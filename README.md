# Ranked Official Site v2.2.0

Corum Ranked의 맵 풀, Solo·Survival 공개 순위와 최신 운영 규칙을 보여주는 공식 사이트입니다.

## v2.2.0 시즌 카운트다운 · Ranked 명칭

- 상단 서버 상태 옆에 시즌 남은 시간을 표시합니다(`GET /api/ranked/config`의 `seasons`, 서버 시각 기준).
  두 모드의 시즌·시각이 같으면 한 줄로, 다르면 `서바이벌`·`솔랭` 두 줄로 보여 줍니다.
  모드가 열려 있으면 `n일 n시간 남음`(종료까지), 닫혀 있으면 `… 후 시작`입니다. 1일 미만은 `n시간 n분`,
  1시간 미만은 `n분 n초`로 바뀌고 시각이 지나면 설정을 다시 읽습니다. 시계 아이콘의 분침은 90°씩 일정하게 돕니다.
- 사이트에 보이는 명칭을 모두 `Ranked`로 통일했습니다(제목, 로고, 푸터, 규칙 버전 표기).

## v2.1.0 LIVE 보드

- 순위 탭 상단에 진행 중 경기를 보여주는 LIVE 보드를 추가했습니다. 서버 v0.6.0-beta.58의 공개
  `GET /api/ranked/live`를 순위 탭이 열려 있고 화면이 보일 때만 10초마다 읽습니다.
- Solo: 두 플레이어·표시 티어, 매치 형식(단판/BO3), 라운드 승수, 현재 라운드와 맵·난이도, 라운드 점수와
  Clear, 남은 시간. Death Match와 봇 매치를 구분합니다.
- Survival: 현재 라운드, 생존 인원/참가 인원, 통과 목표, 맵, 남은 시간, 생존 중인 플레이어 이름.
- Solo·Survival 대기열 인원을 함께 표시합니다. 서버에 LIVE API가 없으면 보드는 표시되지 않습니다.

## v2.0.0 Night Arena 디자인 · 최신 서버 정보

- 블랙(라이트 모드는 쿨 화이트)과 라임, 기울어진 컨덴스드 서체의 e스포츠 중계형 디자인으로 전면 교체했습니다.
  겹쳐 쓰던 5개 스타일시트를 `styles.css`(공통·맵·순위), `pages.css`(정보·Survival·배치),
  `interaction.css`(맵 코드 복사·진행 단계), `rule-demos.css`(진행 예시)로 정리했습니다.
- 기능은 그대로 유지합니다: 상단 3개 메뉴와 `#placement`, 서버 상태, 라이트/다크 테마, 비활성 모드 버튼,
  맵 검색·Pool 필터·맵 코드 복사, 순위 검색·승급전·강등 경고·배치 진행, 진행 예시 애니메이션과 다시 보기,
  스크롤 등장 효과, 키보드 포커스, 모션 줄이기, 작은 화면.
- 기본 API를 Cloudflare를 거치는 `https://api.hwanhee1.com`으로 바꿨습니다. 빌드 변수가 은퇴한
  Render/Railway 주소를 가리켜도 새 주소를 사용합니다.
- 최신 서버(v0.6.0-beta.57) 규칙을 반영했습니다.
  - Solo 티어: RED·AQUA·BRONZE·SILVER의 III/II/I 디비전, GOLD 안의 CHAMPION·MASTER 칭호, 봇 표시, 장착 칭호.
  - 티어별 매치 형식(단판/BO3)과 맵 밴, 밴 후보 수(단판 4개 / BO3 5개), I 단계 승급전, III 단계 강등 보호를
    공개 `GET /api/ranked/leaderboard/tiers`에서 실시간으로 읽습니다. 실패하면 Ranked Tiers 시트(13행·구 5행 모두)로 대체합니다.
  - 라운드 시간·Clear 목표·마지막 시작/LAST ATTEMPT·밴 시간, 모드별 열림 상태와 시즌을 `GET /api/ranked/config`에서 읽습니다.
  - 순위 탭에 Survival 순위(`GET /api/ranked/survival/leaderboard`, 50명씩 더 보기)를 추가했습니다.
  - 정보 탭에 Survival 장(16/64인 라운드별 통과 목표, 결승 Death Match, 순위별 LP, 티어)을 추가했습니다.
  - 배치 건너뛰기 150 LP와 3 Stage 상한을 실시간 티어 구간으로 표시합니다.
- 검증: 데이터 테스트 30개, Vite 프로덕션 빌드, 데스크톱·휴대폰 × 라이트·다크 화면 점검, 진행 예시 재생·키보드 탭 이동·복사 동작 확인.

## v1.5.1 맵 난이도 표시·정렬

- API와 sheet2 CSV의 난이도 `20`은 `20.0`으로 통일해 표시와 배지 색상에 사용합니다.
- Pool 순서를 유지하며, 같은 Pool 안에서는 난이도가 낮은 맵부터 높은 맵 순서로 표시합니다. 같은 난이도에서는 기존 제목순을 유지합니다.

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

## 커스텀 도메인 `ranked.hwanhee1.com`

사이트는 상대 경로(`base: "./"`)와 해시 라우팅을 쓰므로 코드 수정 없이 루트 도메인에서 동작합니다.
GitHub Actions로 배포하므로 `CNAME` 파일은 쓰지 않고 저장소 설정에서 연결합니다.

1. Cloudflare DNS(`hwanhee1.com`)에 레코드를 추가합니다: `CNAME ranked → ybaf100.github.io`,
   Proxy status는 **DNS only**(회색 구름). 프록시를 켜면 GitHub가 HTTPS 인증서를 발급하지 못합니다.
2. 이 저장소 `Settings → Pages → Custom domain`에 `ranked.hwanhee1.com`을 저장하고, DNS 확인과
   인증서 발급이 끝나면 `Enforce HTTPS`를 켭니다. 계정 `Settings → Pages`에서 `hwanhee1.com`을
   Verified domain으로 등록하면 다른 저장소가 이 도메인을 가져가지 못합니다.
3. Ranked 서버의 `/etc/corum-ranked/server.env`에 새 origin을 추가합니다.

   ```text
   CORS_ORIGINS=https://ranked.hwanhee1.com,https://ybaf100.github.io
   ```

   env 파일은 컨테이너를 새로 띄울 때만 읽으므로 `docker restart`가 아니라 Lightsail 배포를 다시 실행해야 반영됩니다.
4. 연결 후 `https://ybaf100.github.io/Corum-Ranked-Web/`은 GitHub가 새 도메인으로 자동 이동시킵니다.

## Ranked 서버 연결

기본 서버는 `https://api.hwanhee1.com`입니다(Render·Railway 주소는 은퇴). 다른 서버를 사용하면 저장소의
GitHub Actions Variable에 아래 값을 설정합니다.

```text
VITE_RANKED_API_URL=https://your-ranked-server.example
```

로컬에서는 `.env`에 같은 값을 넣으면 됩니다.

순위 탭, 상단 서버 상태와 정보 탭은 공개 읽기 전용 `GET /api/ranked/config`, `/leaderboard`,
`/leaderboard/tiers`, `/survival/leaderboard`, `/maps`를 사용합니다. 매칭 활성화 여부와 공개 DB 조회 가능 여부는 서로 독립적입니다. 함께 제공된 서버
패치를 Corum-Ranked 서버에 반영하고, 서버의 `CORS_ORIGINS`에 사이트 origin인
`https://ranked.hwanhee1.com`(과 이전 주소 `https://ybaf100.github.io`)을 등록해야 합니다. DB 접속 문자열을 프런트엔드에 넣지 마세요.

## 데이터 원본

- sheet2: 맵 목록
- Ranked Tiers: 티어 커트, 메인/데스매치 풀, 승급전 판수와 필요 승수
- Ranked Config: 승급·강등 LP 보정값 (legacy 배치 판수를 Stage 수로 사용하지 않음)
- Ranked 공개 API: 플레이어 공개 상태·전적·Solo Stage 진행, 검증된 sheet2 맵 스냅샷
