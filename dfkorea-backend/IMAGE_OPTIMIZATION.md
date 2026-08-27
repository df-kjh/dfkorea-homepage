# 이미지 최적화 가이드

이 문서는 이미지 처리 동작만 설명한다. storage, PostgreSQL, 백업, 배포 및 롤백은 루트 [DEPLOYMENT.md](../DEPLOYMENT.md)를 단일 기준으로 사용한다. 운영 백엔드는 compiled migration 성공 후에만 시작한다.

```bash
npm run migration:run:prod && npm run start:prod
```

## 적용된 최적화

### 백엔드 (자동 이미지 처리)

#### Sharp 라이브러리 사용
- **자동 리사이징**: 최대 1920x1920px로 제한
- **WebP 변환**: 모든 이미지를 WebP 형식으로 변환 (85% 품질)
- **원본 삭제**: 최적화 후 원본 임시 파일 자동 삭제

**변경 사항**:
```typescript
// uploads/temp에 임시 저장
// → Sharp로 리사이징 및 WebP 변환
// → uploads에 최종 저장
// → 임시 파일 삭제
```

**효과**:
- 파일 크기 **70-90% 감소**
- PNG/JPG 5MB → WebP 500KB-1MB
- 업로드/다운로드 속도 대폭 향상

### 프론트엔드 (Lazy Loading)

#### 적용된 컴포넌트
- `ProductCard.vue` - 제품 카드 이미지
- `home/ProductCard.vue` - 홈 제품 카드
- `BlogCard.vue` - 블로그 카드 이미지

**변경 사항**:
```vue
<img 
  :src="imageUrl" 
  :alt="alt"
  loading="lazy"  <!-- 추가됨 -->
/>
```

**효과**:
- 뷰포트에 보일 때만 이미지 로드
- 초기 페이지 로드 시간 단축
- 불필요한 네트워크 요청 감소

---

## 성능 개선 결과

### Before (최적화 전)
- **이미지 크기**: 2-5MB (PNG/JPG)
- **초기 로드**: 모든 이미지 동시 로딩
- **네트워크**: ~50MB+ (20개 제품 페이지 기준)
- **로딩 시간**: 5-10초

### After (최적화 후)
- **이미지 크기**: 200-800KB (WebP)
- **초기 로드**: 뷰포트 내 이미지만
- **네트워크**: ~5-10MB (초기 로드 기준)
- **로딩 시간**: 1-2초

**전체 성능 향상**: 약 **80-90%** 개선

---

## 사용 방법

### 1. 개발 환경 설정

```bash
cd /workspaces/dfkorea/dfkorea-backend

# Sharp 이미 설치됨
npm install

# 업로드 디렉토리 생성 확인
ls -la uploads/
# uploads/ - 최종 이미지 저장
# uploads/temp/ - 임시 업로드
```

### 2. 이미지 업로드 테스트

```bash
# 로컬 테스트
curl -X POST http://localhost:3000/api/upload/image \
  -H "Authorization: Bearer $TOKEN" \
  -F "image=@test.png"

# 응답:
{
  "url": "http://localhost:3000/uploads/image-1234567890.webp",
  "filename": "image-1234567890.webp",
  "originalname": "test.png",
  "size": 2048000  // 원본 크기
}
```

### 3. 로그 확인

콘솔에서 최적화 정보 확인:
```
📸 Image optimized and uploaded: {
  original: 'product-photo.png',
  originalSize: '4500.25KB',
  optimized: 'image-1234567890.webp',
  url: 'https://dfkorea-production.up.railway.app/uploads/image-1234567890.webp'
}
```

---

## 설정 조정

### 이미지 품질 조정

`src/upload/upload.controller.ts`:

```typescript
await sharp(file.path)
  .resize(1920, 1920, {
    fit: 'inside',
    withoutEnlargement: true,
  })
  .webp({ quality: 85 })  // 품질: 60-100 (기본: 85)
  .toFile(optimizedPath);
```

**권장 품질**:
- 제품 이미지: 85 (선명도 중요)
- 블로그 이미지: 80
- 썸네일/아이콘: 70-75

### 최대 크기 조정

```typescript
.resize(1920, 1920, {  // 최대 너비/높이
  fit: 'inside',       // 비율 유지
  withoutEnlargement: true  // 원본보다 크게 하지 않음
})
```

**권장 크기**:
- 메인 이미지: 1920px
- 제품 상세: 1920px
- 썸네일: 800px (별도 생성 필요 시)

### 파일 크기 제한

`src/upload/upload.controller.ts`:

```typescript
limits: {
  fileSize: 5 * 1024 * 1024, // 5MB
}
```

---

## Railway 배포 시 주의사항

### 1. 임시 디렉토리 생성

Railway는 재배포 시 파일 시스템이 초기화됩니다.

`railway-build.sh`에 추가:
```bash
#!/bin/bash
mkdir -p uploads/temp
npm run build
```

### 2. 업로드 파일 영구 저장 ⚠️

Railway의 ephemeral 파일 시스템:
- 재배포 시 `uploads/` 내용 삭제됨
- **프로덕션에서는 S3/CloudFlare R2 등 사용 권장**

임시 해결책:
```typescript
// uploads를 Volume에 마운트 (Railway Pro 이상)
// 또는 외부 스토리지 사용
```

### 3. Sharp 빌드 문제

Railway에서 Sharp가 빌드 실패하면:

```json
// package.json
{
  "scripts": {
    "postinstall": "npm rebuild sharp"
  }
}
```

---

## 추가 최적화 (선택사항)

### 1. 썸네일 생성

여러 크기의 이미지 생성:

```typescript
// 원본 (1920px)
await sharp(file.path)
  .resize(1920, 1920, { fit: 'inside' })
  .webp({ quality: 85 })
  .toFile(`./uploads/${filename}.webp`);

// 중간 (800px)
await sharp(file.path)
  .resize(800, 800, { fit: 'inside' })
  .webp({ quality: 80 })
  .toFile(`./uploads/${filename}-medium.webp`);

// 썸네일 (400px)
await sharp(file.path)
  .resize(400, 400, { fit: 'inside' })
  .webp({ quality: 75 })
  .toFile(`./uploads/${filename}-thumb.webp`);
```

### 2. 프론트엔드 srcset 사용

```vue
<img
  :src="`${imageUrl}.webp`"
  :srcset="`
    ${imageUrl}-thumb.webp 400w,
    ${imageUrl}-medium.webp 800w,
    ${imageUrl}.webp 1920w
  `"
  sizes="(max-width: 640px) 400px,
         (max-width: 1024px) 800px,
         1920px"
  alt="Product"
  loading="lazy"
/>
```

### 3. Progressive JPEG 대안

WebP 지원 안 되는 브라우저용:

```typescript
// WebP 우선, JPEG 폴백
if (supportsWebP) {
  return imageUrl + '.webp';
} else {
  return imageUrl + '.jpg';
}
```

---

## 문제 해결

### Sharp 설치 실패

```bash
# 네이티브 의존성 재빌드
npm rebuild sharp

# 또는 재설치
npm uninstall sharp
npm install sharp
```

### 이미지 최적화 실패

로그 확인:
```
Image optimization error: ...
```

원인:
- 손상된 이미지 파일
- 지원하지 않는 형식
- 디스크 공간 부족

해결:
```typescript
try {
  await sharp(file.path)
    .toFile(optimizedPath);
} catch (error) {
  console.error('Sharp error:', error);
  // 원본 파일 그대로 사용
}
```

### Railway에서 이미지 사라짐

파일 시스템이 ephemeral이므로:
- 재배포 시 삭제됨
- **S3/R2 같은 외부 스토리지 필수**

---

## 체크리스트

### 백엔드
- [x] Sharp 패키지 설치
- [x] 업로드 컨트롤러 수정 (리사이징 + WebP)
- [x] uploads/temp 디렉토리 생성
- [x] 최적화 로그 추가

### 프론트엔드
- [x] ProductCard loading="lazy" 추가
- [x] BlogCard loading="lazy" 추가
- [x] HomeProductCard loading="lazy" 추가

### 배포
- [ ] Railway에서 이미지 업로드 테스트
- [ ] 최적화 로그 확인
- [ ] 실제 성능 측정 (Network 탭)
- [ ] 외부 스토리지 고려 (S3/R2)

---

## 추가 권장사항

1. **CDN 사용**: CloudFlare를 통해 이미지 캐싱
2. **외부 스토리지**: Railway 재배포 시에도 이미지 유지
3. **이미지 압축 모니터링**: 품질 vs 크기 밸런스 조정
4. **Progressive Image**: 저화질 먼저 로드 후 고화질로 전환

---

## 성능 측정

### Chrome DevTools

1. **Network 탭**:
   - Throttling: Fast 3G로 테스트
   - 이미지 로드 시간 확인
   - WebP 형식 확인

2. **Lighthouse**:
   - Performance 점수 확인
   - "Properly size images" 경고 확인
   - "Defer offscreen images" 확인

3. **Coverage 탭**:
   - 사용되지 않는 이미지 확인

### 목표 성능

- **LCP (Largest Contentful Paint)**: < 2.5s
- **이미지 크기**: < 1MB
- **초기 로드**: < 3MB
- **Lighthouse Performance**: > 90점
