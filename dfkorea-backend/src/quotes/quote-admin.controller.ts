import {
  Body,
  Controller,
  Get,
  Header,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Req,
  StreamableFile,
  UseGuards,
  UsePipes,
  ValidationPipe,
} from "@nestjs/common";
import { Request } from "express";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { QuoteAdminActor, QuoteAdminService } from "./quote-admin.service";
import { QuoteRetryDto } from "./quote.dto";

type AdminRequest = Request & { user: QuoteAdminActor };

@Controller("quotes/admin")
@UseGuards(JwtAuthGuard)
@UsePipes(
  new ValidationPipe({
    transform: true,
    whitelist: true,
    forbidNonWhitelisted: true,
  }),
)
export class QuoteAdminController {
  constructor(private readonly admin: QuoteAdminService) {}

  @Get()
  @Header("Cache-Control", "private, no-store")
  list(@Query() query: Record<string, unknown>) {
    return this.admin.list(query);
  }

  @Get(":id")
  @Header("Cache-Control", "private, no-store")
  detail(@Param("id", ParseUUIDPipe) id: string) {
    return this.admin.detail(id);
  }

  @Get(":id/attachments/:attachmentId")
  @Header("Cache-Control", "private, no-store")
  @Header("X-Content-Type-Options", "nosniff")
  async attachment(
    @Param("id", ParseUUIDPipe) id: string,
    @Param("attachmentId", ParseUUIDPipe) attachmentId: string,
  ) {
    const photo = await this.admin.attachment(id, attachmentId);
    // 한글 파일명은 RFC 5987로 인코딩하고 ASCII 대체 이름은 서버 ID에서 생성해 헤더 주입을 방지한다.
    const encodedName = encodeURIComponent(photo.name).replace(
      /['()*]/g,
      (character) => `%${character.charCodeAt(0).toString(16).toUpperCase()}`,
    );
    const extension = photo.mimeType === "image/png" ? "png" : "jpg";
    return new StreamableFile(photo.bytes, {
      type: photo.mimeType,
      length: photo.bytes.length,
      disposition: `attachment; filename="quote-${attachmentId}.${extension}"; filename*=UTF-8''${encodedName}`,
    });
  }

  @Post(":id/retry")
  @HttpCode(200)
  @Header("Cache-Control", "private, no-store")
  retry(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() body: QuoteRetryDto,
    @Req() request: AdminRequest,
  ) {
    const actor: QuoteAdminActor = {};
    if (request.user?.userId) actor.userId = request.user.userId;
    if (request.user?.username) actor.username = request.user.username;
    return this.admin.retry(id, body, actor);
  }
}
