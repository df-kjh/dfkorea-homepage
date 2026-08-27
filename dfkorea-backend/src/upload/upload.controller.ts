import {
  Controller,
  Post,
  Delete,
  UploadedFile,
  UseInterceptors,
  BadRequestException,
  Query,
  Body,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { UploadService, UploadFolder } from "./upload.service";

@Controller("upload")
export class UploadController {
  constructor(private uploadService: UploadService) {}

  @Post("image")
  @UseInterceptors(
    FileInterceptor("image", {
      limits: {
        fileSize: 5 * 1024 * 1024, // 5MB
      },
      fileFilter: (req, file, callback) => {
        if (!file.originalname.match(/\.(jpg|jpeg|png|gif|webp)$/)) {
          return callback(
            new BadRequestException("이미지 파일만 업로드 가능합니다"),
            false,
          );
        }
        callback(null, true);
      },
    }),
  )
  async uploadImage(
    @UploadedFile() file: Express.Multer.File,
    @Query("folder") folder?: UploadFolder,
  ) {
    if (!file) {
      throw new BadRequestException("파일이 업로드되지 않았습니다");
    }

    try {
      const url = await this.uploadService.uploadImage(file, folder || "temp");

      return {
        url,
        filename: url.split("/").pop(),
        originalname: file.originalname,
        size: file.size,
      };
    } catch (error) {
      console.error("Upload error:", error);
      throw new BadRequestException("이미지 업로드에 실패했습니다");
    }
  }

  @Delete("image")
  async deleteImage(@Body("url") url: string) {
    if (!url) {
      throw new BadRequestException("삭제할 이미지 URL을 제공해주세요");
    }

    try {
      const success = await this.uploadService.deleteImage(url);
      return {
        success,
        message: success
          ? "이미지가 삭제되었습니다"
          : "이미지 삭제에 실패했습니다",
      };
    } catch (error) {
      console.error("Delete error:", error);
      throw new BadRequestException("이미지 삭제에 실패했습니다");
    }
  }

  @Post("file")
  @UseInterceptors(
    FileInterceptor("file", {
      limits: {
        fileSize: 10 * 1024 * 1024, // 10MB
      },
      fileFilter: (req, file, callback) => {
        // 이미지 또는 PDF 허용 (대소문자 무시)
        const isValidExtension = file.originalname.match(/\.(jpg|jpeg|png|gif|webp|pdf)$/i);
        const isValidMimeType = 
          file.mimetype.startsWith('image/') || 
          file.mimetype === 'application/pdf';
        
        if (!isValidExtension || !isValidMimeType) {
          console.error('Invalid file upload attempt:', {
            originalname: file.originalname,
            mimetype: file.mimetype
          });
          return callback(
            new BadRequestException("이미지 또는 PDF 파일만 업로드 가능합니다"),
            false,
          );
        }
        callback(null, true);
      },
    }),
  )
  async uploadFile(
    @UploadedFile() file: Express.Multer.File,
    @Query("folder") folder?: UploadFolder,
  ) {
    if (!file) {
      throw new BadRequestException("파일이 업로드되지 않았습니다");
    }
    
    console.log('File upload request:', {
      originalname: file.originalname,
      mimetype: file.mimetype,
      size: file.size,
      folder
    });

    try {
      const url = await this.uploadService.uploadImage(file, folder || "temp");

      return {
        url,
        filename: url.split("/").pop(),
        originalname: file.originalname,
        size: file.size,
      };
    } catch (error) {
      console.error("Upload error:", error);
      throw new BadRequestException("파일 업로드에 실패했습니다");
    }
  }
}
