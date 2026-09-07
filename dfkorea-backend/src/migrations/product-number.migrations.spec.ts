import { randomUUID } from "node:crypto";
import { DataSource } from "typeorm";
import { ChangeProductFieldsToNumber1738027500000 } from "./1738027500000-ChangeProductFieldsToNumber";

const compactSql = (sql: string) => sql.replace(/\s+/g, " ").trim();

describe("ChangeProductFieldsToNumber1738027500000 SQL contract", () => {
  it("casts arrays directly without a forbidden transform-expression subquery", async () => {
    const runner = { query: jest.fn().mockResolvedValue([]) };
    const migration = new ChangeProductFieldsToNumber1738027500000();

    await migration.up(runner as never);
    await migration.down(runner as never);

    const statements = runner.query.mock.calls.map(([sql]) => compactSql(sql));
    expect(statements).toEqual(
      expect.arrayContaining([
        'ALTER TABLE "products" ALTER COLUMN "power" TYPE numeric[] USING "power"::numeric[]',
        'ALTER TABLE "products" ALTER COLUMN "colorTemp" TYPE numeric[] USING "colorTemp"::numeric[]',
        'ALTER TABLE "products" ALTER COLUMN "power" TYPE text[] USING "power"::text[]',
        'ALTER TABLE "products" ALTER COLUMN "colorTemp" TYPE text[] USING "colorTemp"::text[]',
      ]),
    );
    expect(statements.join("\n")).not.toMatch(/ARRAY\s*\(\s*SELECT/i);
    expect(statements).toContain(
      'ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "luminanceEfficiency" character varying',
    );
    expect(statements).toEqual(
      expect.arrayContaining([
        'ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "powerFactor" character varying',
        'ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "colorRendering" character varying',
        'ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "options" text[] NOT NULL DEFAULT ARRAY[]::text[]',
      ]),
    );
    expect(statements).toContain(
      'ALTER TABLE "products" ALTER COLUMN "luminanceEfficiency" TYPE character varying USING "luminanceEfficiency"::character varying',
    );
  });
});

const databaseUrl = process.env.TASK7_TEST_DATABASE_URL;
const postgres = databaseUrl ? describe : describe.skip;

postgres("ChangeProductFieldsToNumber1738027500000 PostgreSQL", () => {
  let db: DataSource;
  const schema = `product_number_${randomUUID().replace(/-/g, "")}`;

  beforeAll(async () => {
    const url = new URL(databaseUrl!);
    if (
      !["localhost", "127.0.0.1"].includes(url.hostname) ||
      !url.pathname.endsWith("_test")
    ) {
      throw new Error("Dedicated local *_test DB required");
    }
    db = await new DataSource({
      type: "postgres",
      url: databaseUrl,
    }).initialize();
    await db.query(`CREATE SCHEMA "${schema}"`);
  });

  afterAll(async () => {
    if (db?.isInitialized) {
      await db.query(`DROP SCHEMA "${schema}" CASCADE`);
      await db.destroy();
    }
  });

  it("converts populated text arrays to numeric arrays and reverses them on PostgreSQL 16", async () => {
    const runner = db.createQueryRunner();
    await runner.connect();
    await runner.startTransaction();
    try {
      await runner.query(`SET LOCAL search_path TO "${schema}", public`);
      await runner.query(`
        CREATE TABLE "products" (
          "power" text[] NOT NULL DEFAULT ARRAY[]::text[],
          "lifespan" varchar NOT NULL,
          "colorTemp" text[] NOT NULL DEFAULT ARRAY[]::text[],
          "luminanceEfficiency" varchar
        )
      `);
      await runner.query(
        'INSERT INTO "products" ("power", "lifespan", "colorTemp", "luminanceEfficiency") VALUES ($1,$2,$3,$4), ($5,$6,$7,$8)',
        [
          ["12.5", null, "40"],
          "50000",
          ["3000", "4000"],
          "125.75",
          [],
          "0",
          [],
          "",
        ],
      );

      const migration = new ChangeProductFieldsToNumber1738027500000();
      await migration.up(runner);
      expect(
        await runner.query(
          'SELECT "power"::text, "lifespan"::text, "colorTemp"::text, "luminanceEfficiency"::text FROM "products" ORDER BY "lifespan" DESC',
        ),
      ).toEqual([
        {
          power: "{12.5,NULL,40}",
          lifespan: "50000",
          colorTemp: "{3000,4000}",
          luminanceEfficiency: "125.75",
        },
        {
          power: "{}",
          lifespan: "0",
          colorTemp: "{}",
          luminanceEfficiency: null,
        },
      ]);
      expect(
        await runner.query(
          `SELECT column_name, udt_name, column_default, is_nullable FROM information_schema.columns WHERE table_schema=$1 AND table_name='products' ORDER BY column_name`,
          [schema],
        ),
      ).toEqual([
        {
          column_name: "colorRendering",
          udt_name: "varchar",
          column_default: null,
          is_nullable: "YES",
        },
        {
          column_name: "colorTemp",
          udt_name: "_numeric",
          column_default: "ARRAY[]::numeric[]",
          is_nullable: "NO",
        },
        {
          column_name: "lifespan",
          udt_name: "numeric",
          column_default: null,
          is_nullable: "NO",
        },
        {
          column_name: "luminanceEfficiency",
          udt_name: "numeric",
          column_default: null,
          is_nullable: "YES",
        },
        {
          column_name: "options",
          udt_name: "_text",
          column_default: "ARRAY[]::text[]",
          is_nullable: "NO",
        },
        {
          column_name: "power",
          udt_name: "_numeric",
          column_default: "ARRAY[]::numeric[]",
          is_nullable: "NO",
        },
        {
          column_name: "powerFactor",
          udt_name: "varchar",
          column_default: null,
          is_nullable: "YES",
        },
      ]);

      await migration.down(runner);
      expect(
        await runner.query(
          `SELECT column_name, udt_name, column_default, is_nullable FROM information_schema.columns WHERE table_schema=$1 AND table_name='products' ORDER BY column_name`,
          [schema],
        ),
      ).toEqual([
        {
          column_name: "colorRendering",
          udt_name: "varchar",
          column_default: null,
          is_nullable: "YES",
        },
        {
          column_name: "colorTemp",
          udt_name: "_text",
          column_default: "ARRAY[]::text[]",
          is_nullable: "NO",
        },
        {
          column_name: "lifespan",
          udt_name: "varchar",
          column_default: null,
          is_nullable: "NO",
        },
        {
          column_name: "luminanceEfficiency",
          udt_name: "varchar",
          column_default: null,
          is_nullable: "YES",
        },
        {
          column_name: "options",
          udt_name: "_text",
          column_default: "ARRAY[]::text[]",
          is_nullable: "NO",
        },
        {
          column_name: "power",
          udt_name: "_text",
          column_default: "ARRAY[]::text[]",
          is_nullable: "NO",
        },
        {
          column_name: "powerFactor",
          udt_name: "varchar",
          column_default: null,
          is_nullable: "YES",
        },
      ]);
    } finally {
      await runner.rollbackTransaction();
      await runner.release();
    }
  });

  it("continues to reject malformed numeric values instead of silently losing data", async () => {
    const runner = db.createQueryRunner();
    await runner.connect();
    await runner.startTransaction();
    try {
      await runner.query(`SET LOCAL search_path TO "${schema}", public`);
      await runner.query(`
        CREATE TABLE "products" (
          "power" text[] NOT NULL DEFAULT ARRAY[]::text[],
          "lifespan" varchar NOT NULL,
          "colorTemp" text[] NOT NULL DEFAULT ARRAY[]::text[],
          "luminanceEfficiency" varchar
        )
      `);
      await runner.query(
        'INSERT INTO "products" ("power", "lifespan", "colorTemp") VALUES ($1,$2,$3)',
        [["not-a-number"], "50000", ["4000"]],
      );

      await expect(
        new ChangeProductFieldsToNumber1738027500000().up(runner),
      ).rejects.toMatchObject({ code: "22P02" });
    } finally {
      await runner.rollbackTransaction();
      await runner.release();
    }
  });
});
