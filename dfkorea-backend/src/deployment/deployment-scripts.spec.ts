import { execFileSync } from "child_process";
import { readFileSync } from "fs";
import { join } from "path";

const backendRoot = join(__dirname, "..", "..");
const archiveMarker =
  "# ARCHIVED / IMPLEMENTATION COMPLETE / NON-OPERATIONAL — 구현 완료·비운영 기록";

describe("deployment migration commands", () => {
  it("keeps primary deployment paths PostgreSQL-only and migration-first", () => {
    const repositoryRoot = join(backendRoot, "..");
    const deployment = readFileSync(
      join(repositoryRoot, "DEPLOYMENT.md"),
      "utf8",
    );
    const compose = readFileSync(
      join(backendRoot, "..", "docker-compose.yml"),
      "utf8",
    );
    const appModule = readFileSync(
      join(backendRoot, "src", "app.module.ts"),
      "utf8",
    );
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
    const excludedDocs = [...auditExclusions.entries()].map(
      ([path, reason]) => {
        const content = readFileSync(join(repositoryRoot, path), "utf8");
        return { path, reason, content };
      },
    );

    expect(activeGuidePaths.sort()).toEqual(expectedCanonicalGuides.sort());
    for (const { path, reason, content } of excludedDocs) {
      expect(reason).toBeTruthy();
      expect(trackedMarkdown).toContain(path);
      expect(content).not.toMatch(
        /npm run start:prod|npm run migration:run|^#{1,4}.*배포/im,
      );
      if (path.includes("docs/superpowers/plans/")) {
        expect(content.startsWith(archiveMarker)).toBe(true);
        expect(content).toContain(
          "Do not execute or follow any command, code block, checkbox, or checklist below.",
        );
        expect(content).toContain("../../../DEPLOYMENT.md");
        expect(content).toContain("../../../database-schema.md");
        expect(content).toContain("../../menus/tenders.md");
        expect(content).not.toContain("Perform a staging smoke test");
        expect(content).not.toContain("truncate only the six tender tables");
        expect(content).not.toContain("DB_PATH");
        expect(content).not.toContain("DATA_DIR");
        expect(content).not.toContain("database.json");
        expect(content).not.toMatch(/SQLite/i);
        expect(content).not.toMatch(/(?:TYPEORM_)?SYNCHRONIZE\s*[:=]\s*true/i);
        expect(content).not.toMatch(
          /^#{1,4}.*(?:Deployment|배포|Staging|스테이징)/im,
        );
        expect(content).not.toMatch(/npm run migration:(?:run|revert)/);
        expect(content).not.toMatch(/npm run start:prod/);
      }
    }

    for (const { content } of auditableDocs) {
      expect(content).not.toContain("DB_PATH");
      expect(content).not.toContain("DATA_DIR");
      expect(content).not.toContain("database.json");
      expect(content).not.toMatch(/SQLite/i);
      expect(content).not.toMatch(/(?:TYPEORM_)?SYNCHRONIZE\s*[:=]\s*true/i);
      expect(content).not.toMatch(/npm run migration:run(?!:prod)/);
      expect(content).not.toMatch(/npm run migration:revert(?!:prod)/);
      expect(content).not.toMatch(
        /(?:첫 배포 후|배포 (?:완료|성공))[\s\S]{0,200}(?:railway run )?npm run migration:run/i,
      );
      expect(content).not.toMatch(
        /npm run start:prod[^\n]*(?:&&|;)[^\n]*npm run migration:run:prod/i,
      );
      for (const line of content
        .split("\n")
        .filter((candidate) => candidate.includes("npm run start:prod"))) {
        expect(line).toMatch(
          /npm run migration:run:prod(?::env)? && npm run start:prod/,
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
      expect(content).not.toMatch(
        /^(?!.*migration:run:prod).*npm run start:prod/m,
      );
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

  it("uses only the compiled TypeORM rollback command in operations", () => {
    const repositoryRoot = join(backendRoot, "..");
    const packageJson = JSON.parse(
      readFileSync(join(backendRoot, "package.json"), "utf8"),
    ) as { scripts: Record<string, string> };
    const deployment = readFileSync(
      join(repositoryRoot, "DEPLOYMENT.md"),
      "utf8",
    );
    const dockerfile = readFileSync(join(backendRoot, "Dockerfile"), "utf8");
    const appModule = readFileSync(
      join(backendRoot, "src", "app.module.ts"),
      "utf8",
    );

    expect(packageJson.scripts["start:prod"]).toBe(
      "node dist/scripts/run-production-process.js ambient start",
    );
    expect(packageJson.scripts["start:prod:env"]).toBe(
      "node dist/scripts/run-production-process.js file start",
    );
    expect(packageJson.scripts["migration:revert:prod"]).toBe(
      "node dist/scripts/run-production-process.js ambient migration:revert",
    );
    expect(packageJson.scripts["migration:run:prod"]).toBe(
      "node dist/scripts/run-production-process.js ambient migration:run",
    );
    expect(packageJson.scripts["migration:run:prod:env"]).toBe(
      "node dist/scripts/run-production-process.js file migration:run",
    );
    expect(packageJson.scripts["migration:revert:prod:env"]).toBe(
      "node dist/scripts/run-production-process.js file migration:revert",
    );
    expect(appModule).toMatch(
      /ignoreEnvFile:\s*process\.env\.NODE_ENV === ["']production["']/,
    );
    expect(dockerfile).toContain("RUN npm run build");
    expect(dockerfile).toContain("COPY --from=builder /app/dist ./dist");
    expect(deployment).toContain("cd dfkorea-backend");
    expect(deployment).toContain("npm run migration:revert:prod:env");
    expect(deployment).not.toMatch(/npm run migration:revert(?!:prod)/);
  });

  it("documents a quiesced, freshly backed-up rollback in strict gate order", () => {
    const repositoryRoot = join(backendRoot, "..");
    const deployment = readFileSync(
      join(repositoryRoot, "DEPLOYMENT.md"),
      "utf8",
    );
    const rollback = deployment.slice(deployment.indexOf("### 롤백"));
    const orderedGates = [
      "#### Gate 0 — 변경 창과 책임자 선언",
      "#### Gate 1 — ingress와 모든 backend replica 정지",
      "#### Gate 2 — 정지 상태 검증",
      "#### Gate 3 — 즉시 백업 및 복구 가능성 검증",
      "#### Gate 4 — 복구 방식 하나 선택",
      "#### Gate 5 — 명시적 production env로 DB 작업",
      "#### Gate 6 — schema-compatible 코드와 검증",
      "#### Gate 7 — backend replica 후 ingress 순서로 재개",
      "#### Gate 8 — 모니터링과 중단 기준",
    ];

    const gateSections = orderedGates.map((gate, index) => {
      const start = rollback.indexOf(gate);
      const next = orderedGates[index + 1];
      const end = next ? rollback.indexOf(next) : rollback.length;
      return rollback.slice(start, end);
    });

    expect(rollback).not.toBe("");
    const gatePositions = orderedGates.map((gate) => rollback.indexOf(gate));
    expect(gatePositions.every((position) => position >= 0)).toBe(true);
    expect(gatePositions).toEqual([...gatePositions].sort((a, b) => a - b));

    expect(gateSections[0]).toContain(
      "ACTION: DECLARE INCIDENT AND CHANGE WINDOW",
    );
    expect(gateSections[1]).toContain("ACTION: STOP INGRESS");
    expect(gateSections[1]).toContain(
      "ACTION: STOP ALL BACKEND REPLICAS, SCHEDULERS, AND API TRAFFIC",
    );
    expect(gateSections[1]).toContain(
      "구독 비활성화나 자격 증명 제거는 replica 정지를 대체하지 않는다",
    );
    expect(gateSections[2]).toContain(
      "ACTION: VERIFY ZERO RUNNING INSTANCES, APPLICATION CONNECTIONS, AND JOBS",
    );
    expect(gateSections[3]).toContain(
      "ACTION: CREATE FRESH TIMESTAMPED POSTGRESQL BACKUP NOW",
    );
    expect(gateSections[3]).toContain(
      "ACTION: CREATE AND VERIFY BACKUP CHECKSUM",
    );
    expect(gateSections[3]).toContain(
      "ACTION: RESTORE FRESH BACKUP INTO ISOLATED TEMPORARY DATABASE",
    );
    expect(gateSections[3]).toContain(
      "ACTION: VALIDATE RESTORED SCHEMA, TABLE COUNTS, AND KEY DATA",
    );
    expect(gateSections[3]).toContain(
      "ACTION: CLEAN UP ISOLATED RESTORE TARGET AND RECORD EVIDENCE",
    );
    expect(gateSections[3]).toContain(
      "backup archive listing만으로는 충분하지 않다",
    );
    expect(gateSections[3]).toContain(
      "listing은 supplemental evidence일 뿐이다",
    );
    expect(gateSections[4]).toContain(
      "ACTION: APPROVE EXACTLY ONE RECOVERY METHOD",
    );
    expect(gateSections[5]).toContain(
      "ACTION: EXECUTE APPROVED RESTORE OR ONE-STEP COMPILED REVERT WITH EXPLICIT PRODUCTION ENV",
    );
    expect(gateSections[5]).toContain("npm run migration:revert:prod:env");
    expect(rollback).not.toContain("npm run migration:revert:prod\n");
    expect(gateSections[6]).toContain(
      "ACTION: DEPLOY SCHEMA-COMPATIBLE PRIOR CODE",
    );
    expect(gateSections[6]).toContain(
      "ACTION: RUN MIGRATION STATUS, SCHEMA, AND HEALTH CHECKS",
    );
    expect(gateSections[7]).toContain("ACTION: START BACKEND REPLICAS");
    expect(gateSections[7]).toContain("ACTION: REOPEN INGRESS");
    expect(gateSections[8]).toContain("ACTION: MONITOR ROLLBACK HEALTH");
    expect(gateSections[8]).toContain("ACTION: ABORT ON DEFINED CRITERIA");

    const orderedActions = [
      "ACTION: DECLARE INCIDENT AND CHANGE WINDOW",
      "ACTION: STOP INGRESS",
      "ACTION: STOP ALL BACKEND REPLICAS, SCHEDULERS, AND API TRAFFIC",
      "ACTION: VERIFY ZERO RUNNING INSTANCES, APPLICATION CONNECTIONS, AND JOBS",
      "ACTION: CREATE FRESH TIMESTAMPED POSTGRESQL BACKUP NOW",
      "ACTION: CREATE AND VERIFY BACKUP CHECKSUM",
      "ACTION: RESTORE FRESH BACKUP INTO ISOLATED TEMPORARY DATABASE",
      "ACTION: VALIDATE RESTORED SCHEMA, TABLE COUNTS, AND KEY DATA",
      "ACTION: CLEAN UP ISOLATED RESTORE TARGET AND RECORD EVIDENCE",
      "ACTION: APPROVE EXACTLY ONE RECOVERY METHOD",
      "ACTION: EXECUTE APPROVED RESTORE OR ONE-STEP COMPILED REVERT WITH EXPLICIT PRODUCTION ENV",
      "ACTION: DEPLOY SCHEMA-COMPATIBLE PRIOR CODE",
      "ACTION: RUN MIGRATION STATUS, SCHEMA, AND HEALTH CHECKS",
      "ACTION: START BACKEND REPLICAS",
      "ACTION: REOPEN INGRESS",
      "ACTION: MONITOR ROLLBACK HEALTH",
      "ACTION: ABORT ON DEFINED CRITERIA",
    ];
    const actionPositions = orderedActions.map((action) =>
      rollback.indexOf(action),
    );
    expect(actionPositions.every((position) => position >= 0)).toBe(true);
    expect(actionPositions).toEqual(
      [...actionPositions].sort((a, b) => a - b),
    );
  });

  it("preserves the AI feature guide without making it deployment authority", () => {
    const aiGuide = readFileSync(
      join(backendRoot, "AI_AUTO_BLOG_GUIDE.md"),
      "utf8",
    );
    const quickstart = readFileSync(
      join(backendRoot, "AI_QUICKSTART.md"),
      "utf8",
    );

    expect(aiGuide).toContain("AI 자동 블로그 기능 가이드");
    expect(aiGuide).toContain("POST /api/scheduler/trigger");
    expect(aiGuide).toContain(
      "POST /api/scheduler/trigger/product-company-news",
    );
    expect(aiGuide).toContain("GEMINI_API_KEY");
    expect(aiGuide).toContain("CRON_TIMEZONE");
    expect(aiGuide).toContain("DEPLOYMENT.md");
    expect(aiGuide).not.toContain("DEPRECATED");
    expect(quickstart).toContain("AI_AUTO_BLOG_GUIDE.md");
    expect(quickstart).toContain("기능 가이드");
    expect(quickstart).toContain("DEPLOYMENT.md");
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
    const railwayConfig = readFileSync(
      join(backendRoot, "railway.json"),
      "utf8",
    );

    expect(script).toMatch(/^#!\/bin\/sh\nset -e/m);
    expect(script).toContain("npm run migration:run:prod");
    expect(script).not.toMatch(/migration:run:prod\s*\|\|/);
    expect(railwayConfig).toContain(
      "npm run migration:run:prod && npm run start:prod",
    );
    expect(railwayConfig).not.toMatch(/migration:run:prod\s*\|\|/);
  });
});
