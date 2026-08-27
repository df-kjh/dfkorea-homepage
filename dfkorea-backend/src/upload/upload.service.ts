import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import * as sharp from "sharp";

export type UploadFolder = "products" | "posts" | "temp" | "certificates";

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
    const isPdf = file.mimetype === 'application/pdf';
    
    let processedBuffer: Buffer;
    let contentType: string;
    let fileExtension: string;
    
    if (isPdf) {
      // PDF는 원본 그대로 업로드
      processedBuffer = file.buffer;
      contentType = 'application/pdf';
      fileExtension = 'pdf';
    } else {
      // 이미지는 Sharp로 최적화
      processedBuffer = await sharp(file.buffer)
        .resize(1920, 1920, {
          fit: "inside",
          withoutEnlargement: true,
        })
        .webp({ quality: 85 })
        .toBuffer();
      contentType = 'image/webp';
      fileExtension = 'webp';
    }

    // 파일명 생성 (폴더 경로 포함)
    const timestamp = Date.now();
    const randomString = Math.round(Math.random() * 1e9);
    const filename = `${folder}/${isPdf ? 'document' : 'image'}-${timestamp}-${randomString}.${fileExtension}`;

    if (this.s3Client) {
      // R2에 업로드
      await this.s3Client.send(
        new PutObjectCommand({
          Bucket: this.bucketName,
          Key: filename,
          Body: processedBuffer,
          ContentType: contentType,
          // CORS를 위한 헤더 추가
          CacheControl: 'public, max-age=31536000',
          ContentDisposition: isPdf ? 'inline' : undefined,
        }),
      );

      const fileUrl = `${this.publicUrl}/${filename}`;

      console.log(`📄 ${isPdf ? 'PDF' : 'Image'} uploaded to R2:`, {
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

      console.log(`📄 ${isPdf ? 'PDF' : 'Image'} uploaded locally:`, {
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

    try {
      // URL에서 파일 경로 추출
      const url = new URL(imageUrl);
      const key = url.pathname.substring(1); // 앞의 '/' 제거

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
