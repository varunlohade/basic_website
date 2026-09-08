# portfolio

Varun Lohade's site. Plain static Astro — no framework, no build tricks.

```sh
npm install
npm run dev      # http://localhost:4321
npm run build    # -> dist/
```

## Layout

| Path | What it is |
| --- | --- |
| `src/pages/index.astro` | Home — work, writing, now, elsewhere |
| `src/pages/blog/index.astro` | Blog index, split into Work and Life |
| `src/pages/blog/[...slug].astro` | Individual post pages |
| `src/content/posts/` | The posts themselves |
| `src/styles/global.css` | All the styling |

## Writing a post

Add an `.mdx` file to `src/content/posts/`. The filename becomes the URL
(`my-post.mdx` -> `/blog/my-post/`).

```yaml
---
title: "Post title"
date: 2026-08-12
description: "one line, shown in the list"
category: work   # or: life
draft: false     # true hides it everywhere
---
```

`category` is the only thing to think about: **work** for engineering and
building, **life** for everything else. It decides which section the post
lands under on `/blog`. The four most recent posts also show on the home page.
