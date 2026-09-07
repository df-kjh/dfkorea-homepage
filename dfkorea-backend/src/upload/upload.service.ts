import { BadRequestException, Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import * as sharp from "sharp";
import { extname } from "path";

export type UploadFolder = "products" | "posts" | "temp" | "certificates";

const RASTER_FORMATS = {
  jpeg: { mime: "image/jpeg", extensions: [".jpg", ".jpeg"] },
  png: { mime: "image/png", extensions: [".png"] },
  gif: { mime: "image/gif", extensions: [".gif"] },
  webp: { mime: "image/webp", extensions: [".webp"] },
};

function detectRasterFormat(
  bytes: Buffer,
): keyof typeof RASTER_FORMATS | undefined {
  if (
    bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
  )
    return "png";
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff)
    return "jpeg";
  if (/^GIF8[79]a$/.test(bytes.subarray(0, 6).toString("ascii"))) return "gif";
  if (
    bytes.subarray(0, 4).toString("ascii") === "RIFF" &&
    bytes.subarray(8, 12).toString("ascii") === "WEBP"
  )
    return "webp";
  return undefined;
}

@Injectable()
export class UploadService {
  private s3Client: S3Client;
  private bucketName: string;
  private publicUrl: string;

  constructor(private configService: ConfigService) {
    const endpoint = this.configService.get("R2_ENDPOINT");
    const accessKeyId = this.configService.get("R2_ACCESS_KEY_ID");
    const secretAccessKey = this.configService.get("R2_SECRET_ACCESS_KEY");

    if (endpoint && accessKeyId && secretAccessKey) {
      // Cloudflare R2 사용
      this.s3Client = new S3Client({
        region: "auto",
        endpoint,
        credentials: {
          accessKeyId,
          secretAccessKey,
        },
      });
      this.bucketName = this.configService.get("R2_BUCKET_NAME");
      this.publicUrl = this.configService.get("R2_PUBLIC_URL");
      console.log("✅ Cloudflare R2 initialized");
    } else {
      console.log("⚠️  R2 credentials not found, using local storage");
    }
  }

  async uploadImage(
    file: Express.Multer.File,
    folder: UploadFolder = "temp",
  ): Promise<string> {
    if (!["products", "posts", "temp", "certificates"].includes(folder)) {
      throw new BadRequestException("허용되지 않은 업로드 폴더입니다");
    }
    if (
      !Buffer.isBuffer(file?.buffer) ||
      !file.buffer.length ||
      file.buffer.length > 10 * 1024 * 1024
    ) {
      throw new BadRequestException("파일 크기는 10MB 이하여야 합니다");
    }
    const extension = extname(file.originalname || "").toLowerCase();
    const isPdf = file.mimetype === "application/pdf";

    let processedBuffer: Buffer;
    let contentType: string;
    let fileExtension: string;

    if (isPdf) {
      // PDF 원본을 보존하되 서버에서 렌더링하지 않는다. 형식 검사는 악성 코드
      // 검사가 아니므로 다운로드 응답으로만 제공하며 SVG 등은 허용하지 않는다.
      if (
        extension !== ".pdf" ||
        !/^%PDF-\d\.\d[\r\n]/.test(
          file.buffer.subarray(0, 16).toString("ascii"),
        ) ||
        !/%%EOF[\s\0]*$/.test(file.buffer.subarray(-1024).toString("ascii"))
      ) {
        throw new BadRequestException("올바른 PDF 파일이 아닙니다");
      }
      processedBuffer = file.buffer;
      contentType = "application/pdf";
      fileExtension = "pdf";
    } else {
      // Sharp에 전달하기 전에 래스터 시그니처를 확인하여 SVG/XML/PDF 파서를
      // 실행하지 않는다. MIME/확장자는 클라이언트가 지정하므로 바이트와 대조한다.
      const bytes = file.buffer;
      const expected = RASTER_FORMATS[detectRasterFormat(bytes)];
      if (
        !expected ||
        file.mimetype !== expected.mime ||
        !expected.extensions.includes(extension)
      ) {
        throw new BadRequestException(
          "이미지 형식과 확장자가 일치하지 않습니다",
        );
      }
      try {
        // 압축 파일 크기와 무관한 픽셀 폭탄을 제한한다. 기존 GIF 동작처럼 첫
        // 프레임만 변환하며 여러 프레임 전체를 메모리에 디코딩하지 않는다.
        processedBuffer = await sharp(bytes, {
          limitInputPixels: 40000000,
          failOn: "warning",
        })
          .resize(1920, 1920, { fit: "inside", withoutEnlargement: true })
          .webp({ quality: 85 })
          .toBuffer();
      } catch {
        throw new BadRequestException(
          "손상된 이미지이거나 최대 픽셀 수(40MP)를 초과했습니다",
        );
      }
      contentType = "image/webp";
      fileExtension = "webp";
    }

    // 파일명 생성 (폴더 경로 포함)
    const timestamp = Date.now();
    const randomString = Math.round(Math.random() * 1e9);
    const filename = `${folder}/${isPdf ? "document" : "image"}-${timestamp}-${randomString}.${fileExtension}`;

    if (this.s3Client) {
      // R2에 업로드
      await this.s3Client.send(
        new PutObjectCommand({
          Bucket: this.bucketName,
          Key: filename,
          Body: processedBuffer,
          ContentType: contentType,
          // CORS를 위한 헤더 추가
          CacheControl: "public, max-age=31536000",
          ContentDisposition: isPdf ? "attachment" : undefined,
        }),
      );

      const fileUrl = `${this.publicUrl.replace(/\/+$/, "")}/${filename}`;

      console.log(`📄 ${isPdf ? "PDF" : "Image"} uploaded to R2:`, {
        folder,
        filename,
        size: `${(processedBuffer.length / 1024).toFixed(2)}KB`,
        url: fileUrl,
      });

      return fileUrl;
    } else {
      // 로컬 저장 (R2 미설정 시 폴백)
      const fs = require("fs").promises;
      const path = require("path");
      const localPath = path.join("./uploads", filename);

      await fs.writeFile(localPath, processedBuffer);

      const publicDomain = this.configService.get("RAILWAY_PUBLIC_DOMAIN");
      const baseUrl = publicDomain
        ? `https://${publicDomain}`
        : this.configService.get("BASE_URL") ||
          `http://localhost:${this.configService.get("PORT") || 3000}`;

      const fileUrl = `${baseUrl}/uploads/${filename}`;

      console.log(`📄 ${isPdf ? "PDF" : "Image"} uploaded locally:`, {
        folder,
        filename,
        size: `${(processedBuffer.length / 1024).toFixed(2)}KB`,
        url: fileUrl,
      });

      return fileUrl;
    }
  }

  /**
   * R2에서 이미지 삭제
   * @param imageUrl 삭제할 이미지 URL
   */
  async deleteImage(imageUrl: string): Promise<boolean> {
    if (!this.s3Client) {
      console.log("⚠️  R2 not configured, skipping delete");
      return false;
    }

    // URL 파싱은 ../, 인코딩, 사용자 정보 등을 정규화할 수 있다. 원문과
    // 설정된 공개 베이스를 정확히 비교한 뒤 이 서비스가 생성한 키만 허용한다.
    const base = this.publicUrl?.replace(/\/+$/, "");
    if (
      typeof imageUrl !== "string" ||
      !base ||
      !imageUrl.startsWith(`${base}/`)
    ) {
      throw new BadRequestException("삭제할 수 없는 파일 URL입니다");
    }
    const key = imageUrl.slice(base.length + 1);
    if (
      !/^(products|posts|temp|certificates)\/(image-\d+-\d+\.webp|document-\d+-\d+\.pdf)$/.test(
        key,
      )
    ) {
      throw new BadRequestException("삭제할 수 없는 파일 경로입니다");
    }
    try {
      await this.s3Client.send(
        new DeleteObjectCommand({
          Bucket: this.bucketName,
          Key: key,
        }),
      );

      console.log("🗑️  Image deleted from R2:", key);
      return true;
    } catch (error) {
      console.error("Failed to delete image from R2:", error);
      return false;
    }
  }

  /**
   * 여러 이미지를 한 번에 삭제
   * @param imageUrls 삭제할 이미지 URL 배열
   */
  async deleteImages(imageUrls: string[]): Promise<void> {
    const deletePromises = imageUrls.map((url) => this.deleteImage(url));
    await Promise.all(deletePromises);
  }

  /**
   * temp 폴더의 이미지를 실제 폴더로 이동
   * @param tempUrl temp 폴더의 이미지 URL
   * @param targetFolder 이동할 폴더 (products 또는 posts)
   */
  async moveTempImage(
    tempUrl: string,
    targetFolder: "products" | "posts",
  ): Promise<string> {
    if (!tempUrl.includes("/temp/")) {
      // 이미 temp가 아닌 이미지는 그대로 반환
      return tempUrl;
    }

    // temp를 targetFolder로 교체
    const newUrl = tempUrl.replace("/temp/", `/${targetFolder}/`);

    // R2에서는 rename이 없으므로 새 URL만 반환
    // 실제로는 copy + delete를 해야 하지만, URL 구조만 변경
    return newUrl;
  }
}
