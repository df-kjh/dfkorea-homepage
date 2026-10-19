import { INestApplication, ValidationPipe } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { readdirSync } from "fs";
import { join } from "path";
import request = require("supertest");
import { getMetadataArgsStorage, Repository } from "typeorm";
import { AiService } from "../ai/ai.service";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { DatabaseService } from "../database/database.service";
import { Product } from "../entities/product.entity";
import { ProductsController } from "./products.controller";
import { ProductsService } from "./products.service";

const existingProduct = {
  id: "existing-product",
  name: "기존 제품",
  category: "실내등",
  images: [{ image: "/uploads/original.jpg" }],
  modelName: "DF-40",
  dimensions: "1200mm",
  power: [40],
  lifespan: 50000,
  colorTemp: [5700],
  ledChipManufacturer: "서울반도체",
  certifications: ["KC"],
  options: ["센서"],
  description: "기존 **Markdown** 설명",
};

const detailContent = {
  version: 1,
  heroTitle: "새 상세 제목",
  heroImage: { url: "/uploads/detail.jpg", alt: "상세 제품 사진" },
  application: {
    title: "실제 적용",
    image: { url: "https://images.example.com/site.jpg", alt: "현장 사진" },
    caption: "이미지 출처",
  },
  showControl: false,
};

describe("product detail content persistence boundary", () => {
  let app: INestApplication;
  let rows: Map<string, Product>;

  beforeAll(async () => {
    // Only the external repository is replaced; requests still pass through the
    // actual controller, DTO pipe, product service and database service.
    const repository = {
      create: (input: Partial<Product>) => Object.assign(new Product(), input),
      save: async (input: Product) => {
        const persisted = JSON.parse(
          JSON.stringify({ ...input, id: input.id || "created-product" }),
        ) as Product;
        rows.set(persisted.id, persisted);
        return persisted;
      },
      find: async () => [...rows.values()],
      findOne: async ({ where }: { where: { id: string } }) =>
        rows.has(where.id)
          ? JSON.parse(JSON.stringify(rows.get(where.id)))
          : null,
    } as unknown as Repository<Product>;
    const database = new DatabaseService(repository, null, null, null);
    const module = await Test.createTestingModule({
      controllers: [ProductsController],
      providers: [
        ProductsService,
        { provide: DatabaseService, useValue: database },
        { provide: AiService, useValue: {} },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .compile();
    app = module.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();
  });

  beforeEach(() => {
    rows = new Map([[existingProduct.id, { ...existingProduct } as Product]]);
  });

  afterAll(async () => app.close());

  it("creates and reads the same nested content alongside the existing specifications", async () => {
    const { id: _id, ...input } = existingProduct;
    await request(app.getHttpServer())
      .post("/products")
      .send({ ...input, detailContent })
      .expect(201);
    const response = await request(app.getHttpServer())
      .get("/products/created-product")
      .expect(200);
    expect(response.body).toEqual({
      ...input,
      id: "created-product",
      detailContent,
    });
  });

  it("preserves old products that have no content", async () => {
    const response = await request(app.getHttpServer())
      .get(`/products/${existingProduct.id}`)
      .expect(200);
    expect(response.body).toEqual(existingProduct);
  });

  it("updates content, preserves it on omission, and clears it only with explicit null", async () => {
    const url = `/products/${existingProduct.id}`;
    await request(app.getHttpServer())
      .put(url)
      .send({ detailContent })
      .expect(200);
    const renamed = await request(app.getHttpServer())
      .put(url)
      .send({ name: "이름만 변경" })
      .expect(200);
    expect(renamed.body).toEqual({
      ...existingProduct,
      name: "이름만 변경",
      detailContent,
    });
    await request(app.getHttpServer())
      .put(url)
      .send({ detailContent: null })
      .expect(200);
    const reset = await request(app.getHttpServer()).get(url).expect(200);
    expect(reset.body).toEqual({
      ...existingProduct,
      name: "이름만 변경",
      detailContent: null,
    });
  });

  it("rejects nested unknown fields before an existing row can be overwritten", async () => {
    const response = await request(app.getHttpServer())
      .put(`/products/${existingProduct.id}`)
      .send({ detailContent: { ...detailContent, power: [99] } })
      .expect(400);
    expect(response.body.message).toContain(
      "detailContent.property power should not exist",
    );
    const unchanged = await request(app.getHttpServer())
      .get(`/products/${existingProduct.id}`)
      .expect(200);
    expect(unchanged.body).toEqual(existingProduct);
  });
});

describe("product detail schema", () => {
  it("maps content as nullable JSONB with no default or changes to specification columns", () => {
    const column = getMetadataArgsStorage().columns.find(
      (item) =>
        item.target === Product && item.propertyName === "detailContent",
    );
    expect(column?.options).toMatchObject({ type: "jsonb", nullable: true });
    expect(column?.options.default).toBeUndefined();
    expect(
      getMetadataArgsStorage().columns.some(
        (item) =>
          item.target === Product && item.propertyName === "variantGroup",
      ),
    ).toBe(false);
  });

  it("discovers an additive migration that reverses only its new column", async () => {
    const directory = join(__dirname, "../migrations");
    const files = readdirSync(directory).filter((file) =>
      /^\d+-AddProductDetailContent\.ts$/.test(file),
    );
    expect(files).toHaveLength(1);
    const exports = require(join(directory, files[0]));
    const Migration = Object.values(exports)[0] as new () => {
      up(runner: unknown): Promise<void>;
      down(runner: unknown): Promise<void>;
    };
    const statements: string[] = [];
    const runner = {
      query: async (sql: string) =>
        statements.push(sql.replace(/\s+/g, " ").trim()),
    };
    const migration = new Migration();
    await migration.up(runner);
    await migration.down(runner);
    expect(statements).toEqual([
      'ALTER TABLE "products" ADD COLUMN "detailContent" jsonb',
      'ALTER TABLE "products" DROP COLUMN "detailContent"',
    ]);
  });
});
