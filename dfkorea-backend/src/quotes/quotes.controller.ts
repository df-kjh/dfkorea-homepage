import {
  Body,
  Controller,
  Delete,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
  UsePipes,
  ValidationPipe,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { memoryStorage } from "multer";
import { Request } from "express";
import {
  QuoteOriginGuard,
  QuoteSessionGuard,
  QuoteSessionService,
} from "./quote-session.service";
import {
  QuoteSubmissionDto,
  VerificationDto,
  QuoteAttachmentUploadDto,
} from "./quote.dto";
import { QuoteAttachmentService } from "./quote-attachment.service";
import { QuoteSubmissionService } from "./quote-submission.service";
type QuoteRequest = Request & { quoteSessionId: string };

@Controller("quotes")
@UseGuards(QuoteOriginGuard)
@UsePipes(
  new ValidationPipe({
    transform: true,
    whitelist: true,
    forbidNonWhitelisted: true,
  }),
)
export class QuotesController {
  constructor(
    private readonly sessions: QuoteSessionService,
    private readonly attachments: QuoteAttachmentService,
    private readonly submissions: QuoteSubmissionService,
  ) {}
  @Post("sessions") createSession() {
    return this.sessions.create();
  }
  @Post("business-verifications")
  @UseGuards(QuoteSessionGuard)
  verify(@Req() request: QuoteRequest, @Body() body: VerificationDto) {
    return this.sessions.verify(request.quoteSessionId, body);
  }
  @Post("attachments")
  @UseGuards(QuoteSessionGuard)
  @UseInterceptors(
    FileInterceptor("file", {
      storage: memoryStorage(),
      limits: {
        fileSize: 5 * 1024 * 1024,
        files: 1,
        fields: 1,
        fieldSize: 100,
        // Busboy는 한도에 도달하는 즉시 partsLimit을 내므로 실제 허용 2개에 여유 1을 둔다. 파일/필드 각각 1개 제한은 유지한다.
        parts: 3,
      },
    }),
  )
  upload(
    @Req() request: QuoteRequest,
    @UploadedFile() file: Express.Multer.File,
    @Body() body: QuoteAttachmentUploadDto,
  ) {
    return this.attachments.upload(
      request.quoteSessionId,
      file,
      body.clientAttachmentId,
    );
  }
  @Delete("attachments/:id")
  @UseGuards(QuoteSessionGuard)
  remove(@Req() request: QuoteRequest, @Param("id", ParseUUIDPipe) id: string) {
    return this.attachments.remove(request.quoteSessionId, id);
  }
  @Post()
  @UseGuards(QuoteSessionGuard)
  submit(@Req() request: QuoteRequest, @Body() body: QuoteSubmissionDto) {
    return this.submissions.submit(request.quoteSessionId, body);
  }
}
