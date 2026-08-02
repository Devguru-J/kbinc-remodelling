# 문의 폼 봇 방어 (Turnstile + 허니팟) — 설계

날짜: 2026-08-02
상태: 승인됨

## 배경

`/api/contact` (Cloudflare Pages Function → Resend → kbi@kbinc.kr)에 봇 스팸이 유입 중.
실제 포착된 공격:

- **"Robertlak" 봇**: 다국어(벵골어·카탈루냐어·아일랜드어·아이슬란드어 등) 가격 문의 스팸을 반복 제출
- **피싱 봇**: 이름 필드에 `graph.org/BALANCE-...` 링크를 삽입해 클릭 유도

현재 방어는 전무: CAPTCHA·허니팟·rate limit·origin 검사 없음. 위험 = 스팸 수신 + Resend 무료 쿼터(월 3,000통) 소진.

## 목표

- 직접 POST 봇(토큰 없는 요청) 100% 차단
- 실제 고객의 제출 경험은 거의 변화 없음 (Turnstile Managed 모드)
- 대시보드 수동 작업 최소화 — 위젯 생성은 CF API로 자동화

## 설계

### 1. Turnstile 위젯 생성 (Cloudflare API)

- wrangler OAuth 토큰(`challenge-widgets.write` 권한)으로 CF API를 통해 위젯 생성
- 모드: **Managed**, 다크 테마
- 허용 도메인: `kbinc.kr`, `www.kbinc.kr`, `kbinc-remodelling.pages.dev`, `localhost`
- Secret key는 `wrangler pages secret put TURNSTILE_SECRET_KEY --project-name kbinc-remodelling`으로 저장
- Sitekey는 공개 값이므로 프론트엔드 코드에 하드코딩

### 2. 프론트엔드 (`src/pages/contact.astro`)

- 제출 버튼 위에 Turnstile 위젯 삽입 (`https://challenges.cloudflare.com/turnstile/v0/api.js`)
- **허니팟**: 시각적으로 숨긴 `website` 텍스트 필드 (`aria-hidden`, `tabindex="-1"`, CSS로 화면 밖 배치 — `display:none` 대신 봇이 감지 못 하는 방식)
- **시간 함정**: 페이지 로드 시각을 hidden 필드 `ts`에 기록
- Turnstile 스크립트 로드 실패 시 상태 메시지로 안내 (제출 자체가 조용히 죽지 않도록)

### 3. 서버 (`functions/api/contact.js`) — 검사 순서

1. **Origin 검사**: `Origin` 헤더가 존재하는데 허용 목록(`kbinc.kr` / `www.kbinc.kr` / `kbinc-remodelling.pages.dev` / localhost)에 없으면 403. (헤더가 아예 없는 경우는 통과시키고 Turnstile이 최종 게이트 — 일부 프라이버시 도구가 Origin을 제거하는 경우의 오탐 방지)
2. **허니팟**: `website` 필드가 채워져 있으면 **가짜 성공(200 ok)** 응답 후 조용히 폐기 — 봇이 차단을 학습하지 못하게
3. **시간 함정**: `ts` 기준 경과 시간 3초 미만이면 422 거부
4. **Turnstile 검증**: `cf-turnstile-response` 토큰을 `siteverify` 엔드포인트로 검증 (`TURNSTILE_SECRET_KEY`). 없거나 무효 → 403 `turnstile_failed`
5. 전부 통과 시에만 기존 Resend 발송 로직 실행

기존 동작 유지: RESEND_API_KEY 미설정 시 503 → 클라이언트 mailto 폴백.

### 4. 오류 처리 (클라이언트)

- 403 `turnstile_failed` → "보안 확인에 실패했습니다. 새로고침 후 다시 시도해주세요."
- Turnstile 검증 네트워크 오류 → 502, 재시도 안내
- 기존 503 mailto 폴백은 그대로

### 5. 테스트 & 배포

- 로컬: Turnstile 공식 테스트 키(항상 통과 `1x00000000000000000000AA` / 항상 실패 키)로 `wrangler pages dev` 검증
- 배포(git push → CF Pages 자동 배포) 후:
  1. 브라우저로 실제 폼 제출 → 성공 확인
  2. `curl`로 토큰 없이 직접 POST → 403 확인 (봇 시나리오 재현)
  3. 허니팟 채워서 POST → 200이지만 메일 미발송 확인

## 제외 사항 (YAGNI)

- 메시지 내용 필터(URL/언어 휴리스틱) — 사용자가 오탐 우려로 제외 선택
- WAF rate-limiting 규칙 — Turnstile로 충분, 필요 시 추후 추가
