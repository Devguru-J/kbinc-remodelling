// Cloudflare Pages middleware — default language by visitor country.
//
// Cloudflare stamps every request with the visitor's country code
// (CF-IPCountry). Korean visitors receive the page as-is (Korean default);
// everyone else gets `lang-en` added to <html> at the edge, so the page
// arrives already in English with no language flash.
//
// A visitor's explicit KO/EN toggle choice (localStorage `kb-lang`, applied
// by the inline script in BaseLayout) still overrides this default on load.
//
// Test override without a VPN: append ?__geo=US (or any country code).

export async function onRequest({ request, next }) {
  const response = await next();
  const type = response.headers.get('content-type') || '';
  if (!type.includes('text/html')) return response;

  const url = new URL(request.url);
  const country = (
    url.searchParams.get('__geo') ||
    request.headers.get('cf-ipcountry') ||
    'KR'
  ).toUpperCase();
  if (country === 'KR') return response;

  return new HTMLRewriter()
    .on('html', {
      element(el) {
        const cls = el.getAttribute('class');
        if (!cls) el.setAttribute('class', 'lang-en');
        else if (!cls.split(/\s+/).includes('lang-en')) el.setAttribute('class', cls + ' lang-en');
        el.setAttribute('lang', 'en');
      },
    })
    .transform(response);
}
