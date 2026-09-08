# Varun's portfolio

Static Astro portfolio with a Three.js scene graph rendered through Canvas 2D. The
hero contains drifting clouds, moving leaves and water, a pencil-writing robot,
and a small simulated editor on the laptop screen. No WebGL, backend, API keys,
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
- `src/scripts/workshop-scene.mjs`: layered Three.js geometry.
- `src/scripts/workshop-motion.mjs`: pencil trajectory and joint calculations.
- `src/scripts/workshop-details.mjs`: laptop display, paper and gripper details.
- `src/scripts/canvas-renderer.mjs`: canvas rasterization and water motion.
- `src/scripts/landscape.mjs`: loading, visibility and reduced-motion handling.
- `public/art/`: the four required artwork layers.

The laptop display is a decorative simulation; no terminal commands execute.
Animation pauses when the page is hidden, leaves the viewport, or the OS requests
reduced motion. The poster remains visible while assets load and on failures.
Each animated canvas owns an independent texture source; see the regression test.

## Security and hosting

See `SECURITY_REVIEW.md` for the review scope, evidence and remaining limits.
A meta CSP restricts scripts to the same origin. `public/_headers` adds response
headers on hosts supporting that file (such as Cloudflare Pages and Netlify).
On other hosts, configure equivalent headers and verify the actual responses.
Inline styles are allowed for trusted MDX syntax highlighting; inline scripts,
remote scripts, plugins, forms and external connections are not allowed.

Use `npm run format` for formatting, `npm test` for animation regressions and
`npm audit` to check the dependency lockfile against current advisories. The npm
packages retain their upstream licenses. Artwork is generated illustration;
review its use separately if brand or legal clearance is required.
