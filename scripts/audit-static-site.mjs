import { existsSync } from "node:fs";
import { readdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";

const rootDir = path.resolve(new URL("..", import.meta.url).pathname);
const reportPath = path.join(rootDir, "audit-report.json");

const textExtensions = new Set([
  ".html",
  ".css",
  ".js",
  ".mjs",
  ".json",
  ".svg",
  ".txt",
  ".md",
]);

const externalUrlPattern = /https?:\/\/[^\s"'<>),\\`\]}]+/g;
const localFilePattern = /(?:(?:\.\.\/|\.\/)[^"'`\s<>),\]}]+\.(?:framercms|html|css|json|mjs|js|png|jpe?g|gif|webp|svg|woff2?|ttf|otf|ico))(?:[?#][^"'`\s<>),\]}]*)?/gi;
const videoPatterns = [
  /https?:\/\/[^\s"'<>),\\`\]}]*(?:vimeo\.com|player\.vimeo\.com)[^\s"'<>),\\`\]}]*/gi,
  /https?:\/\/[^\s"'<>),\\`\]}]*(?:youtube\.com|youtu\.be|youtube-nocookie\.com)[^\s"'<>),\\`\]}]*/gi,
];

function cleanUrl(url) {
  return url
    .replace(/&amp;/g, "&")
    .replace(/[.,;:]+$/g, "")
    .replace(/\\+$/g, "");
}

async function listFiles(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const absolute = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...await listFiles(absolute));
    } else {
      files.push(absolute);
    }
  }
  return files;
}

function resolveLocalReference(filePath, specifier) {
  const clean = specifier.split(/[?#]/, 1)[0];
  return path.resolve(path.dirname(filePath), clean);
}

function isTextLike(filePath) {
  return textExtensions.has(path.extname(filePath).toLowerCase());
}

function shouldAudit(filePath) {
  const relative = path.relative(rootDir, filePath).split(path.sep).join("/");
  if (relative.startsWith(".git/")) return false;
  if (relative.startsWith("scripts/")) return false;
  if (["README.md", "audit-report.json", "mirror-manifest.json"].includes(relative)) return false;
  return true;
}

const files = (await listFiles(rootDir)).filter((filePath) => {
  const relative = path.relative(rootDir, filePath).split(path.sep).join("/");
  return !relative.startsWith(".git/");
});
const textFiles = files.filter((filePath) => shouldAudit(filePath) && isTextLike(filePath));
const cmsFiles = files.filter((filePath) => shouldAudit(filePath) && path.extname(filePath).toLowerCase() === ".framercms");
const cmsBasenames = new Set(
  cmsFiles.map((filePath) => path.basename(filePath))
);
const allExternalUrls = new Map();
const videoUrls = new Map();
const cmsVideoUrls = new Map();
const missingLocalReferences = [];
const localReferenceCount = new Map();

for (const filePath of textFiles) {
  const text = await readFile(filePath, "utf8");
  const relativeFile = path.relative(rootDir, filePath);

  for (const match of text.matchAll(externalUrlPattern)) {
    const url = cleanUrl(match[0]);
    const foundIn = allExternalUrls.get(url) ?? new Set();
    foundIn.add(relativeFile);
    allExternalUrls.set(url, foundIn);
  }

  for (const pattern of videoPatterns) {
    for (const match of text.matchAll(pattern)) {
      const url = cleanUrl(match[0]);
      const foundIn = videoUrls.get(url) ?? new Set();
      foundIn.add(relativeFile);
      videoUrls.set(url, foundIn);
    }
  }

  for (const match of text.matchAll(localFilePattern)) {
    const reference = match[0];
    if (reference.includes("/node_modules/")) continue;
    const absolute = resolveLocalReference(filePath, reference);
    localReferenceCount.set(reference, (localReferenceCount.get(reference) ?? 0) + 1);
    if (!existsSync(absolute)) {
      if (path.extname(reference).toLowerCase() === ".framercms" && cmsBasenames.has(path.basename(reference))) {
        continue;
      }
      missingLocalReferences.push({
        file: relativeFile,
        reference,
        resolved: path.relative(rootDir, absolute),
      });
    }
  }
}

for (const filePath of cmsFiles) {
  const text = (await readFile(filePath)).toString("latin1");
  const relativeFile = path.relative(rootDir, filePath);

  for (const pattern of videoPatterns) {
    for (const match of text.matchAll(pattern)) {
      const url = cleanUrl(match[0]);
      const foundIn = cmsVideoUrls.get(url) ?? new Set();
      foundIn.add(relativeFile);
      cmsVideoUrls.set(url, foundIn);
    }
  }
}

const fileTypeCounts = {};
let totalBytes = 0;
for (const filePath of files) {
  const info = await stat(filePath);
  totalBytes += info.size;
  const ext = path.extname(filePath).toLowerCase() || "[no extension]";
  fileTypeCounts[ext] = (fileTypeCounts[ext] ?? 0) + 1;
}

const externalUrls = [...allExternalUrls.entries()]
  .map(([url, foundIn]) => ({ url, foundIn: [...foundIn].sort() }))
  .sort((a, b) => a.url.localeCompare(b.url));

const report = {
  auditedAt: new Date().toISOString(),
  rootDir,
  fileCount: files.length,
  totalBytes,
  totalMegabytes: Number((totalBytes / 1024 / 1024).toFixed(2)),
  fileTypeCounts,
  externalUrlCount: externalUrls.length,
  externalUrls,
  videoUrlCount: videoUrls.size,
  videoUrls: [...videoUrls.entries()]
    .map(([url, foundIn]) => ({ url, foundIn: [...foundIn].sort() }))
    .sort((a, b) => a.url.localeCompare(b.url)),
  cmsVideoUrlCount: cmsVideoUrls.size,
  cmsVideoUrls: [...cmsVideoUrls.entries()]
    .map(([url, foundIn]) => ({ url, foundIn: [...foundIn].sort() }))
    .sort((a, b) => a.url.localeCompare(b.url)),
  localReferenceCount: [...localReferenceCount.values()].reduce((sum, count) => sum + count, 0),
  missingLocalReferenceCount: missingLocalReferences.length,
  missingLocalReferences,
};

await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`);

console.log(JSON.stringify({
  fileCount: report.fileCount,
  totalMegabytes: report.totalMegabytes,
  fileTypeCounts: report.fileTypeCounts,
  externalUrlCount: report.externalUrlCount,
  videoUrlCount: report.videoUrlCount,
  cmsVideoUrlCount: report.cmsVideoUrlCount,
  missingLocalReferenceCount: report.missingLocalReferenceCount,
  reportPath,
}, null, 2));
