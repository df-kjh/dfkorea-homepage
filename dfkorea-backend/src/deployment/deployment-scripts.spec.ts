import { readFileSync } from "fs";
import { join } from "path";

const backendRoot = join(__dirname, "..", "..");

describe("deployment migration commands", () => {
  it("keeps primary deployment paths PostgreSQL-only and migration-first", () => {
    const deployment = readFileSync(join(backendRoot, "..", "DEPLOYMENT.md"), "utf8");
    const compose = readFileSync(join(backendRoot, "..", "docker-compose.yml"), "utf8");
    const readme = readFileSync(join(backendRoot, "README.md"), "utf8");

    for (const content of [deployment, compose, readme]) {
      expect(content).not.toContain("DB_PATH");
      expect(content).not.toContain("database.json");
    }
    expect(deployment).not.toMatch(/(?:^|\n)npm run start:prod(?:\n|$)/);
    expect(readme).toContain(
      "npm run migration:run:prod && npm run start:prod",
    );
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
