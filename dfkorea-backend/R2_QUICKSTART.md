# Cloudflare R2 설정 빠른 가이드

이 문서는 object storage 설정만 다룬다. 애플리케이션 운영 배포의 단일 기준은 루트 [DEPLOYMENT.md](../DEPLOYMENT.md)이며, PostgreSQL을 먼저 프로비저닝한 뒤 아래 fail-fast Start Command를 사용한다.

```bash
npm run migration:run:prod && npm run start:prod
```

## 1단계: Cloudflare R2 버킷 생성 (5분)

### 1. Cloudflare 대시보드 접속
https://dash.cloudflare.com → **R2** 메뉴

### 2. 버킷 생성
- **Create Bucket** 클릭
- 버킷 이름: `dfkorea-uploads`
- 지역: Automatic
- **Create Bucket**

### 3. 공개 액세스 설정
- 생성한 버킷 클릭
- **Settings** 탭
- **Public Access** 섹션
- **Connect Domain** 또는 **Allow Access** 클릭
- Public URL 받기: `https://pub-xxxxx.r2.dev`

---

## 2단계: API 토큰 생성 (3분)

### 1. API 토큰 페이지 이동
R2 메인 → 우측 상단 **Manage R2 API Tokens**

### 2. 토큰 생성
- **Create API Token** 클릭
- Token Name: `dfkorea-backend-upload`
- Permissions: **Object Read & Write**
- TTL: Forever (또는 필요한 기간)
- **Create API Token**

### 3. 정보 복사 (다시 볼 수 없음!)
```
Access Key ID: a1b2c3d4e5f6g7h8i9j0
Secret Access Key: x1y2z3a4b5c6d7e8f9g0h1i2j3k4l5m6n7o8p9q0
```

⚠️ **중요**: Secret Key는 다시 볼 수 없으니 안전한 곳에 저장!

---

## 3단계: Railway 환경변수 설정 (2분)

### Railway Dashboard 접속
https://railway.app → 프로젝트 → 백엔드 Service → **Variables**

### 다음 환경변수 추가:

| Variable | Value | 설명 |
|----------|-------|------|
| `R2_ENDPOINT` | `https://xxxxx.r2.cloudflarestorage.com` | R2 API 엔드포인트 |
| `R2_ACCESS_KEY_ID` | `a1b2c3d4e5f6g7h8i9j0` | Access Key |
| `R2_SECRET_ACCESS_KEY` | `x1y2z3a4b5c6d7e8f9...` | Secret Key |
| `R2_BUCKET_NAME` | `dfkorea-uploads` | 버킷 이름 |
| `R2_PUBLIC_URL` | `https://pub-xxxxx.r2.dev` | Public URL |

**R2_ENDPOINT 찾는 법**:
- Cloudflare R2 → 버킷 선택 → Settings → S3 API
- 또는 패턴: `https://<account-id>.r2.cloudflarestorage.com`

**Save** 클릭하면 자동 재배포됩니다.

---

## 4단계: 배포 및 테스트 (2분)

### 1. 코드 푸시
```bash
cd /workspaces/dfkorea/dfkorea-backend
git add .
git commit -m "Add Cloudflare R2 storage"
git push
```

### 2. Railway 배포 확인
Railway Dashboard → Deployments → 최신 배포 → Logs

다음 메시지 확인:
```
compiled migrations completed
✅ Cloudflare R2 initialized
```

### 3. 이미지 업로드 테스트

**프론트엔드에서**:
1. 어드민 로그인
2. 제품 추가 페이지
3. 이미지 업로드
4. 업로드된 이미지 URL 확인:
   ```
   https://pub-xxxxx.r2.dev/image-1234567890.webp
   ```

**API로 직접 테스트**:
```bash
TOKEN="your-jwt-token"

curl -X POST https://dfkorea-production.up.railway.app/api/upload/image \
  -H "Authorization: Bearer $TOKEN" \
  -F "image=@test.jpg"
```

응답:
```json
{
  "url": "https://pub-xxxxx.r2.dev/image-1706300000000-123456789.webp",
  "filename": "image-1706300000000-123456789.webp",
  "originalname": "test.jpg",
  "size": 2048000
}
```

### 4. 이미지 접근 확인
브라우저에서 반환된 URL 직접 열기 → 이미지 표시 확인

---

## 완료 체크리스트

- [ ] Cloudflare R2 버킷 생성 (`dfkorea-uploads`)
- [ ] 공개 액세스 설정 (Public URL 받음)
- [ ] API 토큰 생성 (Access Key, Secret Key 복사)
- [ ] Railway 환경변수 5개 추가
- [ ] 코드 푸시 및 배포 확인
- [ ] 로그에서 "✅ Cloudflare R2 initialized" 확인
- [ ] 이미지 업로드 테스트
- [ ] 이미지 URL이 `https://pub-xxxxx.r2.dev/...` 형식인지 확인
- [ ] 브라우저에서 이미지 접근 가능한지 확인

---

## 문제 해결

### "⚠️ R2 credentials not found, using local storage"

**원인**: Railway 환경변수가 설정되지 않음

**해결**:
1. Railway Dashboard → Variables 확인
2. 5개 환경변수 모두 추가되었는지 확인
3. 값에 공백이나 따옴표가 없는지 확인
4. 재배포

### "Access Denied" 또는 403 에러

**원인**: API 토큰 권한 부족

**해결**:
1. Cloudflare R2 → Manage R2 API Tokens
2. 토큰 권한 확인: **Object Read & Write**
3. 필요시 새 토큰 생성

### 이미지 업로드 성공했지만 404

**원인**: Public Access 미설정

**해결**:
1. R2 버킷 → Settings → Public Access
2. **Allow Access** 또는 **Connect Domain**
3. Public URL 확인 및 Railway Variables 업데이트

### R2_ENDPOINT 값 확인

Cloudflare Dashboard → R2 → 버킷 선택 → Settings:

**S3 API**:
```
Endpoint for S3 Clients: https://xxxxx.r2.cloudflarestorage.com
```

또는 Account ID로 직접 구성:
```
https://<your-account-id>.r2.cloudflarestorage.com
```

Account ID는 Cloudflare Dashboard → R2 페이지 우측에 표시됩니다.

---

## 로컬 개발 (선택사항)

로컬에서도 R2를 사용하려면 `.env.development` 수정:

```bash
# Cloudflare R2 Configuration
R2_ENDPOINT=https://xxxxx.r2.cloudflarestorage.com
R2_ACCESS_KEY_ID=a1b2c3d4e5f6g7h8i9j0
R2_SECRET_ACCESS_KEY=x1y2z3a4b5c6d7e8f9...
R2_BUCKET_NAME=dfkorea-uploads
R2_PUBLIC_URL=https://pub-xxxxx.r2.dev
```

주석 해제하고 값 입력 후:

```bash
npm run start:dev
```

로그 확인:
```
✅ Cloudflare R2 initialized
```

---

## 다음 단계

### 1. 기존 이미지 마이그레이션 (선택)

로컬에 백업이 있다면 R2로 업로드:

```bash
# R2 CLI 설치
npm install -g wrangler

# Cloudflare 로그인
wrangler login

# 이미지 업로드
wrangler r2 object put dfkorea-uploads/old-image.webp --file ./old-image.webp
```

### 2. CDN 최적화

Cloudflare R2는 자동으로 CDN이 적용되지만, 커스텀 도메인으로 더 빠르게:

1. Cloudflare Dashboard → R2 → 버킷 → Settings
2. **Connect Domain** 클릭
3. `cdn.dfkorea.com` 같은 도메인 연결
4. Railway Variables의 `R2_PUBLIC_URL` 업데이트

### 3. 이미지 캐싱 정책

Cloudflare에서 자동으로 처리하지만, 추가 설정 가능:
- Cache-Control 헤더 설정
- Browser Cache TTL 조정

---

## 비용 정보

**Cloudflare R2 무료 티어**:
- 저장소: 10GB
- Class A 작업 (업로드): 100만 요청/월
- Class B 작업 (다운로드): 1000만 요청/월
- 트래픽: 무제한 (Cloudflare 네트워크 내)

**예상 사용량** (100개 제품):
- 저장소: ~500MB (이미지 5MB → 최적화 후 500KB)
- 업로드: 월 100회 (신제품 등록)
- 다운로드: 월 10,000회 (페이지 조회)

**결론**: 완전 무료로 사용 가능! 🎉

---

## 참고 자료

- [Cloudflare R2 문서](https://developers.cloudflare.com/r2/)
- [AWS SDK for JavaScript v3 - S3 Client](https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/client/s3/)
- [Sharp 이미지 최적화](https://sharp.pixelplumbing.com/)

---

## 요약

✅ **설정 완료 시간**: 약 10-15분
✅ **비용**: 완전 무료 (10GB)
✅ **효과**: 재배포 시에도 이미지 영구 보존
✅ **보너스**: CDN 포함으로 전 세계 빠른 속도
