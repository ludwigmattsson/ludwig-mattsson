import { getCollection } from "astro:content";
import { absoluteUrl } from "../utils/url";

function escapeXml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function entry(path: string, options: { lastmod?: string; priority?: string } = {}) {
  return [
    "  <url>",
    `    <loc>${escapeXml(absoluteUrl(path))}</loc>`,
    options.lastmod ? `    <lastmod>${escapeXml(options.lastmod)}</lastmod>` : "",
    options.priority ? `    <priority>${options.priority}</priority>` : "",
    "  </url>"
  ].filter(Boolean).join("\n");
}

export async function GET() {
  const projects = (await getCollection("projects"))
    .filter((project) => project.data.featured)
    .sort((a, b) => a.data.order - b.data.order);

  const staticEntries = [
    entry("/", { priority: "1.0" }),
    entry("/index/", { priority: "0.8" }),
    entry("/index/all/", { priority: "0.7" }),
    entry("/index/design/", { priority: "0.7" }),
    entry("/index/film/", { priority: "0.7" }),
    entry("/info/", { priority: "0.8" })
  ];

  const projectEntries = projects.map((project) =>
    entry(`/${project.slug}/`, {
      lastmod: project.data.date,
      priority: "0.9"
    })
  );

  const body = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${[...staticEntries, ...projectEntries].join("\n")}\n</urlset>\n`;

  return new Response(body, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8"
    }
  });
}
