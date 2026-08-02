// Cloudflare Pages Function — POST /api/contact
//
// Receives the inquiry form and emails it to kbi@kbinc.kr via Resend.
//
// Setup (Cloudflare dashboard → Pages → Settings → Environment variables):
//   RESEND_API_KEY   your Resend API key (https://resend.com)
//   CONTACT_TO       recipient (default: kbi@kbinc.kr)
//   CONTACT_FROM     verified sender, e.g. "KB Inc. <no-reply@kbinc.kr>"
//                    (the domain must be verified in Resend)
//   TURNSTILE_SECRET_KEY  Cloudflare Turnstile secret key (bot protection)
//
// If RESEND_API_KEY is not set, this returns 503 and the client form
// gracefully falls back to opening the visitor's mail client (mailto).

const escapeHtml = (s) =>
  String(s || '').replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])
  );

export async function onRequestPost({ request, env }) {
  let data;
  const type = request.headers.get('content-type') || '';
  try {
    if (type.includes('application/json')) {
      data = await request.json();
    } else {
      const form = await request.formData();
      data = Object.fromEntries(form.entries());
    }
  } catch {
    return json({ error: 'invalid_body' }, 400);
  }
  // A body of literal `null`, a bare string or an array is syntactically
  // valid JSON but not a field map — reject it as invalid_body rather than
  // letting the first `data.…` access throw an unhandled 500.
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    return json({ error: 'invalid_body' }, 400);
  }

  // ── Bot defenses ────────────────────────────────────────────────
  // 1) Origin check: reject browser POSTs from foreign origins.
  //    (Missing Origin passes — some privacy tools strip it; Turnstile
  //    below is the real gate. A literal "null" Origin, which sandboxed
  //    iframes and some privacy tools send, counts as missing: it carries
  //    no host to compare, so failing it open matches the stated intent.)
  const origin = request.headers.get('origin');
  if (origin && origin !== 'null') {
    let host = '';
    try { host = new URL(origin).hostname; } catch { /* malformed → treat as foreign */ }
    const allowed =
      host === 'kbinc.kr' || host.endsWith('.kbinc.kr') ||
      host === 'kbinc-remodelling.pages.dev' || host.endsWith('.kbinc-remodelling.pages.dev') ||
      host === 'localhost' || host === '127.0.0.1';
    if (!allowed) return json({ error: 'forbidden_origin' }, 403);
  }

  // 2) Honeypot: hidden "website" field — humans never see it. It is read
  //    here but NOT acted on yet: Turnstile (step 4) already stops every
  //    observed bot, so in practice a filled honeypot on an otherwise
  //    verified request means an over-eager password manager or autofill
  //    extension, i.e. a real person. Discarding it here would silently
  //    destroy a genuine inquiry, so the decision is deferred until after
  //    Turnstile has told us whether a human is behind the request.
  const honeypot = !!(data.website || '').toString().trim();

  // 3) Time trap: the form stamps its load time into "ts". Submissions
  //    faster than 3 s are bots. (Missing/garbled ts passes — Turnstile
  //    still gates below.)
  const ts = Number(data.ts);
  const age = Date.now() - ts;
  if (ts > 0 && age >= 0 && age < 3000) {
    return json({ error: 'too_fast' }, 422);
  }

  const name = (data.name || '').toString().trim();
  const email = (data.email || '').toString().trim();
  const message = (data.message || '').toString().trim();
  const company = (data.company || '').toString().trim();
  const phone = (data.phone || '').toString().trim();
  const product = (data.product || '').toString().trim();

  if (!name || !email || !message) {
    return json({ error: 'missing_fields' }, 422);
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return json({ error: 'invalid_email' }, 422);
  }

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
    if (!verify.ok) return json({ error: 'turnstile_error' }, 502);
    outcome = await verify.json();
  } catch {
    return json({ error: 'turnstile_error' }, 502);
  }
  if (!outcome || outcome.success !== true) {
    return json({ error: 'turnstile_failed' }, 403);
  }

  // 5) Hostname binding: the widget's allowed-domain list includes
  //    localhost, and Turnstile honours that from anyone's machine. Without
  //    this check an attacker could host the public sitekey on their own
  //    localhost, harvest valid tokens headlessly and POST them here with
  //    no Origin header (which fails open above). siteverify reports the
  //    hostname the token was issued for, so pin it to ours.
  const selfHost = (() => { try { return new URL(request.url).hostname; } catch { return ''; } })();
  const localRequest = selfHost === 'localhost' || selfHost === '127.0.0.1';
  const tokenHost = (outcome.hostname || '').toString();
  const hostOk =
    tokenHost === 'kbinc.kr' || tokenHost.endsWith('.kbinc.kr') ||
    tokenHost === 'kbinc-remodelling.pages.dev' ||
    tokenHost.endsWith('.kbinc-remodelling.pages.dev') ||
    // Local dev only: a localhost-issued token can never satisfy a
    // production request. The always-pass test secret reports its own
    // dummy hostname, so accept anything while serving from localhost.
    localRequest;
  if (!hostOk) {
    return json({ error: 'turnstile_failed' }, 403);
  }

  const apiKey = env.RESEND_API_KEY;
  if (!apiKey) {
    // Not configured yet → tell the client to use its mailto fallback.
    return json({ error: 'email_not_configured' }, 503);
  }

  const to = env.CONTACT_TO || 'kbi@kbinc.kr';
  const from = env.CONTACT_FROM || 'KB Inc. <onboarding@resend.dev>';

  const html = `
    <h2>웹사이트 문의</h2>
    <table cellpadding="6" style="border-collapse:collapse">
      <tr><td><b>이름</b></td><td>${escapeHtml(name)}</td></tr>
      <tr><td><b>회사명</b></td><td>${escapeHtml(company)}</td></tr>
      <tr><td><b>이메일</b></td><td>${escapeHtml(email)}</td></tr>
      <tr><td><b>연락처</b></td><td>${escapeHtml(phone)}</td></tr>
      <tr><td><b>관심 제품</b></td><td>${escapeHtml(product)}</td></tr>
    </table>
    <p><b>문의 내용</b></p>
    <p style="white-space:pre-wrap">${escapeHtml(message)}</p>`;

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from,
      to: [to],
      reply_to: email,
      // Honeypot filled but Turnstile verified → treat as a human whose
      // autofill tripped the trap: still deliver, just flag it for a
      // human eyeball instead of silently dropping a real inquiry.
      subject: `${honeypot ? '[검토필요] ' : ''}[웹문의] ${product || '제품 문의'} - ${name}`,
      html,
    }),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    return json({ error: 'send_failed', detail }, 502);
  }
  return json({ ok: true });
}

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' },
  });
}
