# Corum Ranked Official Site v1.5.0

Corum Ranked의 맵 풀, 공개 플레이어 순위와 운영 규칙을 보여주는 공식 사이트입니다.

## v1.5.0 디자인 개편

- 차콜, 쿨 화이트, 오렌지 색상과 숫자 중심의 Competitive Index 디자인을 적용했습니다.
- 맵 리스트는 Pool별 개수를 보여주는 필터와 검색 가능한 표로 구성하며, 모바일에서는 맵 카드로 전환합니다.
- 순위는 LP, 승급전, 3/5 Stage Placement 진행, 승패와 승률을 구분합니다. 서버의 정렬 순서를 유지합니다.
- 정보와 Placement 화면은 규칙집, Stage 비교, Grade별 Pool 이동, 최종 배치 흐름으로 재구성했습니다.
- 라이트/다크 테마, 작은 화면, 키보드 포커스, 모션 줄이기 설정을 지원합니다.
- 상단 3개 메뉴와 별도 `#placement` 경로, 공개 API/CSV 로딩, 현재 게임 규칙을 유지합니다.
- 서버 상태 조회 실패는 `상태 확인 불가`로 구분합니다. 실제 Ranked 비활성 상태에서 공개 읽기는 계속 가능합니다.
- 검증: 데이터 회귀 테스트 10개, Vite 프로덕션 빌드, 기존 규칙·데이터 로더 보존 및 CSS 변수 점검.

## v1.4.1 수정

- 순위의 배치 표시를 과거 PvP 승패 마크에서 서버가 제공하는 3/5 Stage 진행으로 변경했습니다.
- 현재 Stage/Map, 완료 Map 수, Stage 결과 대기와 시작 전 상태를 표시합니다.
- 기존 API만 제공되는 동안에는 `배치 미완료 / 상세 진행 정보 없음`으로 표시하며 Stage 수를 추측하지 않습니다.
- 맵 목록은 서버의 공개 `GET /api/ranked/maps`에서 먼저 읽고, 이용할 수 없으면 원래 sheet2 CSV로 전환합니다.
- Google CSV는 리다이렉트를 포함해 30초가량 걸리는 응답을 수용하도록 45초까지 기다립니다. 매번 달라지는 URL 쿼리를 제거했습니다.
- 최신 진행 표시와 서버 맵 조회를 사용하려면 Corum-Ranked 서버의 공개 데이터 패치도 함께 배포해야 합니다. 서버 → Web 순서로 반영하는 것을 권장합니다.
- 검증: `npm test`, `npm run build`.

## 현재 기능

- `맵 리스트`: sheet2의 맵 제목, 난이도, 맵 코드, Ranked Pool, Qualifying %
- `순위`: 플레이어 이름, 티어/LP, 승급전·배치 상태, 승/패, 승률
- 상단에 Ranked 운영 상태를 `서버 열림` / `서버 닫힘`으로 표시
- Ranked 매칭이 꺼져 있어도 DB가 연결되어 있으면 순위와 플레이어 상태 표시
- Unranked는 Ranked 아래에 별도 분류
- `정보`: 티어별 LP 커트, 승급전 판수/필요 승수, 승급·강등 규칙, 풀 구성
- 정보 탭에 Bo3 경기 흐름, 5분 라운드, Final/LAST Attempt, 3-Clear,
  Death Match와 Attempt 점수를 설명하는 `진행 방식` 섹션 추가
- 정보 탭의 Placement 요약에서 별도 `#placement` 상세 화면으로 이동 (상단 3개 메뉴 유지)
- 다크 모드 유지
- 모드 다운로드 버튼 비활성화 유지
- GitHub Pages 배포 workflow 포함

Hidden MMR은 서버의 동률 정렬에만 사용되며 공개 API 응답과 사이트에는 표시되지
않습니다.

## 순위 정렬

- Ranked: 높은 티어 우선
- 같은 티어의 승급전 플레이어: 승급전 승리 수 → 승률 → Hidden MMR → 이름순
- 같은 티어의 일반 플레이어: LP → 승률 → Hidden MMR → 이름순
- Unranked: 승률 → Hidden MMR → 이름순

승률은 `wins / (wins + losses)`로 계산합니다.

## 실행

```bash
npm install
npm run dev
```

## GitHub Pages 배포

1. 이 압축 파일의 내용을 저장소 최상위에 넣고 `main` 브랜치에 push합니다.
2. GitHub 저장소의 `Settings → Pages → Source`를 `GitHub Actions`로 설정합니다.
3. 포함된 `.github/workflows/deploy.yml`이 `dist`를 자동 배포합니다.

## Ranked 서버 연결

기본 서버는 `https://corum-ranked.onrender.com`입니다. 다른 서버를 사용하면 저장소의
GitHub Actions Variable에 아래 값을 설정합니다.

```text
VITE_RANKED_API_URL=https://your-ranked-server.example
```

로컬에서는 `.env`에 같은 값을 넣으면 됩니다.

순위 탭과 상단 서버 상태는 공개 읽기 전용 `GET /api/ranked/leaderboard`를 사용합니다. 매칭 활성화 여부와 공개 DB 조회 가능 여부는 서로 독립적입니다. 함께 제공된 서버
패치를 Corum-Ranked 서버에 반영하고, 서버의 `CORS_ORIGINS`에 GitHub Pages origin인
`https://ybaf100.github.io`를 등록해야 합니다. DB 접속 문자열을 프런트엔드에 넣지 마세요.

## 데이터 원본

- sheet2: 맵 목록
- Ranked Tiers: 티어 커트, 메인/데스매치 풀, 승급전 판수와 필요 승수
- Ranked Config: 승급·강등 LP 보정값 (legacy 배치 판수를 Stage 수로 사용하지 않음)
- Ranked 공개 API: 플레이어 공개 상태·전적·Solo Stage 진행, 검증된 sheet2 맵 스냅샷
