// Single source of truth for everything the terminal knows about.
// Text supports a tiny inline markup: [label](url), **bold**, `code`.

export const identity = {
  name: 'Varun Lohade',
  tagline: 'Engineer · Mobile, AI, Crypto, Robotics',
  shell: 'varun@macbook',
  cwd: '~/varun',
  version: '1.0.0',
  updated: '2026-05-14',
  blurb:
    'I build things. Mostly software, sometimes hardware. Currently thinking about agents, on-chain finance, and machines that move.',
};

export interface Row {
  tag: string;
  text: string;
}

export const work: Row[] = [
  {
    tag: 'mobile',
    text: 'Flutter — the surface most of his work ships on, [Avici](https://avici.money) included.',
  },
  {
    tag: 'crypto',
    text: '[Avici.money](https://avici.money) — cofounder, technical founder. On-chain finance.',
  },
  {
    tag: 'ai',
    text: '[fixmahbug](https://github.com/varunlohade/fixmahbug) — anyone on the team can fix small bugs without pulling an engineer; prompts route into the engineer’s project-aware Claude.',
  },
  { tag: 'robotics', text: 'robotic arm — LLM-driven. Ongoing.' },
];

export const now: Row[] = [
  {
    tag: 'thinking',
    text: 'parallel agents interacting with each other to process interactions faster.',
  },
  { tag: 'learning', text: '**Modern Robotics** — Kevin Lynch, Northwestern.' },
  { tag: 'building', text: 'Avici.money, fixmahbug, the arm.' },
];

export const contact: Row[] = [
  { tag: 'email', text: '[varunlohade@gmail.com](mailto:varunlohade@gmail.com)' },
  { tag: 'github', text: '[github.com/varunlohade](https://github.com/varunlohade)' },
  { tag: 'medium', text: '[medium.com/@varunlohade](https://medium.com/@varunlohade)' },
];

export const about: string[] = [
  identity.blurb,
  'Mobile developer by trade — Flutter is where most of what he builds actually lands in people’s hands. Cofounder and technical founder at [Avici.money](https://avici.money), building on-chain finance. Before and alongside that: agent tooling, and a robotic arm driven by an LLM.',
  'The through-line is autonomy — systems that decide and act, whether that’s money moving without a bank in the loop, a bug getting fixed without an engineer in the loop, or an arm figuring out how to pick something up.',
];

// Answers for free-form questions. First rule whose keywords all-or-any match wins.
export interface Rule {
  any: string[];
  reply: string[];
  tool?: { name: string; arg: string; res: string };
}

export const rules: Rule[] = [
  {
    any: ['avici', 'crypto', 'on-chain', 'onchain', 'defi', 'finance', 'money'],
    tool: { name: 'Read', arg: 'work/avici.md', res: 'Read 24 lines' },
    reply: [
      '[Avici.money](https://avici.money) — he’s cofounder and technical founder. On-chain finance: wallets, cards, and the rails between them.',
      'It’s the thing he spends most of his hours on. Ask about `work` for the rest.',
    ],
  },
  {
    any: ['fixmahbug', 'agent', 'agents', 'llm', 'claude', 'ai', 'tooling'],
    tool: { name: 'Read', arg: 'work/fixmahbug.md', res: 'Read 18 lines' },
    reply: [
      '[fixmahbug](https://github.com/varunlohade/fixmahbug) lets anyone on a team fix small bugs without pulling an engineer — prompts route into the engineer’s project-aware Claude.',
      'He’s also thinking about parallel agents that talk to each other to process interactions faster.',
    ],
  },
  {
    any: ['robot', 'robotics', 'arm', 'hardware', 'motor', 'machine'],
    tool: { name: 'Read', arg: 'work/arm.md', res: 'Read 11 lines' },
    reply: [
      'An LLM-driven robotic arm. Ongoing, unfinished, the fun kind of hard.',
      'Currently working through **Modern Robotics** (Kevin Lynch, Northwestern) to stop guessing at the kinematics.',
    ],
  },
  {
    any: ['mobile', 'flutter', 'ios', 'android', 'app'],
    tool: { name: 'Read', arg: 'work/mobile.md', res: 'Read 9 lines' },
    reply: [
      'Mobile is his day-to-day surface. He builds in **Flutter**, and [Avici](https://avici.money) ships as a mobile app he owns end to end.',
      'So most of the AI and on-chain work he does eventually has to survive a phone.',
    ],
  },
  {
    any: ['hire', 'hiring', 'job', 'available', 'freelance', 'work with', 'consult'],
    reply: [
      'He’s heads-down on Avici, but he reads everything.',
      'Best path: [varunlohade@gmail.com](mailto:varunlohade@gmail.com). Be specific — same as you would with another engineer.',
    ],
  },
  {
    any: ['stack', 'tech', 'language', 'tools', 'use', 'built with'],
    reply: [
      'Whatever the problem wants. Lately: TypeScript, Python, Solidity, Flutter, and a lot of time inside Claude Code.',
      'This site is Astro with no client framework — the terminal is hand-rolled.',
    ],
  },
  {
    any: ['contact', 'reach', 'email', 'twitter', 'linkedin', 'dm'],
    reply: ['Run `contact` — or just email [varunlohade@gmail.com](mailto:varunlohade@gmail.com).'],
  },
  {
    any: ['who', 'about', 'yourself', 'background', 'bio'],
    reply: about,
  },
  {
    any: ['read', 'write', 'writing', 'blog', 'post', 'essay', 'article'],
    reply: ['Run `writing` to list posts, then `cat <file>` to read one here in the terminal.'],
  },
];
