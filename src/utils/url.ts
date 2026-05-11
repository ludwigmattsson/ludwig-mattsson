export function withBase(path = "") {
  if (!path) return "";
  if (/^(https?:|mailto:|tel:)/.test(path)) return path;

  const base = import.meta.env.BASE_URL || "/";
  const cleanBase = base.endsWith("/") ? base : `${base}/`;
  const cleanPath = path.replace(/^\.\//, "").replace(/^\//, "");

  if (cleanPath === "") return cleanBase;
  return `${cleanBase}${cleanPath}`;
}

export function srcsetWithBase(srcset = "") {
  return srcset
    .split(",")
    .map((part) => {
      const [url, width] = part.trim().split(/\s+/, 2);
      if (!url) return "";
      return [withBase(url), width].filter(Boolean).join(" ");
    })
    .filter(Boolean)
    .join(", ");
}
