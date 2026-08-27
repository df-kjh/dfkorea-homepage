import {
  getProductionProcessCommand,
  parseProductionProcessArguments,
} from "./run-production-process";

describe("production process runner", () => {
  it.each([
    ["file", "start"],
    ["ambient", "start"],
    ["file", "migration:run"],
    ["ambient", "migration:run"],
    ["file", "migration:revert"],
    ["ambient", "migration:revert"],
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

  it("rejects implicit modes and unknown actions", () => {
    expect(() => parseProductionProcessArguments(["start"])).toThrow(
      "Production process requires an explicit file or ambient mode",
    );
    expect(() =>
      parseProductionProcessArguments(["ambient", "unknown"]),
    ).toThrow("Unsupported production process action");
  });
});
