import { readFileSync } from "fs";
import { join } from "path";

const backendRoot = join(__dirname, "..", "..");

describe("deployment migration commands", () => {
  it("keeps primary deployment paths PostgreSQL-only and migration-first", () => {
    const repositoryRoot = join(backendRoot, "..");
    const deployment = readFileSync(join(repositoryRoot, "DEPLOYMENT.md"), "utf8");
    const compose = readFileSync(join(backendRoot, "..", "docker-compose.yml"), "utf8");
    const readme = readFileSync(join(backendRoot, "README.md"), "utf8");
    const appModule = readFileSync(join(backendRoot, "src", "app.module.ts"), "utf8");
    const activeGuides = [
      join(repositoryRoot, "RAILWAY_DEPLOYMENT_GUIDE.md"),
      join(repositoryRoot, "RAILWAY_QUICKSTART.md"),
      join(backendRoot, "RAILWAY_DEPLOYMENT.md"),
    ].map((path) => readFileSync(path, "utf8"));

    for (const content of [deployment, compose, readme, ...activeGuides]) {
      expect(content).not.toContain("DB_PATH");
      expect(content).not.toContain("DATA_DIR");
      expect(content).not.toContain("database.json");
      expect(content).not.toMatch(/SQLite/i);
      expect(content).not.toMatch(/(?:TYPEORM_)?SYNCHRONIZE\s*[:=]\s*true/i);
      expect(content).not.toMatch(/npm run migration:run(?!:prod)/);
      expect(content).not.toMatch(/^(?!.*migration:run:prod).*npm run start:prod/m);
    }
    expect(deployment).not.toMatch(/(?:^|\n)npm run start:prod(?:\n|$)/);
    expect(readme).toContain(
      "npm run migration:run:prod && npm run start:prod",
    );
    expect(appModule).not.toContain("처음 배포: true");
    expect(appModule).toContain("production databases are migration-only");
    for (const guide of activeGuides) {
      expect(guide).toContain("DEPLOYMENT.md");
      expect(guide).toContain(
        "npm run migration:run:prod && npm run start:prod",
      );
      expect(guide).not.toMatch(/배포 (?:완료|성공)[\s\S]{0,200}migration/i);
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
