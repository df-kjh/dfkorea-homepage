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
