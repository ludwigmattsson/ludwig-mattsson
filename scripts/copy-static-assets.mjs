import { cpSync, existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const dist = resolve(root, "dist");
const sourceAssets = resolve(root, "assets");
const targetAssets = resolve(dist, "assets");

if (!existsSync(dist)) {
  throw new Error("Expected Astro to create dist before copying static assets.");
}

if (existsSync(targetAssets)) {
  rmSync(targetAssets, { recursive: true, force: true });
}

mkdirSync(dist, { recursive: true });
cpSync(sourceAssets, targetAssets, { recursive: true });
writeFileSync(resolve(dist, ".nojekyll"), "");
