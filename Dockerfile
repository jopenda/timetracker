# Playwright 공식 이미지 (Chromium + 모든 의존성 포함)
FROM mcr.microsoft.com/playwright:v1.40.0-jammy

WORKDIR /app

# 패키지 설치 (postinstall 스킵 — 이미지에 브라우저 있음)
COPY package*.json ./
RUN npm ci --omit=dev --ignore-scripts

# 소스 복사
COPY . .

# data 폴더 생성 (설정/로그 저장용)
RUN mkdir -p data

EXPOSE 3000

CMD ["node", "server.js"]
