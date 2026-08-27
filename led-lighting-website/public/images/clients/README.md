# 클라이언트 로고 이미지

이 폴더에 파트너 기업 로고 이미지를 추가하세요.

## 권장 사양

- **형식**: PNG (투명 배경) 또는 SVG
- **크기**: 가로 400px × 세로 200px (비율 2:1)
- **배경**: 투명 또는 흰색
- **파일명**: 소문자, 하이픈으로 구분 (예: `samsung.png`, `lg.png`)

## 현재 설정된 로고 목록

ClientsSection.vue에 다음 로고들이 기본으로 설정되어 있습니다:

1. `samsung.png` - 삼성
2. `lg.png` - LG
3. `hyundai.png` - 현대
4. `sk.png` - SK
5. `lotte.png` - 롯데
6. `gs.png` - GS
7. `posco.png` - 포스코
8. `shinsegae.png` - 신세계

## 로고 추가/변경 방법

1. 이 폴더에 로고 이미지 파일 추가
2. `/src/components/home/ClientsSection.vue` 파일 수정
3. `clients` 배열에서 로고 정보 업데이트:

```typescript
clients: () => [
  { name: '회사명', logo: '/images/clients/로고파일명.png' },
  // ... 추가 로고
]
```

## 주의사항

- 로고 이미지가 없을 경우 회사명이 텍스트로 표시됩니다
- 저작권이 있는 로고는 사용 권한을 확인하세요
- 파일 크기는 가능한 100KB 이하로 최적화하세요
