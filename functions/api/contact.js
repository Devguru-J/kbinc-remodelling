// Cloudflare Pages Function — POST /api/contact
//
// Receives the inquiry form and emails it to kbi@kbinc.kr via Resend.
//
// Setup (Cloudflare dashboard → Pages → Settings → Environment variables):
//   RESEND_API_KEY   your Resend API key (https://resend.com)
//   CONTACT_TO       recipient(s), comma-separated (default: kbi@kbinc.kr)
//                    e.g. "kbi@kbinc.kr, hjk94610@gmail.com"
//   CONTACT_BCC      optional hidden copy recipient(s), comma-separated —
//                    use this instead of CONTACT_TO for a personal archive
//                    copy that does not show up in the visible To: line
//   CONTACT_FROM     verified sender, e.g. "KB Inc. <no-reply@kbinc.kr>"
//                    (the domain must be verified in Resend)
//   TURNSTILE_SECRET_KEY  Cloudflare Turnstile secret key (bot protection)
//
// If RESEND_API_KEY is not set, this returns 503 and the client form
// gracefully falls back to opening the visitor's mail client (mailto).

// Subject lines are plain text, not HTML, so escapeHtml is the wrong tool:
// strip the characters that break a header instead. Newlines and control
// characters would fold or truncate the subject in a mail client; the
// fields are already length-capped, so only the shape needs fixing here.
const cleanSubject = (s) =>
  String(s || '')
    // eslint-disable-next-line no-control-regex
    .replace(/[\x00-\x1F\x7F]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

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

  // Length caps. The form's own maxlength attributes stop honest typists
  // long before this, so anything arriving oversized is a direct POST —
  // an unbounded body would otherwise bloat the mailbox or blow past
  // Resend's size limit and fail the send. Checked before Turnstile so a
  // junk payload never costs a siteverify round-trip. Limits are generous
  // enough that no real inquiry can hit them.
  const LIMITS = { name: 100, company: 100, email: 254, phone: 40, product: 100, message: 5000 };
  const tooLong = Object.entries({ name, company, email, phone, product, message })
    .find(([field, value]) => value.length > LIMITS[field]);
  if (tooLong) {
    return json({ error: 'too_long', field: tooLong[0], limit: LIMITS[tooLong[0]] }, 422);
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

  // Recipients are comma-separated so extra inboxes can be added from the
  // dashboard without a code change. Blank entries (a trailing comma, a
  // stray space) are dropped so they never reach Resend as "" and fail the
  // whole send — one typo must not cost a real inquiry.
  const addresses = (value, fallback = []) => {
    const list = String(value || '')
      .split(',')
      .map((a) => a.trim())
      .filter(Boolean);
    return list.length ? list : fallback;
  };

  const to = addresses(env.CONTACT_TO, ['kbi@kbinc.kr']);
  const bcc = addresses(env.CONTACT_BCC);
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
      to,
      ...(bcc.length ? { bcc } : {}),
      reply_to: email,
      // Honeypot filled but Turnstile verified → treat as a human whose
      // autofill tripped the trap: still deliver, just flag it for a
      // human eyeball instead of silently dropping a real inquiry.
      subject: `${honeypot ? '[검토필요] ' : ''}[웹문의] ${cleanSubject(product) || '제품 문의'} - ${cleanSubject(name)}`,
      html,
    }),
  });

  if (!res.ok) {
    // Resend's message can name the sending domain, the key's state or
    // internal limits — useful in the deploy logs, not something to hand
    // back to an anonymous caller. Log it, return the bare error code.
    const detail = await res.text().catch(() => '');
    console.error('resend send failed', res.status, detail);
    return json({ error: 'send_failed' }, 502);
  }
  return json({ ok: true });
}

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' },
  });
}
