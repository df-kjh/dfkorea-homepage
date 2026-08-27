# LED 조명 웹사이트 배포 가이드

## 📋 목차

1. [환경 설정](#환경-설정)
2. [Docker를 이용한 배포](#docker를-이용한-배포)
3. [수동 배포](#수동-배포)
4. [환경 변수 설정](#환경-변수-설정)
5. [배포 후 확인 사항](#배포-후-확인-사항)

---

## 🔧 환경 설정

### 필수 요구사항

- Node.js 20.x 이상
- npm 또는 yarn
- Docker & Docker Compose (Docker 배포 시)
- Nginx (수동 배포 시)

---

## 🐳 Docker를 이용한 배포

### 1. 환경 변수 설정

**프론트엔드** (`led-lighting-website/.env.production`):

```env
VITE_API_BASE_URL=https://api.yourdomain.com
VITE_APP_TITLE=LED 조명 - 미래를 밝히는 빛
```

**백엔드** (`dfkorea-backend/.env.production`):

```env
NODE_ENV=production
PORT=3000
JWT_SECRET=your-super-secret-jwt-key-change-this
JWT_EXPIRES_IN=7d
CORS_ORIGIN=https://yourdomain.com
MAX_FILE_SIZE=10485760
UPLOAD_DEST=./uploads
DB_PATH=./database.json
```

### 2. Docker Compose로 빌드 및 실행

```bash
# 프로젝트 루트 디렉토리에서
docker-compose up -d --build
```

### 3. 서비스 확인

```bash
# 컨테이너 상태 확인
docker-compose ps

# 로그 확인
docker-compose logs -f
```

### 4. 중지 및 재시작

```bash
# 중지
docker-compose down

# 재시작
docker-compose restart
```

---

## 🔨 수동 배포

### 백엔드 배포

#### 1. 의존성 설치 및 빌드

```bash
cd dfkorea-backend
npm ci
npm run build
```

#### 2. 환경 변수 설정

`.env.production` 파일을 생성하고 필요한 값을 설정합니다.

#### 3. PM2로 실행 (권장)

```bash
# PM2 글로벌 설치
npm install -g pm2

# 애플리케이션 시작
pm2 start ecosystem.config.js --env production

# 부팅 시 자동 시작 설정
pm2 startup
pm2 save
```

#### 4. 또는 직접 실행

```bash
npm run start:prod
```

### 프론트엔드 배포

#### 1. 의존성 설치 및 빌드

```bash
cd led-lighting-website
npm ci
npm run build
```

#### 2. Nginx 설정

`/etc/nginx/sites-available/led-lighting` 파일 생성:

```nginx
server {
    listen 80;
    server_name yourdomain.com;
    root /var/www/led-lighting/dist;
    index index.html;

    # Gzip compression
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_types text/plain text/css text/xml text/javascript application/x-javascript application/xml+rss application/json application/javascript;

    # Cache static assets
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # SPA fallback
    location / {
        try_files $uri $uri/ /index.html;
    }

    # API proxy
    location /api {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

#### 3. Nginx 활성화

```bash
# 심볼릭 링크 생성
sudo ln -s /etc/nginx/sites-available/led-lighting /etc/nginx/sites-enabled/

# Nginx 설정 테스트
sudo nginx -t

# Nginx 재시작
sudo systemctl restart nginx
```

#### 4. 빌드 파일 복사

```bash
sudo mkdir -p /var/www/led-lighting
sudo cp -r dist/* /var/www/led-lighting/
```

---

## 🔐 환경 변수 설정

### 프론트엔드 환경 변수

| 변수명              | 설명           | 예시                         |
| ------------------- | -------------- | ---------------------------- |
| `VITE_API_BASE_URL` | 백엔드 API URL | `https://api.yourdomain.com` |
| `VITE_APP_TITLE`    | 앱 타이틀      | `LED 조명`                   |

### 백엔드 환경 변수

| 변수명           | 설명                   | 예시                     |
| ---------------- | ---------------------- | ------------------------ |
| `NODE_ENV`       | 환경 모드              | `production`             |
| `PORT`           | 서버 포트              | `3000`                   |
| `JWT_SECRET`     | JWT 비밀키             | `your-secret-key`        |
| `JWT_EXPIRES_IN` | JWT 만료 시간          | `7d`                     |
| `CORS_ORIGIN`    | CORS 허용 도메인       | `https://yourdomain.com` |
| `MAX_FILE_SIZE`  | 최대 업로드 크기       | `10485760` (10MB)        |
| `UPLOAD_DEST`    | 업로드 디렉토리        | `./uploads`              |
| `DB_PATH`        | 데이터베이스 파일 경로 | `./database.json`        |

---

## ✅ 배포 후 확인 사항

### 1. 서비스 상태 확인

```bash
# Docker
docker-compose ps

# PM2
pm2 status

# Nginx
sudo systemctl status nginx
```

### 2. 접속 테스트

- 프론트엔드: `http://yourdomain.com`
- 백엔드 API: `http://yourdomain.com/api/health` (헬스체크 엔드포인트)

### 3. 로그 확인

```bash
# Docker
docker-compose logs -f backend
docker-compose logs -f frontend

# PM2
pm2 logs led-backend

# Nginx
sudo tail -f /var/log/nginx/error.log
sudo tail -f /var/log/nginx/access.log
```

### 4. 보안 체크리스트

- [ ] JWT_SECRET을 강력한 값으로 변경
- [ ] CORS_ORIGIN을 실제 도메인으로 설정
- [ ] HTTPS 인증서 설치 (Let's Encrypt 권장)
- [ ] 방화벽 설정 확인
- [ ] 데이터베이스 백업 설정

---

## 🔄 업데이트 배포

### Docker 사용 시

```bash
# 최신 코드 pull
git pull origin main

# 컨테이너 재빌드 및 재시작
docker-compose up -d --build
```

### 수동 배포 시

```bash
# 백엔드 업데이트
cd dfkorea-backend
git pull
npm ci
npm run build
pm2 restart led-backend

# 프론트엔드 업데이트
cd ../led-lighting-website
git pull
npm ci
npm run build
sudo cp -r dist/* /var/www/led-lighting/
```

---

## 🆘 트러블슈팅

### 포트가 이미 사용 중

```bash
# 포트 사용 프로세스 확인
sudo lsof -i :3000
sudo lsof -i :80

# 프로세스 종료
sudo kill -9 <PID>
```

### 파일 업로드 안됨

- `uploads` 디렉토리 권한 확인
- `MAX_FILE_SIZE` 설정 확인
- Nginx `client_max_body_size` 설정 확인

### CORS 에러

- 백엔드 `CORS_ORIGIN` 설정 확인
- 프론트엔드 API URL 설정 확인

---

## 📞 지원

문제가 발생하면 다음을 확인하세요:

1. 로그 파일
2. 환경 변수 설정
3. 네트워크 및 방화벽 설정

---

## LED 입찰 공고 운영

### PostgreSQL 마이그레이션과 배포 순서

입찰 기능은 PostgreSQL과 TypeORM migration을 사용한다. `TYPEORM_SYNCHRONIZE=false`를 유지하고, 배포 전 DB 백업을 만든다. 아래 단계 중 하나라도 실패하면 이후 단계를 실행하지 않는다.

```bash
cd dfkorea-backend
npm ci
npm run build
npm run migration:run:prod
npm run start:prod
```

Railway 등의 pre-deploy 명령도 `cd dfkorea-backend && npm ci && npm run build && npm run migration:run:prod`로 설정한다. `&&`를 사용하므로 schema 적용 실패가 숨겨진 채 새 서버가 시작되지 않는다. Start 명령은 `cd dfkorea-backend && npm run start:prod`다.

Dockerfile과 `railway.json`도 `npm run migration:run:prod && npm run start:prod`를 사용한다. migration 실패를 `|| true` 등으로 무시하지 않는다.

백엔드의 `PUBLIC_SITE_URL`, `PUBLIC_API_URL`, `CORS_ORIGIN`에는 실제 HTTPS URL을 넣고, `DB_HOST`, `DB_PORT`, `DB_USERNAME`, `DB_PASSWORD`, `DB_NAME`에는 PostgreSQL 접속 값을 넣는다. 상세 변수는 `dfkorea-backend/.env.example`을 기준으로 한다.

### 공식 데이터 키

- [조달청 나라장터 입찰공고정보서비스](https://www.data.go.kr/data/15129394/openapi.do)와 [공동주택 입찰공고 정보제공 서비스](https://www.data.go.kr/data/15058166/openapi.do)를 공공데이터포털에서 활용 신청한 뒤 `PUBLIC_DATA_SERVICE_KEY`를 설정한다.
- 포털은 URL 인코딩된 키와 디코딩된(원문) 키를 함께 보여줄 수 있다. 디코딩/원문 키가 있으면 그대로 넣고, 포털이 직접 API 호출용으로 지정한 값만 사용한다. 키를 복사한 뒤 다시 URL 인코딩하지 않는다. HTTP 클라이언트가 쿼리 값을 정확히 한 번 인코딩한다.
- 한전 전자입찰계약정보는 현재 LINK API다. [공식 데이터셋](https://www.data.go.kr/data/15148223/openapi.do)에서 활용 승인을 받고 실제 OpenAPI 매뉴얼의 URL·operation·인증 파라미터·응답 필드를 `docs/references/kepco-tender-api-contract.md`와 비교하기 전에는 `KEPCO_TENDER_ENABLED=false`를 유지한다.

API 키와 원본 요청 URL은 로그, DB 원본 데이터, API 응답에 넣지 않는다.

### NAVER WORKS SMTP

1. NAVER WORKS 관리자 콘솔에서 발신 계정의 SMTP 사용을 허용한다.
2. 발신 계정의 외부 앱 비밀번호를 만들고, 일반 로그인 비밀번호 대신 `SMTP_APP_PASSWORD`에만 저장한다.
3. `SMTP_HOST=smtp.worksmobile.com`, `SMTP_PORT=465`, `SMTP_SECURE=true`, `SMTP_USER=도메인_포함_발신_이메일`, `SMTP_FROM_NAME`을 설정한다.
4. 앱 비밀번호 노출 또는 발신 계정 변경 시 기존 비밀번호를 폐기하고, 새 값을 배포 플랫폼에 주입한 뒤 스테이징 메일함으로 다시 검증한다.

수신 주소에는 개별 메일을 전송하므로 서로의 주소가 노출되지 않는다. SMTP 자격 증명은 구독 설정 API 또는 DB에 저장되지 않는다.

### 예약 작업과 여러 서버 인스턴스

- 공고 수집은 `Asia/Seoul` 기준 매일 `00:00`, `12:00`에만 실행한다. 최초 조회 범위는 직전 24시간이고, 이후에는 출처별 마지막 성공 시각의 1시간 전부터 다시 조회한다.
- 일일 메일은 저장된 공통 시각에 한 번 발송한다. 주소별 첫 실패만 10분 뒤 한 번 재시도한다.
- 수집, 일일 메일, 재시도는 각각 PostgreSQL advisory lock을 같은 연결 세션에서 획득하므로 Railway/PM2 replica가 여러 개여도 한 인스턴스만 작업한다.
- `node-cron`이 `Asia/Seoul`을 명시하므로 Node 프로세스·서버의 기본 시간대는 일정 의미를 바꾸지 않는다.

관리자에는 수집 현황 버튼이 없다. 실패는 `tender_sync_runs`에 출처별로 남고 다음 정규 수집이 겹치는 시간 범위를 회수한다.

### 실제 AppModule 통합 테스트

빠른 `npm run test:tender:contract`는 외부 경계와 저장소를 이중으로 바꾼 HTTP·서비스 **계약 테스트**다. 실제 PostgreSQL은 건드리지 않는다.

실제 AppModule, JWT, TypeORM, migration을 확인하려면 disposable DB만 지정한 뒤 아래 전용 명령을 사용한다.

```bash
cd dfkorea-backend
TEST_DATABASE_URL='postgresql://test_user:test_password@localhost:5432/dfkorea_tender_e2e' \
  npm run test:tender:integration
```

또는 `TEST_DB_HOST`, `TEST_DB_PORT`, `TEST_DB_USERNAME`, `TEST_DB_PASSWORD`, `TEST_DB_NAME`을 모두 설정한다. 전용 실행기는 **로컬** `localhost`, `127.0.0.1`, `::1` 또는 명시된 Docker 서비스 `postgres`/`db`만 허용한다. DB 이름에는 `test` 또는 `e2e`가 있어야 하고 URL·host·DB 이름 어디에도 `prod`, `production`, `live`, `staging`이 있으면 AppModule을 시작하기 전에 실패한다. URL 안전성 검사는 최대 4회 percent decode하며 malformed 또는 그 이후에도 남은 어떤 `%`도 거부한다. 원격 스테이징 DB는 이 파괴적 통합 러너의 대상이 아니다. migration을 적용하고 명시된 tender 테이블 여섯 개만 트랜잭션으로 truncate하며, 종료 시에도 같은 범위만 정리한 뒤 앱을 닫는다. 실제 API 어댑터와 SMTP 전송기만 이중으로 교체하며 운영 DB 변수(`DB_*`)만으로는 실행할 수 없다.

### 스테이징 라이브 스모크 체크리스트

실제 API·SMTP 자격 증명 없이 이 저장소에서 외부 호출을 수행하지 않는다. 별도 스테이징에서 다음을 확인한다.

1. 전용 DB를 백업하고 migration을 실행한 뒤 여섯 tender 테이블과 singleton/claim migration이 적용됐는지 확인한다.
2. 나라장터·K-apt 키를 주입해 실제 응답을 한 번 수집하고, 공고 ID·차수 중복이 없으며 키가 로그·응답에 없는지 확인한다. 한전은 승인된 매뉴얼 검증 전까지 비활성화한다.
3. 다음 `00:00` 또는 `12:00` KST 실행 뒤 `tender_sync_runs`가 출처별 성공/실패를 분리하고, 캘린더의 등록일 기준 직접/잠재 건수가 DB 집계와 같은지 확인한다.
4. 관리자 JWT로 calendar, list, detail을 확인한다. 캘린더는 42칸이고, 화면 필터가 메일 수신 대상에 영향을 주지 않아야 한다.
5. 스테이징 수신 주소와 다음 발송 시각을 저장해 digest 한 번을 확인한다. 한 주소를 고의 실패시켜 그 주소만 10분 뒤 한 번 재시도되고, 성공 주소에는 중복 메일이 없는지 확인한다.

### 롤백

먼저 구독을 비활성화하거나 SMTP/API 변수를 제거해 외부 호출을 멈춘다. 이미 적용한 migration은 무조건 되돌리면 데이터가 손실될 수 있으므로, 스테이징에서 백업 복원과 `npm run migration:revert`를 검증한 승인된 복구 계획으로 한 단계씩 롤백한다. 코드만 이전 버전으로 되돌린 뒤에도 수집 lock, 비밀값 노출, 캘린더 집계, 메일 중복을 다시 점검한다.
