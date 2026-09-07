import { randomUUID } from "node:crypto";
import { DataSource, DataSourceOptions, QueryRunner } from "typeorm";
import { configureTestDatabase } from "../../test/test-database";
import { Product } from "../entities/product.entity";
import { InitialSchema1706200000000 } from "./1706200000000-InitialSchema";
import { ChangePowerAndColorTempToArray1738027000000 } from "./1738027000000-ChangePowerAndColorTempToArray";
import { ChangeProductFieldsToNumber1738027500000 } from "./1738027500000-ChangeProductFieldsToNumber";
import { ChangeImagesToJsonb1740000000000 } from "./1740000000000-ChangeImagesToJsonb";

const compactSql = (sql: string) => sql.replace(/\s+/g, " ").trim();

describe("product number migration SQL contract", () => {
  it("defines the complete Product baseline before later type migrations", async () => {
    const runner = { query: jest.fn().mockResolvedValue([]) };

    await new InitialSchema1706200000000().up(runner as never);

    const createProducts = compactSql(
      runner.query.mock.calls
        .map(([sql]) => sql as string)
        .find((sql) => sql.includes('CREATE TABLE "products"'))!,
    );
    expect(createProducts).toEqual(
      expect.stringContaining(
        "\"certifications\" text[] NOT NULL DEFAULT '{}'",
      ),
    );
    expect(createProducts).toEqual(
      expect.stringContaining('"powerFactor" varchar'),
    );
    expect(createProducts).toEqual(
      expect.stringContaining('"luminanceEfficiency" varchar'),
    );
    expect(createProducts).toEqual(
      expect.stringContaining('"colorRendering" varchar'),
    );
    expect(createProducts).toEqual(
      expect.stringContaining("\"options\" text[] NOT NULL DEFAULT '{}'"),
    );
    for (const column of ["isNew", "isFeatured", "createdAt", "updatedAt"]) {
      expect(createProducts).toMatch(new RegExp(`"${column}" [^,]+ NOT NULL`));
    }
  });

  it("casts arrays directly and keeps the number migration reversible", async () => {
    const runner = { query: jest.fn().mockResolvedValue([]) };
    const migration = new ChangeProductFieldsToNumber1738027500000();

    await migration.up(runner as never);
    await migration.down(runner as never);

    const statements = runner.query.mock.calls.map(([sql]) => compactSql(sql));
    expect(statements).toEqual(
      expect.arrayContaining([
        'ALTER TABLE "products" ALTER COLUMN "power" TYPE numeric[] USING "power"::numeric[]',
        'ALTER TABLE "products" ALTER COLUMN "colorTemp" TYPE numeric[] USING "colorTemp"::numeric[]',
        'ALTER TABLE "products" ALTER COLUMN "luminanceEfficiency" TYPE numeric USING NULLIF("luminanceEfficiency"::text, \'\')::numeric',
        'ALTER TABLE "products" ALTER COLUMN "power" TYPE text[] USING "power"::text[]',
        'ALTER TABLE "products" ALTER COLUMN "colorTemp" TYPE text[] USING "colorTemp"::text[]',
        'ALTER TABLE "products" ALTER COLUMN "luminanceEfficiency" TYPE character varying USING "luminanceEfficiency"::character varying',
      ]),
    );
    expect(statements.join("\n")).not.toMatch(/ARRAY\s*\(\s*SELECT/i);
    expect(statements).toEqual(
      expect.arrayContaining([
        'ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "powerFactor" character varying',
        'ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "luminanceEfficiency" character varying',
        'ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "colorRendering" character varying',
        'ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "options" text[] NOT NULL DEFAULT \'{}\'',
      ]),
    );
  });
});

configureTestDatabase(process.env.REQUIRE_MIGRATION_TEST_DATABASE === "true");
const databaseOptions: DataSourceOptions | null = process.env.DB_HOST
  ? {
      type: "postgres",
      host: process.env.DB_HOST,
      port: Number(process.env.DB_PORT),
      username: process.env.DB_USERNAME,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
    }
  : null;
const postgres = databaseOptions ? describe : describe.skip;

postgres("product migrations on PostgreSQL 16", () => {
  let rootDb: DataSource;
  let db: DataSource;
  const schema = `product_number_${randomUUID().replace(/-/g, "")}`;

  beforeAll(async () => {
    rootDb = await new DataSource(databaseOptions!).initialize();
    const [{ server_version_num: version }] = await rootDb.query(
      "SHOW server_version_num",
    );
    expect(Math.floor(Number(version) / 10_000)).toBe(16);
    await rootDb.query(`CREATE SCHEMA "${schema}"`);
    db = await new DataSource({
      ...databaseOptions!,
      schema,
      entities: [Product],
      extra: { options: `-c search_path=${schema},public` },
    }).initialize();
  });

  beforeEach(async () => {
    await rootDb.query(`DROP SCHEMA "${schema}" CASCADE`);
    await rootDb.query(`CREATE SCHEMA "${schema}"`);
  });

  afterAll(async () => {
    if (db?.isInitialized) await db.destroy();
    if (rootDb?.isInitialized) {
      await rootDb.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
      await rootDb.destroy();
    }
  });

  const preparePreNumberSchema = async (): Promise<QueryRunner> => {
    const runner = db.createQueryRunner();
    await runner.connect();
    await new InitialSchema1706200000000().up(runner);
    await new ChangePowerAndColorTempToArray1738027000000().up(runner);
    return runner;
  };

  const insertProduct = async (
    runner: QueryRunner,
    values: {
      power: Array<string | null>;
      lifespan: string;
      colorTemp: string[];
      luminanceEfficiency: string | number | null;
      suffix: string;
    },
  ): Promise<void> => {
    await runner.query(
      `INSERT INTO "products" (
        "name", "category", "modelName", "dimensions", "power", "lifespan",
        "colorTemp", "ledChipManufacturer", "description", "luminanceEfficiency"
      ) VALUES ($1,'실내조명',$2,'100x100',$3,$4,$5,'제조사','설명',$6)`,
      [
        `제품-${values.suffix}`,
        `모델-${values.suffix}`,
        values.power,
        values.lifespan,
        values.colorTemp,
        values.luminanceEfficiency,
      ],
    );
  };

  const productColumns = () =>
    db.query(
      `SELECT column_name, udt_name, column_default, is_nullable
       FROM information_schema.columns
       WHERE table_schema=$1 AND table_name='products'
       ORDER BY ordinal_position`,
      [schema],
    );

  it("runs the real baseline chain, preserves data, reverses exactly, and matches Product metadata", async () => {
    const runner = await preparePreNumberSchema();
    try {
      const before = await productColumns();
      await insertProduct(runner, {
        power: ["12.5", null, "40"],
        lifespan: "50000",
        colorTemp: ["3000", "4000"],
        luminanceEfficiency: "125.75",
        suffix: "populated",
      });
      await insertProduct(runner, {
        power: [],
        lifespan: "0",
        colorTemp: [],
        luminanceEfficiency: "",
        suffix: "empty",
      });

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

      await migration.down(runner);
      expect(await productColumns()).toEqual(before);

      await migration.up(runner);
      await new ChangeImagesToJsonb1740000000000().up(runner);
      const schemaDiff = await db.driver.createSchemaBuilder().log();
      expect(schemaDiff.upQueries.map(({ query }) => query)).toEqual([]);
    } finally {
      await runner.release();
    }
  });

  it("accepts luminanceEfficiency when synchronization already made it numeric", async () => {
    const runner = await preparePreNumberSchema();
    try {
      await runner.query(`
        ALTER TABLE "products"
        ALTER COLUMN "luminanceEfficiency" TYPE numeric
        USING NULLIF("luminanceEfficiency"::text, '')::numeric
      `);
      await insertProduct(runner, {
        power: ["12"],
        lifespan: "50000",
        colorTemp: ["4000"],
        luminanceEfficiency: 130,
        suffix: "numeric",
      });

      await new ChangeProductFieldsToNumber1738027500000().up(runner);
      expect(
        await runner.query(
          'SELECT "luminanceEfficiency"::text FROM "products"',
        ),
      ).toEqual([{ luminanceEfficiency: "130" }]);
    } finally {
      await runner.release();
    }
  });

  it("advances an old recorded baseline that lacks synchronized Product columns", async () => {
    const runner = await preparePreNumberSchema();
    try {
      await runner.query(`
        ALTER TABLE "products"
        DROP COLUMN "powerFactor",
        DROP COLUMN "luminanceEfficiency",
        DROP COLUMN "colorRendering",
        DROP COLUMN "options"
      `);

      await new ChangeProductFieldsToNumber1738027500000().up(runner);
      expect(
        await runner.query(
          `SELECT column_name, udt_name
           FROM information_schema.columns
           WHERE table_schema=$1 AND table_name='products'
             AND column_name IN ('powerFactor','luminanceEfficiency','colorRendering','options')
           ORDER BY column_name`,
          [schema],
        ),
      ).toEqual([
        { column_name: "colorRendering", udt_name: "varchar" },
        { column_name: "luminanceEfficiency", udt_name: "numeric" },
        { column_name: "options", udt_name: "_text" },
        { column_name: "powerFactor", udt_name: "varchar" },
      ]);
    } finally {
      await runner.release();
    }
  });

  it("continues to reject malformed numeric values instead of silently losing data", async () => {
    const runner = await preparePreNumberSchema();
    try {
      await insertProduct(runner, {
        power: ["not-a-number"],
        lifespan: "50000",
        colorTemp: ["4000"],
        luminanceEfficiency: null,
        suffix: "malformed",
      });

      await expect(
        new ChangeProductFieldsToNumber1738027500000().up(runner),
      ).rejects.toMatchObject({ code: "22P02" });
    } finally {
      await runner.release();
    }
  });
});
