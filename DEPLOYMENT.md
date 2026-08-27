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
JWT_SECRET=your-super-secret-jwt-key-change-this
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
npm run migration:run:prod:env && npm run start:prod
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
| `JWT_SECRET`          | JWT 비밀키          | `your-secret-key`         |
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

입찰 기능은 PostgreSQL과 TypeORM migration을 사용한다. `TYPEORM_SYNCHRONIZE=false`를 유지하고, 배포 전 DB 백업을 만든다. 아래 단계 중 하나라도 실패하면 이후 단계를 실행하지 않는다. 수동 서버는 backend 디렉터리의 `.env.production`을 명시적으로 읽는 `:env` migration 명령을 사용한다. `start:prod`도 `NODE_ENV=production`을 강제해 같은 파일을 선택한다. 이 파일이 없거나 `NODE_ENV=production`, `DB_HOST`, `DB_PORT`, `DB_USERNAME`, `DB_PASSWORD`, `DB_NAME` 중 하나라도 비어 있으면 migration은 DB에 접속하기 전에 실패한다. 값은 오류에 출력하지 않는다.

```bash
cd dfkorea-backend
npm ci
npm run build
npm run migration:run:prod:env && npm run start:prod
```

Railway처럼 환경 변수를 플랫폼이 직접 주입하는 경로의 pre-deploy 명령은 `cd dfkorea-backend && npm ci && npm run build && npm run migration:run:prod`로 설정한다. 이 compiled production script가 `NODE_ENV=production`을 강제하며, 플랫폼은 다섯 `DB_*`를 모두 주입해야 한다. production datasource는 누락 값을 localhost나 기본 DB로 대체하지 않고 실패한다. `&&`를 사용하므로 schema 적용 실패가 숨겨진 채 새 서버가 시작되지 않는다. Start 명령 역시 `cd dfkorea-backend && npm run migration:run:prod && npm run start:prod`로 설정해 migration 없는 시작 경로를 만들지 않는다.

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
- 일일 메일 작업은 매분 공용 설정을 DB에서 다시 읽고, 현재 KST 시각이 저장 시각 이상이면 `tender_daily_dispatches.businessDate` 고유키를 먼저 claim한다. 설정 변경과 여러 replica가 있어도 KST 영업일별 한 번만 실행된다.
- 주소별 확인된 첫 SMTP 실패만 10분 뒤 한 번 재시도한다. SMTP 요청 뒤 결과를 DB에 확정하기 전에 프로세스가 종료된 stale claim은 `DELIVERY_UNCERTAIN`으로 종결하고 다시 보내지 않는다. SMTP 승인과 DB commit은 원자화할 수 없으므로, 이 정책은 드문 메일 손실 가능성을 감수해 이미 승인된 주소의 중복 발송을 우선 방지한다.
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

incident/change window, 작업 책임자, 승인자, 영향 범위, 관찰 지표와 중단 기준을 기록한다. 사용할 코드 revision과 목표 schema version을 함께 고정한다.

#### Gate 1 — ingress와 모든 backend replica 정지

외부 ingress를 차단한 다음 **모든 backend replica**를 0개로 축소하거나 완전히 정지한다. 여기에는 scheduler와 API traffic을 처리하는 Railway, Docker, PM2 instance가 전부 포함된다. 구독 비활성화나 자격 증명 제거는 replica 정지를 대체하지 않는다.

#### Gate 2 — 정지 상태 검증

배포 플랫폼과 PostgreSQL 양쪽에서 실행 중인 instance, connection, job이 0개인지 확인한다. 애플리케이션 DB connection, advisory lock, 수집·메일 job, queue 작업이 남아 있으면 Gate 1로 돌아간다. 운영자가 읽기 전용 관리 연결을 유지한다면 별도로 식별하고 기록한다.

#### Gate 3 — 즉시 백업 및 복구 가능성 검증

Gate 2 확인 뒤 destructive action 직전 시점의 timestamp가 붙은 **새 PostgreSQL backup**을 만든다. 과거 배포 전 백업만으로 이 gate를 통과할 수 없다. backup artifact의 listing과 checksum을 기록하고, 격리된 disposable PostgreSQL에서 restore/listing 검증 또는 공급자 restore 검증을 완료해 실제 복구 가능성을 확인한다. 백업 생성·검증 중 쓰기나 job이 감지되면 백업을 폐기하고 Gate 1부터 다시 시작한다.

#### Gate 4 — 복구 방식 하나 선택

승인자는 목표 schema와 데이터 보존 영향을 검토해 **DB restore 또는 migration 1단계 revert 중 하나만** 선택한다. 두 방법을 연속으로 또는 무조건 실행하지 않는다. migration down이 데이터를 삭제하거나 이전 코드와 호환되지 않으면 restore를 선택하며, 어느 쪽도 검증되지 않았다면 작업을 중단한다.

#### Gate 5 — 명시적 production env로 DB 작업

restore를 선택했다면 승인된 공급자 절차로 Gate 3 artifact 하나를 복원한다. revert를 선택했다면 저장소 루트가 아니라 backend 디렉터리에서 빌드 산출물과 정확한 `.env.production`을 사용해 **한 단계만** 실행한다.

```bash
cd dfkorea-backend
npm run build
npm run migration:revert:prod:env
```

`:env` runner는 backend의 `.env.production`만 override-load하고 필수 production DB 변수를 검증한 뒤 `dist/database/typeorm.config.js`를 호출한다. 파일·변수 누락 시 DB 접속 전에 실패하며 비밀값을 출력하지 않는다. Railway/container처럼 환경을 직접 주입하는 자동 배포 경로는 기존 `migration:run:prod`를 사용하되 `NODE_ENV=production`과 모든 `DB_*`를 필수로 주입한다. 실제 revert 전에 동일 backup과 revision으로 스테이징 검증을 완료한다.

#### Gate 6 — schema-compatible 코드와 검증

선택한 DB 상태와 호환되는 이전 코드 revision을 배포하되 아직 replica를 시작하지 않는다. migration history와 실제 table/index/constraint schema를 목표 version과 비교하고, 읽기 전용 health/schema check를 실행한다. 불일치, pending migration 오판, 데이터 검증 실패가 있으면 시작하지 말고 Gate 5 이전 상태로 복구한다.

#### Gate 7 — backend replica 후 ingress 순서로 재개

backend replica를 먼저 최소 1개만 시작해 health와 scheduler lock 획득 상태를 확인한다. 그 다음 필요한 replica 수까지 늘리고 모두 정상임을 확인한 뒤 마지막에 ingress를 연다. ingress를 replica보다 먼저 열지 않는다.

#### Gate 8 — 모니터링과 중단 기준

오류율, DB connection, migration/schema 상태, 수집 lock, 메일 발송·중복, 캘린더 집계를 change window 동안 모니터링한다. schema 불일치, 예상 밖 쓰기, 중복 scheduler, 급격한 오류 증가 또는 backup 복구 불가가 확인되면 ingress를 닫고 모든 replica를 다시 정지하며 incident 책임자에게 escalate한다. 사전 정의한 중단 기준 없이 정상 종료로 선언하지 않는다.
