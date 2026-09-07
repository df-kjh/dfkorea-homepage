import { BadRequestException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import sharp = require("sharp");
import { UploadFolder, UploadService } from "./upload.service";

const publicBase = "https://assets.example.test/public";
const pdf = Buffer.from("%PDF-1.7\n1 0 obj<</Type/Catalog>>endobj\n%%EOF\n");
const file = (buffer: Buffer, originalname: string, mimetype: string) =>
  ({
    buffer,
    originalname,
    mimetype,
    size: buffer.length,
  }) as Express.Multer.File;

describe("admin upload storage boundary", () => {
  let service: UploadService;
  let send: jest.SpyInstance;
  let png: Buffer;
  beforeAll(async () => {
    png = await sharp({
      create: { width: 2, height: 2, channels: 3, background: "red" },
    })
      .png()
      .toBuffer();
  });
  beforeEach(() => {
    send = jest
      .spyOn(S3Client.prototype, "send")
      .mockImplementation(async () => ({}));
    service = new UploadService(
      new ConfigService({
        R2_ENDPOINT: "https://r2.example.test",
        R2_ACCESS_KEY_ID: "test",
        R2_SECRET_ACCESS_KEY: "test",
        R2_BUCKET_NAME: "test-bucket",
        R2_PUBLIC_URL: publicBase,
      }),
    );
  });
  afterEach(() => jest.restoreAllMocks());

  it.each(
    [
      "../private",
      "quotes",
      "products/../../quotes",
      ["products", "temp"],
      "",
      "PRODUCTS",
    ].map((folder) => [folder]),
  )("rejects invalid runtime folder %p before storing", async (folder) => {
    await expect(
      service.uploadImage(
        file(png, "image.png", "image/png"),
        folder as UploadFolder,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(send).not.toHaveBeenCalled();
  });
  it.each([
    [
      Buffer.from("<script>alert(1)</script>"),
      "document.pdf",
      "application/pdf",
    ],
    [pdf, "image.png", "application/pdf"],
    [pdf, "document.pdf", "image/png"],
    [
      Buffer.from(
        '<svg xmlns="http://www.w3.org/2000/svg" width="2" height="2"><rect width="2" height="2"/></svg>',
      ),
      "image.png",
      "image/png",
    ],
    [Buffer.from("%PDF-1.7\nincomplete"), "document.pdf", "application/pdf"],
  ])(
    "rejects disguised or incomplete content %s %s",
    async (buffer, name, mime) => {
      await expect(
        service.uploadImage(
          file(buffer as Buffer, name as string, mime as string),
        ),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(send).not.toHaveBeenCalled();
    },
  );
  it("rejects raster MIME and extension mismatches", async () => {
    await expect(
      service.uploadImage(file(png, "image.jpg", "image/jpeg")),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(send).not.toHaveBeenCalled();
  });
  it("rejects files above the service size cap without trusting Multer metadata", async () => {
    const oversized = file(
      Buffer.concat([pdf, Buffer.alloc(10 * 1024 * 1024)]),
      "document.pdf",
      "application/pdf",
    );
    oversized.size = 1;
    await expect(service.uploadImage(oversized)).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(send).not.toHaveBeenCalled();
  });
  it("rejects image decompression above 40 megapixels", async () => {
    const largePng = await sharp({
      create: { width: 7000, height: 6000, channels: 3, background: "red" },
    })
      .png()
      .toBuffer();
    await expect(
      service.uploadImage(file(largePng, "large.png", "image/png")),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(send).not.toHaveBeenCalled();
  });
  it.each(["products", "posts", "certificates", "temp"] as UploadFolder[])(
    "preserves valid raster upload flow for %s",
    async (folder) => {
      const url = await service.uploadImage(
        file(png, "사진.PNG", "image/png"),
        folder,
      );
      expect(url).toMatch(
        new RegExp(
          `^https://assets.example.test/public/${folder}/image-.+\\.webp$`,
        ),
      );
      const command = send.mock.calls[0][0] as PutObjectCommand;
      expect(command.input.ContentType).toBe("image/webp");
      expect(
        (await sharp(command.input.Body as Buffer).metadata()).format,
      ).toBe("webp");
    },
  );
  it.each([
    ["jpeg", "photo.jpg", "image/jpeg"],
    ["jpeg", "photo.JPEG", "image/jpeg"],
    ["gif", "photo.gif", "image/gif"],
    ["webp", "photo.webp", "image/webp"],
  ])("preserves supported %s image uploads", async (format, name, mime) => {
    const bytes = await sharp(png)
      .toFormat(format as keyof sharp.FormatEnum)
      .toBuffer();
    await service.uploadImage(file(bytes, name, mime));
    const stored = send.mock.calls[0][0].input.Body as Buffer;
    expect((await sharp(stored).metadata()).format).toBe("webp");
  });
  it("retains PDF bytes and serves documents as attachments", async () => {
    const url = await service.uploadImage(
      file(pdf, "인증서.PDF", "application/pdf"),
      "certificates",
    );
    expect(url).toMatch(/\/certificates\/document-.+\.pdf$/);
    expect(send.mock.calls[0][0].input).toMatchObject({
      Body: pdf,
      ContentType: "application/pdf",
      ContentDisposition: "attachment",
    });
  });
  it.each(
    [
      "https://evil.test/public/products/image-1-2.webp",
      "https://assets.example.test.evil.test/public/products/image-1-2.webp",
      "http://assets.example.test/public/products/image-1-2.webp",
      "https://user@assets.example.test/public/products/image-1-2.webp",
      `${publicBase}/products/image-1-2.webp?x=1`,
      `${publicBase}/products/image-1-2.webp#fragment`,
      `${publicBase}/quotes/image-1-2.webp`,
      `${publicBase}/products/../temp/image-1-2.webp`,
      `${publicBase}/products/%2e%2e/temp/image-1-2.webp`,
      `${publicBase}/products/folder/image-1-2.webp`,
      `${publicBase}/products/private.json`,
      `${publicBase}/products/image-1-2.webp/`,
      ["https://assets.example.test/public/products/image-1-2.webp"],
    ].map((url) => [url]),
  )("rejects noncanonical or unmanaged deletion target %p", async (url) => {
    await expect(service.deleteImage(url as string)).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(send).not.toHaveBeenCalled();
  });
  it("deletes only the managed key relative to the configured public base", async () => {
    await expect(
      service.deleteImage(
        `${publicBase}/products/image-1750000000000-123456.webp`,
      ),
    ).resolves.toBe(true);
    expect(send.mock.calls[0][0].input).toEqual({
      Bucket: "test-bucket",
      Key: "products/image-1750000000000-123456.webp",
    });
  });
});
