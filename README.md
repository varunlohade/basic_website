# Varun's portfolio

Static Astro portfolio on a black-and-white page with a dithered Perlin-noise
background drawn on Canvas 2D. No WebGL, backend, API keys,
analytics, cookies, or visitor-triggered generation are required.

## Develop

Use Node 24 (`nvm use`) and the committed lockfile:

```sh
npm ci
npm run dev
npm test
npm run build
```

Deploy `dist/` as static files. Do not expose the development server to the public
internet. The existing blog remains at `/blog/`; it is no longer promoted on the
homepage. Posts are trusted, repository-owned MDX in `src/content/posts/`.

## Source

- `src/pages/index.astro`: homepage copy and structure.
- `src/styles/home.css`: homepage layout, extending the shared styles.
- `src/scripts/noise-field.mjs`: dithered Perlin-noise page background.
- `public/art/backdrop.png`: thumbnail for the workshop portfolio card.

The background canvas is viewport-sized, capped at 30 fps, and pauses when the
page is hidden or off-screen. With reduced motion it draws one still frame.

## Security and hosting

See `SECURITY_REVIEW.md` for the review scope, evidence and remaining limits.
A meta CSP restricts scripts to the same origin. `vercel.json` adds the response
headers (nosniff, frame denial, referrer and permissions policies, and a CSP with
`frame-ancestors 'none'`) on Vercel. On another host, configure equivalent
headers and verify the actual responses.
Inline styles are allowed for trusted MDX syntax highlighting; inline scripts,
remote scripts, plugins, forms and external connections are not allowed.

Use `npm run format` for formatting, `npm test` for unit tests and
`npm audit` to check the dependency lockfile against current advisories. The npm
packages retain their upstream licenses. Artwork is generated illustration;
review its use separately if brand or legal clearance is required.
