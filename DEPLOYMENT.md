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
- PostgreSQL (모든 백엔드 배포에서 필수)

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
# secret store only: >=32 chars and 3+ of lower/upper/number/symbol
JWT_SECRET=
JWT_EXPIRES_IN=7d
CORS_ORIGIN=https://yourdomain.com
MAX_FILE_SIZE=10485760
UPLOAD_DEST=./uploads
DB_HOST=postgres-host
DB_PORT=5432
DB_USERNAME=postgres-user
DB_PASSWORD=replace-with-secret-store-value
DB_NAME=dfkorea
TYPEORM_SYNCHRONIZE=false
```

### 2. Docker Compose로 빌드 및 실행

기존 관리자가 있는 일반 배포는 아래 명령을 사용한다. fresh DB 또는 insecure default-admin cleanup으로 관리자가 0명이 된 배포는 backend ingress/replica를 열기 전에 이미지를 build하고 migration을 실행한 뒤, compose secret store에 임시 `ADMIN_USERNAME`/`ADMIN_PASSWORD`를 주입하여 `npm run admin:provision:prod` one-off container를 정확히 한 번 실행한다. 성공 뒤 두 입력을 제거하고 아래 일반 시작을 수행한다. backend는 관리자 0명 상태에서 자동 계정을 만들지 않고 시작에 실패한다.

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

# 정확히 .env.production을 검증·로드한 migration 성공 뒤에만 애플리케이션 시작
npm run migration:run:prod:env && pm2 start ecosystem.config.js --env production

# 부팅 시 자동 시작 설정
pm2 startup
pm2 save
```

#### 4. 또는 직접 실행

```bash
npm run migration:run:prod:env && npm run start:prod:env
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

| 변수명                | 설명                | 예시                      |
| --------------------- | ------------------- | ------------------------- |
| `NODE_ENV`            | 환경 모드           | `production`              |
| `PORT`                | 서버 포트           | `3000`                    |
| `JWT_SECRET`          | JWT 서명키          | secret store에서 32자 이상 무작위 값 주입 |
| `JWT_EXPIRES_IN`      | JWT 만료 시간       | `7d`                      |
| `CORS_ORIGIN`         | CORS 허용 도메인    | `https://yourdomain.com`  |
| `MAX_FILE_SIZE`       | 최대 업로드 크기    | `10485760` (10MB)         |
| `UPLOAD_DEST`         | 업로드 디렉토리     | `./uploads`               |
| `DB_HOST`             | PostgreSQL 호스트   | `postgres-host`           |
| `DB_PORT`             | PostgreSQL 포트     | `5432`                    |
| `DB_USERNAME`         | PostgreSQL 사용자   | `postgres-user`           |
| `DB_PASSWORD`         | PostgreSQL 비밀번호 | 비밀 저장소에서 주입      |
| `DB_NAME`             | PostgreSQL DB 이름  | `dfkorea`                 |
| `TYPEORM_SYNCHRONIZE` | TypeORM 자동 동기화 | 운영에서는 반드시 `false` |

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

- [ ] JWT_SECRET이 32자 이상이고 소문자·대문자·숫자·기호 중 3종 이상이며 placeholder가 아닌지 확인
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
npm run migration:run:prod:env && pm2 restart led-backend

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

입찰 기능은 PostgreSQL과 TypeORM migration을 사용한다. `TYPEORM_SYNCHRONIZE=false`를 유지하고, 배포 전 DB 백업을 만든다. 아래 단계 중 하나라도 실패하면 이후 단계를 실행하지 않는다. 수동 서버의 `:env` 명령은 하나의 production runner를 `file` mode로 실행한다. 이 mode는 backend 디렉터리의 `.env.production`을 격리해서 읽고, 파일에 적힌 모든 값으로 같은 이름의 ambient 값을 덮어쓴다. 파일에 없는 PATH 같은 process 값은 유지하지만, 다섯 DB 값과 `JWT_SECRET`은 반드시 파일 자체에 있어야 한다. migration, revert, admin provisioning, app start가 모두 이 동일한 precedence를 사용한다. 파일 또는 `NODE_ENV=production`, 다섯 `DB_*`, 강한 `JWT_SECRET` 중 하나라도 유효하지 않으면 DB 접속이나 Nest listen 전에 실패하고 값은 오류에 출력하지 않는다.

```bash
cd dfkorea-backend
npm ci
npm run build
npm run migration:run:prod:env
# 최초 배포 또는 insecure default-admin cleanup 뒤 admin이 0명일 때만:
# secret store/.env.production에 ADMIN_USERNAME과 ADMIN_PASSWORD를 임시 주입
npm run admin:provision:prod:env
# provisioning 입력을 즉시 제거한 뒤 정상 실행
npm run migration:run:prod:env && npm run start:prod:env
```

Railway처럼 환경 변수를 플랫폼이 직접 주입하는 경로의 `migration:run:prod`, `migration:revert:prod`, `admin:provision:prod`, `start:prod`는 같은 runner의 명시적 `ambient` mode다. 이 mode는 어떤 env 파일도 읽지 않는다. 플랫폼은 `NODE_ENV=production`, 다섯 `DB_*`, 규칙을 만족하는 `JWT_SECRET`을 모두 주입해야 한다. pre-deploy 명령은 `cd dfkorea-backend && npm ci && npm run build && npm run migration:run:prod`로 둔다. 최초 관리자만 별도 one-off job에서 임시 `ADMIN_USERNAME`/`ADMIN_PASSWORD`와 `npm run admin:provision:prod`로 만든 뒤 두 입력을 삭제한다. Start 명령은 `cd dfkorea-backend && npm run migration:run:prod && npm run start:prod`다. 관리자가 0명이면 start는 자동 계정을 만들지 않고 nonsecret 안내 오류로 중단한다.

Dockerfile과 `railway.json`도 `npm run migration:run:prod && npm run start:prod`를 사용한다. migration 실패를 `|| true` 등으로 무시하지 않는다.

backend의 canonical CI는 다음 단일 명령으로 실행한다.

```bash
cd dfkorea-backend
npm run test:ci
```

`test:ci`는 lint, unit, contract, TypeScript 검사를 통과한 뒤 backend의 정확한 `dist` 디렉터리를 지우고 새로 build한다. 따라서 오래된 산출물로 compiled 검사가 통과할 수 없다. 이어서 실제 compiled runner를 `file`/`ambient` start mode로 spawn하여 `dist/main.js`에 진입하고 TypeORM entity/migration discovery도 검사한다. 별도 preload hook이 main module load 직전에만 `NODE_ENV=test`로 전환해 test-only sanitized config probe에서 종료하므로 DB/network 연결을 만들지 않는다. 이 test-only probe는 `NODE_ENV=production`에서는 비활성화되며 password를 기록하지 않는다. 또한 missing file/변수의 사전 종료와 dev/test에서 PG alias를 무시하는 기존 Nest DB 옵션을 검증한다.

백엔드의 `PUBLIC_SITE_URL`, `PUBLIC_API_URL`, `CORS_ORIGIN`에는 실제 HTTPS URL을 넣고, `DB_HOST`, `DB_PORT`, `DB_USERNAME`, `DB_PASSWORD`, `DB_NAME`에는 PostgreSQL 접속 값을 넣는다. 상세 변수는 `dfkorea-backend/.env.example`을 기준으로 한다.

### JWT 키 생성과 회전

- production `JWT_SECRET`은 trim 후 최소 32자이며 소문자·대문자·숫자·기호 중 최소 3종을 포함해야 한다. `your-secret-key-change-this`, 빈 값, 짧거나 단일 패턴인 값은 file/ambient mode 모두 거부한다.
- 암호학적으로 안전한 생성기로 만든 값을 secret store에만 보관하고 로그, shell history, 저장소에 쓰지 않는다. signing과 verification은 동일한 shared validator 결과만 사용한다.
- 회전 시 change window를 선언하고 새 키를 모든 replica의 동일 secret revision에 설정한 뒤 replica를 순차 재시작한다. 기존 token은 즉시 무효화되므로 관리자 재로그인과 보호 API를 확인하고 이전 키를 폐기·감사한다.
- 과거 fallback 또는 알려진 placeholder로 운영한 적이 있다면 해당 키로 만든 모든 token을 침해된 것으로 보고 즉시 회전하며 access log와 관리자 변경 이력을 감사한다.

### 최초 관리자와 기존 기본 자격 증명 정리

- fresh migration은 관리자를 만들지 않는다. `1787819900000-RemoveInsecureDefaultAdmin`은 username이 정확히 `admin`이고 저장 hash가 `admin123`과 일치하는 행만 id+username+password 조건으로 삭제한다. 다른 관리자와 이미 회전된 `admin`은 삭제하지 않는다.
- 관리자가 0명인 production은 자동 생성하지 않고 시작을 거부한다. 승인된 운영자가 migration 후 별도 one-off compiled `admin:provision:prod` 또는 `admin:provision:prod:env`를 한 번만 실행한다.
- `ADMIN_USERNAME`은 3–64자의 영문·숫자·점·밑줄·하이픈, `ADMIN_PASSWORD`는 16자 이상이며 소문자·대문자·숫자·기호를 모두 포함해야 한다. CLI는 serializable transaction과 transaction advisory lock 아래 기존 관리자 0명을 다시 확인하고 bcrypt cost 12 hash만 저장한다. 값/hash는 출력하지 않는다.
- 기존 `admin/admin123` 사용 이력이 있으면 migration 여부와 무관하게 관련 자격 증명을 폐기하고 관리자·로그인 이력을 감사한다. provisioning 입력은 성공 직후 secret store와 `.env.production`에서 제거한다.

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
- 일일 메일 작업은 매분 공용 설정을 DB에서 다시 읽고, 현재 KST 시각이 저장 시각 이상이면 `tender_daily_dispatches.businessDate` 고유키를 먼저 claim한다. 설정 변경과 여러 replica가 있어도 KST 영업일별 한 번만 실행된다.
- 주소별 확인된 첫 SMTP 실패만 10분 뒤 한 번 재시도한다. `responseCode` 4xx/5xx의 명시적 거절, 또는 `command=CONN|AUTH|MAIL FROM|RCPT TO` 단계의 입증 가능한 연결·인증·envelope 실패만 confirmed failure다. `DATA` 중 timeout/reset, command 없는 `ETIMEDOUT`/`ECONNRESET`, 알 수 없는 오류는 즉시 terminal `DELIVERY_UNCERTAIN`으로 delivery/item을 함께 종결하며 재시도하지 않는다. Nodemailer 원본 오류는 메모리 내 typed classifier에만 전달하고 server response나 recipient 상세는 DB 오류 문자열에 저장하지 않는다.
- 일일 dispatch claim은 15분 `leaseExpiresAt`을 가진다. recipient claim 전 DB 오류가 나면 `CLAIMED`와 안전한 `lastError`를 유지하고 완료하지 않는다. 다음 replica는 lease 만료 뒤 같은 KST business date를 reclaim하여 durable delivery/no-work 상태가 없는 recipient만 처리한다. fresh lease와 `COMPLETED`는 건너뛴다.
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

또는 `TEST_DB_HOST`, `TEST_DB_PORT`, `TEST_DB_USERNAME`, `TEST_DB_PASSWORD`, `TEST_DB_NAME`을 모두 설정한다. 전용 실행기는 **로컬** `localhost`, `127.0.0.1`, `::1` 또는 명시된 Docker 서비스 `postgres`/`db`만 허용한다. DB 이름에는 `test` 또는 `e2e`가 있어야 하고 URL·host·DB 이름 어디에도 `prod`, `production`, `live`, `staging`이 있으면 AppModule을 시작하기 전에 실패한다. URL 안전성 검사는 최대 4회 percent decode하며 malformed 또는 그 이후에도 남은 어떤 `%`도 거부한다. 원격 스테이징 DB는 이 파괴적 통합 러너의 대상이 아니다. migration을 적용하고 명시된 tender 테이블 일곱 개만 트랜잭션으로 truncate하며, 종료 시에도 같은 범위만 정리한 뒤 앱을 닫는다. 실제 API 어댑터와 SMTP 전송기만 이중으로 교체하며 운영 DB 변수(`DB_*`)만으로는 실행할 수 없다.

### 스테이징 라이브 스모크 체크리스트

실제 API·SMTP 자격 증명 없이 이 저장소에서 외부 호출을 수행하지 않는다. 별도 스테이징에서 다음을 확인한다.

1. 전용 DB를 백업하고 migration을 실행한 뒤 일곱 tender 테이블과 singleton/claim/recipient-activation migration이 적용됐는지 확인한다.
2. 나라장터·K-apt 키를 주입해 실제 응답을 한 번 수집하고, 공고 ID·차수 중복이 없으며 키가 로그·응답에 없는지 확인한다. 한전은 승인된 매뉴얼 검증 전까지 비활성화한다.
3. 다음 `00:00` 또는 `12:00` KST 실행 뒤 `tender_sync_runs`가 출처별 성공/실패를 분리하고, 캘린더의 등록일 기준 직접/잠재 건수가 DB 집계와 같은지 확인한다.
4. 관리자 JWT로 calendar, list, detail을 확인한다. 캘린더는 42칸이고, 화면 필터가 메일 수신 대상에 영향을 주지 않아야 한다.
5. 스테이징 수신 주소와 다음 발송 시각을 저장해 digest 한 번을 확인한다. 한 주소를 고의 실패시켜 그 주소만 10분 뒤 한 번 재시도되고, 성공 주소에는 중복 메일이 없는지 확인한다. SMTP 승인 직후 강제 종료 시험은 별도 승인된 테스트 계정에서만 수행하고, stale claim이 `DELIVERY_UNCERTAIN`으로 종결되어 재전송되지 않는지 확인한다.

### 롤백

아래 gate는 순서대로 통과해야 한다. 하나라도 확인할 수 없으면 destructive action을 시작하지 않거나 즉시 중단한다.

#### Gate 0 — 변경 창과 책임자 선언

- [필수 작업: DECLARE INCIDENT AND CHANGE WINDOW]

incident/change window, 작업 책임자, 승인자, 영향 범위, 관찰 지표와 중단 기준을 기록한다. 사용할 코드 revision과 목표 schema version을 함께 고정한다.

#### Gate 1 — ingress와 모든 backend replica 정지

- [필수 작업: STOP INGRESS]

- [필수 작업: STOP ALL BACKEND REPLICAS, SCHEDULERS, AND API TRAFFIC]

외부 ingress를 차단한 다음 **모든 backend replica**를 0개로 축소하거나 완전히 정지한다. 여기에는 scheduler와 API traffic을 처리하는 Railway, Docker, PM2 instance가 전부 포함된다. 구독 비활성화나 자격 증명 제거는 replica 정지를 대체하지 않는다.

#### Gate 2 — 정지 상태 검증

- [필수 작업: VERIFY ZERO RUNNING INSTANCES, APPLICATION CONNECTIONS, AND JOBS]

배포 플랫폼과 PostgreSQL 양쪽에서 실행 중인 instance, connection, job이 0개인지 확인한다. 애플리케이션 DB connection, advisory lock, 수집·메일 job, queue 작업이 남아 있으면 Gate 1로 돌아간다. 운영자가 읽기 전용 관리 연결을 유지한다면 별도로 식별하고 기록한다.

#### Gate 3 — 즉시 백업 및 복구 가능성 검증

- [필수 작업: CREATE CURRENT-STATE SAFETY BACKUP NOW]

- [필수 작업: CREATE AND VERIFY CURRENT-STATE BACKUP CHECKSUM]

- [필수 작업: RESTORE CURRENT-STATE SAFETY BACKUP IN ISOLATED REHEARSAL TARGET]

- [필수 작업: VALIDATE CURRENT-STATE REHEARSAL SCHEMA, TABLE COUNTS, AND KEY DATA]

- [필수 작업: CLEAN UP CURRENT-STATE REHEARSAL TARGET AND RECORD EVIDENCE]

Gate 2 확인 뒤 destructive action 직전 시점의 timestamp가 붙은 **새 PostgreSQL backup**을 만든다. 이것은 rollback 작업 자체에서 문제가 생겼을 때 현재 상태로 돌아오기 위한 `current-state safety backup`이다. 과거 배포 전 백업만으로 이 gate를 통과할 수 없으며, current-state safety backup은 intended rollback artifact가 아니다.

생성 직후 checksum을 만들고 독립적으로 다시 계산해 일치 여부를 검증한다. 그 current-state artifact를 격리된 disposable PostgreSQL 또는 공급자의 격리 restore target에 **실제로 restore**해야 한다. listing은 supplemental evidence일 뿐이다. backup archive listing만으로는 충분하지 않다.

복원된 target에서 migration history, table/index/constraint schema, 핵심 테이블별 row count와 승인자가 정한 key data sample을 원본의 기록값과 대조한다. 검증 결과, artifact 위치, timestamp, checksum, 실행자와 승인자를 증거로 남긴 뒤 격리 target을 정리하고 정리 완료도 기록한다. 이 모든 단계가 성공하기 전에는 Gate 4로 진행하지 않는다. 백업·복원·검증 중 쓰기나 job이 감지되면 artifact와 격리 target을 폐기하고 Gate 1부터 다시 시작한다.

#### Gate 4 — 복구 방식 하나 선택

- [필수 작업: SELECT APPROVED PRE-CHANGE RESTORE ARTIFACT]

- [필수 작업: VERIFY PRE-CHANGE ARTIFACT CHECKSUM]

- [필수 작업: RESTORE PRE-CHANGE ARTIFACT IN ISOLATED REHEARSAL TARGET]

- [필수 작업: VALIDATE PRE-CHANGE ARTIFACT AGAINST TARGET CODE, SCHEMA, COUNTS, AND KEY DATA]

- [필수 작업: CLEAN UP PRE-CHANGE REHEARSAL TARGET AND RECORD EVIDENCE]

- [필수 작업: APPROVE EXACTLY ONE RECOVERY METHOD]

restore를 후보로 삼으려면 목표 이전 코드 revision과 schema version에 맞는 `approved pre-change artifact`를 별도로 선택한다. 이 artifact의 recorded checksum과 새로 계산한 checksum이 일치해야 한다. 해당 artifact를 격리된 temporary PostgreSQL/provider target에 실제 restore하고, 목표 코드와 함께 migration history, table/index/constraint schema, 핵심 table count와 key data를 검증한다. 검증 증거와 승인자를 기록하고 격리 target을 정리한 뒤 cleanup 증거까지 남겨야 한다. 현재 상태 안전 backup 검증으로 이 pre-change 검증을 대신할 수 없다.

승인자는 위 증거와 데이터 보존 영향을 검토해 **approved pre-change artifact restore 또는 current DB migration 1단계 revert 중 하나만** 선택한다. 두 방법을 연속으로 또는 무조건 실행하지 않는다. migration down이 데이터를 삭제하거나 이전 코드와 호환되지 않으면 검증된 pre-change restore를 선택하며, 어느 쪽도 검증되지 않았다면 작업을 중단한다.

#### Gate 5 — 명시적 production env로 DB 작업

- [필수 작업: EXECUTE APPROVED PRE-CHANGE RESTORE OR ONE-STEP COMPILED REVERT WITH EXPLICIT PRODUCTION ENV]

restore branch는 approved pre-change artifact를 사용한다. Gate 3의 current-state safety backup을 rollback 목표로 복원하지 않는다. revert branch는 current DB에 compiled migration down을 한 단계만 적용한다. revert를 선택했다면 저장소 루트가 아니라 backend 디렉터리에서 빌드 산출물과 정확한 `.env.production`을 사용한다.

```bash
cd dfkorea-backend
npm run build
npm run migration:revert:prod:env
```

`:env` runner의 `file` mode는 backend의 `.env.production`을 격리 load하고 필수 production DB 변수를 검증한 뒤 `dist/database/typeorm.config.js`를 호출한다. 파일·변수 누락 시 DB 접속 전에 실패하며 비밀값을 출력하지 않는다. Railway/container의 `ambient` mode는 파일을 읽지 않고 플랫폼 주입값만 검증한다. 실제 restore 전에 approved pre-change artifact와 목표 revision 조합을, 실제 revert 전에 current-state safety backup과 compiled down migration 조합을 각각 스테이징에서 검증한다.

#### Gate 6 — schema-compatible 코드와 검증

- [필수 작업: DEPLOY SCHEMA-COMPATIBLE PRIOR CODE]

- [필수 작업: RUN MIGRATION STATUS, SCHEMA, AND HEALTH CHECKS]

선택한 DB 상태와 호환되는 이전 코드 revision을 배포하되 아직 replica를 시작하지 않는다. migration history와 실제 table/index/constraint schema를 목표 version과 비교하고, 읽기 전용 health/schema check를 실행한다. 불일치, pending migration 오판, 데이터 검증 실패가 있으면 시작하지 말고 Gate 5 이전 상태로 복구한다.

#### Gate 7 — backend replica 후 ingress 순서로 재개

- [필수 작업: START BACKEND REPLICAS]

- [필수 작업: REOPEN INGRESS]

backend replica를 먼저 최소 1개만 시작해 health와 scheduler lock 획득 상태를 확인한다. 그 다음 필요한 replica 수까지 늘리고 모두 정상임을 확인한 뒤 마지막에 ingress를 연다. ingress를 replica보다 먼저 열지 않는다.

#### Gate 8 — 모니터링과 중단 기준

- [필수 작업: MONITOR ROLLBACK HEALTH]

- [필수 작업: ABORT ON DEFINED CRITERIA]

오류율, DB connection, migration/schema 상태, 수집 lock, 메일 발송·중복, 캘린더 집계를 change window 동안 모니터링한다. schema 불일치, 예상 밖 쓰기, 중복 scheduler, 급격한 오류 증가 또는 backup 복구 불가가 확인되면 ingress를 닫고 모든 replica를 다시 정지하며 incident 책임자에게 escalate한다. 사전 정의한 중단 기준 없이 정상 종료로 선언하지 않는다.
