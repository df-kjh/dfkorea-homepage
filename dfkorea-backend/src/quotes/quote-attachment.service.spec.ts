import sharp = require("sharp");
import { prepareQuoteImage } from "./quote-attachment.service";
describe("private quote images", () => {
  it("decodes real pixels, limits dimensions and removes metadata", async () => {
    const input = await sharp({
      create: { width: 2100, height: 10, channels: 3, background: "red" },
    })
      .jpeg()
      .withMetadata({ exif: { IFD0: { Copyright: "private information" } } })
      .toBuffer();
    const output = await prepareQuoteImage({
      buffer: input,
      originalname: "<unsafe>.jpg",
      mimetype: "image/jpeg",
    });
    const info = await sharp(output.buffer).metadata();
    expect(info.width).toBe(1920);
    expect(info.exif).toBeUndefined();
    expect(output.buffer.length).toBeLessThanOrEqual(2 * 1024 * 1024);
  });
  it("rejects disguised non-images, MIME mismatch, oversized originals and animation", async () => {
    await expect(
      prepareQuoteImage({
        buffer: Buffer.from("not an image"),
        originalname: "a.jpg",
        mimetype: "image/jpeg",
      }),
    ).rejects.toThrow();
    const input = await sharp({
      create: { width: 10, height: 10, channels: 3, background: "red" },
    })
      .png()
      .toBuffer();
    await expect(
      prepareQuoteImage({
        buffer: input,
        originalname: "a.jpg",
        mimetype: "image/jpeg",
      }),
    ).rejects.toThrow();
    await expect(
      prepareQuoteImage({
        buffer: Buffer.alloc(5 * 1024 * 1024 + 1),
        originalname: "a.png",
        mimetype: "image/png",
      }),
    ).rejects.toThrow();
  });
});
