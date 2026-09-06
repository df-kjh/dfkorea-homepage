import { QuoteAdminController } from "./quote-admin.controller";
import { QuoteAdminService } from "./quote-admin.service";
import { Module } from "@nestjs/common";
import { TendersModule } from "../tenders/tenders.module";
import { AuthModule } from "../auth/auth.module";
import { QuotesController } from "./quotes.controller";
import {
  QuoteOriginGuard,
  QuoteSessionGuard,
  QuoteSessionService,
} from "./quote-session.service";
import { NtsVerifier } from "./nts-verifier";
import {
  QuotePrivateStorage,
  QuoteAttachmentService,
} from "./quote-attachment.service";
import { QuoteSubmissionService } from "./quote-submission.service";
import { QuoteWorkerService } from "./quote-worker.service";
@Module({
  imports: [TendersModule, AuthModule],
  controllers: [QuotesController, QuoteAdminController],
  providers: [
    QuoteAdminService,
    QuoteSessionService,
    QuoteOriginGuard,
    QuoteSessionGuard,
    NtsVerifier,
    QuotePrivateStorage,
    QuoteAttachmentService,
    QuoteSubmissionService,
    QuoteWorkerService,
  ],
})
export class QuotesModule {}
