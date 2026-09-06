import { ConfigService } from "@nestjs/config";
import { Certificate } from "../entities/certificate.entity";
import { PostsService } from "../posts/posts.service";
import { ProductsService } from "../products/products.service";
import { CertificatesService } from "../certificates/certificates.service";
import { SeoController } from "./seo.controller";

const certificate = (category: string | null, updatedAt: Date): Certificate =>
  ({
    id: `${category}-${updatedAt.toISOString()}`,
    name: "에너지효율 인증서",
    issuingOrganization: "한국에너지공단",
    category,
    markImage: null,
    certificatePdf: null,
    createdAt: new Date("2026-01-01"),
    updatedAt,
  }) as Certificate;

describe("SeoController sitemap", () => {
  it("lists each normalized certificate category once using the canonical origin", async () => {
    const posts = {
      findAll: jest.fn().mockResolvedValue([]),
    } as unknown as PostsService;
    const products = {
      findAll: jest.fn().mockResolvedValue([]),
    } as unknown as ProductsService;
    const certificates = {
      findAll: jest
        .fn()
        .mockResolvedValue([
          certificate("고효율", new Date("2026-02-01")),
          certificate("고효율", new Date("2026-03-04")),
          certificate("   ", new Date("2026-03-01")),
          certificate(null, new Date("2026-03-02")),
        ]),
    } as unknown as CertificatesService;
    const config = {
      get: jest.fn().mockReturnValue(undefined),
    } as unknown as ConfigService;
    const controller = new SeoController(posts, products, config, certificates);

    const sitemap = await controller.getSitemap();
    const highEfficiencyUrl =
      "https://dfkorealed.com/certificates/%EA%B3%A0%ED%9A%A8%EC%9C%A8";

    expect(sitemap).toContain(highEfficiencyUrl);
    expect(sitemap.match(new RegExp(highEfficiencyUrl, "g"))).toHaveLength(1);
    expect(sitemap).toContain(
      "https://dfkorealed.com/certificates/%EA%B8%B0%ED%83%80",
    );
    expect(
      sitemap.match(
        /https:\/\/dfkorealed\.com\/certificates\/%EA%B8%B0%ED%83%80/g,
      ),
    ).toHaveLength(1);
    expect(sitemap).toContain(
      "<loc>https://dfkorealed.com/certificates/%EA%B8%B0%ED%83%80</loc>\n    <lastmod>2026-03-02</lastmod>",
    );
    expect(sitemap).toContain("<lastmod>2026-03-04</lastmod>");
    expect(sitemap).not.toContain("www.dfkorealed.com");
  });
});
