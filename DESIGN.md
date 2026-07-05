# Design System: KB Inc. (케이비주식회사) — Industrial Components Distributor

## 1. Visual Theme & Atmosphere
A dark, engineered, high-precision interface for a European/American heavy-vehicle
parts distributor. The atmosphere is that of a machined component under studio
light: deep charcoal voids, hard structural rules, and a single arterial red that
behaves like a warning stripe on industrial equipment. Product renders (air
suspensions, axles, hydraulic cylinders) are the heroes — they float on near-black
canvas like specimens on a lab bench, edges catching light. The feeling is
mechanical confidence, not decoration: this is a company that supplies parts trusted
across every continent. Density is balanced-to-dense (6) — spec tables and technical
data are first-class citizens. Variance is high (7) — asymmetric splits, offset
grids, no timid centered rows. Motion is measured (4) — weighty, restrained, never
playful.

## 2. Color Palette & Roles
- **Charcoal Void** (#141414) — Primary background surface, the machined-metal darkness
- **Graphite Surface** (#1E1E1E) — Cards, panels, elevated containers
- **Steel Panel** (#262626) — Secondary surface, table row banding, input fills
- **Bright Alloy** (#F5F5F5) — Primary text, headlines, high-contrast foreground
- **Muted Zinc** (#8A8A8A) — Secondary text, labels, metadata, spec captions
- **Hairline Steel** (rgba(245,245,245,0.10)) — 1px structural borders, table gridlines, dividers
- **Arterial Red** (#C8102E) — SINGLE accent: primary CTAs, active nav, section index numbers, focus rings, key spec highlights
(Max 1 accent. Red saturation ~88% but used sparingly as industrial warning-stripe, never as fill washes or glows. No purple, no neon, no gradients.)

## 3. Typography Rules
- **Display / Headlines:** `Space Grotesk` (700) — track-tight, mechanical, engineered character. Hierarchy via weight + Arterial Red index numbers, not runaway size. Korean headlines use `Pretendard` (700/800) to match the geometric sans tone.
- **Body:** `Pretendard` (400/500) for Korean, `Space Grotesk`/`Geist` (400) for Latin — relaxed leading (1.6), max 65ch line length, Muted Zinc for secondary paragraphs.
- **Mono:** `JetBrains Mono` — ALL technical specifications, dimensions, load ratings, part numbers, phone/fax numbers. Tabular alignment in spec tables.
- **Banned:** `Inter`, all generic serifs (Times/Georgia/Garamond), system-ui fallback for headlines.

## 4. Component Stylings
* **Buttons:** Sharp geometry — 2px corner radius max, NOT pill-rounded. Primary = Arterial Red fill, Bright Alloy text, tactile -1px translate on active press. Secondary = 1px Hairline Steel outline, transparent fill, red border on hover. No outer glow, no gradient.
* **Cards / Product Panels:** Graphite Surface (#1E1E1E) with 1px Hairline Steel border, minimal 4px radius (industrial, not soft). Product image centered on the panel; on hover the image scales 1.05 and border shifts to Arterial Red. Shadow is deep and tight, tinted to charcoal — never a soft grey blur.
* **Spec Tables:** The signature component. Monospace values, Steel Panel row banding, Hairline Steel gridlines, red column header for the featured variant. Left-aligned labels in Muted Zinc, right-aligned mono values in Bright Alloy. Dense, precise, catalog-grade.
* **Brand Logo Bar:** Horizontal strip of partner brand logos (VDL Weweler, VALX, HS Penta, ROLLS, CIVACON) desaturated to Muted Zinc, returning to full contrast on hover.
* **Inputs (Contact form):** Label above in Muted Zinc uppercase micro-caps, Steel Panel fill, 1px Hairline border, Arterial Red focus ring. Error text below in red.
* **Nav:** Fixed top bar on Charcoal Void, thin Hairline Steel bottom border. Active item marked by Arterial Red underline. KO/EN language toggle at right as `KO / EN` mono switch.
* **Loaders:** Skeletal shimmer blocks matching panel dimensions — no spinners.

## 5. Layout Principles
- Max-width 1400px centered container; generous section padding `clamp(4rem, 10vw, 8rem)` vertical.
- Hero: ASYMMETRIC split — oversized headline + section index on the left, large product render bleeding off the right edge. Never centered.
- Feature/product rows: 2-column zig-zag (image left / text right, then alternate) — NEVER 3 equal horizontal cards.
- Strong structural rules: full-width Hairline Steel dividers between sections, red tick marks or `01 / 02 / 03` mono index numbers as section markers.
- CSS Grid over flexbox math. Full-height sections use `min-h-[100dvh]`.
- Technical density is a feature — let spec tables breathe but keep them catalog-tight.

## 6. Motion & Interaction
- Spring physics (stiffness 100, damping 20) for reveals — weighty, mechanical settle, no bounce.
- Staggered cascade on section entry: dividers draw in, then headline, then product render slides from edge.
- Product panels: image scales 1.05 + border reddens on hover (transform/opacity only).
- Subtle perpetual micro-motion limited to the hero product render (slow float ≤6px) — everything else stays static and precise.
- Hardware-accelerated transforms exclusively. No animating width/height/top/left.

## 7. Anti-Patterns (Banned)
- No emojis anywhere.
- No `Inter`, no generic serifs, no system-ui headlines.
- No pure black (#000000) — Charcoal Void #141414 is the floor.
- No neon glows, no red glow halos, no gradient-filled headlines.
- No oversaturated accent washes — red is a stripe/marker, not a background.
- No 3-column equal card feature rows.
- No centered hero.
- No custom mouse cursors, no bouncing chevrons, no "Scroll to explore" filler.
- No AI copywriting clichés ("Elevate", "Seamless", "Unleash", "Next-Gen").
- No fake round stats, no generic placeholder names/logos.
- No overlapping text-on-image — clean spatial zones always.
- No broken external image links — use the provided real product renders.
