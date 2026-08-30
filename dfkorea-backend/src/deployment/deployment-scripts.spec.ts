import { execFileSync } from "child_process";
import { readFileSync } from "fs";
import { join } from "path";

const backendRoot = join(__dirname, "..", "..");
const archiveMarker =
  "# ARCHIVED / IMPLEMENTATION COMPLETE / NON-OPERATIONAL — 구현 완료·비운영 기록";

const rollbackGateContract = [
  {
    heading: "#### Gate 0 — 변경 창과 책임자 선언",
    markers: ["DECLARE INCIDENT AND CHANGE WINDOW"],
  },
  {
    heading: "#### Gate 1 — ingress와 모든 backend replica 정지",
    markers: [
      "STOP INGRESS",
      "STOP ALL BACKEND REPLICAS, SCHEDULERS, AND API TRAFFIC",
    ],
  },
  {
    heading: "#### Gate 2 — 정지 상태 검증",
    markers: [
      "VERIFY ZERO RUNNING INSTANCES, APPLICATION CONNECTIONS, AND JOBS",
    ],
  },
  {
    heading: "#### Gate 3 — 즉시 백업 및 복구 가능성 검증",
    markers: [
      "CREATE CURRENT-STATE SAFETY BACKUP NOW",
      "CREATE AND VERIFY CURRENT-STATE BACKUP CHECKSUM",
      "RESTORE CURRENT-STATE SAFETY BACKUP IN ISOLATED REHEARSAL TARGET",
      "VALIDATE CURRENT-STATE REHEARSAL SCHEMA, TABLE COUNTS, AND KEY DATA",
      "CLEAN UP CURRENT-STATE REHEARSAL TARGET AND RECORD EVIDENCE",
    ],
  },
  {
    heading: "#### Gate 4 — 복구 방식 하나 선택",
    markers: [
      "SELECT APPROVED PRE-CHANGE RESTORE ARTIFACT",
      "VERIFY PRE-CHANGE ARTIFACT CHECKSUM",
      "RESTORE PRE-CHANGE ARTIFACT IN ISOLATED REHEARSAL TARGET",
      "VALIDATE PRE-CHANGE ARTIFACT AGAINST TARGET CODE, SCHEMA, COUNTS, AND KEY DATA",
      "CLEAN UP PRE-CHANGE REHEARSAL TARGET AND RECORD EVIDENCE",
      "APPROVE EXACTLY ONE RECOVERY METHOD",
    ],
  },
  {
    heading: "#### Gate 5 — 명시적 production env로 DB 작업",
    markers: [
      "EXECUTE APPROVED PRE-CHANGE RESTORE OR ONE-STEP COMPILED REVERT WITH EXPLICIT PRODUCTION ENV",
    ],
  },
  {
    heading: "#### Gate 6 — schema-compatible 코드와 검증",
    markers: [
      "DEPLOY SCHEMA-COMPATIBLE PRIOR CODE",
      "RUN MIGRATION STATUS, SCHEMA, AND HEALTH CHECKS",
    ],
  },
  {
    heading: "#### Gate 7 — backend replica 후 ingress 순서로 재개",
    markers: ["START BACKEND REPLICAS", "REOPEN INGRESS"],
  },
  {
    heading: "#### Gate 8 — 모니터링과 중단 기준",
    markers: ["MONITOR ROLLBACK HEALTH", "ABORT ON DEFINED CRITERIA"],
  },
] as const;

const markerLine = (marker: string): string => `- [필수 작업: ${marker}]`;

const validateRollbackMarkerContract = (deployment: string): void => {
  const rollbackStart = deployment.indexOf("### 롤백");
  if (rollbackStart < 0) {
    throw new Error("Rollback section is missing");
  }
  const rollback = deployment.slice(rollbackStart);
  const headings = rollbackGateContract.map(({ heading }) => heading);
  const headingPositions = headings.map((heading) => rollback.indexOf(heading));
  for (const [index, heading] of headings.entries()) {
    if (rollback.split(heading).length - 1 !== 1) {
      throw new Error(`Gate heading must occur exactly once: ${heading}`);
    }
    if (index > 0 && headingPositions[index] <= headingPositions[index - 1]) {
      throw new Error(`Gate heading is out of order: ${heading}`);
    }
  }

  const expectedLines = rollbackGateContract.flatMap(({ markers }) =>
    markers.map(markerLine),
  );
  const anchoredLines = rollback
    .split(/\r?\n/)
    .filter((line) => /^- \[필수 작업: [^\]\r\n]+\]$/.test(line));
  if (
    anchoredLines.length !== expectedLines.length ||
    anchoredLines.some((line) => !expectedLines.includes(line))
  ) {
    throw new Error("Rollback action markers do not match the exact contract");
  }

  const markerPositions: number[] = [];
  rollbackGateContract.forEach(({ heading, markers }, gateIndex) => {
    const sectionStart = rollback.indexOf(heading);
    const nextHeading = rollbackGateContract[gateIndex + 1]?.heading;
    const sectionEnd = nextHeading
      ? rollback.indexOf(nextHeading)
      : rollback.length;
    const section = rollback.slice(sectionStart, sectionEnd);

    for (const marker of markers) {
      const line = markerLine(marker);
      if (rollback.split(line).length - 1 !== 1) {
        throw new Error(`Marker must occur exactly once: ${line}`);
      }
      if (!section.split(/\r?\n/).includes(line)) {
        throw new Error(`Marker belongs to a different gate: ${line}`);
      }
      markerPositions.push(rollback.indexOf(line));
    }
  });

  if (
    markerPositions.some(
      (position, index) => index > 0 && position <= markerPositions[index - 1],
    )
  ) {
    throw new Error("Rollback action markers are out of order");
  }
};

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
    expect(packageJson.scripts["admin:provision:prod"]).toBe(
      "node dist/scripts/run-production-process.js ambient admin:provision",
    );
    expect(packageJson.scripts["admin:provision:prod:env"]).toBe(
      "node dist/scripts/run-production-process.js file admin:provision",
    );
    expect(packageJson.scripts["test:production-process:compiled"]).toBe(
      "node test/production-process-compiled-probe.js",
    );
    const compiledProbe = readFileSync(
      join(backendRoot, "test", "production-process-compiled-probe.js"),
      "utf8",
    );
    expect(compiledProbe).toContain('"dist"');
    expect(compiledProbe).toContain('"run-production-process.js"');
    expect(appModule).toMatch(
      /ignoreEnvFile:\s*process\.env\.NODE_ENV === ["']production["']/,
    );
    expect(dockerfile).toContain("RUN npm run build");
    expect(dockerfile).toContain("COPY --from=builder /app/dist ./dist");
    expect(deployment).toContain("cd dfkorea-backend");
    expect(deployment).toContain("npm run migration:revert:prod:env");
    expect(deployment).not.toMatch(/npm run migration:revert(?!:prod)/);
  });

  it("runs the canonical backend CI checks before a fresh compiled probe", () => {
    const packageJson = JSON.parse(
      readFileSync(join(backendRoot, "package.json"), "utf8"),
    ) as { scripts: Record<string, string> };
    const ciSteps = packageJson.scripts["test:ci"]?.split(" && ");

    expect(ciSteps).toEqual([
      "npm run lint:check",
      "npm test -- --runInBand",
      "npm run test:tender:contract",
      "npx tsc --noEmit",
      "npm run clean:dist",
      "npm run build",
      "npm run test:production-process:compiled",
      "npm run test:typeorm:compiled",
    ]);
    expect(packageJson.scripts["test:ci"]).not.toContain("npm run test:ci");
    expect(packageJson.scripts["clean:dist"]).toBe(
      "node test/clean-dist.js",
    );
    expect(packageJson.scripts["test:typeorm:compiled"]).toBe(
      "node test/typeorm-compiled-discovery.js",
    );
  });

  it("documents a quiesced, freshly backed-up rollback in strict gate order", () => {
    const repositoryRoot = join(backendRoot, "..");
    const deployment = readFileSync(
      join(repositoryRoot, "DEPLOYMENT.md"),
      "utf8",
    );
    const rollback = deployment.slice(deployment.indexOf("### 롤백"));

    expect(() => validateRollbackMarkerContract(deployment)).not.toThrow();
    expect(rollback).toContain(
      "구독 비활성화나 자격 증명 제거는 replica 정지를 대체하지 않는다",
    );
    expect(rollback).toContain("current-state safety backup");
    expect(rollback).toContain("approved pre-change artifact");
    expect(rollback).toContain(
      "current-state safety backup은 intended rollback artifact가 아니다",
    );
    expect(rollback).toContain(
      "restore branch는 approved pre-change artifact를 사용한다",
    );
    expect(rollback).toContain(
      "revert branch는 current DB에 compiled migration down을 한 단계만 적용한다",
    );
    expect(rollback).toContain("backup archive listing만으로는 충분하지 않다");
    expect(rollback).toContain("listing은 supplemental evidence일 뿐이다");
    expect(rollback).toContain("npm run migration:revert:prod:env");
    expect(rollback).not.toContain("npm run migration:revert:prod\n");
  });

  it("rejects duplicate, moved, and negated rollback markers", () => {
    const validFixture = [
      "### 롤백",
      ...rollbackGateContract.flatMap(({ heading, markers }) => [
        heading,
        ...markers.map(markerLine),
      ]),
    ].join("\n");
    expect(() => validateRollbackMarkerContract(validFixture)).not.toThrow();

    const duplicate = validFixture.replace(
      markerLine("STOP INGRESS"),
      `${markerLine("STOP INGRESS")}\n${markerLine("STOP INGRESS")}`,
    );
    expect(() => validateRollbackMarkerContract(duplicate)).toThrow(
      "Rollback action markers do not match the exact contract",
    );

    const movedLine = markerLine(
      "CREATE AND VERIFY CURRENT-STATE BACKUP CHECKSUM",
    );
    const moved = validFixture
      .replace(`${movedLine}\n`, "")
      .replace(
        "#### Gate 2 — 정지 상태 검증",
        `#### Gate 2 — 정지 상태 검증\n${movedLine}`,
      );
    expect(() => validateRollbackMarkerContract(moved)).toThrow(
      "Marker belongs to a different gate",
    );

    const negated = validFixture.replace(
      markerLine("REOPEN INGRESS"),
      "- [필수 작업 아님: REOPEN INGRESS]",
    );
    expect(() => validateRollbackMarkerContract(negated)).toThrow(
      "Rollback action markers do not match the exact contract",
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
    const railwayConfig = JSON.parse(
      readFileSync(join(backendRoot, "railway.json"), "utf8"),
    ) as {
      deploy: {
        preDeployCommand?: string[];
        startCommand: string;
      };
    };

    expect(script).toMatch(/^#!\/bin\/sh\nset -e/m);
    expect(script).toContain("npm run migration:run:prod");
    expect(script).not.toMatch(/migration:run:prod\s*\|\|/);
    expect(railwayConfig.deploy.startCommand).toBe(
      "sh -c 'npm run migration:run:prod && exec npm run start:prod'",
    );
    expect(railwayConfig.deploy.startCommand).not.toMatch(
      /migration:run:prod\s*\|\|/,
    );
    expect(railwayConfig.deploy.preDeployCommand).toBeUndefined();
  });
});
