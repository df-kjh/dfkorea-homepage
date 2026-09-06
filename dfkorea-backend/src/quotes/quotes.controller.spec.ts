import { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request = require("supertest");
import { randomUUID } from "crypto";
import { QuotesController } from "./quotes.controller";
import { QuoteAttachmentService } from "./quote-attachment.service";
import {
  QuoteOriginGuard,
  QuoteSessionGuard,
  QuoteSessionService,
} from "./quote-session.service";
import { QuoteSubmissionService } from "./quote-submission.service";

describe("quote multipart attachment contract", () => {
  let app: INestApplication;
  const upload = jest.fn();
  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [QuotesController],
      providers: [
        { provide: QuoteAttachmentService, useValue: { upload } },
        { provide: QuoteSessionService, useValue: {} },
        { provide: QuoteSubmissionService, useValue: {} },
      ],
    })
      .overrideGuard(QuoteOriginGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(QuoteSessionGuard)
      .useValue({
        canActivate: (context) => {
          context.switchToHttp().getRequest().quoteSessionId = "session-id";
          return true;
        },
      })
      .compile();
    app = module.createNestApplication();
    await app.init();
  });
  afterAll(async () => {
    await app.close();
  });
  beforeEach(() => upload.mockReset());
  it("accepts file plus stable UUID and returns the object contract", async () => {
    const clientAttachmentId = randomUUID();
    const result = {
      id: randomUUID(),
      name: "photo.jpg",
      mimeType: "image/jpeg",
      size: 1,
    };
    upload.mockResolvedValue(result);
    await request(app.getHttpServer())
      .post("/quotes/attachments")
      .field("clientAttachmentId", clientAttachmentId)
      .attach("file", Buffer.from("x"), "photo.jpg")
      .expect(201, result);
    expect(upload).toHaveBeenCalledWith(
      "session-id",
      expect.objectContaining({ originalname: "photo.jpg" }),
      clientAttachmentId,
    );
  });
  it.each([undefined, "not-a-uuid"])(
    "requires a valid stable attachment UUID (%s)",
    async (key) => {
      let call = request(app.getHttpServer()).post("/quotes/attachments");
      if (key) call = call.field("clientAttachmentId", key);
      await call.attach("file", Buffer.from("x"), "photo.jpg").expect(400);
      expect(upload).not.toHaveBeenCalled();
    },
  );
});
