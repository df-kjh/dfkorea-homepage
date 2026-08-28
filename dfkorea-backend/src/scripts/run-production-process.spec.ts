import { ChildProcess } from "child_process";
import { EventEmitter } from "events";
import { mkdtempSync, rmSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import {
  getProductionProcessCommand,
  parseProductionProcessArguments,
  runProductionProcess,
} from "./run-production-process";

type SpawnProcess = (
  executable: string,
  arguments_: readonly string[],
  options: {
    cwd: string;
    env: NodeJS.ProcessEnv;
    stdio: "inherit";
  },
) => ChildProcess;

type InjectableProductionRunner = (
  mode: "file" | "ambient",
  action: "start" | "admin:provision" | "migration:run" | "migration:revert",
  workingDirectory: string,
  dependencies: {
    environment: NodeJS.ProcessEnv;
    loadModule?: (modulePath: string) => unknown;
    spawnProcess?: SpawnProcess;
    typeOrmCliPath?: string;
  },
) => Promise<number>;

const runWithDependencies =
  runProductionProcess as unknown as InjectableProductionRunner;

const completeAmbientEnvironment = (): NodeJS.ProcessEnv => ({
  NODE_ENV: "production",
  DB_HOST: "ambient.internal",
  DB_PORT: "5432",
  DB_USERNAME: "ambient-user",
  DB_PASSWORD: "ambient-password",
  DB_NAME: "ambient-database",
  JWT_SECRET: "Ambient-JWT-secret-with-32+Chars!2026",
});

const createChild = (): ChildProcess => {
  const child = new EventEmitter() as ChildProcess;
  child.kill = jest.fn().mockReturnValue(true);
  return child;
};

describe("production process runner", () => {
  it.each([
    ["file", "start"],
    ["ambient", "start"],
    ["file", "migration:run"],
    ["ambient", "migration:run"],
    ["file", "migration:revert"],
    ["ambient", "migration:revert"],
    ["ambient", "admin:provision"],
    ["file", "admin:provision"],
  ] as const)("accepts explicit %s mode for %s", (mode, action) => {
    expect(parseProductionProcessArguments([mode, action])).toEqual({
      mode,
      action,
    });
  });

  it("loads the compiled Nest application in the runner process for PM2 cluster compatibility", () => {
    expect(getProductionProcessCommand("start", "/srv/backend")).toEqual({
      kind: "module",
      modulePath: "/srv/backend/dist/main.js",
    });
  });

  it("runs and reverts only through the compiled TypeORM datasource", () => {
    expect(
      getProductionProcessCommand("migration:run", "/srv/backend", "/cli.js"),
    ).toEqual({
      kind: "child",
      executable: process.execPath,
      arguments: [
        "/cli.js",
        "migration:run",
        "-d",
        "dist/database/typeorm.config.js",
      ],
    });
    expect(
      getProductionProcessCommand(
        "migration:revert",
        "/srv/backend",
        "/cli.js",
      ),
    ).toEqual({
      kind: "child",
      executable: process.execPath,
      arguments: [
        "/cli.js",
        "migration:revert",
        "-d",
        "dist/database/typeorm.config.js",
      ],
    });
  });

  it("runs admin provisioning only through the compiled out-of-band CLI", () => {
    expect(
      getProductionProcessCommand("admin:provision", "/srv/backend"),
    ).toEqual({
      kind: "child",
      executable: process.execPath,
      arguments: ["/srv/backend/dist/scripts/provision-admin.js"],
    });
  });

  it("rejects implicit modes and unknown actions", () => {
    expect(() => parseProductionProcessArguments(["start"])).toThrow(
      "Production process requires an explicit file or ambient mode",
    );
    expect(() =>
      parseProductionProcessArguments(["ambient", "unknown"]),
    ).toThrow("Unsupported production process action");
  });

  it("prepares file environment and calls the actual start branch in-process", async () => {
    const directory = mkdtempSync(join(tmpdir(), "dfkorea-runner-start-"));
    writeFileSync(
      join(directory, ".env.production"),
      [
        "NODE_ENV=production",
        "DB_HOST=file.internal",
        "DB_PORT=6543",
        "DB_USERNAME=file-user",
        "DB_PASSWORD=file-password",
        "DB_NAME=file-database",
        "JWT_SECRET=File-JWT-secret-with-32+Chars!2026",
      ].join("\n"),
    );
    const environment: NodeJS.ProcessEnv = {
      ...completeAmbientEnvironment(),
      JWT_SECRET: "Ambient-JWT-secret-with-32+Chars!2026",
    };
    const loadModule = jest.fn();
    const spawnProcess = jest.fn<ReturnType<SpawnProcess>, Parameters<SpawnProcess>>();

    try {
      await expect(
        runWithDependencies("file", "start", directory, {
          environment,
          loadModule,
          spawnProcess,
        }),
      ).resolves.toBe(0);
      expect(environment).toMatchObject({
        NODE_ENV: "production",
        DB_HOST: "file.internal",
        DB_PORT: "6543",
        DB_USERNAME: "file-user",
        DB_PASSWORD: "file-password",
        DB_NAME: "file-database",
        JWT_SECRET: "File-JWT-secret-with-32+Chars!2026",
      });
      expect(loadModule).toHaveBeenCalledWith(join(directory, "dist", "main.js"));
      expect(spawnProcess).not.toHaveBeenCalled();
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it("spawns the compiled migration with prepared env and propagates its exit", async () => {
    const environment = completeAmbientEnvironment();
    const child = createChild();
    const spawnProcess = jest.fn<
      ReturnType<SpawnProcess>,
      Parameters<SpawnProcess>
    >(() => child);
    const result = runWithDependencies(
      "ambient",
      "migration:run",
      "/srv/backend",
      {
        environment,
        spawnProcess,
        typeOrmCliPath: "/srv/backend/node_modules/typeorm/cli.js",
      },
    );

    expect(spawnProcess).toHaveBeenCalledWith(
      process.execPath,
      [
        "/srv/backend/node_modules/typeorm/cli.js",
        "migration:run",
        "-d",
        "dist/database/typeorm.config.js",
      ],
      {
        cwd: "/srv/backend",
        env: environment,
        stdio: "inherit",
      },
    );
    child.emit("exit", 7);
    await expect(result).resolves.toBe(7);
  });

  it("propagates child start errors without exposing environment values", async () => {
    const environment = completeAmbientEnvironment();
    const child = createChild();
    const spawnProcess = jest.fn<
      ReturnType<SpawnProcess>,
      Parameters<SpawnProcess>
    >(() => child);
    const result = runWithDependencies(
      "ambient",
      "migration:revert",
      "/srv/backend",
      {
        environment,
        spawnProcess,
        typeOrmCliPath: "/srv/backend/node_modules/typeorm/cli.js",
      },
    );

    child.emit("error", new Error("spawn failed"));
    await expect(result).rejects.toThrow(
      "Production process could not start: spawn failed",
    );
    await expect(result).rejects.not.toThrow("ambient-password");
  });
});
