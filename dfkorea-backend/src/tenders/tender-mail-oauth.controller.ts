import {
  BadRequestException,
  Controller,
  Get,
  Post,
  Query,
  Res,
  UseGuards,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { Response } from "express";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { NaverWorksOAuthService } from "./mail/naver-works-oauth.service";

@Controller("tenders/mail/oauth")
export class TenderMailOAuthController {
  constructor(
    private readonly oauth: NaverWorksOAuthService,
    private readonly config: ConfigService,
  ) {}

  @Post("authorize")
  @UseGuards(JwtAuthGuard)
  async authorize(): Promise<{ authorizationUrl: string }> {
    return { authorizationUrl: await this.oauth.beginAuthorization() };
  }

  @Get("status")
  @UseGuards(JwtAuthGuard)
  status() {
    return this.oauth.getStatus();
  }

  @Get("callback")
  async callback(
    @Query("code") code: string,
    @Query("state") state: string,
    @Res() response: Response,
  ): Promise<void> {
    if (!code || !state) {
      throw new BadRequestException("OAuth callback is incomplete");
    }
    const publicSiteUrl = this.config.get<string>("PUBLIC_SITE_URL")?.trim();
    let redirect: URL;
    try {
      redirect = new URL("/admin/dashboard", publicSiteUrl);
    } catch {
      throw new Error("PUBLIC_SITE_URL is invalid");
    }
    await this.oauth.completeAuthorization(code, state);
    redirect.searchParams.set("tab", "tenders");
    redirect.searchParams.set("mailOAuth", "connected");
    response.redirect(redirect.toString());
  }
}
