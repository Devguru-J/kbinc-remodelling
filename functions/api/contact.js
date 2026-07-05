// Cloudflare Pages Function — POST /api/contact
//
// Receives the inquiry form and emails it to kbi@kbinc.kr via Resend.
//
// Setup (Cloudflare dashboard → Pages → Settings → Environment variables):
//   RESEND_API_KEY   your Resend API key (https://resend.com)
//   CONTACT_TO       recipient (default: kbi@kbinc.kr)
//   CONTACT_FROM     verified sender, e.g. "KB Inc. <no-reply@kbinc.kr>"
//                    (the domain must be verified in Resend)
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
      subject: `[웹문의] ${product || '제품 문의'} - ${name}`,
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
