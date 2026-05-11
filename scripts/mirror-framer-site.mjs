import { createHash } from "node:crypto";
import { copyFile, mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";

const rootDir = path.resolve(new URL("..", import.meta.url).pathname);
const indexPath = path.join(rootDir, "index.html");
const assetDir = path.join(rootDir, "assets");
const sourceUrl = "https://ludwigmattsson.com/";

const mirrorHosts = new Set([
  "framerusercontent.com",
  "fonts.gstatic.com",
]);

const skippedHosts = new Set([
  "framer.com",
  "events.framer.com",
]);

const urlPattern = /https?:\/\/[^\s"'<>),\\`\]}]+/g;
const importPattern = /(?:import\s*\(\s*|from\s*|import\s*)["'`]([^"'`]+)["'`]/g;
const cssUrlPattern = /url\(\s*["']?([^"')]+)["']?\s*\)/g;
const absoluteFramerCmsPattern = /new URL\(`\.\/([^`]+\.framercms)`,`(https:\/\/framerusercontent\.com\/modules\/[^`]+)`\)/g;
const relativeFramerCmsPattern = /new URL\(`\.\/([^`]+\.framercms)`,new URL\(`((?:\.\.\/)+modules\/[^`]+)`,import\.meta\.url\)\.href\)/g;

const queue = [];
const records = new Map();
const fetchUrlToRecord = new Map();
const textFiles = new Set();
const failed = [];

function decodeHtml(value) {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&#38;/g, "&")
    .replace(/&quot;/g, '"');
}

function normalizeUrl(rawUrl, baseUrl) {
  const decoded = decodeHtml(rawUrl).replace(/\\+$/g, "");
  try {
    return new URL(decoded, baseUrl).href;
  } catch {
    return null;
  }
}

function isMirrorable(url) {
  try {
    const host = new URL(url).hostname;
    return mirrorHosts.has(host);
  } catch {
    return false;
  }
}

function shouldSkip(url) {
  try {
    const host = new URL(url).hostname;
    return skippedHosts.has(host);
  } catch {
    return true;
  }
}

function hashUrl(url) {
  return createHash("sha1").update(url).digest("hex").slice(0, 10);
}

function localAssetPath(fetchUrl) {
  const parsed = new URL(fetchUrl);
  const dir = path.join(assetDir, parsed.hostname, path.dirname(parsed.pathname));
  const ext = path.extname(parsed.pathname);
  const base = path.basename(parsed.pathname, ext) || "asset";
  const suffix = parsed.search ? `-${hashUrl(fetchUrl)}` : "";
  return path.join(dir, `${base}${suffix}${ext || ".bin"}`);
}

function enqueue(rawUrl, baseUrl = "https://ludwigmattsson.com/") {
  const fetchUrl = normalizeUrl(rawUrl, baseUrl);
  if (!fetchUrl || !isMirrorable(fetchUrl) || shouldSkip(fetchUrl)) return;
  const parsed = new URL(fetchUrl);
  if (parsed.pathname === "/" && !parsed.search) return;

  const localPath = localAssetPath(fetchUrl);
  const existing = fetchUrlToRecord.get(fetchUrl);
  if (existing) {
    existing.rawUrls.add(rawUrl);
    return;
  }

  const record = {
    fetchUrl,
    localPath,
    rawUrls: new Set([rawUrl, fetchUrl]),
    contentType: "",
    text: null,
    ok: false,
  };

  fetchUrlToRecord.set(fetchUrl, record);
  records.set(fetchUrl, record);
  queue.push(record);
}

function collectAbsoluteUrls(text, baseUrl) {
  for (const match of text.matchAll(urlPattern)) {
    enqueue(match[0], baseUrl);
  }
}

function collectRelativeReferences(text, baseUrl) {
  const collect = (pattern) => {
    for (const match of text.matchAll(pattern)) {
      const specifier = match[1];
      if (!specifier || specifier.startsWith("data:") || specifier.startsWith("#")) {
        continue;
      }

      if (/^https?:\/\//.test(specifier)) {
        enqueue(specifier, baseUrl);
      } else if (specifier.startsWith("./") || specifier.startsWith("../") || specifier.startsWith("/")) {
        enqueue(specifier, baseUrl);
      }
    }
  };

  collect(importPattern);
  collect(cssUrlPattern);
}

function enqueueFramerCmsFile(cmsFile, moduleBase) {
  const cmsUrl = new URL(`./${cmsFile}`, moduleBase).href.replace("/modules/", "/cms/");
  enqueue(cmsUrl, moduleBase);
}

function collectFramerCmsUrls(text, baseUrl) {
  for (const match of text.matchAll(absoluteFramerCmsPattern)) {
    const [, cmsFile, moduleBase] = match;
    enqueueFramerCmsFile(cmsFile, moduleBase);
  }

  for (const match of text.matchAll(relativeFramerCmsPattern)) {
    const [, cmsFile, moduleBase] = match;
    enqueueFramerCmsFile(cmsFile, new URL(moduleBase, baseUrl).href);
  }
}

function isLikelyText(record, buffer) {
  const ext = path.extname(new URL(record.fetchUrl).pathname).toLowerCase();
  if (ext === ".framercms") return false;
  if ([".mjs", ".js", ".json", ".css", ".html", ".svg", ".txt"].includes(ext)) return true;
  if (/text|json|javascript|ecmascript|svg|css/.test(record.contentType)) return true;
  return buffer.slice(0, 64).every((byte) => byte === 9 || byte === 10 || byte === 13 || (byte >= 32 && byte <= 126));
}

function relativeFromFile(filePath, targetPath) {
  let relative = path.relative(path.dirname(filePath), targetPath).split(path.sep).join("/");
  if (!relative.startsWith(".")) relative = `./${relative}`;
  return relative;
}

function replacementVariants(record) {
  const variants = new Set(record.rawUrls);
  variants.add(record.fetchUrl);
  variants.add(record.fetchUrl.replace(/&/g, "&amp;"));
  variants.add(record.fetchUrl.replace(/\//g, "\\/"));
  variants.add(record.fetchUrl.replace(/&/g, "\\u0026"));
  variants.add(record.fetchUrl.replace(/&/g, "&amp;").replace(/\//g, "\\/"));
  return [...variants].sort((a, b) => b.length - a.length);
}

function replaceUrls(text, filePath) {
  let rewritten = text;
  for (const record of records.values()) {
    if (!record.ok) continue;
    const relative = relativeFromFile(filePath, record.localPath);
    for (const variant of replacementVariants(record)) {
      rewritten = rewritten.split(variant).join(relative);
    }
  }
  return postProcessText(rewritten);
}

function postProcessText(text) {
  return patchFramerCmsRangeFallback(text)
    .replace(/<script>try\{if\(localStorage\.get\("__framer_force_showing_editorbar_since"\)\)[\s\S]*?<\/script>\s*/g, "")
    .replace(
      /EditorBar:s===void 0\?void 0:\(\(\)=>\{if\(q\)\{console\.log\(`\[Framer On-Page Editing\][\s\S]*?\}\)\}\)\(\),adaptLayoutToTextDirection/g,
      "EditorBar:void 0,adaptLayoutToTextDirection"
    )
    .replace(
      /new URL\(`\.\/([^`]+\.framercms)`,`((?:\.\.\/)+modules\/[^`]+)`\)/g,
      "new URL(`./$1`,new URL(`$2`,import.meta.url).href)"
    )
    .replace(/<script\b(?=[^>]*\bsrc=["']https:\/\/framer\.com\/edit\/init\.mjs["'])[^>]*>\s*<\/script>/g, "")
    .replace(/<script\b(?=[^>]*\bsrc=["']https:\/\/events\.framer\.com\/script\?v=2["'])[^>]*>\s*<\/script>/g, "")
    .replace(/<link\b(?=[^>]*\bhref=["']https:\/\/fonts\.gstatic\.com["'])(?=[^>]*\brel=["']preconnect["'])[^>]*>/g, "")
    .replace(/instagramcom\/ludwigmattsson/g, "https://instagram.com/ludwigmattsson")
    .replace(/https:\/\/https:\/\/instagram\.com\/ludwigmattsson/g, "https://instagram.com/ludwigmattsson");
}

function patchFramerCmsRangeFallback(text) {
  return text
    .replace(
      "if(l.length!==i)throw Error(`Request failed: Unexpected response length`);let u=new pn,d=0;for(let e of n){let t=e.to-e.from,n=d+t,r=l.subarray(d,n);u.write(e.from,r),d=n}return t.map(e=>u.read(e.from,e.to-e.from))",
      "let u=new pn,d=0;if(l.length===i){for(let e of n){let t=e.to-e.from,n=d+t,r=l.subarray(d,n);u.write(e.from,r),d=n}}else{let r=await fn(e);if(r.status!==200)throw Error(`Request failed: ${r.status} ${r.statusText}`);let i=new Uint8Array(await r.arrayBuffer());for(let e of n)u.write(e.from,i.subarray(e.from,e.to))}return t.map(e=>u.read(e.from,e.to-e.from))"
    )
    .replace(
      'if(l.length!==i)throw Error("Request failed: Unexpected response length");let h=new tT,c=0;for(let t of r){let e=t.to-t.from,r=c+e,n=l.subarray(c,r);h.write(t.from,n),c=r;}return e.map(t=>h.read(t.from,t.to-t.from));',
      'let h=new tT,c=0;if(l.length===i){for(let t of r){let e=t.to-t.from,r=c+e,n=l.subarray(c,r);h.write(t.from,n),c=r;}}else{let f=await tB(t);if(200!==f.status)throw Error(`Request failed: ${f.status} ${f.statusText}`);let y=new Uint8Array(await f.arrayBuffer());for(let t of r)h.write(t.from,y.subarray(t.from,t.to));}return e.map(t=>h.read(t.from,t.to-t.from));'
    );
}

async function listFiles(dir) {
  try {
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
  } catch {
    return [];
  }
}

function isTextPath(filePath) {
  return [".html", ".css", ".js", ".mjs", ".json", ".svg", ".txt"].includes(path.extname(filePath).toLowerCase());
}

function sourceUrlForLocalAsset(filePath) {
  const relative = path.relative(assetDir, filePath).split(path.sep).join("/");
  const [host, ...rest] = relative.split("/");
  if (!mirrorHosts.has(host) || rest.length === 0) return null;
  return `https://${host}/${rest.join("/")}`;
}

async function seedExistingLocalTextAssets() {
  const files = await listFiles(assetDir);
  for (const filePath of files.filter(isTextPath)) {
    const baseUrl = sourceUrlForLocalAsset(filePath);
    if (!baseUrl) continue;
    const text = await readFile(filePath, "utf8");
    textFiles.add(filePath);
    collectAbsoluteUrls(text, baseUrl);
    collectRelativeReferences(text, baseUrl);
    collectFramerCmsUrls(text, baseUrl);
  }
}

async function fetchLiveIndex() {
  try {
    const response = await fetch(sourceUrl, {
      headers: {
        "user-agent": "Mozilla/5.0 static mirror",
      },
      redirect: "follow",
    });
    if (!response.ok) {
      throw new Error(`${response.status} ${response.statusText}`);
    }
    const text = await response.text();
    await writeFile(indexPath, text);
    return text;
  } catch (error) {
    console.warn(`Could not refresh live index, using current local copy: ${error.message}`);
    return readFile(indexPath, "utf8");
  }
}

async function downloadRecord(record) {
  const ext = path.extname(new URL(record.fetchUrl).pathname).toLowerCase();
  if (ext !== ".framercms") {
    try {
      const cached = await readFile(record.localPath);
      if (cached.length > 0) {
        if (isLikelyText(record, cached)) {
          const text = cached.toString("utf8");
          record.text = text;
          textFiles.add(record.localPath);
          collectAbsoluteUrls(text, record.fetchUrl);
          collectRelativeReferences(text, record.fetchUrl);
          collectFramerCmsUrls(text, record.fetchUrl);
        }
        record.ok = true;
        return;
      }
    } catch {
      // Cache miss; fetch it below.
    }
  }

  const response = await fetch(record.fetchUrl, {
    headers: {
      "user-agent": "Mozilla/5.0 static mirror",
    },
    redirect: "follow",
  });

  if (!response.ok) {
    throw new Error(`${response.status} ${response.statusText}`);
  }

  record.contentType = response.headers.get("content-type") || "";
  const buffer = Buffer.from(await response.arrayBuffer());
  await mkdir(path.dirname(record.localPath), { recursive: true });

  if (isLikelyText(record, buffer)) {
    const text = buffer.toString("utf8");
    record.text = text;
    textFiles.add(record.localPath);
    collectAbsoluteUrls(text, record.fetchUrl);
    collectRelativeReferences(text, record.fetchUrl);
    collectFramerCmsUrls(text, record.fetchUrl);
    await writeFile(record.localPath, text);
  } else {
    await writeFile(record.localPath, buffer);
  }
  record.ok = true;
}

let indexHtml = await fetchLiveIndex();
collectAbsoluteUrls(indexHtml, sourceUrl);
collectRelativeReferences(indexHtml, sourceUrl);
collectFramerCmsUrls(indexHtml, sourceUrl);
textFiles.add(indexPath);
await seedExistingLocalTextAssets();

for (let i = 0; i < queue.length; i += 1) {
  const record = queue[i];
  try {
    await downloadRecord(record);
    const downloaded = i + 1;
    if (downloaded % 25 === 0 || downloaded === queue.length) {
      console.log(`Downloaded ${downloaded}/${queue.length}`);
    }
  } catch (error) {
    failed.push({ url: record.fetchUrl, error: error.message });
  }
}

for (const filePath of textFiles) {
  const text = await readFile(filePath, "utf8");
  await writeFile(filePath, replaceUrls(text, filePath));
}

const readme = [
  "# Ludwig Mattsson static site",
  "",
  "This folder is a static mirror of https://ludwigmattsson.com for GitHub Pages.",
  "",
  "Deploy the contents of this directory as the site root. `index.html` is the entry point and local assets live under `assets/`.",
  "",
  "`CNAME` is set to `ludwigmattsson.com`. If you deploy under a `github.io` URL instead, remove `CNAME` and add that GitHub Pages domain to any Vimeo embed/domain allowlists.",
  "",
  "The original Framer analytics/editor URLs are intentionally left external or inactive because they are not needed for the public static site.",
  "",
].join("\n");
await writeFile(path.join(rootDir, "README.md"), readme);
await writeFile(path.join(rootDir, "CNAME"), "ludwigmattsson.com\n");

const nojekyll = "";
await writeFile(path.join(rootDir, ".nojekyll"), nojekyll);
const fallbackPath = path.join(rootDir, "404.html");
await copyFile(indexPath, fallbackPath);
const fallbackHtml = await readFile(fallbackPath, "utf8");
await writeFile(
  fallbackPath,
  fallbackHtml.replace(/\sdata-framer-hydrate-v2="[^"]*"/, "")
);

const manifest = {
  source: "https://ludwigmattsson.com/",
  mirroredAt: new Date().toISOString(),
  assetCount: records.size,
  mirroredAssetCount: [...records.values()].filter((record) => record.ok).length,
  failed,
};
await writeFile(path.join(rootDir, "mirror-manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);

console.log(`Mirrored ${[...records.values()].filter((record) => record.ok).length}/${records.size} assets.`);
if (failed.length > 0) {
  console.log("Failed assets:");
  for (const item of failed) {
    console.log(`- ${item.url}: ${item.error}`);
  }
}
