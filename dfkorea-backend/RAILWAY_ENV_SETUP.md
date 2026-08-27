# Railway 환경변수 설정 가이드

## 필수 환경변수

Railway 대시보드에서 다음 환경변수를 설정하세요:

### 1. NODE_ENV
```
NODE_ENV=production
```

### 2. CORS_ORIGIN
프론트엔드 URL을 정확히 입력하세요 (끝에 슬래시 없이):
```
CORS_ORIGIN=https://dfkorea-frontend.vercel.app
```

여러 도메인을 허용하려면 쉼표로 구분:
```
CORS_ORIGIN=https://dfkorea-frontend.vercel.app,https://dfkorea-preview.vercel.app
```

### 3. 데이터베이스 설정
Railway PostgreSQL을 연결했다면 자동으로 설정됩니다:
- `DATABASE_URL`
- `DATABASE_HOST`
- `DATABASE_PORT`
- `DATABASE_USER`
- `DATABASE_PASSWORD`
- `DATABASE_NAME`

### 4. Cloudflare R2 (이미지 업로드)
```
R2_ACCOUNT_ID=your_account_id
R2_ACCESS_KEY_ID=your_access_key
R2_SECRET_ACCESS_KEY=your_secret_key
R2_BUCKET_NAME=dfkorea
R2_PUBLIC_URL=https://your-r2-domain.com
```

### 5. JWT 설정
```
JWT_SECRET=your-secure-random-secret-key-here
JWT_EXPIRATION=7d
```

## CORS 문제 해결

### 증상: "No 'Access-Control-Allow-Origin' header"

1. **환경변수 확인**
   - Railway 대시보드 → Variables 탭
   - `NODE_ENV=production` 정확히 입력되었는지 확인
   - `CORS_ORIGIN=https://dfkorea-frontend.vercel.app` (슬래시 없이)

2. **재배포**
   - 환경변수 변경 후 자동 재배포되지만, 수동으로 재배포하는 것을 권장
   - Railway 대시보드 → Deployments → 최신 배포에서 "Redeploy" 클릭

3. **로그 확인**
   Railway 로그에서 다음을 확인:
   ```
   🔧 Environment: { NODE_ENV: 'production', CORS_ORIGIN: 'https://dfkorea-frontend.vercel.app', ... }
   🔧 Allowed origins: [ 'https://dfkorea-frontend.vercel.app' ]
   🌐 Setting up production CORS...
   🚀 Application is running on: http://0.0.0.0:3000
   ```

4. **요청 시 로그**
   실제 요청이 들어올 때 다음과 같은 로그가 나와야 함:
   ```
   🔍 CORS request from origin: https://dfkorea-frontend.vercel.app
   🔍 CORS check: { origin: 'https://dfkorea-frontend.vercel.app', isExactMatch: true, ... }
   ✅ CORS allowed for: https://dfkorea-frontend.vercel.app
   ```

## 테스트 방법

### 1. 헬스체크 엔드포인트 테스트
```bash
curl https://dfkorea-production.up.railway.app/
```

예상 응답: `{"message":"LED Lighting Backend API","version":"1.0.0"}`

### 2. CORS 테스트 (브라우저 콘솔에서)
```javascript
fetch('https://dfkorea-production.up.railway.app/products?page=1&limit=4', {
  method: 'GET',
  headers: {
    'Origin': 'https://dfkorea-frontend.vercel.app'
  }
}).then(r => r.json()).then(console.log).catch(console.error);
```

### 3. OPTIONS 프리플라이트 테스트
```bash
curl -X OPTIONS https://dfkorea-production.up.railway.app/products \
  -H "Origin: https://dfkorea-frontend.vercel.app" \
  -H "Access-Control-Request-Method: GET" \
  -v
```

예상 응답 헤더:
```
Access-Control-Allow-Origin: https://dfkorea-frontend.vercel.app
Access-Control-Allow-Methods: GET,POST,PUT,PATCH,DELETE,OPTIONS
Access-Control-Allow-Credentials: true
```

## 일반적인 실수

1. ❌ `CORS_ORIGIN=https://dfkorea-frontend.vercel.app/` (끝에 슬래시)
   ✅ `CORS_ORIGIN=https://dfkorea-frontend.vercel.app`

2. ❌ `NODE_ENV= production` (공백 포함)
   ✅ `NODE_ENV=production`

3. ❌ 환경변수 변경 후 재배포 안 함
   ✅ 환경변수 변경 후 반드시 재배포

4. ❌ http와 https 혼용
   ✅ 프로덕션에서는 항상 https 사용

## 추가 지원이 필요한 경우

Railway 로그의 전체 내용을 확인하여:
- 서버가 정상적으로 시작되었는지
- 환경변수가 올바르게 로드되었는지
- CORS 요청 로그가 나타나는지

확인해주세요.
