import { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request = require("supertest");
import { AiService } from "../ai/ai.service";
import { DatabaseService } from "../database/database.service";
import { Product } from "../entities/product.entity";
import { ProductsController } from "./products.controller";
import { ProductsService } from "./products.service";

const product = (id: string, values: Partial<Product> = {}): Product =>
  ({
    id,
    name: "LED 조명",
    modelName: `MODEL-${id}`,
    category: "실내등",
    power: [40],
    colorTemp: [5700],
    certifications: ["KC"],
    options: ["센서"],
    createdAt: new Date("2026-09-01"),
    ...values,
  }) as Product;

describe("product search API", () => {
  let app: INestApplication;
  let catalog: Product[];
  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [ProductsController],
      providers: [
        ProductsService,
        {
          provide: DatabaseService,
          useValue: { getProducts: async () => catalog },
        },
        { provide: AiService, useValue: {} },
      ],
    }).compile();
    app = module.createNestApplication();
    await app.init();
  });
  beforeEach(() => {
    catalog = [product("c"), product("b"), product("a")];
  });
  afterAll(async () => app.close());

  it("preserves the legacy unpaginated response and pagination envelope", async () => {
    const all = await request(app.getHttpServer()).get("/products").expect(200);
    expect(all.body.map((p) => p.id)).toEqual(["c", "b", "a"]);
    const paged = await request(app.getHttpServer())
      .get("/products?page=1&limit=2")
      .expect(200);
    expect(paged.body).toEqual({
      data: expect.any(Array),
      total: 3,
      page: 1,
      limit: 2,
      totalPages: 2,
    });
  });

  it("matches model names case-insensitively and filters the whole catalog before paging", async () => {
    catalog = [
      product("first", { power: [20] }),
      product("second", { certifications: [] }),
      product("third", { modelName: "DF-WP-40" }),
    ];
    const response = await request(app.getHttpServer())
      .get("/products")
      .query({
        page: 1,
        limit: 1,
        search: " wp ",
        power: "40",
        certifications: "KC",
        category: "실내등",
      })
      .expect(200);
    expect(response.body.total).toBe(1);
    expect(response.body.data.map((p) => p.id)).toEqual(["third"]);
  });

  it("uses OR within a field and AND across fields, excluding unspecified product specs", async () => {
    catalog = [
      product("a", {
        power: [20],
        colorTemp: [3000],
        certifications: ["고효율"],
      }),
      product("b"),
      product("c", { options: [] }),
      product("d", { power: [] }),
      product("e", { category: "실외등" }),
      product("f", { colorTemp: [] }),
    ];
    const response = await request(app.getHttpServer())
      .get("/products")
      .query({
        page: 1,
        limit: 10,
        search: "LED",
        category: "실내등",
        power: "20,40",
        colorTemp: "3000,5700",
        certifications: "KC,고효율",
        options: "센서,디밍",
      })
      .expect(200);
    expect(response.body.data.map((p) => p.id)).toEqual(["a", "b"]);
    expect(response.body.total).toBe(2);
  });

  it("handles PostgreSQL numeric array strings and decimal watts", async () => {
    catalog = [
      product("a", {
        power: ["7.5"] as unknown as number[],
        colorTemp: ["3000"] as unknown as number[],
      }),
      product("b"),
    ];
    const response = await request(app.getHttpServer())
      .get("/products")
      .query({ page: 1, limit: 10, power: "7.5", colorTemp: "3000" })
      .expect(200);
    expect(response.body.total).toBe(1);
  });

  it("uses a stable id tiebreaker while preserving newest-first ordering", async () => {
    catalog[1].createdAt = new Date("2026-09-02");
    const first = await request(app.getHttpServer())
      .get("/products?page=1&limit=2")
      .expect(200);
    catalog.reverse();
    const second = await request(app.getHttpServer())
      .get("/products?page=2&limit=2")
      .expect(200);
    expect(first.body.data.map((p) => p.id)).toEqual(["b", "a"]);
    expect(second.body.data.map((p) => p.id)).toEqual(["c"]);
  });

  it("returns empty data for a valid large page and empty catalogs", async () => {
    const response = await request(app.getHttpServer())
      .get("/products?page=999999&limit=10")
      .expect(200);
    expect(response.body).toEqual({
      data: [],
      total: 3,
      page: 999999,
      limit: 10,
      totalPages: 1,
    });
    catalog = [];
    const empty = await request(app.getHttpServer())
      .get("/products?page=1&limit=10")
      .expect(200);
    expect(empty.body.totalPages).toBe(0);
  });

  it("registers filter-options before :id and returns sorted deduplicated catalog values", async () => {
    catalog = [
      product("a", { power: [40, 20], certifications: ["KC", "고효율"] }),
      product("b", {
        category: "실외등",
        power: [20],
        colorTemp: [3000],
        options: [],
      }),
      product("c", {
        category: "",
        power: [],
        colorTemp: [],
        certifications: [],
        options: [],
      }),
    ];
    const response = await request(app.getHttpServer())
      .get("/products/filter-options")
      .expect(200);
    expect(response.body).toEqual({
      categories: ["실내등", "실외등"],
      power: [20, 40],
      colorTemp: [3000, 5700],
      certifications: ["KC", "고효율"],
      options: ["센서"],
    });
    catalog = [];
    const empty = await request(app.getHttpServer())
      .get("/products/filter-options")
      .expect(200);
    expect(empty.body).toEqual({
      categories: [],
      power: [],
      colorTemp: [],
      certifications: [],
      options: [],
    });
  });

  it("normalizes textual facets and matches without mutating original catalog displays", async () => {
    const padded = product("padded", {
      category: " 실내등 ",
      certifications: [" KC "],
      options: [" 센서 "],
    });
    catalog = [padded, product("plain")];
    const facets = await request(app.getHttpServer())
      .get("/products/filter-options")
      .expect(200);
    expect(facets.body.categories).toEqual(["실내등"]);
    expect(facets.body.certifications).toEqual(["KC"]);
    expect(facets.body.options).toEqual(["센서"]);
    const response = await request(app.getHttpServer())
      .get("/products")
      .query({
        page: 1,
        limit: 10,
        category: facets.body.categories[0],
        certifications: facets.body.certifications.join(","),
        options: facets.body.options.join(","),
      })
      .expect(200);
    expect(response.body.total).toBe(2);
    expect(response.body.data.find((item) => item.id === "padded")).toEqual(
      expect.objectContaining({
        category: " 실내등 ",
        certifications: [" KC "],
        options: [" 센서 "],
      }),
    );
    expect(padded.category).toBe(" 실내등 ");
    expect(padded.certifications).toEqual([" KC "]);
    expect(padded.options).toEqual([" 센서 "]);
  });

  it.each([
    { page: "1x", limit: "10" },
    { page: "0", limit: "10" },
    { page: "1.5", limit: "10" },
    { page: "1", limit: "0" },
    { page: "1", limit: "101" },
    { page: "1", limit: "NaN" },
    { page: "9007199254740992", limit: "10" },
    { page: "1" },
    { limit: "10" },
    { power: "40W" },
    { power: "-1" },
    { power: "40,,20" },
    { colorTemp: "Infinity" },
    { certifications: "KC,,KS" },
    { options: "" },
    { power: ["20", "40"] },
    { search: ["a", "b"] },
  ])("rejects malformed query %j with a meaningful 400", async (query) => {
    const response = await request(app.getHttpServer())
      .get("/products")
      .query(query)
      .expect(400);
    expect(response.body.message).toEqual(expect.any(String));
    expect(response.body.message.length).toBeGreaterThan(5);
  });
});
