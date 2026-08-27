# Railway 배포 가이드

## 문제 해결 내역

### 1. 데이터베이스 파일 경로 오류 (ENOENT)
**문제**: `ENOENT: no such file or directory, open '/app/data/database.json'`

**원인**: 
- Dockerfile에서 `data` 폴더가 복사되지 않음
- 컨테이너 환경에서 `/app` 경로로 배포되지만 데이터 파일이 없음

**해결책**:
1. `Dockerfile`에 data 폴더 복사 추가
2. `database.service.ts`에서 디렉토리 자동 생성 로직 추가
3. 환경 변수로 데이터 경로 설정 가능하도록 개선

### 2. 프론트엔드 이미지 로드 오류 (ERR_CONNECTION_REFUSED)
**문제**: `localhost:3000/uploads/...` 으로 이미지 요청 시 연결 거부

**원인**:
- 백엔드에서 반환된 이미지 경로가 상대 경로(`/uploads/...`)
- 프론트엔드가 배포 환경에서 `localhost:3000`으로 요청

**해결책**:
1. 이미지 URL 처리 유틸리티 함수 생성 (`src/utils/image.ts`)
2. 모든 컴포넌트에서 `getImageUrl()` / `getFirstImageUrl()` 사용
3. 환경 변수 `VITE_API_BASE_URL`을 통해 API 베이스 URL 설정

## Railway 배포 설정

### 백엔드 환경 변수
Railway 대시보드에서 다음 환경 변수를 설정하세요:

```
NODE_ENV=production
PORT=3000
JWT_SECRET=your-secret-key-here
DATA_DIR=data (선택사항, 기본값: data)
```

### 프론트엔드 환경 변수
Vercel 또는 Railway에서 다음 환경 변수를 설정하세요:

```
VITE_API_BASE_URL=https://your-backend.railway.app
VITE_APP_TITLE=LED 조명 - 미래를 밝히는 빛
```

**중요**: `VITE_API_BASE_URL`은 실제 백엔드 Railway URL로 설정해야 합니다.

## 배포 단계

### 1. 백엔드 배포 (Railway)

1. Railway 프로젝트 생성
2. GitHub 저장소 연결
3. Root Directory를 `dfkorea-backend`로 설정
4. 환경 변수 설정
5. 배포 완료 후 URL 확인 (예: `https://dfkorea-backend.railway.app`)

### 2. 프론트엔드 배포 (Vercel/Railway)

1. 새 프로젝트 생성
2. Root Directory를 `led-lighting-website`로 설정
3. Build Command: `npm run build`
4. Output Directory: `dist`
5. 환경 변수 설정:
   - `VITE_API_BASE_URL`: 백엔드 Railway URL 입력
6. 배포

### 3. 배포 확인

1. 프론트엔드 접속하여 로그 확인:
   ```
   🌐 API Base URL: https://your-backend.railway.app
   ```

2. 제품/포스트 이미지가 정상적으로 로드되는지 확인

3. 관리자 페이지에서 이미지 업로드 테스트

## 문제 해결

### 이미지가 로드되지 않는 경우

1. **브라우저 콘솔 확인**: 어떤 URL로 요청하고 있는지 확인
2. **환경 변수 확인**: `VITE_API_BASE_URL`이 올바르게 설정되었는지 확인
3. **CORS 설정 확인**: 백엔드에서 프론트엔드 도메인 허용 확인

```typescript
// dfkorea-backend/src/main.ts
app.enableCors({
  origin: [
    'http://localhost:5173',
    'https://your-frontend-domain.vercel.app',
  ],
  credentials: true,
});
```

### 데이터베이스 파일이 사라지는 경우

Railway는 ephemeral 스토리지를 사용하므로 재배포 시 데이터가 사라질 수 있습니다.

**해결책**:
1. Railway Volume 사용 (유료)
2. PostgreSQL 또는 MongoDB 등 실제 데이터베이스 사용 권장
3. S3 등의 클라우드 스토리지로 이미지 저장

## 파일 구조

```
dfkorea-backend/
├── Dockerfile          # data 폴더 복사 추가됨
├── data/
│   └── database.json   # 초기 데이터
└── src/
    └── database/
        └── database.service.ts  # 디렉토리 자동 생성 로직 추가

led-lighting-website/
├── .env.development    # 개발 환경 변수
├── .env.example       # 환경 변수 템플릿
└── src/
    └── utils/
        └── image.ts   # 이미지 URL 처리 유틸리티
```

## 추가 개선 사항

### 1. 이미지를 클라우드 스토리지로 이동

AWS S3, Cloudinary 등을 사용하여 이미지를 저장하면:
- 영구 스토리지
- CDN을 통한 빠른 로딩
- 스케일링 용이

### 2. 데이터베이스를 실제 DB로 교체

PostgreSQL, MongoDB 등을 사용하여:
- 데이터 영속성 보장
- 동시성 처리 개선
- 트랜잭션 지원

### 3. 환경별 설정 분리

```
.env.development  # 개발
.env.staging      # 스테이징
.env.production   # 프로덕션
```
