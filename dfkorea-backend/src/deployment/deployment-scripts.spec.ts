import { execFileSync } from "child_process";
import { readFileSync } from "fs";
import { join } from "path";

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
    const auditExclusions = new Map([
      [
        "led-lighting-website/public/images/clients/README.md",
        "asset attribution and image replacement instructions only",
      ],
      [
        "docs/superpowers/plans/2026-08-27-led-tender-notification.md",
        "historical implementation plan, not an operational runbook",
      ],
      [
        "docs/superpowers/specs/2026-08-27-led-tender-notification-design.md",
        "historical design specification, not an operational runbook",
      ],
    ]);
    const auditableDocs = trackedMarkdown
      .filter((path) => !auditExclusions.has(path))
      .map((path) => ({
        path,
        content: readFileSync(join(repositoryRoot, path), "utf8"),
      }));
    const actionableRuntimePattern =
      /npm run (?:start(?::(?:dev|prod))?|migration:run)|database\.json|(?:TYPEORM_)?SYNCHRONIZE\s*[:=]\s*true|^#{1,4}.*(?:배포|Railway)/im;
    const activeGuides = auditableDocs.filter(({ content }) =>
      actionableRuntimePattern.test(content),
    );
    const activeGuidePaths = activeGuides.map(({ path }) => path);
    const expectedCanonicalGuides = [
      "DEPLOYMENT.md",
      "RAILWAY_DEPLOYMENT_GUIDE.md",
      "RAILWAY_QUICKSTART.md",
      "RAILWAY_STORAGE_SOLUTION.md",
      "dfkorea-backend/AI_AUTO_BLOG_GUIDE.md",
      "dfkorea-backend/AI_IMPLEMENTATION_SUMMARY.md",
      "dfkorea-backend/AI_QUICKSTART.md",
      "dfkorea-backend/AUTO_INIT_GUIDE.md",
      "dfkorea-backend/CONNECTION_FIXED.md",
      "dfkorea-backend/CORS_SETUP.md",
      "dfkorea-backend/DATABASE_MIGRATION_SUMMARY.md",
      "dfkorea-backend/IMAGE_OPTIMIZATION.md",
      "dfkorea-backend/LOCAL_RAILWAY_DB_SETUP.md",
      "dfkorea-backend/POSTGRESQL_MIGRATION_GUIDE.md",
      "dfkorea-backend/QUICKSTART.md",
      "dfkorea-backend/R2_QUICKSTART.md",
      "dfkorea-backend/RAILWAY_DEPLOYMENT.md",
      "dfkorea-backend/RAILWAY_ENV_SETUP.md",
      "dfkorea-backend/README.md",
      "led-lighting-website/README.md",
      "led-lighting-website/VERCEL_SETUP.md",
    ];
    const excludedDocs = [...auditExclusions.entries()].map(([path, reason]) => {
      const content = readFileSync(join(repositoryRoot, path), "utf8");
      return { path, reason, content };
    });

    expect(activeGuidePaths.sort()).toEqual(expectedCanonicalGuides.sort());
    for (const { path, reason, content } of excludedDocs) {
      expect(reason).toBeTruthy();
      expect(trackedMarkdown).toContain(path);
      expect(content).not.toMatch(
        /npm run start:prod|npm run migration:run|^#{1,4}.*배포/im,
      );
    }

    for (const { content } of auditableDocs) {
      expect(content).not.toContain("DB_PATH");
      expect(content).not.toContain("DATA_DIR");
      expect(content).not.toContain("database.json");
      expect(content).not.toMatch(/SQLite/i);
      expect(content).not.toMatch(/(?:TYPEORM_)?SYNCHRONIZE\s*[:=]\s*true/i);
      expect(content).not.toMatch(/npm run migration:run(?!:prod)/);
      expect(content).not.toMatch(
        /(?:첫 배포 후|배포 (?:완료|성공))[\s\S]{0,200}(?:railway run )?npm run migration:run/i,
      );
      expect(content).not.toMatch(
        /npm run start:prod[^\n]*(?:&&|;)[^\n]*npm run migration:run:prod/i,
      );
      for (const line of content
        .split("\n")
        .filter((candidate) => candidate.includes("npm run start:prod"))) {
        expect(line).toContain(
          "npm run migration:run:prod && npm run start:prod",
        );
      }
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
