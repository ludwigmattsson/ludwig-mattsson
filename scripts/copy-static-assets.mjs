import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { dirname, extname, join, relative, resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const dist = resolve(root, "dist");
const sourceAssets = resolve(root, "assets");
const targetAssets = resolve(dist, "assets");
const textExtensions = new Set([".html", ".css", ".js", ".mjs", ".json", ".svg", ".txt", ".xml"]);
const assetPattern = /(?:\/ludwig-mattsson)?(\/assets\/[^"'`\s)>,]+)/g;

if (!existsSync(dist)) {
  throw new Error("Expected Astro to create dist before copying static assets.");
}

function walkFiles(directory) {
  const files = [];

  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const absolute = join(directory, entry.name);

    if (entry.isDirectory()) {
      if (absolute === targetAssets) continue;
      files.push(...walkFiles(absolute));
    } else {
      files.push(absolute);
    }
  }

  return files;
}

function isTextFile(filePath) {
  return textExtensions.has(extname(filePath).toLowerCase());
}

function referencedAssets() {
  const references = new Set();

  for (const filePath of walkFiles(dist).filter(isTextFile)) {
    const text = readFileSync(filePath, "utf8");

    for (const match of text.matchAll(assetPattern)) {
      const assetPath = match[1].replace(/[?#].*$/, "");
      const sourcePath = join(root, assetPath.replace(/^\//, ""));

      if (existsSync(sourcePath) && statSync(sourcePath).isFile()) {
        references.add(sourcePath);
      }
    }
  }

  return [...references].sort();
}

if (existsSync(targetAssets)) {
  rmSync(targetAssets, { recursive: true, force: true });
}

mkdirSync(dist, { recursive: true });

let copiedBytes = 0;
const references = referencedAssets();

for (const sourcePath of references) {
  const assetRelativePath = relative(sourceAssets, sourcePath);
  const targetPath = join(targetAssets, assetRelativePath);

  mkdirSync(dirname(targetPath), { recursive: true });
  cpSync(sourcePath, targetPath);
  copiedBytes += statSync(sourcePath).size;
}

writeFileSync(resolve(dist, ".nojekyll"), "");

console.log(
  `Copied ${references.length} referenced asset files (${(copiedBytes / 1024 / 1024).toFixed(2)} MB).`
);
