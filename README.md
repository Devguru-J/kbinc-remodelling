# 케이비(주) KB Inc. — 웹사이트 리뉴얼

특장차(트럭·트레일러) 핵심 부품 유통사 **케이비(주)** 의 공식 웹사이트 리뉴얼.
기존 2014년 Dreamweaver 템플릿 사이트(`kbinc.kr`)를 **모던 인더스트리얼** 디자인으로 재구축했습니다.

## 구성

정적 멀티페이지 사이트 (빌드 불필요, 그대로 배포 가능).

| 파일 | 내용 |
|------|------|
| `index.html` | 메인 — 히어로 · 취급 브랜드 · 제품 3종 · 회사 강점 |
| `about.html` | 회사소개 — 인사말 · 사업개요 · 세 가지 약속 |
| `products.html` | 제품 — 에어서스펜션(Weweler) · 액슬(VALX 스펙표) · 유압실린더(HS Penta) |
| `location.html` | 오시는 길 — 본사 지도 · 연락처 |
| `contact.html` | 문의 — 문의 폼 · 직접 연락처 |
| `assets/css/custom.css` | 커스텀 스타일 (스펙표, 스크롤 리빌, 로고칩 등) |
| `assets/js/theme.js` | Tailwind 설정 · 한/영 토글 · 모바일 메뉴 · 스크롤 애니메이션 |
| `assets/img/` | 제품 렌더 · 브랜드 로고 (실제 자산) |
| `DESIGN.md` | 디자인 시스템 정의 (색상·타이포·컴포넌트·모션) |
| `_source/` | 기존 사이트 원본 HTML + 원본 이미지 29종 (아카이브) |

## 디자인 시스템

- **컬러:** Charcoal Void `#141414` / Graphite `#1E1E1E` / Steel `#262626` / Bright Alloy `#F5F5F5` / Muted Zinc `#8A8A8A` / **Arterial Red `#C8102E`** (단일 액센트)
- **타이포:** Space Grotesk (헤드라인) · Pretendard (본문) · JetBrains Mono (스펙·수치)
- **언어:** 한국어 기본 / 영어 토글 (`KO · EN`, 로컬스토리지 유지)

## 로컬 미리보기

```bash
python3 -m http.server 8000
# → http://localhost:8000
```

## 배포 (Cloudflare Pages)

빌드 과정이 없는 순수 정적 사이트입니다.

1. Cloudflare Pages → **Connect to Git** → 이 리포 선택
2. 빌드 설정:
   - **Framework preset:** `None`
   - **Build command:** *(비움)*
   - **Build output directory:** `/`
3. 배포

## 문의 폼 연동 (선택)

`contact.html` 의 폼은 기본적으로 방문자의 메일 앱을 여는 `mailto` 방식으로 동작합니다.
받은편지함으로 직접 수신하려면 아래 중 하나로 교체하세요:

- **Cloudflare Pages Functions** — `/functions/api/contact.js` 작성 후 폼 `action="/api/contact"`
- **Formspree** — 폼 `action="https://formspree.io/f/{FORM_ID}"` (해당 시 mailto 스크립트 자동 비활성화)

## 연락처

케이비(주) · 경기도 화성시 마도면 청원로 136-18 (청원리, 3동) 우18543
전화 031-357-4250 · 팩스 031-357-7250 · kbi@kbinc.kr
