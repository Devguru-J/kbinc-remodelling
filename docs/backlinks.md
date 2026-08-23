# 백링크 메모

이 사이트(kbinc.kr)에 걸려 있는 스튜디오 백링크 기록. 2026-08-23 작업.

## 위치

- **파일**: `src/components/Footer.astro` — 하단 저작권 줄 오른쪽
- **앵커**: "Website by 기억" (영어 모드에서는 "Memory", `data-ko-only`/`data-en-only` 사용)
- **링크 대상**: `https://bymemory.dev/work/kb-inc/` (홈이 아니라 이 사이트의 작업 상세 페이지)
- **커밋**: `3671cbc`

## 반대 방향

bymemory.dev의 kb-inc 작업 항목(`src/data/works.ts`)에 "사이트 보기 → https://kbinc.kr" 외부 링크가 걸려 있어 양방향이다.

## 주의

- 이 링크는 SEO 백링크 그래프의 일부다. 푸터를 리팩터링할 때 지우지 말 것.
- 앵커 텍스트는 브랜드명 유지("기억"/"Memory"). 키워드 앵커로 바꾸지 말 것 — 스팸 신호가 된다.
- dofollow 그대로 둔다 (`rel` 속성 추가하지 않음).
