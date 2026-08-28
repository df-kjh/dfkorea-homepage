# Vercel 배포 가이드

이 문서는 프론트엔드 환경 변수만 보충한다. 전체 서비스의 PostgreSQL, 백업, 백엔드 배포 및 롤백은 루트 [DEPLOYMENT.md](../DEPLOYMENT.md)를 단일 기준으로 사용한다. 백엔드는 compiled migration 성공 후에만 시작한다.

```bash
npm run migration:run:prod && npm run start:prod
```

## Node.js 버전

Nuxt 4 프론트엔드는 Node.js `22.18.0` 이상인 Node 22 계열을 지원 기준으로 사용합니다.

Vercel 프로젝트의 **Settings → General → Node.js Version**에서 `22.x`를 선택하세요. 최소 `22.18.0`을 사용해야 하며, `package.json`의 `engines.node`와 `packageManager`가 로컬, Vercel, Docker 빌드 환경의 Node/npm 기준을 고정합니다.

## 설치 및 빌드 명령

프로젝트의 `vercel.json`은 다음 설치 명령으로 lockfile을 재현하고 npm 버전을 고정합니다.

```sh
npx --yes npm@11.17.0 ci
```

이 명령은 `postinstall`의 `nuxt prepare`를 실행한 뒤 Vercel의 `npm run build`로 이어집니다. Nuxt의 Node 서버 산출물은 Vercel이 자동으로 처리하므로 별도의 `dist` 출력 설정은 사용하지 않습니다.

## 환경 변수 설정

Vercel에 배포하기 전에 다음 환경 변수를 설정해야 합니다.

### Vercel 대시보드에서 설정하는 방법

1. Vercel 프로젝트 대시보드로 이동
2. **Settings** 탭 클릭
3. **Environment Variables** 섹션으로 이동
4. 다음 환경 변수들을 추가:

#### 필수 환경 변수

| 변수명              | 설명           | 예시 값                        | 환경                             |
| ------------------- | -------------- | ------------------------------ | -------------------------------- |
| `VITE_API_BASE_URL` | 백엔드 API URL | `https://your-backend-api.com` | Production, Preview, Development |
| `VITE_APP_TITLE`    | 앱 타이틀      | `LED 조명 - 미래를 밝히는 빛`  | Production, Preview, Development |

### 백엔드 API URL 설정

백엔드가 배포된 URL을 `VITE_API_BASE_URL`에 설정해야 합니다:

- **Railway/Render/Heroku 등에 배포한 경우**: 해당 서비스에서 제공하는 URL 사용
- **자체 서버에 배포한 경우**: 도메인 또는 IP 주소 사용
- **로컬 테스트**: `http://localhost:3000` (개발 환경에서만)

예시:

```
VITE_API_BASE_URL=https://dfkorea-backend.railway.app
VITE_API_BASE_URL=https://api.dfkorea.com
```

### 주의사항

⚠️ **중요**:

- Vercel은 `.env.production` 파일을 읽지 않습니다
- 반드시 Vercel 대시보드에서 환경 변수를 설정해야 합니다
- 환경 변수를 변경한 후에는 재배포가 필요합니다

### 확인 방법

배포 후 브라우저 개발자 도구(F12)의 Network 탭에서 API 요청 URL을 확인하세요:

- ✅ 올바른 경우: `https://your-backend-api.com/products`
- ❌ 잘못된 경우: `http://localhost:3000/products`

## CLI로 환경 변수 설정 (선택사항)

```bash
# Vercel CLI 설치
npm i -g vercel

# 환경 변수 추가
vercel env add VITE_API_BASE_URL production
# 값 입력: https://your-backend-api.com

vercel env add VITE_APP_TITLE production
# 값 입력: LED 조명 - 미래를 밝히는 빛
```

## 재배포

환경 변수를 설정/변경한 후:

1. Vercel 대시보드에서 **Deployments** 탭으로 이동
2. 최신 배포 옆의 **...** 버튼 클릭
3. **Redeploy** 선택

또는 Git에 새로운 커밋을 푸시하면 자동으로 재배포됩니다.
