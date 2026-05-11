import { defineCollection, z } from "astro:content";

const embedSchema = z.object({
  provider: z.enum(["vimeo", "youtube"]),
  url: z.string().url(),
  autoplay: z.boolean().default(false),
  loop: z.boolean().default(false),
  muted: z.boolean().default(false)
});

const projects = defineCollection({
  type: "content",
  schema: z.object({
    title: z.string(),
    description: z.string().default(""),
    seoTitle: z.string().optional(),
    seoDescription: z.string().optional(),
    seoKeywords: z.array(z.string()).default([]),
    category: z.enum(["design", "film", "design-film"]),
    date: z.string().optional(),
    order: z.number(),
    featured: z.boolean().default(true),
    cover: z.string(),
    gallery: z.array(z.string()).default([]),
    standingGallery: z.array(z.string()).default([]),
    squareGallery: z.array(z.string()).default([]),
    videoEmbeds: z.array(embedSchema).default([]),
    externalLinks: z.array(
      z.object({
        label: z.string(),
        url: z.string().url()
      })
    ).default([])
  })
});

export const collections = { projects };
