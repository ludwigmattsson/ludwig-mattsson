import type { CollectionEntry } from "astro:content";
import site from "../content/site.json";
import { absoluteUrl } from "./url";

type Project = CollectionEntry<"projects">;

export const defaultSocialImage = "/assets/framerusercontent.com/images/KzJJXtCjD7Cl8tOvUuYnTvLJQo.png";

const personId = `${absoluteUrl("/info/")}#person`;
const websiteId = `${absoluteUrl("/")}#website`;

const categoryLabels = {
  design: "Design",
  film: "Film",
  "design-film": "Design and film"
} as const;

const categoryKeywords = {
  design: ["design", "graphic design", "design systems", "brand identity", "editorial design"],
  film: ["filmmaking", "film direction", "short film", "moving image", "visual storytelling"],
  "design-film": ["design", "filmmaking", "motion design", "visual storytelling", "creative direction"]
} as const;

function unique(items: string[]) {
  return [...new Set(items.map((item) => item.trim()).filter(Boolean))];
}

export function cleanText(text = "") {
  return text.replace(/\s+/g, " ").trim();
}

export function truncateMeta(text: string, max = 180) {
  const clean = cleanText(text);
  if (clean.length <= max) return clean;
  return `${clean.slice(0, max).replace(/\s+\S*$/, "").replace(/[.,;:–-]+$/, "")}.`;
}

function prune<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map(prune).filter((item) => item !== undefined && item !== null && item !== "") as T;
  }

  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .map(([key, item]) => [key, prune(item)])
        .filter(([, item]) => {
          if (item === undefined || item === null || item === "") return false;
          if (Array.isArray(item) && item.length === 0) return false;
          return true;
        })
    ) as T;
  }

  return value;
}

function videoEmbedUrl(embed: Project["data"]["videoEmbeds"][number]) {
  const parsed = new URL(embed.url);

  if (embed.provider === "vimeo") {
    const [, id, hash] = parsed.pathname.match(/^\/(\d+)(?:\/([A-Za-z0-9]+))?/) || [];
    if (!id) return embed.url;

    const params = new URLSearchParams();
    if (hash) params.set("h", hash);
    return `https://player.vimeo.com/video/${id}${params.size ? `?${params.toString()}` : ""}`;
  }

  const id = parsed.hostname.includes("youtu.be")
    ? parsed.pathname.slice(1)
    : parsed.searchParams.get("v");

  return id ? `https://www.youtube.com/embed/${id}` : embed.url;
}

export function siteKeywords() {
  return unique([
    ...(site.keywords || []),
    "Ludwig Mattsson",
    "Stockholm filmmaker",
    "Stockholm designer",
    "film direction",
    "graphic design",
    "design systems",
    "visual storytelling"
  ]);
}

export function projectKeywords(project: Project) {
  const data = project.data;
  return unique([
    data.title,
    data.description,
    categoryLabels[data.category],
    ...categoryKeywords[data.category],
    ...data.seoKeywords,
    "Ludwig Mattsson",
    "Stockholm"
  ]);
}

export function projectMetaTitle(project: Project) {
  return cleanText(project.data.seoTitle || project.data.title);
}

export function projectMetaDescription(project: Project) {
  const data = project.data;
  const description = cleanText(data.seoDescription || data.description);
  const category = categoryLabels[data.category];
  const base = description ? `${data.title}: ${description}.` : `${data.title}.`;

  return truncateMeta(`${base} ${category} portfolio project by Ludwig Mattsson, filmmaker and designer in Stockholm.`);
}

export function personSchema() {
  return {
    "@context": "https://schema.org",
    "@type": "Person",
    "@id": personId,
    name: site.title,
    url: absoluteUrl("/"),
    image: absoluteUrl(defaultSocialImage),
    jobTitle: ["Filmmaker", "Designer"],
    description: truncateMeta(site.intro, 360),
    email: site.email,
    telephone: site.phone,
    address: {
      "@type": "PostalAddress",
      addressLocality: "Stockholm",
      addressCountry: "SE"
    },
    knowsAbout: siteKeywords(),
    sameAs: site.social
      .map((link) => link.url)
      .filter((url) => /^https?:/.test(url))
  };
}

export function websiteSchema() {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "@id": websiteId,
    name: site.title,
    url: absoluteUrl("/"),
    description: site.description,
    inLanguage: "en",
    publisher: {
      "@id": personId
    }
  };
}

export function profilePageSchema() {
  return {
    "@context": "https://schema.org",
    "@type": "ProfilePage",
    "@id": `${absoluteUrl("/info/")}#webpage`,
    url: absoluteUrl("/info/"),
    name: `${site.title} Information`,
    description: truncateMeta(`${site.intro} ${site.bio}`, 360),
    inLanguage: "en",
    isPartOf: {
      "@id": websiteId
    },
    mainEntity: {
      "@id": personId
    }
  };
}

export function collectionPageSchema({
  path,
  title,
  description,
  projects
}: {
  path: string;
  title: string;
  description: string;
  projects: Project[];
}) {
  const url = absoluteUrl(path);

  return {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    "@id": `${url}#webpage`,
    url,
    name: title,
    description,
    inLanguage: "en",
    isPartOf: {
      "@id": websiteId
    },
    about: ["design", "filmmaking", "visual storytelling"],
    mainEntity: {
      "@type": "ItemList",
      itemListElement: projects.map((project, index) => ({
        "@type": "ListItem",
        position: index + 1,
        name: project.data.title,
        url: absoluteUrl(`/${project.slug}/`)
      }))
    }
  };
}

export function breadcrumbSchema(items: { name: string; path: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: absoluteUrl(item.path)
    }))
  };
}

export function projectSchema(project: Project) {
  const data = project.data;
  const url = absoluteUrl(`/${project.slug}/`);
  const images = unique([
    data.cover,
    ...data.gallery,
    ...data.standingGallery,
    ...data.squareGallery
  ]).slice(0, 8).map((image) => absoluteUrl(image));
  const description = projectMetaDescription(project);

  return prune({
    "@context": "https://schema.org",
    "@type": data.category === "film" ? "Movie" : "CreativeWork",
    "@id": `${url}#creativework`,
    name: data.title,
    headline: projectMetaTitle(project),
    description,
    url,
    image: images,
    datePublished: data.date,
    creator: {
      "@id": personId
    },
    author: {
      "@id": personId
    },
    genre: categoryLabels[data.category],
    keywords: projectKeywords(project).join(", "),
    sameAs: data.externalLinks.map((link) => link.url),
    associatedMedia: data.videoEmbeds.map((embed, index) => ({
      "@type": "VideoObject",
      name: `${data.title} video${data.videoEmbeds.length > 1 ? ` ${index + 1}` : ""}`,
      description,
      url: embed.url,
      embedUrl: videoEmbedUrl(embed),
      thumbnailUrl: absoluteUrl(data.cover),
      uploadDate: data.date
    }))
  });
}

export function serializeJsonLd(schema: unknown) {
  return JSON.stringify(schema).replace(/</g, "\\u003c");
}
