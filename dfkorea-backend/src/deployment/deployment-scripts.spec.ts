import { execFileSync } from "child_process";
import { readFileSync } from "fs";
import { basename, join } from "path";

const backendRoot = join(__dirname, "..", "..");

describe("deployment migration commands", () => {
  it("keeps primary deployment paths PostgreSQL-only and migration-first", () => {
    const repositoryRoot = join(backendRoot, "..");
    const deployment = readFileSync(join(repositoryRoot, "DEPLOYMENT.md"), "utf8");
    const compose = readFileSync(join(backendRoot, "..", "docker-compose.yml"), "utf8");
    const appModule = readFileSync(join(backendRoot, "src", "app.module.ts"), "utf8");
    const trackedMarkdown = execFileSync("git", ["ls-files", "*.md"], {
      cwd: repositoryRoot,
      encoding: "utf8",
    })
      .trim()
      .split("\n")
      .filter(Boolean);
    const nonDeploymentReadmes = new Map([
      [
        "led-lighting-website/public/images/clients/README.md",
        "asset attribution and image replacement instructions only",
      ],
    ]);
    const activeGuidePaths = trackedMarkdown.filter((path) => {
      const filename = basename(path).toUpperCase();
      const relevantName =
        filename === "README.MD" ||
        filename.includes("DEPLOY") ||
        filename.includes("QUICKSTART") ||
        filename.endsWith("MIGRATION_GUIDE.MD");
      return relevantName && !nonDeploymentReadmes.has(path);
    });
    const expectedCanonicalGuides = [
      "DEPLOYMENT.md",
      "RAILWAY_DEPLOYMENT_GUIDE.md",
      "RAILWAY_QUICKSTART.md",
      "dfkorea-backend/AI_QUICKSTART.md",
      "dfkorea-backend/POSTGRESQL_MIGRATION_GUIDE.md",
      "dfkorea-backend/QUICKSTART.md",
      "dfkorea-backend/R2_QUICKSTART.md",
      "dfkorea-backend/RAILWAY_DEPLOYMENT.md",
      "dfkorea-backend/README.md",
      "led-lighting-website/README.md",
    ];
    const activeGuides = activeGuidePaths.map((path) => ({
      path,
      content: readFileSync(join(repositoryRoot, path), "utf8"),
    }));

    expect(activeGuidePaths).toEqual(
      expect.arrayContaining(expectedCanonicalGuides),
    );
    expect([...nonDeploymentReadmes.entries()]).toEqual([
      [
        "led-lighting-website/public/images/clients/README.md",
        "asset attribution and image replacement instructions only",
      ],
    ]);

    for (const { content } of activeGuides) {
      expect(content).not.toContain("DB_PATH");
      expect(content).not.toContain("DATA_DIR");
      expect(content).not.toContain("database.json");
      expect(content).not.toMatch(/SQLite/i);
      expect(content).not.toMatch(/(?:TYPEORM_)?SYNCHRONIZE\s*[:=]\s*true/i);
      expect(content).not.toMatch(/npm run migration:run(?!:prod)/);
      expect(content).not.toMatch(/^(?!.*migration:run:prod).*npm run start:prod/m);
      expect(content).not.toMatch(
        /(?:첫 배포 후|배포 (?:완료|성공))[\s\S]{0,200}(?:railway run )?npm run migration:run/i,
      );
    }
    for (const content of [deployment, compose]) {
      expect(content).not.toContain("DB_PATH");
      expect(content).not.toContain("DATA_DIR");
      expect(content).not.toContain("database.json");
      expect(content).not.toMatch(/SQLite/i);
      expect(content).not.toMatch(/(?:TYPEORM_)?SYNCHRONIZE\s*[:=]\s*true/i);
      expect(content).not.toMatch(/npm run migration:run(?!:prod)/);
      expect(content).not.toMatch(/^(?!.*migration:run:prod).*npm run start:prod/m);
    }
    expect(deployment).not.toMatch(/(?:^|\n)npm run start:prod(?:\n|$)/);
    expect(appModule).not.toContain("처음 배포: true");
    expect(appModule).toContain("production databases are migration-only");
    for (const guide of activeGuides) {
      if (guide.path !== "DEPLOYMENT.md") {
        expect(guide.content).toContain("DEPLOYMENT.md");
      }
      expect(guide.content).toContain(
        "npm run migration:run:prod && npm run start:prod",
      );
    }
  });

  it("fails the container start when a production migration fails", () => {
    const dockerfile = readFileSync(join(backendRoot, "Dockerfile"), "utf8");

    expect(dockerfile).toContain(
      "npm run migration:run:prod && npm run start:prod",
    );
    expect(dockerfile).not.toContain("migration:run:prod || true");
  });

  it("fails the Railway build step when a production migration fails", () => {
    const script = readFileSync(join(backendRoot, "railway-build.sh"), "utf8");
    const railwayConfig = readFileSync(join(backendRoot, "railway.json"), "utf8");

    expect(script).toMatch(/^#!\/bin\/sh\nset -e/m);
    expect(script).toContain("npm run migration:run:prod");
    expect(script).not.toMatch(/migration:run:prod\s*\|\|/);
    expect(railwayConfig).toContain(
      "npm run migration:run:prod && npm run start:prod",
    );
    expect(railwayConfig).not.toMatch(/migration:run:prod\s*\|\|/);
  });
});
