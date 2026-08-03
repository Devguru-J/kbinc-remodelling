# 케이비(주) KB Inc. — 웹사이트 리뉴얼

특장차(트럭·트레일러) 핵심 부품 유통사 **케이비(주)** 의 공식 웹사이트 리뉴얼.
기존 2014년 Dreamweaver 템플릿 사이트(`kbinc.kr`)를 **모던 인더스트리얼** 디자인으로 재구축했습니다.

**스택:** [Astro](https://astro.build) (정적 출력) · Tailwind CSS · Cloudflare Pages
(+ Pages Functions로 문의 폼 처리)

## 페이지

| 라우트 | 내용 |
|--------|------|
| `/` | 메인 — 히어로 · 취급 브랜드 · 제품 3종 · 회사 강점 |
| `/about` | 회사소개 — 인사말 · 사업개요 · 세 가지 약속 |
| `/products` | 제품 — 에어서스펜션(Weweler) · 액슬(VALX 스펙표) · 유압실린더(HS Penta) |
| `/location` | 오시는 길 — 본사 지도 · 연락처 |
| `/contact` | 문의 — 문의 폼 · 직접 연락처 |

## 구조

```
src/
  layouts/BaseLayout.astro   공통 head·nav·footer·스크립트(한/영 토글, 스크롤 리빌)
  components/Nav.astro        네비게이션 (active 하이라이트)
  components/Footer.astro     푸터
  pages/*.astro               5개 페이지
  styles/global.css           Tailwind + 커스텀(스펙표, 로고칩, 리빌)
public/
  assets/img/                 제품 렌더 · 브랜드 로고 (실제 자산)
  favicon.svg
functions/
  _middleware.js              Cloudflare Pages 미들웨어 — 방문 국가별 기본 언어(KR 외 영문)
tailwind.config.mjs           디자인 토큰(색상·폰트·간격)
DESIGN.md                     디자인 시스템 정의
_source/                      기존 사이트 원본 HTML + 원본 이미지 29종 (아카이브)
```

## 디자인 시스템

- **컬러:** Charcoal Void `#141414` / Graphite `#1E1E1E` / Steel `#262626` / Bright Alloy `#F5F5F5` / Muted Zinc `#8A8A8A` / **Arterial Red `#C8102E`** (단일 액센트)
- **타이포:** Pretendard 단일 통일 (헤드라인·본문·수치), 수치는 tabular-nums로 정렬. 한글 줄바꿈은 `word-break: keep-all`
- **언어:** 한국어 기본 / 영어 토글 (`KO · EN`, 로컬스토리지 유지)

## 개발

```bash
npm install
npm run dev      # http://localhost:4321
npm run build    # → dist/
npm run preview  # 빌드 결과 미리보기
```

## 배포 (Cloudflare Pages)

1. Cloudflare Pages → **Connect to Git** → 이 리포 선택
2. 빌드 설정:
   - **Framework preset:** `Astro`
   - **Build command:** `npm run build`
   - **Build output directory:** `dist`
3. 배포. `functions/` 디렉터리는 Pages가 자동 인식하여 엣지에서 실행합니다.

## 문의 접수 방식

웹 문의 폼은 2026-08-03 자로 제거되었습니다 (봇 스팸 유입 + 운영 부담).
`/contact` 페이지는 전화·팩스·이메일·주소와 지도만 안내하며, 문의는 전화(031-357-4250)
또는 메일(kbi@kbinc.kr)로 직접 받습니다.

폼과 함께 제거된 것: `functions/api/contact.js` (Resend 발송 + Turnstile 검증),
Turnstile 위젯, `/api/contact` 대상 WAF 레이트리밋 룰, Pages 환경변수
`RESEND_API_KEY` / `CONTACT_TO` / `CONTACT_BCC` / `CONTACT_FROM` / `TURNSTILE_SECRET_KEY`.
되살릴 경우 git 히스토리의 `3568edf` 시점 코드를 참고하세요.

## 연락처

케이비(주) · 경기도 화성시 마도면 청원로 136-18 (청원리, 3동) 우18543
전화 031-357-4250 · 팩스 031-357-7250 · kbi@kbinc.kr
