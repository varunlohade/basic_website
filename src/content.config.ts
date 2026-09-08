import { defineCollection } from 'astro:content';
import { z } from 'astro/zod';
import { glob } from 'astro/loaders';

const posts = defineCollection({
  loader: glob({ pattern: '**/*.{md,mdx}', base: './src/content/posts' }),
  schema: z.object({
    title: z.string(),
    date: z.date(),
    description: z.string().optional(),
    // 'work' = engineering and building. 'life' = everything else.
    category: z.enum(['work', 'life']).default('work'),
    draft: z.boolean().default(false),
  }),
});

export const collections = { posts };
