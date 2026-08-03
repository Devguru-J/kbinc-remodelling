# 문의 폼 제거 — 설계

**날짜:** 2026-08-03
**요청:** 발주처(케이비(주))에서 웹 문의 폼 기능 제거 요청.

## 배경

`/contact` 의 문의 폼은 Cloudflare Pages Function(`functions/api/contact.js`) → Resend →
`kbi@kbinc.kr` 경로로 동작했다. 2026-08-02 에 Turnstile · 허니팟 · 타임트랩 · Origin 검사 ·
WAF 레이트리밋까지 붙여 봇 스팸을 막았으나, 운영 측 판단으로 폼 자체를 걷어내기로 결정.

폼이 사라지면 봇이 POST 할 대상(`/api/contact`)이 없어지므로 폼 경유 스팸은 구조적으로 0이 된다.
단, 페이지에 노출된 `kbi@kbinc.kr` 주소를 수집하는 **직접 이메일 스팸은 별개 경로**이며 이 변경과
무관하게 계속 발생할 수 있다 (메일 서버 스팸필터 영역).

## 범위

**유지:** `/contact` 페이지, 전화·팩스·이메일·주소, 지도 섹션, 네비/푸터의 연락처 링크,
`functions/_middleware.js`(국가별 기본 언어 — 폼과 무관).

**제거:** 입력 폼 전체, Turnstile 위젯 및 CDN 스크립트, 제출 클라이언트 로직(mailto 폴백 포함),
`noscript` 안내, `functions/api/contact.js`.

## 변경 내용

### 1. `src/pages/contact.astro`
- `TURNSTILE_SITEKEY` 상수, `<form>` 블록, Turnstile div, `<noscript>`, 제출 `<script>`,
  Turnstile CDN `<script>` 삭제
- 레이아웃: `[사이드바 20rem | 폼]` 2단 → 연락처 정보를 **전체 폭 4칸 그리드**(TEL/FAX/EMAIL/주소,
  `sm:2 · lg:4`, 모바일 1칸)로 재배치
- 섹션 헤더 우측에 CTA `전화 걸기`(tel:) 1개. (메일 CTA는 요청에 따라 제외 — 이메일 주소는
  아래 정보 그리드의 `EMAIL` 항목에 mailto 링크로 그대로 남아 있음)
- 히어로 부제: "필요하신 제품과 사양을 남겨주시면 담당자가 신속히 회신드립니다" →
  "전화 또는 이메일로 연락 주시면 담당자가 신속히 안내드립니다" (한/영)

### 2. 타 페이지 CTA
폼을 기대하고 눌렀다가 어긋나지 않도록 라벨/아이콘만 조정 (링크는 `/contact` 유지):
- `index.astro`: "부품 문의를 남겨주세요" → "부품 문의는 전화 또는 이메일로",
  버튼 "문의하기"/`mail` → "연락처 보기"/`call`
- `products.astro`: 동일 패턴
- `news.astro`: 버튼 "문의하기" → "연락처 보기"
- `resources.astro`: "…<문의하기>로 요청해 주세요" → "…<전화 또는 이메일>로 요청해 주세요"

### 3. 백엔드 · 문서
- `functions/api/contact.js` 삭제
- `README.md`: 디렉터리 표에서 `api/contact.js` → `_middleware.js`,
  "문의 폼 이메일 연동" 섹션 → "문의 접수 방식"(제거 사실 + 함께 제거할 인프라 목록 + 복원 시 참고 커밋)

### 4. Cloudflare 대시보드 정리 (코드 외 · 수동)
- Pages 환경변수/시크릿: `RESEND_API_KEY`, `CONTACT_FROM`, `CONTACT_TO`, `CONTACT_BCC`,
  `TURNSTILE_SECRET_KEY`
- Turnstile 위젯 (sitekey `0x4AAAAAAEEX6mFoHBSP28eu`)
- WAF 레이트리밋 룰 (`/api/contact` 3req/10s)

## 검증

- `npm run build` 성공
- `dist/` 전체에서 `cf-turnstile` · `api/contact` · `<form>` 잔여 0건
- 데스크톱(1440) · 모바일(390) 렌더 확인 — 4칸 그리드가 모바일에서 1칸으로 정상 스택
