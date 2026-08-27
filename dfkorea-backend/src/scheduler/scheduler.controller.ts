import { Controller, Post, UseGuards } from "@nestjs/common";
import { SchedulerService } from "./scheduler.service";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";

@Controller("scheduler")
export class SchedulerController {
  constructor(private readonly schedulerService: SchedulerService) {}

  /**
   * 수동으로 AI 블로그 글 생성 트리거 (관리자 전용)
   * POST /api/scheduler/trigger
   */
  @Post("trigger")
  @UseGuards(JwtAuthGuard)
  async triggerPostGeneration(): Promise<{ message: string }> {
    await this.schedulerService.triggerImmediatePost();
    return {
      message: "AI 블로그 글 생성이 트리거되었습니다. 로그를 확인해주세요.",
    };
  }

  /**
   * 수동으로 제품소식 AI 블로그 글 생성 트리거 (관리자 전용)
   * POST /api/scheduler/trigger/product-company-news
   */
  @Post("trigger/product-company-news")
  @UseGuards(JwtAuthGuard)
  async triggerProductCompanyNewsGeneration(): Promise<{ message: string }> {
    await this.schedulerService.triggerImmediateProductCompanyNewsPost();
    return {
      message:
        "AI 제품소식 글 생성이 트리거되었습니다. 로그를 확인해주세요.",
    };
  }
}
