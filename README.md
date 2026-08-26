# Corum Ranked Official Site

Corum Ranked의 현재 맵 풀과 티어별 풀 구성을 보여주는 공식 사이트 소스입니다.

## 실행

```bash
npm install
npm run dev
```

## 빌드

```bash
npm run build
```

빌드 결과는 `dist` 폴더에 생성됩니다. `vite.config.js`의 `base`가 상대 경로로 설정되어 있어 GitHub Pages와 일반 정적 호스팅에 사용할 수 있습니다.

## 데이터

Google Sheets의 `sheet2` CSV에서 다음 열만 읽습니다.

- 맵 제목
- Rating
- 대체 맵 코드
- Ranked Pool (1~6)
- Qualifying %

사이트에서는 `대체 맵 코드`가 `맵 코드`로 표시됩니다. `Ranked Pool (1~6)` 값이 비어 있는 맵은 목록에 표시되지 않습니다.
