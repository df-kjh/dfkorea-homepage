import { BadRequestException, ValidationPipe } from "@nestjs/common";
import { CreateProductDto, UpdateProductDto } from "./product.dto";

const pipe = new ValidationPipe({
  whitelist: true,
  forbidNonWhitelisted: true,
  transform: true,
});

const image = () => ({ url: "/uploads/product.jpg", alt: "제품 사진" });
const content = () => ({
  version: 1,
  heroTitle: "제품 소개",
  heroDescription: "제품 특징 설명",
  heroImage: image(),
  storyTitle: "제품 이야기",
  storyImage: image(),
  features: [{ title: "특징", body: "특징 설명" }],
  structureTitle: "제품 구조",
  structureImages: [image()],
  application: {
    title: "적용 예시",
    description: "설치 공간",
    image: image(),
    caption: "적용 이미지 출처",
  },
  controlTitle: "제어 옵션",
  showControl: false,
  dimensionsTitle: "규격",
  showDimensions: true,
  dimensionImage: { ...image(), caption: "규격 도식 출처" },
});

const transform = (payload: object, metatype = UpdateProductDto) =>
  pipe.transform(payload, { type: "body", metatype });

async function messages(payload: object): Promise<string[]> {
  try {
    await transform(payload);
    return [];
  } catch (error) {
    if (!(error instanceof BadRequestException)) throw error;
    return (error.getResponse() as { message: string[] }).message;
  }
}

describe("product detail content DTO contract", () => {
  it("accepts every flat v1 field through the production validation options", async () => {
    await expect(transform({ detailContent: content() })).resolves.toEqual({
      detailContent: content(),
    });
  });

  it("accepts legacy creation without content and explicit null reset", async () => {
    const legacyProduct = {
      name: "LED 조명",
      category: "실내등",
      images: [],
      modelName: "DF-40",
      dimensions: "1200mm",
      power: [40],
      lifespan: 50000,
      colorTemp: [5700],
      ledChipManufacturer: "서울반도체",
      certifications: [],
      description: "기존 Markdown 설명",
    };
    await expect(transform(legacyProduct, CreateProductDto)).resolves.toEqual(
      legacyProduct,
    );
    await expect(
      transform(
        { ...legacyProduct, detailContent: content() },
        CreateProductDto,
      ),
    ).resolves.toMatchObject({ detailContent: content() });
    await expect(transform({ detailContent: null })).resolves.toEqual({
      detailContent: null,
    });
    await expect(transform({ name: "새 제목" })).resolves.toEqual({
      name: "새 제목",
    });
  });

  it("accepts exact string and array limits without truncating content", async () => {
    const maxImage = {
      url: `/${"i".repeat(2047)}`,
      alt: "가".repeat(300),
      caption: "가".repeat(500),
    };
    const detailContent = {
      version: 1,
      heroTitle: "가".repeat(160),
      heroDescription: "가".repeat(2000),
      heroImage: maxImage,
      storyTitle: "가".repeat(160),
      storyImage: maxImage,
      features: Array.from({ length: 6 }, () => ({
        title: "가".repeat(160),
        body: "가".repeat(2000),
      })),
      structureTitle: "가".repeat(160),
      structureImages: Array.from({ length: 6 }, () => maxImage),
      application: {
        title: "가".repeat(160),
        description: "가".repeat(2000),
        image: maxImage,
        caption: "가".repeat(500),
      },
      controlTitle: "가".repeat(160),
      dimensionsTitle: "가".repeat(160),
      dimensionImage: maxImage,
    };
    await expect(transform({ detailContent })).resolves.toEqual({
      detailContent,
    });
  });

  it.each([
    "https://images.example.com/product.jpg?width=1200#view",
    "http://localhost:3000/uploads/product.jpg",
    "/uploads/제품 사진.jpg".replace(" ", "%20"),
    "/",
  ])("accepts safe image URL %s", async (url) => {
    await expect(
      transform({ detailContent: { version: 1, heroImage: { url, alt: "" } } }),
    ).resolves.toMatchObject({ detailContent: { heroImage: { url } } });
  });

  it.each([
    "javascript:alert(1)",
    "data:image/png;base64,aGVsbG8=",
    "//images.example.com/product.jpg",
    "/\\images.example.com/product.jpg",
    "https://images.example.com\\@evil.example/product.jpg",
    "uploads/product.jpg",
    "https:images.example.com/product.jpg",
    "https://",
    " https://images.example.com/product.jpg",
    "/uploads/a\n.jpg",
    "/uploads/a\t.jpg",
    "",
  ])("rejects unsafe or malformed image URL %j", async (url) => {
    expect(
      await messages({
        detailContent: { version: 1, heroImage: { url, alt: "사진" } },
      }),
    ).toEqual(
      expect.arrayContaining([expect.stringContaining("heroImage.url")]),
    );
  });

  it.each([
    ["missing version", {}, "detailContent.version"],
    ["unknown version", { version: 2 }, "detailContent.version"],
    ["string version", { version: "1" }, "detailContent.version"],
    ["unknown root field", { version: 1, hero: {} }, "property hero"],
    [
      "unknown image field",
      { version: 1, heroImage: { ...image(), html: "<b>" } },
      "property html",
    ],
    [
      "unknown feature field",
      { version: 1, features: [{ title: "특징", body: "설명", power: 40 }] },
      "property power",
    ],
    [
      "unknown structure field",
      { version: 1, structureImages: [{ ...image(), width: 100 }] },
      "property width",
    ],
    [
      "unknown application field",
      {
        version: 1,
        application: { title: "적용", image: image(), body: "설명" },
      },
      "property body",
    ],
    [
      "unknown application image field",
      {
        version: 1,
        application: {
          title: "적용",
          image: { ...image(), src: "/other.jpg" },
        },
      },
      "property src",
    ],
    [
      "unknown dimension image field",
      { version: 1, dimensionImage: { ...image(), src: "/other.jpg" } },
      "property src",
    ],
    [
      "missing image URL",
      { version: 1, heroImage: { alt: "사진" } },
      "heroImage.url",
    ],
    [
      "missing image alt",
      { version: 1, heroImage: { url: "/a.jpg" } },
      "heroImage.alt",
    ],
    [
      "missing feature title",
      { version: 1, features: [{ body: "본문" }] },
      "features.0.title",
    ],
    [
      "missing feature body",
      { version: 1, features: [{ title: "제목" }] },
      "features.0.body",
    ],
    [
      "missing application title",
      { version: 1, application: { image: image() } },
      "application.title",
    ],
    [
      "missing application image",
      { version: 1, application: { title: "적용" } },
      "application.image",
    ],
    ["non-object content", "content", "detailContent"],
    ["array content", [], "detailContent"],
    [
      "non-array features",
      { version: 1, features: {} },
      "detailContent.features",
    ],
    [
      "non-array structure",
      { version: 1, structureImages: {} },
      "detailContent.structureImages",
    ],
    [
      "too many features",
      {
        version: 1,
        features: Array.from({ length: 7 }, () => ({
          title: "특징",
          body: "본문",
        })),
      },
      "detailContent.features",
    ],
    [
      "too many structures",
      { version: 1, structureImages: Array.from({ length: 7 }, image) },
      "detailContent.structureImages",
    ],
    [
      "non-boolean control",
      { version: 1, showControl: "false" },
      "detailContent.showControl",
    ],
    [
      "non-boolean dimensions",
      { version: 1, showDimensions: 1 },
      "detailContent.showDimensions",
    ],
    [
      "null optional title",
      { version: 1, heroTitle: null },
      "detailContent.heroTitle",
    ],
    [
      "null optional image",
      { version: 1, heroImage: null },
      "detailContent.heroImage",
    ],
    [
      "null optional array",
      { version: 1, features: null },
      "detailContent.features",
    ],
    [
      "null application image",
      { version: 1, application: { title: "적용", image: null } },
      "application.image",
    ],
    [
      "null feature entry",
      { version: 1, features: [null] },
      "detailContent.features",
    ],
    [
      "null structure entry",
      { version: 1, structureImages: [null] },
      "detailContent.structureImages",
    ],
  ])("rejects %s at its nested field", async (_label, detailContent, path) => {
    expect(await messages({ detailContent })).toEqual(
      expect.arrayContaining([expect.stringContaining(path as string)]),
    );
  });

  it.each([
    ["heroTitle", 160],
    ["storyTitle", 160],
    ["structureTitle", 160],
    ["controlTitle", 160],
    ["dimensionsTitle", 160],
    ["heroDescription", 2000],
  ])("rejects oversized %s", async (field, limit) => {
    expect(
      await messages({
        detailContent: { version: 1, [field]: "가".repeat(Number(limit) + 1) },
      }),
    ).toEqual(
      expect.arrayContaining([
        expect.stringContaining(`detailContent.${field}`),
      ]),
    );
  });

  it.each([
    [
      { version: 1, heroImage: { url: `/${"x".repeat(2048)}`, alt: "사진" } },
      "heroImage.url",
    ],
    [
      { version: 1, storyImage: { ...image(), alt: "가".repeat(301) } },
      "storyImage.alt",
    ],
    [
      { version: 1, dimensionImage: { ...image(), caption: "가".repeat(501) } },
      "dimensionImage.caption",
    ],
    [
      { version: 1, features: [{ title: "가".repeat(161), body: "설명" }] },
      "features.0.title",
    ],
    [
      { version: 1, features: [{ title: "특징", body: "가".repeat(2001) }] },
      "features.0.body",
    ],
    [
      { version: 1, application: { title: "가".repeat(161), image: image() } },
      "application.title",
    ],
    [
      {
        version: 1,
        application: {
          title: "적용",
          description: "가".repeat(2001),
          image: image(),
        },
      },
      "application.description",
    ],
    [
      {
        version: 1,
        application: {
          title: "적용",
          caption: "가".repeat(501),
          image: image(),
        },
      },
      "application.caption",
    ],
  ])("rejects nested string overflow at %s", async (detailContent, path) => {
    expect(await messages({ detailContent })).toEqual(
      expect.arrayContaining([expect.stringContaining(path as string)]),
    );
  });
});
