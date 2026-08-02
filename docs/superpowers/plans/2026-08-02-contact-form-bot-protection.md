# Contact Form Bot Protection Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Block spam bots ("Robertlak" multi-language spam, phishing-link bots) hitting `/api/contact` with Cloudflare Turnstile + honeypot + time-trap + origin check, without adding friction for real customers.

**Architecture:** A Turnstile widget (Managed mode, created via CF API) renders in the contact form; the Pages Function verifies the token server-side via `siteverify` before sending email through Resend. Honeypot and time-trap run as cheap pre-checks, origin check rejects cross-site POSTs. Existing mailto fallback (503) behavior is preserved.

**Tech Stack:** Astro 4 (static), Cloudflare Pages Functions (plain JS), Cloudflare Turnstile, Resend, wrangler 4.

## Global Constraints

- Project: Cloudflare Pages `kbinc-remodelling`, account ID `9a77643c4c0fb6cdb49bacdfbdcda1d5`, Git-connected (push to `main` on GitHub `Devguru-J/kbinc-remodelling` auto-deploys)
- Live domains: `kbinc.kr`, `www.kbinc.kr`, `kbinc-remodelling.pages.dev`
- No test framework in repo — verification is curl against `npx wrangler pages dev dist` and live browser checks
- Site is bilingual (KO default / EN via `lang-en`); existing JS status messages are Korean-only strings — follow that pattern
- Never touch DNS records (email MX + whois-mail A records must survive)
- Secrets go through `wrangler pages secret put` — never commit key values; `.dev.vars` must be gitignored
- Turnstile local testing uses official test keys: always-pass secret `1x0000000000000000000000000000000AA`, dummy token `XXXX.DUMMY.TOKEN.XXXX`

---

### Task 1: Create Turnstile widget and store keys

**Files:**
- Modify: `.gitignore` (add `.dev.vars`)
- Create: `.dev.vars` (local only, NOT committed)
- Create: `/private/tmp/claude-501/-Users-tuesdaymorning-Devguru-kbinc/553bdf98-ac1b-4d01-97d0-eb7ae908468b/scratchpad/turnstile-sitekey.txt` (handoff to Task 3)

**Interfaces:**
- Produces: production Turnstile **sitekey** (saved to scratchpad file above; consumed by Task 3), `TURNSTILE_SECRET_KEY` Pages secret (consumed by the deployed function), `.dev.vars` with test secret (consumed by Task 2 local tests)

- [ ] **Step 1: Create the widget via CF API using wrangler's OAuth token**

The wrangler OAuth token has `challenge-widgets.write` scope. Extract it and call the Turnstile widgets endpoint:

```bash
TOKEN=$(grep -m1 'oauth_token' ~/.config/.wrangler/config/default.toml | sed 's/.*= *"\(.*\)"/\1/')
curl -s -X POST "https://api.cloudflare.com/client/v4/accounts/9a77643c4c0fb6cdb49bacdfbdcda1d5/challenges/widgets" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "kbinc-contact-form",
    "mode": "managed",
    "domains": ["kbinc.kr", "kbinc-remodelling.pages.dev", "localhost"],
    "region": "world"
  }'
```

Expected: JSON with `"success": true` and `result.sitekey` + `result.secret`. (`kbinc.kr` covers `www.kbinc.kr` — Turnstile matches subdomains automatically.)

**Fallback if the API call fails** (scope rejected, etc.): ask the user to create it in the dashboard — Cloudflare dashboard → Turnstile → Add widget, Managed mode, domains as above — and paste the sitekey + secret key back into the session. Do not proceed without real keys.

- [ ] **Step 2: Save the sitekey for Task 3**

```bash
echo "<result.sitekey from Step 1>" > /private/tmp/claude-501/-Users-tuesdaymorning-Devguru-kbinc/553bdf98-ac1b-4d01-97d0-eb7ae908468b/scratchpad/turnstile-sitekey.txt
```

- [ ] **Step 3: Store the secret as a Pages secret**

```bash
printf '<result.secret from Step 1>' | npx wrangler pages secret put TURNSTILE_SECRET_KEY --project-name kbinc-remodelling
```

Expected output: `✨ Successfully created secret for the Pages project "kbinc-remodelling"`.

Verify: `npx wrangler pages secret list --project-name kbinc-remodelling` now lists `TURNSTILE_SECRET_KEY` alongside `CONTACT_FROM` and `RESEND_API_KEY`.

- [ ] **Step 4: Create `.dev.vars` with the Turnstile always-pass test secret (local dev only)**

```bash
cat > .dev.vars <<'EOF'
TURNSTILE_SECRET_KEY=1x0000000000000000000000000000000AA
EOF
```

(No `RESEND_API_KEY` locally — local "full pass" ends at 503 `email_not_configured`, which is the expected success signal in Task 2 tests.)

- [ ] **Step 5: Gitignore `.dev.vars` and commit**

Add a line `.dev.vars` to `.gitignore` (it currently only ignores `.wrangler/` on line 23).

```bash
git add .gitignore
git commit -m "Ignore .dev.vars (local Turnstile/Resend dev secrets)"
git status --short   # must NOT show .dev.vars
```

---

### Task 2: Server-side bot checks in the contact function

**Files:**
- Modify: `functions/api/contact.js`

**Interfaces:**
- Consumes: `env.TURNSTILE_SECRET_KEY` (Task 1), form fields `website` (honeypot), `ts` (load timestamp), `cf-turnstile-response` (Turnstile token) — all produced by Task 3's frontend, but curl supplies them directly here
- Produces: HTTP contract consumed by Task 3's client JS — `403 {error:'forbidden_origin'}`, `200 {ok:true}` (honeypot fake success), `422 {error:'too_fast'}`, `403 {error:'turnstile_failed'}`, `502 {error:'turnstile_error'}`, `503 {error:'turnstile_not_configured'}`; existing responses unchanged (`422 missing_fields/invalid_email`, `503 email_not_configured`, `502 send_failed`, `200 {ok:true}`)

- [ ] **Step 1: Add the four bot checks to `onRequestPost`**

In `functions/api/contact.js`, insert after the body-parsing `try/catch` block (right before the `const name = ...` field extraction):

```js
  // ── Bot defenses ────────────────────────────────────────────────
  // 1) Origin check: reject browser POSTs from foreign origins.
  //    (Missing Origin passes — some privacy tools strip it; Turnstile
  //    below is the real gate.)
  const origin = request.headers.get('origin');
  if (origin) {
    let host = '';
    try { host = new URL(origin).hostname; } catch { /* malformed → treat as foreign */ }
    const allowed =
      host === 'kbinc.kr' || host.endsWith('.kbinc.kr') ||
      host === 'kbinc-remodelling.pages.dev' || host.endsWith('.kbinc-remodelling.pages.dev') ||
      host === 'localhost' || host === '127.0.0.1';
    if (!allowed) return json({ error: 'forbidden_origin' }, 403);
  }

  // 2) Honeypot: hidden "website" field — humans never see it. If a bot
  //    filled it, reply with a fake success so it doesn't learn and adapt.
  if ((data.website || '').toString().trim()) {
    return json({ ok: true });
  }

  // 3) Time trap: the form stamps its load time into "ts". Submissions
  //    faster than 3 s are bots. (Missing/garbled ts passes — Turnstile
  //    still gates below.)
  const ts = Number(data.ts);
  if (ts > 0 && Date.now() - ts < 3000) {
    return json({ error: 'too_fast' }, 422);
  }
```

Then insert the Turnstile verification after the existing email-format check (`invalid_email` return) and **before** the `const apiKey = env.RESEND_API_KEY;` line:

```js
  // 4) Turnstile: verify the widget token server-side. This is the hard
  //    gate — direct API POSTs have no token and stop here.
  const turnstileSecret = env.TURNSTILE_SECRET_KEY;
  if (!turnstileSecret) {
    // Misconfiguration → 503 so the client falls back to mailto and no
    // inquiry is lost while the gate is down.
    return json({ error: 'turnstile_not_configured' }, 503);
  }
  const token = (data['cf-turnstile-response'] || '').toString();
  if (!token) return json({ error: 'turnstile_failed' }, 403);
  let outcome;
  try {
    const verify = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        secret: turnstileSecret,
        response: token,
        remoteip: request.headers.get('cf-connecting-ip') || undefined,
      }),
    });
    outcome = await verify.json();
  } catch {
    return json({ error: 'turnstile_error' }, 502);
  }
  if (!outcome || outcome.success !== true) {
    return json({ error: 'turnstile_failed' }, 403);
  }
```

Also update the file's header comment block to document the new env var:

```js
//   TURNSTILE_SECRET_KEY  Cloudflare Turnstile secret key (bot protection)
```

- [ ] **Step 2: Build the site and start the local Pages dev server**

```bash
npm run build
npx wrangler pages dev dist --port 8788
```

Wait for `Ready on http://localhost:8788`. (`.dev.vars` from Task 1 supplies the always-pass test secret. Run the server in the background.)

- [ ] **Step 3: curl the bot scenarios against the local server**

Run each and check status + body:

```bash
BASE=http://localhost:8788/api/contact

# A) Direct bot POST, no token → 403 turnstile_failed
curl -s -o /dev/null -w '%{http_code} ' -X POST $BASE \
  -d 'name=Robertlak&email=spam@example.com&message=Hola, volia saber el seu preu.'
curl -s -X POST $BASE -d 'name=Robertlak&email=spam@example.com&message=spam' | grep -o turnstile_failed

# B) Honeypot filled → 200 {"ok":true} fake success
curl -s -X POST $BASE \
  -d 'name=Bot&email=bot@example.com&message=spam&website=http://spam.example' # expect {"ok":true}

# C) Too-fast submission (fresh timestamp) → 422 too_fast
curl -s -o /dev/null -w '%{http_code}\n' -X POST $BASE \
  -d "name=Bot&email=bot@example.com&message=spam&ts=$(node -e 'console.log(Date.now())')"

# D) Foreign origin → 403 forbidden_origin
curl -s -o /dev/null -w '%{http_code}\n' -X POST $BASE \
  -H 'Origin: https://evil.example' \
  -d 'name=Bot&email=bot@example.com&message=spam'

# E) Legit-shaped request: old ts + dummy token (test secret passes anything)
#    → passes ALL bot checks, then hits missing RESEND_API_KEY → 503 email_not_configured
curl -s -X POST $BASE \
  -H 'Origin: http://localhost:8788' \
  -d "name=Tester&email=test@example.com&message=hello&ts=$(node -e 'console.log(Date.now()-10000)')&cf-turnstile-response=XXXX.DUMMY.TOKEN.XXXX" \
  | grep -o email_not_configured
```

Expected: A=403+`turnstile_failed`, B=`{"ok":true}`, C=422, D=403, E=`email_not_configured`. If any differ, fix `contact.js` and re-run before moving on.

- [ ] **Step 4: Stop the dev server and commit**

```bash
git add functions/api/contact.js
git commit -m "Add bot defenses to contact API: origin check, honeypot, time trap, Turnstile verify"
```

---

### Task 3: Frontend — Turnstile widget, honeypot, time-trap in the form

**Files:**
- Modify: `src/pages/contact.astro`

**Interfaces:**
- Consumes: production sitekey from `/private/tmp/claude-501/-Users-tuesdaymorning-Devguru-kbinc/553bdf98-ac1b-4d01-97d0-eb7ae908468b/scratchpad/turnstile-sitekey.txt` (Task 1); server HTTP contract from Task 2 (`403 turnstile_failed` → show retry message, NOT mailto; 503 → mailto fallback unchanged)
- Produces: form fields `website`, `ts`, `cf-turnstile-response` (auto-injected by the Turnstile widget into the form, so the existing `new FormData(form)` picks all three up with no fetch-code change)

- [ ] **Step 1: Add honeypot + ts fields and the Turnstile widget to the form**

In `src/pages/contact.astro`, read the sitekey and expose it in frontmatter (top of file, inside the existing `---` block):

```astro
const TURNSTILE_SITEKEY = '<sitekey from Task 1 scratchpad file>';
```

Immediately after the `<form id="inquiry-form" ...>` opening tag (line ~52), add the honeypot and timestamp fields:

```html
        <!-- Honeypot: invisible to humans; bots that fill it are silently dropped -->
        <div aria-hidden="true" style="position:absolute;left:-9999px;top:auto;width:1px;height:1px;overflow:hidden">
          <label for="website">Website</label>
          <input id="website" name="website" type="text" tabindex="-1" autocomplete="off" />
        </div>
        <input type="hidden" name="ts" value="" />
```

Before the submit-button row (`<div class="flex items-center gap-4 flex-wrap">`), add the widget:

```html
        <div class="cf-turnstile" data-sitekey={TURNSTILE_SITEKEY} data-theme="dark" data-language="auto"></div>
```

At the bottom of the page (next to the existing `<script>` tag), load the Turnstile script:

```html
  <script is:inline src="https://challenges.cloudflare.com/turnstile/v0/api.js" async defer></script>
```

(Implicit rendering: the script finds `.cf-turnstile`, renders the widget, and injects a hidden `cf-turnstile-response` input into the form automatically.)

- [ ] **Step 2: Update the client script — stamp ts, handle 403, reset widget**

In the existing `<script>` block of `contact.astro`:

After `const status = document.getElementById('form-status');` add:

```ts
    const tsField = form?.elements.namedItem('ts') as HTMLInputElement | null;
    if (tsField) tsField.value = String(Date.now());
```

Inside the submit handler, right after `e.preventDefault();`, guard against the widget not having produced a token yet (script blocked / still solving) — covers the spec's "Turnstile 로드 실패 시 안내":

```ts
      const tokenEl = form.querySelector('input[name="cf-turnstile-response"]') as HTMLInputElement | null;
      if (!tokenEl || !tokenEl.value) {
        if (status) { status.textContent = '보안 확인이 아직 완료되지 않았습니다. 잠시 후 다시 시도해주세요.'; status.className = 'font-mono text-[13px] text-arterial-red'; }
        return;
      }
```

Replace the response-handling block

```ts
        } else if (res.status === 503) {
          mailtoFallback();
          if (status) status.textContent = '메일 앱으로 전송합니다…';
        } else {
```

with:

```ts
        } else if (res.status === 503) {
          mailtoFallback();
          if (status) status.textContent = '메일 앱으로 전송합니다…';
        } else if (res.status === 403) {
          // Turnstile rejected the token (expired/invalid). Ask for a retry
          // instead of mailto — a fresh token usually fixes it.
          if (status) { status.textContent = '보안 확인에 실패했습니다. 잠시 후 다시 시도해주세요.'; status.className = 'font-mono text-[13px] text-arterial-red'; }
          (window as any).turnstile?.reset();
        } else {
```

And after the success branch's `form.reset();` add a widget reset so a second inquiry gets a fresh token (also re-stamp ts):

```ts
          (window as any).turnstile?.reset();
          if (tsField) tsField.value = String(Date.now());
```

- [ ] **Step 3: Build and verify the widget renders locally**

```bash
npm run build
npx wrangler pages dev dist --port 8788
```

Open `http://localhost:8788/contact` in a browser (sitekey allows `localhost`). Verify: Turnstile widget visible above the submit button (Managed mode may show briefly then auto-pass), honeypot invisible, page layout intact. Grep the built output as a cheap sanity check too:

```bash
grep -o 'cf-turnstile\|name="website"\|name="ts"' dist/contact/index.html | sort | uniq -c
```

Expected: all three present.

- [ ] **Step 4: Commit**

```bash
git add src/pages/contact.astro
git commit -m "Add Turnstile widget, honeypot and time-trap to contact form"
```

---

### Task 4: Deploy and live verification

**Files:** none (deploy + verification only)

**Interfaces:**
- Consumes: everything above; CF Pages auto-deploy on push to `main`

- [ ] **Step 1: Push to main**

```bash
git push origin main
```

- [ ] **Step 2: Wait for the CF Pages deployment to finish**

```bash
npx wrangler pages deployment list --project-name kbinc-remodelling 2>&1 | head -8
```

Poll until the newest deployment for this commit shows success (typically 1-2 min). 

- [ ] **Step 3: Live curl tests (bot scenarios against production)**

```bash
# Direct bot POST without token → 403 turnstile_failed
curl -s -w '\n%{http_code}\n' -X POST https://kbinc.kr/api/contact \
  -d 'name=Robertlak&email=spam@example.com&message=Hola, volia saber el seu preu.'

# Honeypot → fake 200 {"ok":true} (and NO email must arrive)
curl -s -w '\n%{http_code}\n' -X POST https://kbinc.kr/api/contact \
  -d 'name=Bot&email=bot@example.com&message=spam&website=x'

# Foreign origin → 403 forbidden_origin
curl -s -w '\n%{http_code}\n' -X POST https://kbinc.kr/api/contact \
  -H 'Origin: https://evil.example' -d 'name=Bot&email=b@example.com&message=x'
```

Expected: `403 turnstile_failed`, `200 {"ok":true}`, `403 forbidden_origin`. This is the exact request shape the Robertlak bot uses — 403 here means the attack is dead.

- [ ] **Step 4: Live browser submit (real-customer path)**

Using the browser MCP tools (chrome-devtools or playwright): open `https://kbinc.kr/contact`, fill 이름=`홈페이지 보안 테스트`, EMAIL=`hjk94610@gmail.com`, 문의 내용=`Turnstile 적용 후 정상 제출 테스트입니다. 이 메일은 무시하셔도 됩니다.`, wait for the Turnstile widget to show success (Managed mode auto-passes normally), submit, and confirm the status line shows `문의가 접수되었습니다. 감사합니다.`

- [ ] **Step 5: Confirm the test email arrived and report**

Ask the user to confirm the test inquiry arrived at kbi@kbinc.kr (or check the Resend dashboard). Report all verification results.
