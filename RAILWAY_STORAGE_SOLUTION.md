# Railway 이미지 영구 저장 문제 해결

## 문제 상황

Railway는 **ephemeral(임시) 파일 시스템**을 사용합니다:

### 재배포 시 발생하는 일
```
1. 새 컨테이너 생성
2. 코드 빌드 및 실행
3. 이전 컨테이너 삭제 ← uploads/ 폴더도 삭제됨!
```

**결과**:
- ❌ 재배포할 때마다 모든 업로드 이미지 삭제
- ❌ 제품 이미지 URL이 404 에러
- ❌ 데이터베이스에는 URL 저장되어 있지만 실제 파일 없음

---

## 해결 방법 비교

| 방법 | 비용 | 난이도 | 영구성 | 추천 |
|------|------|--------|--------|------|
| Railway Volumes | $20/월 | ⭐ | ✅ | 빠른 해결 |
| Cloudflare R2 | 무료(10GB) | ⭐⭐ | ✅ | **권장** |
| AWS S3 | $0.023/GB | ⭐⭐⭐ | ✅ | 대용량 |
| Supabase Storage | 무료(1GB) | ⭐⭐ | ✅ | 소규모 |

---

## 옵션 1: Railway Volumes (즉시 해결)

### 1. Railway Pro 플랜 업그레이드

Railway Dashboard → Billing → Upgrade to Pro ($20/month)

### 2. Volume 생성

Railway Dashboard → Service (백엔드) → Settings → Volumes:

```
Mount Path: /app/uploads
Size: 5GB (필요한 만큼)
```

**Save** 클릭

### 3. 재배포

자동으로 재배포되며, 이후부터는 `/app/uploads` 폴더가 유지됩니다.

### 장점
- ✅ 설정 간단 (코드 수정 불필요)
- ✅ 즉시 적용
- ✅ 빠른 속도 (같은 서버)

### 단점
- ❌ 월 $20 추가 비용
- ❌ Railway 종속성
- ❌ CDN 없음

---

## 옵션 2: Cloudflare R2 (권장)

완전 무료(10GB)이며 CDN 포함!

### 1. Cloudflare R2 버킷 생성

1. https://dash.cloudflare.com 접속
2. **R2** 메뉴 클릭
3. **Create Bucket** 클릭
4. 버킷 이름: `dfkorea-uploads`
5. **Create Bucket**

### 2. API 토큰 생성

R2 → Manage R2 API Tokens → Create API Token:

```
Token Name: dfkorea-backend-upload
Permissions: Object Read & Write
Bucket: dfkorea-uploads
```

저장 후 다음 정보 복사:
```
Access Key ID: xxxxxxxxxxxxx
Secret Access Key: yyyyyyyyyyyyyyy
Bucket URL: https://xxxxx.r2.cloudflarestorage.com
```

### 3. 백엔드 패키지 설치

```bash
cd /workspaces/dfkorea/dfkorea-backend
npm install @aws-sdk/client-s3 @aws-sdk/lib-storage multer-s3
```

### 4. 환경변수 추가

`.env.production`:

```bash
# Cloudflare R2 Configuration
R2_ENDPOINT=https://xxxxx.r2.cloudflarestorage.com
R2_ACCESS_KEY_ID=your-access-key-id
R2_SECRET_ACCESS_KEY=your-secret-access-key
R2_BUCKET_NAME=dfkorea-uploads
R2_PUBLIC_URL=https://pub-xxxxx.r2.dev
```

Railway Dashboard → Variables에 동일하게 추가

### 5. Upload Service 생성

`src/upload/upload.service.ts`:

```typescript
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import * as sharp from 'sharp';

@Injectable()
export class UploadService {
  private s3Client: S3Client;
  private bucketName: string;
  private publicUrl: string;

  constructor(private configService: ConfigService) {
    this.s3Client = new S3Client({
      region: 'auto',
      endpoint: this.configService.get('R2_ENDPOINT'),
      credentials: {
        accessKeyId: this.configService.get('R2_ACCESS_KEY_ID'),
        secretAccessKey: this.configService.get('R2_SECRET_ACCESS_KEY'),
      },
    });
    this.bucketName = this.configService.get('R2_BUCKET_NAME');
    this.publicUrl = this.configService.get('R2_PUBLIC_URL');
  }

  async uploadImage(file: Express.Multer.File): Promise<string> {
    // Sharp로 이미지 최적화
    const optimizedBuffer = await sharp(file.buffer)
      .resize(1920, 1920, {
        fit: 'inside',
        withoutEnlargement: true,
      })
      .webp({ quality: 85 })
      .toBuffer();

    // WebP 파일명 생성
    const timestamp = Date.now();
    const randomString = Math.round(Math.random() * 1e9);
    const filename = `image-${timestamp}-${randomString}.webp`;

    // R2에 업로드
    await this.s3Client.send(
      new PutObjectCommand({
        Bucket: this.bucketName,
        Key: filename,
        Body: optimizedBuffer,
        ContentType: 'image/webp',
      }),
    );

    // Public URL 반환
    return `${this.publicUrl}/${filename}`;
  }
}
```

### 6. Controller 수정

`src/upload/upload.controller.ts`:

```typescript
import { Controller, Post, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { UploadService } from './upload.service';

@Controller('upload')
export class UploadController {
  constructor(private uploadService: UploadService) {}

  @Post('image')
  @UseInterceptors(
    FileInterceptor('image', {
      limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
    }),
  )
  async uploadImage(@UploadedFile() file: Express.Multer.File) {
    const url = await this.uploadService.uploadImage(file);
    
    console.log('📸 Image uploaded to R2:', url);

    return {
      url,
      filename: url.split('/').pop(),
      originalname: file.originalname,
      size: file.size,
    };
  }
}
```

### 7. Module 업데이트

`src/upload/upload.module.ts`:

```typescript
import { Module } from '@nestjs/common';
import { UploadController } from './upload.controller';
import { UploadService } from './upload.service';

@Module({
  controllers: [UploadController],
  providers: [UploadService],
})
export class UploadModule {}
```

### 8. 배포

```bash
git add .
git commit -m "Add Cloudflare R2 storage integration"
git push
```

### 장점
- ✅ 완전 무료 (10GB)
- ✅ 재배포 시에도 이미지 유지
- ✅ CDN 자동 포함 (빠른 속도)
- ✅ 무제한 요청
- ✅ Railway 독립적

### 단점
- ⚠️ 초기 설정 필요
- ⚠️ 코드 수정 필요

---

## 옵션 3: 기존 이미지 복구 (임시)

이미 업로드한 이미지가 날아간 경우:

### 1. 로컬에 이미지 백업 있는지 확인

```bash
# 로컬 uploads 폴더 확인
ls -la /workspaces/dfkorea/dfkorea-backend/uploads/
```

### 2. Railway에 수동 업로드

```bash
# Railway CLI로 파일 복사 (불가능)
# → API를 통해 다시 업로드해야 함
```

### 3. 제품 이미지 다시 등록

어드민 페이지에서 제품 수정 → 이미지 다시 업로드

---

## 권장 워크플로우

### 단계별 마이그레이션

#### Phase 1: 즉시 조치 (Railway Volumes)
- Railway Pro 업그레이드
- Volume 설정 (5분)
- **이미지 손실 방지**

#### Phase 2: 장기 해결 (Cloudflare R2)
- R2 버킷 생성
- 백엔드 코드 수정
- 기존 이미지 마이그레이션
- **비용 절감 + CDN**

#### Phase 3: 최적화
- 이미지 리사이징 자동화 (이미 구현됨)
- WebP 변환 (이미 구현됨)
- CDN 캐싱 설정

---

## 기존 이미지 마이그레이션 (R2로 이동)

Railway Volumes → Cloudflare R2 마이그레이션:

### 1. 기존 이미지 다운로드

```bash
# Railway Shell 접속
railway run bash

# 이미지 압축
tar -czf uploads-backup.tar.gz uploads/

# 로컬로 복사 (Railway CLI)
railway run cat uploads-backup.tar.gz > uploads-backup.tar.gz
```

### 2. R2로 업로드

```bash
# R2 CLI 사용 또는 대시보드에서 수동 업로드
# 또는 마이그레이션 스크립트 작성
```

### 3. 데이터베이스 URL 업데이트

```sql
-- 기존 이미지 URL 업데이트
UPDATE product 
SET images = array_replace(images, 
  'https://dfkorea-production.up.railway.app/uploads/', 
  'https://pub-xxxxx.r2.dev/'
);
```

---

## 체크리스트

### 즉시 조치 (Railway Volumes)
- [ ] Railway Pro 업그레이드
- [ ] Volume 생성 및 설정
- [ ] 재배포 확인
- [ ] 기존 제품 이미지 다시 업로드

### 장기 해결 (Cloudflare R2)
- [ ] Cloudflare 계정 생성
- [ ] R2 버킷 생성
- [ ] API 토큰 발급
- [ ] 백엔드 패키지 설치
- [ ] UploadService 구현
- [ ] Railway 환경변수 설정
- [ ] 배포 및 테스트
- [ ] 기존 이미지 마이그레이션

---

## 비용 비교 (연간)

| 방법 | 월 비용 | 연 비용 |
|------|---------|---------|
| Railway Volumes (5GB) | $20 | $240 |
| Cloudflare R2 (10GB) | $0 | $0 |
| AWS S3 (10GB) | ~$2.50 | ~$30 |
| Supabase Storage (1GB) | $0 | $0 |

**결론**: Cloudflare R2가 가장 경제적이고 확장 가능합니다.

---

## 다음 단계

### 우선순위 1: 이미지 손실 방지
**지금 바로** Railway Volumes 설정 (5분 소요)

### 우선순위 2: 비용 절감
**이번 주**: Cloudflare R2 마이그레이션

### 우선순위 3: 성능 최적화
- R2 CDN 설정
- 이미지 캐싱 정책
- Lazy loading (이미 구현됨)

---

## 추가 리소스

- [Railway Volumes 문서](https://docs.railway.app/reference/volumes)
- [Cloudflare R2 문서](https://developers.cloudflare.com/r2/)
- [AWS SDK for JavaScript v3](https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/)
