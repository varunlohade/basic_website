import { defineConfig } from 'astro/config';
import mdx from '@astrojs/mdx';

export default defineConfig({
  site: 'https://varunlohade.com',
  output: 'static',
  integrations: [mdx()],
  server: { host: '127.0.0.1' },
  build: { inlineStylesheets: 'never' },
  vite: { build: { sourcemap: false, assetsInlineLimit: 0 } },
  markdown: { shikiConfig: { theme: 'github-dark-dimmed' } },
});
