import { INestApplication, ValidationPipe } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request = require("supertest");
import { AiService } from "../ai/ai.service";
import { DatabaseService } from "../database/database.service";
import { Product } from "../entities/product.entity";
import { CreateProductDto, UpdateProductDto } from "./dto/product.dto";
import { ProductsController } from "./products.controller";
import { ProductsService } from "./products.service";

const ids = {
  round: "d4705d1d-7dab-4381-b83c-9c9026efa896",
  sensor: "bc46e6f3-2dd0-4c17-bf5b-0ee5b681b538",
  constant: "492784ba-6318-4687-b877-9edde0b96b32",
  dimming: "f6bfbddf-a3b8-4127-b352-6ba9c703e252",
};

function product(id: string, fields: Partial<Product> = {}): Product {
  return {
    id,
    name: "독립 제품",
    category: "별도 조명",
    images: [{ image: `/uploads/${id}.jpg` }],
    modelName: `DF-${id}`,
    dimensions: "240*62",
    power: [15],
    lifespan: 40000,
    colorTemp: [5700],
    ledChipManufacturer: "서울반도체",
    certifications: ["KS", "고효율"],
    powerFactor: "0.95",
    luminanceEfficiency: 110,
    colorRendering: "80",
    options: [],
    description: `**${id}** 원본 설명`,
    isNew: false,
    isFeatured: false,
    createdAt: "2026-02-19T08:00:00.000Z" as unknown as Date,
    updatedAt: "2026-09-06T01:00:00.000Z" as unknown as Date,
    ...fields,
  };
}

function catalogFixture(): Product[] {
  const parking = {
    category: "주차장조명",
    dimensions: "1200*60*45",
    colorTemp: [5700, 4000, 3000],
    options: ["개별디밍", "그룹디밍", "센서", "발전기 비상", "밧데리 비상"],
  };
  return [
    product(ids.round, {
      name: "원형직부",
      category: "원형직부",
      modelName: "DF-CI-15",
    }),
    product(ids.sensor, {
      name: "원형센서",
      category: "원형센서",
      modelName: "DF-CIS-15",
      options: ["발전기 비상", "밧데리 비상"],
    }),
    product(ids.constant, {
      ...parking,
      name: "주차장조명 상시",
      modelName: "DF-REA-40",
      power: [40, 22, 18, 50],
      certifications: ["KS", "고효율", "친환경"],
    }),
    product(ids.dimming, {
      ...parking,
      name: "주차장조명 디밍",
      modelName: "DF-RES-40",
      power: [40, 22, 18],
      isFeatured: true,
    }),
    ...Array.from({ length: 21 }, (_, index) =>
      product(`separate-${String(index).padStart(2, "0")}`),
    ),
  ];
}

describe("reviewed product family API", () => {
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
    catalog = catalogFixture();
  });

  afterAll(async () => app.close());

  const list = (query: Record<string, unknown> = {}) =>
    request(app.getHttpServer()).get("/products").query(query);

  it("keeps 25 raw SKUs by default and exposes only 23 opt-in family results", async () => {
    const original = JSON.parse(JSON.stringify(catalog));
    const raw = await list().expect(200);
    expect(raw.body).toEqual(original);
    expect((await list({ groupVariants: "false" }).expect(200)).body).toEqual(
      original,
    );
    const grouped = await list({ groupVariants: "true" }).expect(200);
    expect(grouped.body).toHaveLength(23);
    const groups = grouped.body.filter((item) => item.variantGroup);
    expect(groups.map((item) => item.variantGroup.id).sort()).toEqual([
      "parking-linear",
      "round-ceiling",
    ]);
    for (const item of groups) {
      const { variantGroup, ...source } = item;
      expect(source).toEqual(original.find((value) => value.id === item.id));
      expect(item.id).toBe(variantGroup.primaryProductId);
      for (const variant of variantGroup.variants) {
        expect(variant.product).toEqual(
          original.find((value) => value.id === variant.product.id),
        );
        expect(variant.product).not.toHaveProperty("variantGroup");
      }
    }
    expect(catalog).toEqual(original);
    expect((await list().expect(200)).body).toEqual(original);
  });

  it.each([
    [ids.round, "round-ceiling", "원형 조명", ["일반형", "센서형"]],
    [ids.sensor, "round-ceiling", "원형 조명", ["일반형", "센서형"]],
    [ids.constant, "parking-linear", "주차장 조명", ["상시형", "디밍형"]],
    [ids.dimming, "parking-linear", "주차장 조명", ["상시형", "디밍형"]],
  ])(
    "preserves old detail URL %s and returns all source variants",
    async (id, groupId, name, labels) => {
      const response = await request(app.getHttpServer())
        .get(`/products/${id}`)
        .expect(200);
      const { variantGroup, ...source } = response.body;
      expect(source).toEqual(catalog.find((item) => item.id === id));
      expect(variantGroup).toMatchObject({ id: groupId, name });
      expect(variantGroup.variants.map((variant) => variant.label)).toEqual(
        labels,
      );
      expect(
        variantGroup.variants.every((variant) => !variant.product.variantGroup),
      ).toBe(true);
    },
  );

  it("leaves featured responses and unreviewed product details unchanged", async () => {
    const featured = await request(app.getHttpServer())
      .get("/products/featured/list")
      .expect(200);
    expect(featured.body).toEqual([
      catalog.find((item) => item.id === ids.dimming),
    ]);
    const separate = await request(app.getHttpServer())
      .get("/products/separate-00")
      .expect(200);
    expect(separate.body).toEqual(
      catalog.find((item) => item.id === "separate-00"),
    );
    await request(app.getHttpServer()).get("/products/missing").expect(404);
  });

  it("keeps 50W and 친환경 scoped to the actual parking constant SKU", async () => {
    const response = await list({
      groupVariants: "true",
      category: "주차장조명",
      power: "50",
      certifications: "친환경",
    }).expect(200);
    expect(response.body).toHaveLength(1);
    expect(response.body[0].id).toBe(ids.constant);
    const variants = response.body[0].variantGroup.variants;
    expect(
      variants.find((variant) => variant.label === "상시형").product.power,
    ).toEqual([40, 22, 18, 50]);
    expect(
      variants.find((variant) => variant.label === "디밍형").product.power,
    ).toEqual([40, 22, 18]);
    expect(
      variants.find((variant) => variant.label === "디밍형").product
        .certifications,
    ).toEqual(["KS", "고효율"]);
  });

  it("selects the matching secondary SKU when search or category excludes the primary", async () => {
    const parking = await list({
      groupVariants: "true",
      search: "df-res-40",
    }).expect(200);
    expect(parking.body).toHaveLength(1);
    expect(parking.body[0].id).toBe(ids.dimming);
    expect(parking.body[0].variantGroup.primaryProductId).toBe(ids.constant);
    const sensor = await list({
      groupVariants: "true",
      category: "원형센서",
      options: "발전기 비상",
    }).expect(200);
    expect(sensor.body).toHaveLength(1);
    expect(sensor.body[0].id).toBe(ids.sensor);
    expect(sensor.body[0].variantGroup.variants[0].product.options).toEqual([]);
    expect(
      (
        await list({
          groupVariants: "true",
          category: "원형직부",
          options: "발전기 비상",
        }).expect(200)
      ).body,
    ).toEqual([]);
  });

  it("requires every AND facet to match the same SKU before grouping", async () => {
    catalog.find((item) => item.id === ids.constant).options = [];
    expect(
      (
        await list({
          groupVariants: "true",
          power: "50",
          options: "발전기 비상",
        }).expect(200)
      ).body,
    ).toEqual([]);
    expect(
      (
        await list({
          groupVariants: "true",
          certifications: "친환경",
          options: "발전기 비상",
        }).expect(200)
      ).body,
    ).toEqual([]);
    const matched = await list({
      groupVariants: "true",
      power: "40",
      options: "발전기 비상",
    }).expect(200);
    expect(matched.body.map((item) => item.id)).toEqual([ids.dimming]);
  });

  it.each(["원형 조명", "주차장 조명"])(
    "searches reviewed family name %s only for grouped requests",
    async (search) => {
      expect((await list({ search }).expect(200)).body).toEqual([]);
      const grouped = await list({ groupVariants: "true", search }).expect(200);
      expect(grouped.body).toHaveLength(1);
      expect(grouped.body[0].variantGroup.name).toBe(search);
    },
  );

  it("calculates stable count and pages after grouping and before slicing", async () => {
    const first = await list({
      groupVariants: "true",
      page: "1",
      limit: "12",
    }).expect(200);
    catalog.reverse();
    const second = await list({
      groupVariants: "true",
      page: "2",
      limit: "12",
    }).expect(200);
    expect(first.body).toMatchObject({
      total: 23,
      totalPages: 2,
      page: 1,
      limit: 12,
    });
    expect(first.body.data).toHaveLength(12);
    expect(second.body).toMatchObject({
      total: 23,
      totalPages: 2,
      page: 2,
      limit: 12,
    });
    expect(second.body.data).toHaveLength(11);
    expect(
      new Set([...first.body.data, ...second.body.data].map((item) => item.id))
        .size,
    ).toBe(23);
    const raw = await list({ page: "1", limit: "12" }).expect(200);
    expect(raw.body).toMatchObject({ total: 25, totalPages: 3 });
  });

  it.each(["TRUE", "1", "", "yes", "null", ["true", "false"]])(
    "rejects ambiguous groupVariants %j",
    async (groupVariants) => {
      const response = await list({ groupVariants }).expect(400);
      expect(response.body.message).toEqual(
        expect.stringContaining("groupVariants"),
      );
    },
  );

  it.each([ids.round, ids.sensor, ids.constant, ids.dimming])(
    "falls back to source records when expected member %s is removed",
    async (missingId) => {
      catalog = catalog.filter((item) => item.id !== missingId);
      const grouped = await list({ groupVariants: "true" }).expect(200);
      expect(grouped.body).toHaveLength(23);
      const otherId =
        missingId === ids.round
          ? ids.sensor
          : missingId === ids.sensor
            ? ids.round
            : missingId === ids.constant
              ? ids.dimming
              : ids.constant;
      const remaining = grouped.body.find((item) => item.id === otherId);
      expect(remaining).toEqual(catalog.find((item) => item.id === otherId));
      const detail = await request(app.getHttpServer())
        .get(`/products/${otherId}`)
        .expect(200);
      expect(detail.body).not.toHaveProperty("variantGroup");
    },
  );

  it.each([
    ["dimensions", "250*62"],
    ["colorTemp", [3000]],
    ["ledChipManufacturer", "다른 제조사"],
    ["lifespan", 30000],
    ["powerFactor", "0.9"],
    ["luminanceEfficiency", 100],
    ["colorRendering", "70"],
    ["certifications", ["KS"]],
    ["power", [20]],
  ])("stops round grouping after common %s diverges", async (field, value) => {
    Object.assign(
      catalog.find((item) => item.id === ids.sensor),
      { [field]: value },
    );
    const response = await list({ groupVariants: "true" }).expect(200);
    expect(response.body).toHaveLength(24);
    expect(
      response.body
        .filter((item) => [ids.round, ids.sensor].includes(item.id))
        .every((item) => !item.variantGroup),
    ).toBe(true);
  });

  it("stops parking grouping when a common field diverges despite allowed power/cert differences", async () => {
    catalog.find((item) => item.id === ids.dimming).dimensions = "different";
    const response = await list({ groupVariants: "true" }).expect(200);
    expect(response.body).toHaveLength(24);
    expect(
      response.body.find((item) => item.id === ids.dimming),
    ).not.toHaveProperty("variantGroup");
  });

  it("compares numeric database values and array members without order or formatting changes", async () => {
    Object.assign(
      catalog.find((item) => item.id === ids.round),
      {
        colorTemp: [5700, 4000],
        power: [15, 20],
      },
    );
    Object.assign(
      catalog.find((item) => item.id === ids.sensor),
      {
        colorTemp: ["4000.0", "5700.00"],
        power: ["20.0", "15"],
        certifications: ["고효율", "KS"],
        lifespan: "40000.0",
        powerFactor: "0.950",
        luminanceEfficiency: "110.00",
        colorRendering: "80.0",
      },
    );
    const before = JSON.parse(JSON.stringify(catalog));
    const response = await list({ groupVariants: "true" }).expect(200);
    expect(response.body).toHaveLength(23);
    expect(
      response.body.find((item) => item.id === ids.round).variantGroup.id,
    ).toBe("round-ceiling");
    expect(catalog).toEqual(before);
  });

  it("does not infer a new group from similar names or specifications", async () => {
    catalog.push(
      product("unreviewed-round", { ...catalog[0], id: "unreviewed-round" }),
    );
    const response = await list({ groupVariants: "true" }).expect(200);
    expect(response.body).toHaveLength(24);
    expect(
      response.body.find((item) => item.id === "unreviewed-round"),
    ).not.toHaveProperty("variantGroup");
  });

  it("does not confuse a textual specification with a normalized numeric value", async () => {
    catalog.find((item) => item.id === ids.sensor).colorRendering = "number:80";
    const response = await list({ groupVariants: "true" }).expect(200);
    expect(response.body).toHaveLength(24);
    expect(
      response.body.find((item) => item.id === ids.round),
    ).not.toHaveProperty("variantGroup");
  });

  it("keeps unrelated matching products when a filter also selects a family variant", async () => {
    catalog.push(
      product("unrelated-50w", { power: [50], certifications: ["친환경"] }),
    );
    const response = await list({
      groupVariants: "true",
      power: "50",
      certifications: "친환경",
    }).expect(200);
    expect(response.body.map((item) => item.id)).toEqual([
      ids.constant,
      "unrelated-50w",
    ]);
  });

  it.each([CreateProductDto, UpdateProductDto])(
    "does not accept virtual group data in %p writes",
    async (metatype) => {
      const pipe = new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      });
      const {
        id: _id,
        createdAt: _createdAt,
        updatedAt: _updatedAt,
        ...input
      } = catalog[0];
      const promise = pipe.transform(
        { ...input, variantGroup: { id: "injected" } },
        { type: "body", metatype },
      );
      await expect(promise).rejects.toMatchObject({
        response: {
          message: expect.arrayContaining([
            "property variantGroup should not exist",
          ]),
        },
      });
    },
  );
});
