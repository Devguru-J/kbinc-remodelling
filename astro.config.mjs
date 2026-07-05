import { defineConfig } from 'astro/config';
import tailwind from '@astrojs/tailwind';

// Static output — Cloudflare Pages serves dist/ directly, with the
// contact form handled by the Pages Function in functions/api/contact.js
export default defineConfig({
  site: 'https://kbinc.kr',
  integrations: [tailwind({ applyBaseStyles: false })],
});
