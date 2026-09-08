import { defineCollection, z } from 'astro:content';

const posts = defineCollection({
  type: 'content',
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
