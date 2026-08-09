import { identity, work, now, contact, about, rules, type Row } from '../data/site';

/* ────────────────────────────────────────────────────────
   types
   ──────────────────────────────────────────────────────── */

type Block =
  | { k: 'msg'; text: string }
  | { k: 'cont'; text: string }
  | { k: 'tool'; name: string; arg: string; res: string }
  | { k: 'rows'; rows: Row[] }
  | { k: 'chips'; items: string[] }
  | { k: 'pre'; text: string }
  | { k: 'gap' }
  | { k: 'think'; ms?: number }
  | { k: 'clear' }
  | { k: 'ask'; q: string }
  | { k: 'nav'; url: string };

interface Post {
  slug: string;
  title: string;
  date: string;
  description: string;
  body: string;
}

interface Command {
  name: string;
  aliases?: string[];
  desc: string;
  slash?: boolean;
  hidden?: boolean;
  /** Takes arguments — so `cat foo.md` runs the command instead of being read as a question. */
  args?: boolean;
  run: (arg: string) => Block[];
}

/* ────────────────────────────────────────────────────────
   dom
   ──────────────────────────────────────────────────────── */

const root = document.querySelector<HTMLElement>('.term')!;
const out = root.querySelector<HTMLElement>('.term__out')!;
const field = root.querySelector<HTMLInputElement>('.input__real')!;
const mirror = root.querySelector<HTMLElement>('.input__mirror')!;
const menu = root.querySelector<HTMLElement>('.menu')!;
const inputBox = root.querySelector<HTMLElement>('.input')!;

const posts: Post[] = JSON.parse(
  document.getElementById('site-posts')?.textContent || '[]',
);

const startedAt = Date.now();
const PLACEHOLDER = 'Ask about Varun — or run /help';

let busy = false;
let interrupted = false;
let stick = true;
const history: string[] = [];
let histIdx = -1;

/* ────────────────────────────────────────────────────────
   inline markup:  [label](url)  **bold**  `code`
   ──────────────────────────────────────────────────────── */

type Token =
  | { t: 'text'; s: string }
  | { t: 'link'; s: string; href: string }
  | { t: 'bold'; s: string }
  | { t: 'code'; s: string };

function tokenize(src: string): Token[] {
  const tokens: Token[] = [];
  const re = /\[([^\]]+)\]\(([^)]+)\)|\*\*([^*]+)\*\*|`([^`]+)`/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(src))) {
    if (m.index > last) tokens.push({ t: 'text', s: src.slice(last, m.index) });
    if (m[1] !== undefined) tokens.push({ t: 'link', s: m[1], href: m[2] });
    else if (m[3] !== undefined) tokens.push({ t: 'bold', s: m[3] });
    else tokens.push({ t: 'code', s: m[4] });
    last = m.index + m[0].length;
  }
  if (last < src.length) tokens.push({ t: 'text', s: src.slice(last) });
  return tokens;
}

function nodeFor(tok: Token): HTMLElement | Text {
  if (tok.t === 'text') return document.createTextNode('');
  if (tok.t === 'link') {
    const a = document.createElement('a');
    a.href = tok.href;
    if (/^https?:/.test(tok.href)) {
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
    }
    return a;
  }
  if (tok.t === 'code') return document.createElement('code');
  const el = document.createElement('span');
  el.className = 'bold';
  return el;
}

/* ────────────────────────────────────────────────────────
   output helpers
   ──────────────────────────────────────────────────────── */

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const scroller = document.scrollingElement || document.documentElement;

function toBottom() {
  if (stick) window.scrollTo(0, scroller.scrollHeight);
}

function append(el: HTMLElement) {
  out.appendChild(el);
  toBottom();
  return el;
}

function div(cls: string, html?: string) {
  const el = document.createElement('div');
  el.className = cls;
  if (html !== undefined) el.innerHTML = html;
  return el;
}

/** Types tokenized text into `host`, char by char, honouring interrupts. */
async function type(host: HTMLElement, text: string, msPerChar = 7) {
  const tokens = tokenize(text);
  const chunk = Math.max(1, Math.ceil(text.length / 160));
  for (const tok of tokens) {
    const node = nodeFor(tok);
    host.appendChild(node);
    const sink = node instanceof Text ? node : node;
    for (let i = 0; i < tok.s.length; i += chunk) {
      if (interrupted) {
        // dump the rest instantly
        if (sink instanceof Text) sink.data = tok.s;
        else sink.textContent = tok.s;
        break;
      }
      const slice = tok.s.slice(0, Math.min(i + chunk, tok.s.length));
      if (sink instanceof Text) sink.data = slice;
      else sink.textContent = slice;
      toBottom();
      await sleep(msPerChar);
    }
    if (interrupted) {
      if (sink instanceof Text) sink.data = tok.s;
      else sink.textContent = tok.s;
    }
  }
  toBottom();
}

/** The ✻ spinner Claude Code shows while it thinks. */
async function think(ms: number) {
  const words = ['Simmering', 'Percolating', 'Noodling', 'Puzzling', 'Ruminating', 'Cogitating'];
  const glyphs = ['✻', '✽', '✳', '∗', '✳', '✽'];
  const word = words[Math.floor(Math.random() * words.length)];
  const el = append(div('line spin'));
  const t0 = Date.now();
  let i = 0;
  while (Date.now() - t0 < ms && !interrupted) {
    const secs = ((Date.now() - t0) / 1000).toFixed(0);
    el.innerHTML = `${glyphs[i++ % glyphs.length]} ${word}… <span class="spin__hint">(${secs}s · esc to interrupt)</span>`;
    toBottom();
    await sleep(110);
  }
  el.remove();
}

/** Turns bare URLs and emails in generated text into links, without innerHTML. */
function autolink(host: HTMLElement) {
  const source = host.textContent ?? '';
  const re = /(https?:\/\/[^\s)<>]+)|([\w.+-]+@[\w-]+\.[\w.-]+)/g;
  if (!re.test(source)) return;
  re.lastIndex = 0;

  host.textContent = '';
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(source))) {
    if (m.index > last) host.appendChild(document.createTextNode(source.slice(last, m.index)));
    const a = document.createElement('a');
    a.textContent = m[0];
    if (m[1]) {
      a.href = m[0];
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
    } else {
      a.href = `mailto:${m[0]}`;
    }
    host.appendChild(a);
    last = m.index + m[0].length;
  }
  if (last < source.length) host.appendChild(document.createTextNode(source.slice(last)));
}

/** Types plain text, parsing no markup — model output is never trusted markup. */
async function typePlain(host: HTMLElement, s: string, msPerChar = 4) {
  const node = document.createTextNode('');
  host.appendChild(node);
  const chunk = Math.max(1, Math.ceil(s.length / 160));

  for (let i = 0; i < s.length; i += chunk) {
    if (interrupted) break;
    node.data = s.slice(0, Math.min(i + chunk, s.length));
    toBottom();
    await sleep(msPerChar);
  }
  node.data = s;
  toBottom();
}

/**
 * Fetches an answer from /api/ask and types it out.
 *
 * Not streamed: the endpoint validates the complete response before returning
 * it, so there is nothing to show until it has passed. Typing it out client-side
 * keeps the terminal feel without rendering unvalidated model output.
 *
 * Returns false if the endpoint is unavailable, so the caller can fall back to
 * the built-in answers — the terminal still works with no model behind it.
 */
async function askModel(q: string): Promise<boolean> {
  const words = ['Simmering', 'Percolating', 'Noodling', 'Puzzling', 'Ruminating', 'Cogitating'];
  const glyphs = ['✻', '✽', '✳', '∗', '✳', '✽'];
  const word = words[Math.floor(Math.random() * words.length)];

  const spinner = append(div('line spin'));
  const t0 = Date.now();
  let g = 0;
  const tick = window.setInterval(() => {
    const secs = ((Date.now() - t0) / 1000).toFixed(0);
    spinner.innerHTML = `${glyphs[g++ % glyphs.length]} ${word}… <span class="spin__hint">(${secs}s · esc to interrupt)</span>`;
    toBottom();
  }, 110);

  const ctrl = new AbortController();
  const watch = window.setInterval(() => {
    if (interrupted) ctrl.abort();
  }, 80);

  const cleanup = () => {
    window.clearInterval(tick);
    window.clearInterval(watch);
  };

  try {
    const res = await fetch('/api/ask', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ q }),
      signal: ctrl.signal,
    });

    cleanup();
    spinner.remove();

    if (!res.ok) return false;

    const answer = (await res.text()).trim();
    if (!answer) return false;

    const wrap = append(div('msg'));
    wrap.appendChild(div('msg__dot', '⏺'));
    const body = div('msg__body');
    wrap.appendChild(body);

    await typePlain(body, answer);
    autolink(body);
    toBottom();
    return true;
  } catch {
    cleanup();
    spinner.remove();
    // An abort is an interrupt, not a failure — don't show the fallback for it.
    return interrupted;
  }
}

async function render(blocks: Block[]) {
  for (const b of blocks) {
    if (interrupted && b.k !== 'clear') break;

    switch (b.k) {
      case 'gap':
        append(div('blank'));
        break;

      case 'think':
        await think(b.ms ?? 380 + Math.random() * 420);
        break;

      case 'msg':
      case 'cont': {
        const wrap = append(div(b.k === 'cont' ? 'msg msg--cont' : 'msg'));
        wrap.appendChild(div('msg__dot', '⏺'));
        const body = div('msg__body');
        wrap.appendChild(body);
        await type(body, b.text);
        break;
      }

      case 'tool': {
        const wrap = append(div('tool'));
        wrap.appendChild(div('tool__dot', '⏺'));
        const body = div('msg__body');
        body.innerHTML = `<span class="tool__name">${esc(b.name)}</span><span class="tool__arg">(${esc(b.arg)})</span>`;
        wrap.appendChild(body);
        await sleep(interrupted ? 0 : 180);
        append(div('line tool__res', `<span class="elbow">⎿</span>  ${esc(b.res)}`));
        await sleep(interrupted ? 0 : 90);
        break;
      }

      case 'rows': {
        const wrap = append(div('rows'));
        for (const r of b.rows) {
          const row = div('row');
          row.appendChild(div('row__tag', esc(r.tag)));
          const text = div('row__text');
          row.appendChild(text);
          wrap.appendChild(row);
          toBottom();
          await type(text, r.text, 3);
        }
        break;
      }

      case 'pre': {
        const el = append(div('line dim pre'));
        await type(el, b.text, 1);
        break;
      }

      case 'chips': {
        const wrap = append(div('chips'));
        for (const c of b.items) {
          const btn = document.createElement('button');
          btn.className = 'chip';
          btn.type = 'button';
          btn.textContent = c;
          btn.addEventListener('click', () => {
            field.value = c;
            paint();
            submit();
          });
          wrap.appendChild(btn);
        }
        toBottom();
        break;
      }

      case 'ask': {
        const answered = await askModel(b.q);
        if (!answered && !interrupted) await render(offline(b.q));
        break;
      }

      case 'clear':
        out.innerHTML = '';
        break;

      case 'nav':
        window.open(b.url, '_blank', 'noopener');
        break;
    }
  }
}

function esc(s: string) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/* ────────────────────────────────────────────────────────
   files
   ──────────────────────────────────────────────────────── */

const files: Record<string, () => Block[]> = {
  'about.md': () => [{ k: 'msg', text: about[0] }, ...about.slice(1).map((t) => ({ k: 'cont' as const, text: t }))],
  'work.md': () => [{ k: 'rows', rows: work }],
  'now.md': () => [{ k: 'rows', rows: now }],
  'contact.md': () => [{ k: 'rows', rows: contact }],
};

function findPost(q: string): Post | undefined {
  const key = q.replace(/^posts\//, '').replace(/\.mdx?$/, '').toLowerCase();
  return posts.find((p) => p.slug.toLowerCase() === key);
}

/* ────────────────────────────────────────────────────────
   commands
   ──────────────────────────────────────────────────────── */

const commands: Command[] = [
  {
    name: 'about',
    aliases: ['whoami', 'who', 'bio'],
    desc: 'who he is',
    run: () => [
      { k: 'tool', name: 'Read', arg: 'about.md', res: `Read ${about.length * 3} lines` },
      { k: 'gap' },
      ...files['about.md'](),
    ],
  },
  {
    name: 'work',
    aliases: ['projects', 'building'],
    desc: "what he's building",
    run: () => [
      { k: 'tool', name: 'Read', arg: 'work.md', res: `${work.length} entries` },
      { k: 'gap' },
      { k: 'rows', rows: work },
    ],
  },
  {
    name: 'writing',
    aliases: ['posts', 'blog', 'essays'],
    desc: 'posts & essays',
    run: () => {
      const rows: Row[] = posts.map((p) => ({
        tag: p.date.slice(0, 4),
        text: `[${p.title}](/writing/${p.slug}/)${p.description ? ` — ${p.description}` : ''}`,
      }));
      rows.push({ tag: 'medium', text: '[@varunlohade](https://medium.com/@varunlohade) — older essays.' });
      return [
        { k: 'tool', name: 'Glob', arg: 'posts/**/*.mdx', res: `${posts.length} files` },
        { k: 'gap' },
        { k: 'rows', rows },
        { k: 'gap' },
        { k: 'cont', text: 'Read one here with `cat hello.mdx`, or open the link for the full page.' },
      ];
    },
  },
  {
    name: 'now',
    desc: "what he's doing right now",
    run: () => [
      { k: 'tool', name: 'Read', arg: 'now.md', res: `updated ${identity.updated}` },
      { k: 'gap' },
      { k: 'rows', rows: now },
    ],
  },
  {
    name: 'contact',
    aliases: ['elsewhere', 'links', 'email'],
    desc: 'how to reach him',
    run: () => [
      { k: 'tool', name: 'Read', arg: 'contact.md', res: `${contact.length} entries` },
      { k: 'gap' },
      { k: 'rows', rows: contact },
    ],
  },
  {
    name: 'ls',
    aliases: ['dir'],
    desc: 'list files',
    run: () => [
      {
        k: 'rows',
        rows: [
          { tag: 'about.md', text: 'who he is' },
          { tag: 'work.md', text: 'what he ships' },
          { tag: 'now.md', text: `current focus (updated ${identity.updated})` },
          { tag: 'contact.md', text: 'how to reach him' },
          { tag: 'posts/', text: `${posts.length} file${posts.length === 1 ? '' : 's'}` },
        ],
      },
    ],
  },
  {
    name: 'cat',
    args: true,
    desc: 'read a file — cat about.md',
    run: (arg) => {
      if (!arg) return [{ k: 'msg', text: 'Usage: `cat <file>`. Run `ls` to see what’s here.' }];
      const key = arg.trim().toLowerCase();
      if (files[key]) {
        return [{ k: 'tool', name: 'Read', arg: key, res: 'ok' }, { k: 'gap' }, ...files[key]()];
      }
      const post = findPost(key);
      if (post) {
        return [
          { k: 'tool', name: 'Read', arg: `posts/${post.slug}.mdx`, res: `Read ${post.body.split('\n').length} lines` },
          { k: 'gap' },
          { k: 'msg', text: `**${post.title}** — ${post.date}` },
          { k: 'gap' },
          { k: 'pre', text: post.body.trim() },
          { k: 'gap' },
          { k: 'cont', text: `Full page: [/writing/${post.slug}/](/writing/${post.slug}/)` },
        ];
      }
      return [{ k: 'msg', text: `cat: ${arg}: No such file or directory. Try \`ls\`.` }];
    },
  },
  {
    name: 'open',
    args: true,
    desc: 'open a link — open avici',
    hidden: true,
    run: (arg) => {
      const map: Record<string, string> = {
        avici: 'https://avici.money',
        fixmahbug: 'https://github.com/varunlohade/fixmahbug',
        github: 'https://github.com/varunlohade',
        medium: 'https://medium.com/@varunlohade',
        email: 'mailto:varunlohade@gmail.com',
      };
      const url = map[arg.trim().toLowerCase()];
      if (!url) return [{ k: 'msg', text: `Nothing to open for \`${arg}\`. Try: ${Object.keys(map).join(', ')}.` }];
      return [{ k: 'msg', text: `Opening ${url}` }, { k: 'nav', url }];
    },
  },
  {
    name: 'help',
    aliases: ['?', 'commands'],
    desc: 'show commands',
    slash: true,
    run: () => [
      { k: 'msg', text: 'Ask a question in plain English, or run one of these:' },
      { k: 'gap' },
      {
        k: 'rows',
        rows: [
          ...commands
            .filter((c) => !c.hidden && !c.slash)
            .map((c) => ({ tag: c.name, text: c.desc })),
          { tag: '/model', text: 'model & availability' },
          { tag: '/status', text: 'session status' },
          { tag: '/cost', text: 'what this cost you' },
          { tag: 'clear', text: 'clear the screen' },
        ],
      },
      { k: 'gap' },
      { k: 'cont', text: '**↑/↓** history · **tab** complete · **esc** interrupt' },
    ],
  },
  {
    name: 'clear',
    aliases: ['cls'],
    desc: 'clear the screen',
    slash: true,
    run: () => [{ k: 'clear' }],
  },
  {
    name: 'model',
    desc: 'model & availability',
    slash: true,
    hidden: true,
    run: () => [
      {
        k: 'rows',
        rows: [
          { tag: 'model', text: 'varun-1.0 (human, opus-class stubbornness)' },
          { tag: 'reasoning', text: 'high — thinks in systems, ships in weeks' },
          { tag: 'context', text: 'AI, crypto, robotics' },
          { tag: 'status', text: 'heads-down on Avici · reads every email' },
        ],
      },
    ],
  },
  {
    name: 'status',
    desc: 'session status',
    slash: true,
    hidden: true,
    run: () => [
      {
        k: 'rows',
        rows: [
          { tag: 'version', text: identity.version },
          { tag: 'cwd', text: identity.cwd },
          { tag: 'session', text: uptime() },
          { tag: 'account', text: 'guest (you)' },
          { tag: 'updated', text: identity.updated },
        ],
      },
    ],
  },
  {
    name: 'cost',
    desc: 'what this cost you',
    slash: true,
    hidden: true,
    run: () => [
      {
        k: 'rows',
        rows: [
          { tag: 'duration', text: uptime() },
          { tag: 'tokens', text: '0 — everything here is hand-written' },
          { tag: 'cost', text: '$0.00. Spend it on [an email](mailto:varunlohade@gmail.com) instead.' },
        ],
      },
    ],
  },
  {
    name: 'init',
    desc: 'write VARUN.md',
    slash: true,
    hidden: true,
    run: () => [
      { k: 'tool', name: 'Write', arg: 'VARUN.md', res: 'Created VARUN.md' },
      { k: 'gap' },
      { k: 'msg', text: '`VARUN.md` written. It says: **ship it, then make it good.**' },
    ],
  },
  {
    name: 'exit',
    aliases: ['quit', ':q'],
    desc: 'leave',
    slash: true,
    hidden: true,
    run: () => [
      { k: 'msg', text: 'There’s no exit — this is a portfolio. Close the tab, or run `contact` first.' },
    ],
  },
  {
    name: 'sudo',
    args: true,
    desc: '',
    hidden: true,
    run: () => [
      { k: 'msg', text: 'guest is not in the sudoers file. This incident has been reported.' },
    ],
  },
  {
    name: 'pwd',
    desc: '',
    hidden: true,
    run: () => [{ k: 'msg', text: identity.cwd }],
  },
];

function uptime() {
  const s = Math.max(1, Math.round((Date.now() - startedAt) / 1000));
  return s < 60 ? `${s}s` : `${Math.floor(s / 60)}m ${s % 60}s`;
}

function lookup(name: string) {
  const n = name.toLowerCase();
  return commands.find((c) => c.name === n || c.aliases?.includes(n));
}

/* ────────────────────────────────────────────────────────
   free-form answers
   ──────────────────────────────────────────────────────── */

/** Whole-word match, so `ai` doesn't fire on "em-ai-l" or "av-ai-lable". */
function mentions(haystack: string, needle: string): boolean {
  const escaped = needle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(^|[^a-z0-9])${escaped}([^a-z0-9]|$)`, 'i').test(haystack);
}

/**
 * Fallback for when /api/ask is unreachable or unconfigured: the keyword rules
 * from site.ts, then a generic nudge. The model is the primary path — these
 * exist so the terminal still answers with no backend at all.
 */
function offline(input: string): Block[] {
  const q = input.toLowerCase();

  for (const rule of rules) {
    if (rule.any.some((k) => mentions(q, k))) {
      return [
        ...(rule.tool ? ([{ k: 'tool', ...rule.tool }, { k: 'gap' }] as Block[]) : []),
        { k: 'msg', text: rule.reply[0] },
        ...rule.reply.slice(1).map((t) => ({ k: 'cont' as const, text: t })),
      ];
    }
  }

  return [
    { k: 'msg', text: 'I only know one subject, and it’s Varun. Try one of these:' },
    { k: 'chips', items: ['about', 'work', 'writing', 'now', 'contact'] },
  ];
}

/** Free-form input goes to the model. Commands stay local and instant. */
const answer = (input: string): Block[] => [{ k: 'ask', q: input }];

/* ────────────────────────────────────────────────────────
   run loop
   ──────────────────────────────────────────────────────── */

function echo(text: string) {
  const el = div('line echo');
  el.innerHTML = `<span class="caret">&gt;</span>${esc(text)}`;
  append(el);
}

async function exec(raw: string) {
  const input = raw.trim();
  if (!input) return;

  busy = true;
  interrupted = false;
  history.unshift(input);
  histIdx = -1;

  echo(input);
  append(div('blank'));

  const isSlash = input.startsWith('/');
  const body = isSlash ? input.slice(1) : input;
  const [head, ...rest] = body.split(/\s+/);
  const arg = rest.join(' ');
  const cmd = lookup(head);

  // A bare word that matches a command runs it; anything else is a question.
  // (`about the arm` should be answered, not treated as the `about` command.)
  const blocks: Block[] =
    cmd && (isSlash || rest.length === 0 || cmd.args)
      ? cmd.run(arg)
      : answer(input); // answer() owns its own spinner — the remote path streams one

  await render(blocks);

  if (interrupted) {
    append(div('line', '<span class="accent">⏺</span> <span class="dim">Interrupted by user</span>'));
  }
  append(div('blank'));

  busy = false;
  interrupted = false;
  paint();
  field.focus();
}

/** Messages typed while a response is streaming queue up, as they do in Claude Code. */
const queue: string[] = [];
const queueEl = root.querySelector<HTMLElement>('.queued')!;

function drawQueue() {
  queueEl.innerHTML = '';
  for (const q of queue) {
    queueEl.appendChild(div('queued__item', `<span class="elbow">⧗</span> ${esc(q)}`));
  }
}

function submit() {
  const v = field.value.trim();
  if (!v) return;
  field.value = '';
  closeMenu();
  paint();

  if (busy) {
    queue.push(v);
    drawQueue();
    return;
  }
  void drain(v);
}

async function drain(first: string) {
  let next: string | undefined = first;
  while (next !== undefined) {
    await exec(next);
    next = queue.shift();
    drawQueue();
  }
}

/* ────────────────────────────────────────────────────────
   input: mirrored text + block cursor
   ──────────────────────────────────────────────────────── */

function paint() {
  const v = field.value;
  const pos = field.selectionStart ?? v.length;
  const focused = document.activeElement === field;
  mirror.textContent = '';

  if (!v) {
    mirror.appendChild(cursorEl(' ', focused));
    const ph = document.createElement('span');
    ph.className = 'input__ph';
    ph.textContent = PLACEHOLDER;
    mirror.appendChild(ph);
    return;
  }

  mirror.appendChild(document.createTextNode(v.slice(0, pos)));
  mirror.appendChild(cursorEl(v[pos] ?? ' ', focused));
  mirror.appendChild(document.createTextNode(v.slice(pos + (v[pos] ? 1 : 0))));
}

function cursorEl(ch: string, focused: boolean) {
  const c = document.createElement('span');
  c.className = focused ? 'cursor' : 'cursor cursor--off';
  c.textContent = ch === ' ' ? ' ' : ch;
  return c;
}

/* ────────────────────────────────────────────────────────
   slash menu
   ──────────────────────────────────────────────────────── */

let menuItems: Command[] = [];
let menuIdx = 0;

function slashable() {
  return commands.filter((c) => c.slash);
}

function openMenu(q: string) {
  menuItems = slashable().filter((c) => c.name.startsWith(q.toLowerCase()));
  if (!menuItems.length) return closeMenu();
  menuIdx = 0;
  menu.innerHTML = '';
  menuItems.forEach((c, i) => {
    const item = div('menu__item');
    item.setAttribute('role', 'option');
    item.setAttribute('aria-selected', String(i === menuIdx));
    item.innerHTML = `<span class="menu__name">/${esc(c.name)}</span><span class="menu__desc">${esc(c.desc)}</span>`;
    item.addEventListener('mousedown', (e) => {
      e.preventDefault();
      field.value = `/${c.name}`;
      submit();
    });
    menu.appendChild(item);
  });
  menu.hidden = false;
}

function closeMenu() {
  menu.hidden = true;
  menuItems = [];
}

function moveMenu(delta: number) {
  menuIdx = (menuIdx + delta + menuItems.length) % menuItems.length;
  Array.from(menu.children).forEach((el, i) =>
    el.setAttribute('aria-selected', String(i === menuIdx)),
  );
}

function syncMenu() {
  const v = field.value;
  if (v.startsWith('/') && !v.includes(' ')) openMenu(v.slice(1));
  else closeMenu();
}

/* ────────────────────────────────────────────────────────
   events
   ──────────────────────────────────────────────────────── */

field.addEventListener('input', () => {
  paint();
  syncMenu();
});
field.addEventListener('click', paint);
field.addEventListener('focus', paint);
field.addEventListener('blur', () => {
  paint();
  closeMenu();
});
field.addEventListener('keyup', (e) => {
  if (e.key.startsWith('Arrow') || e.key === 'Home' || e.key === 'End') paint();
});

field.addEventListener('keydown', (e) => {
  const openList = !menu.hidden && menuItems.length > 0;

  if (e.key === 'Enter') {
    e.preventDefault();
    if (openList) {
      field.value = `/${menuItems[menuIdx].name}`;
      closeMenu();
    }
    submit();
    return;
  }

  if (e.key === 'Escape') {
    if (openList) return closeMenu();
    if (busy) interrupted = true;
    return;
  }

  if (e.key === 'c' && e.ctrlKey) {
    if (busy) interrupted = true;
    else {
      field.value = '';
      paint();
    }
    return;
  }

  if (e.key === 'l' && e.ctrlKey) {
    e.preventDefault();
    out.innerHTML = '';
    return;
  }

  if (e.key === 'Tab') {
    e.preventDefault();
    if (openList) {
      field.value = `/${menuItems[menuIdx].name}`;
      closeMenu();
      paint();
      return;
    }
    const v = field.value.trim().toLowerCase();
    if (!v) return;
    const hit = commands.find((c) => !c.hidden && c.name.startsWith(v));
    if (hit) {
      field.value = hit.name;
      paint();
    }
    return;
  }

  if (e.key === 'ArrowUp') {
    if (openList) {
      e.preventDefault();
      return moveMenu(-1);
    }
    if (histIdx + 1 < history.length) {
      e.preventDefault();
      histIdx++;
      field.value = history[histIdx];
      requestAnimationFrame(paint);
    }
    return;
  }

  if (e.key === 'ArrowDown') {
    if (openList) {
      e.preventDefault();
      return moveMenu(1);
    }
    if (histIdx > 0) {
      e.preventDefault();
      histIdx--;
      field.value = history[histIdx];
    } else if (histIdx === 0) {
      e.preventDefault();
      histIdx = -1;
      field.value = '';
    }
    requestAnimationFrame(paint);
  }
});

// Click anywhere (that isn't a link or a selection) to focus the prompt.
document.addEventListener('mousedown', (e) => {
  const t = e.target as HTMLElement;
  if (t.closest('a, button, .menu')) return;
  if (window.getSelection()?.toString()) return;
  setTimeout(() => field.focus(), 0);
});

// Typing anywhere routes into the prompt.
document.addEventListener('keydown', (e) => {
  if (document.activeElement === field) return;
  if (e.metaKey || e.ctrlKey || e.altKey || e.key.length !== 1) return;
  field.focus();
});

inputBox.addEventListener('mousedown', () => setTimeout(() => field.focus(), 0));

window.addEventListener('scroll', () => {
  stick = scroller.scrollHeight - window.scrollY - window.innerHeight < 60;
});

/* ────────────────────────────────────────────────────────
   boot
   ──────────────────────────────────────────────────────── */

async function boot() {
  busy = true;

  // `varun@macbook ~ % claude`
  const bootLine = append(div('line boot'));
  bootLine.innerHTML = `<span class="host">${esc(identity.shell)}</span> <span class="path">~</span> % `;
  const cmd = document.createElement('span');
  cmd.className = 'cmd';
  bootLine.appendChild(cmd);
  const typed = 'claude';
  for (let i = 1; i <= typed.length; i++) {
    cmd.textContent = typed.slice(0, i);
    await sleep(55);
  }
  await sleep(320);

  const box = append(div('box'));
  box.innerHTML = `
    <div class="title"><span class="star">✻</span> Welcome to <span class="bold">${esc(identity.name)}</span></div>
    <div class="blank"></div>
    <div class="dim">${esc(identity.tagline)}</div>
    <div class="blank"></div>
    <div class="dim">/help for commands · ask anything in plain English</div>
    <div class="faint">cwd: ${esc(identity.cwd)}</div>`;
  await sleep(220);

  append(div('line dim', ' Tips for getting started'));
  append(div('blank'));
  const tips = [
    'Run `about` to find out who he is',
    'Run `work` to see what he’s building right now',
    'Or just ask — “what is avici?”',
  ];
  for (const t of tips) {
    const el = append(div('line dim'));
    el.style.paddingLeft = '1.4em';
    await type(el, `· ${t}`, 4);
  }
  append(div('blank'));

  await render([
    { k: 'think', ms: 500 },
    { k: 'msg', text: 'You’ve opened Varun’s shell. Ask me anything about him — or start here:' },
    { k: 'chips', items: ['about', 'work', 'writing', 'now', 'contact'] },
  ]);

  busy = false;
  field.focus();
  paint();
}

paint();
void boot();
