import { Controller, Get, Header } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PostsService } from "../posts/posts.service";
import { ProductsService } from "../products/products.service";
import { Post } from "../entities/post.entity";
import { Product } from "../entities/product.entity";

@Controller()
export class SeoController {
  private readonly siteUrl: string;
  private readonly assetBaseUrl: string;

  constructor(
    private readonly postsService: PostsService,
    private readonly productsService: ProductsService,
    private readonly configService: ConfigService,
  ) {
    this.siteUrl = (
      this.configService.get<string>("PUBLIC_SITE_URL") ||
      "https://www.dfkorealed.com"
    ).replace(/\/$/, "");
    this.assetBaseUrl = (
      this.configService.get<string>("PUBLIC_API_URL") ||
      this.configService.get<string>("API_BASE_URL") ||
      this.siteUrl
    ).replace(/\/$/, "");
  }

  @Get(["sitemap.xml", "seo/sitemap.xml"])
  @Header("Content-Type", "application/xml; charset=utf-8")
  async getSitemap(): Promise<string> {
    const [posts, products] = await Promise.all([
      this.postsService.findAll(),
      this.productsService.findAll(),
    ]);

    const staticUrls = [
      this.urlEntry("/", "daily", "1.0"),
      this.urlEntry("/about", "monthly", "0.8"),
      this.urlEntry("/certificates", "monthly", "0.8"),
      this.urlEntry("/products", "daily", "0.9"),
      this.urlEntry("/blog", "daily", "0.8"),
    ];

    const productUrls = products.map((product) =>
      this.urlEntry(
        `/products/${product.id}`,
        "weekly",
        "0.8",
        product.updatedAt || product.createdAt,
        this.getProductImage(product),
        product.name,
      ),
    );

    const postUrls = posts.map((post) =>
      this.urlEntry(
        `/blog/${post.id}`,
        "weekly",
        "0.7",
        post.updatedAt || post.createdAt,
        post.image,
        post.title,
      ),
    );

    return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">
${[...staticUrls, ...productUrls, ...postUrls].join("\n")}
</urlset>`;
  }

  @Get(["rss.xml", "seo/rss.xml"])
  @Header("Content-Type", "application/rss+xml; charset=utf-8")
  async getRss(): Promise<string> {
    const posts = await this.postsService.findAll();
    const sortedPosts = [...posts]
      .sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      )
      .slice(0, 50);

    const items = sortedPosts.map((post) => this.rssItem(post)).join("\n");
    const lastBuildDate =
      sortedPosts[0]?.updatedAt || sortedPosts[0]?.createdAt || new Date();

    return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0"
     xmlns:atom="http://www.w3.org/2005/Atom"
     xmlns:content="http://purl.org/rss/1.0/modules/content/"
     xmlns:dc="http://purl.org/dc/elements/1.1/">
  <channel>
    <title>(주)디에프코리아 - LED 조명 전문 기업</title>
    <link>${this.siteUrl}/</link>
    <atom:link href="${this.siteUrl}/rss.xml" rel="self" type="application/rss+xml" />
    <description>(주)디에프코리아의 최신 소식과 LED 조명 제품 정보를 확인하세요.</description>
    <language>ko</language>
    <copyright>Copyright ${new Date().getFullYear()} (주)디에프코리아. All rights reserved.</copyright>
    <lastBuildDate>${this.toRssDate(lastBuildDate)}</lastBuildDate>
    <ttl>60</ttl>
${items}
  </channel>
</rss>`;
  }

  private urlEntry(
    path: string,
    changefreq: string,
    priority: string,
    lastmod?: Date,
    image?: string | null,
    imageTitle?: string,
  ): string {
    const imageBlock = image
      ? `
    <image:image>
      <image:loc>${this.escapeXml(this.absoluteUrl(image))}</image:loc>
      ${imageTitle ? `<image:title>${this.escapeXml(imageTitle)}</image:title>` : ""}
    </image:image>`
      : "";

    return `  <url>
    <loc>${this.escapeXml(`${this.siteUrl}${path}`)}</loc>
    ${lastmod ? `<lastmod>${this.toIsoDate(lastmod)}</lastmod>` : ""}
    <changefreq>${changefreq}</changefreq>
    <priority>${priority}</priority>${imageBlock}
  </url>`;
  }

  private rssItem(post: Post): string {
    const link = `${this.siteUrl}/blog/${post.id}`;
    const pubDate = post.createdAt || new Date();

    return `    <item>
      <title>${this.escapeXml(post.title)}</title>
      <link>${this.escapeXml(link)}</link>
      <guid isPermaLink="true">${this.escapeXml(link)}</guid>
      <description>${this.escapeXml(post.excerpt)}</description>
      <category>${this.escapeXml(post.category)}</category>
      <pubDate>${this.toRssDate(pubDate)}</pubDate>
    </item>`;
  }

  private getProductImage(product: Product): string | null {
    return product.images?.find((image) => image.image)?.image || null;
  }

  private absoluteUrl(url: string): string {
    if (/^https?:\/\//i.test(url)) {
      return url;
    }

    const normalizedPath = url.startsWith("/") ? url : `/${url}`;
    return `${this.assetBaseUrl}${normalizedPath}`;
  }

  private toIsoDate(date: Date): string {
    return new Date(date).toISOString().split("T")[0];
  }

  private toRssDate(date: Date): string {
    return new Date(date).toUTCString();
  }

  private escapeXml(value: string): string {
    return value
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&apos;");
  }
}
