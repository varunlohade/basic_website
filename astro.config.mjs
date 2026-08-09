import { defineConfig } from 'astro/config';
import mdx from '@astrojs/mdx';
import vercel from '@astrojs/vercel/serverless';

export default defineConfig({
  // 'hybrid' = everything prerendered static by default; only routes that opt
  // out with `export const prerender = false` become functions. Right now that
  // is /api/ask and nothing else.
  output: 'hybrid',
  adapter: vercel(),
  integrations: [mdx()],
  markdown: {
    shikiConfig: { theme: 'github-dark-dimmed' },
  },
});
