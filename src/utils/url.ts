export function withBase(path = "") {
  if (!path) return "";
  if (/^(https?:|mailto:|tel:)/.test(path)) return path;

  const base = import.meta.env.BASE_URL || "/";
  const cleanBase = base.endsWith("/") ? base : `${base}/`;
  const cleanPath = path.replace(/^\.\//, "").replace(/^\//, "");

  if (cleanPath === "") return cleanBase;
  return `${cleanBase}${cleanPath}`;
}
