import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
import * as cron from "node-cron";
import type { ScheduledTask } from "node-cron";
import { PostsService } from "../posts/posts.service";
import { AiService } from "../ai/ai.service";
import { ProductsService } from "../products/products.service";
import { Product } from "../entities/product.entity";

@Injectable()
export class SchedulerService implements OnModuleInit {
  private readonly logger = new Logger(SchedulerService.name);
  private readonly timezone = process.env.CRON_TIMEZONE || "Asia/Seoul";
  private weeklyPostTask?: ScheduledTask;
  private dailyProductNewsTask?: ScheduledTask;

  constructor(
    private readonly postsService: PostsService,
    private readonly aiService: AiService,
    private readonly productsService: ProductsService
  ) {}

  onModuleInit() {
    this.scheduleWeeklyPost();
    this.scheduleDailyProductCompanyNewsPost();
    this.logger.log(
      `✅ Scheduler initialized. timezone=${this.timezone}, serverTime=${new Date().toISOString()}`
    );
  }

  /**
   * 매주 월요일 오전 8시에 LED 산업 동향 포스트 자동 생성
   * Cron: 0 0 8 * * 1 (초 분 시 일 요일)
   * - 분: 0
   * - 시: 8
   * - 일: * (매일)
   * - 월: * (매월)
   * - 요일: 1 (월요일, 0=일요일, 1=월요일)
   */
  private scheduleWeeklyPost() {
    // 매주 월요일 오전 8시 (한국 시간 기준)
    // 서버가 UTC 시간대라면 KST-9시간 = 23시 (일요일)
    // 서버 시간대에 맞게 조정 필요
    const cronExpression = "0 0 8 * * 1"; // 매주 월요일 오전 8시

    this.weeklyPostTask = cron.schedule(cronExpression, async () => {
      this.logger.log("⏰ Weekly post generation triggered");
      await this.generateAndPublishPost();
    }, {
      name: "weekly-led-industry-trend-post",
      noOverlap: true,
      timezone: this.timezone,
    });
    this.weeklyPostTask.start();

    this.logger.log(
      `📅 Scheduled weekly post generation: Every Monday at 8:00 AM`
    );
    this.logger.log(
      `Weekly cron timezone=${this.timezone}, nextRun=${this.formatNextRun(this.weeklyPostTask)}`
    );
  }

  /**
   * 매일 오전 8시에 제품 소개 기반 제품소식 포스트 자동 생성
   * Cron: 0 0 8 * * * (매일 오전 8시)
   */
  private scheduleDailyProductCompanyNewsPost() {
    const cronExpression = "0 0 8 * * *"; // 매일 오전 8시

    this.dailyProductNewsTask = cron.schedule(cronExpression, async () => {
      this.logger.log("⏰ Daily product news generation triggered");
      await this.generateAndPublishProductCompanyNewsPost();
    }, {
      name: "daily-product-news-post",
      noOverlap: true,
      timezone: this.timezone,
    });
    this.dailyProductNewsTask.start();

    this.logger.log(
      "📅 Scheduled daily product news generation: Every day at 8:00 AM"
    );
    this.logger.log(
      `Daily product news cron timezone=${this.timezone}, nextRun=${this.formatNextRun(this.dailyProductNewsTask)}`
    );
  }

  /**
   * AI 블로그 글 생성 및 업로드
   * 수동 트리거도 가능하도록 public 메서드로 제공
   */
  async generateAndPublishPost(): Promise<void> {
    try {
      // AI 사용 가능 여부 확인
      if (!this.aiService.isAvailable()) {
        this.logger.warn(
          "⚠️ AI service is not available. Skipping post generation."
        );
        return;
      }

      this.logger.log("🤖 Generating LED industry trend post...");

      // AI로 블로그 글 생성
      const generatedPost = await this.aiService.generateLedIndustryTrendPost();

      // 데이터베이스에 저장
      const createdPost = await this.postsService.create({
        title: generatedPost.title,
        excerpt: generatedPost.excerpt,
        content: generatedPost.content,
        category: generatedPost.category,
        image: generatedPost.image,
      });

      this.logger.log(
        `✅ Post published successfully: "${createdPost.title}" (ID: ${createdPost.id})`
      );
    } catch (error) {
      this.logger.error("❌ Failed to generate and publish post:", error);
    }
  }

  /**
   * DB에 저장된 제품 중 하나를 골라 제품소식 게시글 생성 및 업로드
   */
  async generateAndPublishProductCompanyNewsPost(): Promise<void> {
    try {
      if (!this.aiService.isAvailable()) {
        this.logger.warn(
          "⚠️ AI service is not available. Skipping product news generation."
        );
        return;
      }

      const products = await this.productsService.findAll();
      if (products.length === 0) {
        this.logger.warn(
          "⚠️ No products found. Skipping product news generation."
        );
        return;
      }

      const selectedProduct = this.selectDailyProduct(products);
      this.logger.log(
        `🤖 Generating product news post for product: ${selectedProduct.name}`
      );

      const generatedPost =
        await this.aiService.generateProductCompanyNewsPost(selectedProduct);

      const createdPost = await this.postsService.create({
        title: generatedPost.title,
        excerpt: generatedPost.excerpt,
        content: generatedPost.content,
        category: generatedPost.category,
        image: generatedPost.image,
      });

      this.logger.log(
        `✅ Product news published successfully: "${createdPost.title}" (ID: ${createdPost.id})`
      );
    } catch (error) {
      this.logger.error(
        "❌ Failed to generate and publish product news post:",
        error
      );
    }
  }

  /**
   * 날짜 기반으로 제품을 순환 선택하여 같은 날에는 같은 제품이 선택되도록 함
   */
  private selectDailyProduct(products: Product[]): Product {
    const sortedProducts = [...products].sort((a, b) => {
      const aKey = a.createdAt?.getTime?.() || 0;
      const bKey = b.createdAt?.getTime?.() || 0;
      if (aKey !== bKey) {
        return aKey - bKey;
      }
      return a.id.localeCompare(b.id);
    });

    const daysSinceEpoch = this.getKstDaysSinceEpoch();
    const selectedIndex = daysSinceEpoch % sortedProducts.length;
    return sortedProducts[selectedIndex];
  }

  private getKstDaysSinceEpoch(): number {
    const kstOffsetMs = 9 * 60 * 60 * 1000;
    return Math.floor((Date.now() + kstOffsetMs) / 86400000);
  }

  private formatNextRun(task?: ScheduledTask): string {
    return task?.getNextRun()?.toISOString() || "not available";
  }

  /**
   * 테스트용: 즉시 포스트 생성
   */
  async triggerImmediatePost(): Promise<void> {
    this.logger.log("🔧 Manual trigger: Generating post immediately...");
    await this.generateAndPublishPost();
  }

  /**
   * 테스트용: 즉시 제품소식 포스트 생성
   */
  async triggerImmediateProductCompanyNewsPost(): Promise<void> {
    this.logger.log(
      "🔧 Manual trigger: Generating product news post immediately..."
    );
    await this.generateAndPublishProductCompanyNewsPost();
  }
}
