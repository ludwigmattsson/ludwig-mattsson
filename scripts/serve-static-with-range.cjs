const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");

const port = Number(process.argv[2] || 4175);
const rootDir = path.resolve(__dirname, "..", process.argv[3] || ".");
const basePath = (process.argv[4] || "").replace(/\/$/, "");

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".webp": "image/webp",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
};

function safePath(urlPath) {
  const decoded = decodeURIComponent(urlPath.split("?")[0]);
  const normalized = path.normalize(decoded).replace(/^(\.\.[/\\])+/, "");
  return path.join(rootDir, normalized);
}

function fileForRequest(req) {
  let pathname = new URL(req.url, "http://local").pathname;
  if (basePath && pathname.startsWith(`${basePath}/`)) {
    pathname = pathname.slice(basePath.length) || "/";
  } else if (basePath && pathname === basePath) {
    pathname = "/";
  }

  let requested = safePath(pathname);
  if (!requested.startsWith(rootDir)) return null;

  if (fs.existsSync(requested) && fs.statSync(requested).isDirectory()) {
    requested = path.join(requested, "index.html");
  }
  if (fs.existsSync(requested) && fs.statSync(requested).isFile()) {
    return { filePath: requested, status: 200 };
  }
  return { filePath: path.join(rootDir, "404.html"), status: 404 };
}

function sendFile(req, res, filePath, status) {
  const stat = fs.statSync(filePath);
  const ext = path.extname(filePath).toLowerCase();
  const type = mimeTypes[ext] || "application/octet-stream";
  const headers = {
    "Accept-Ranges": "bytes",
    "Content-Type": type,
    "Cache-Control": "no-store",
  };

  const range = req.headers.range;
  if (range) {
    const match = /^bytes=(\d*)-(\d*)$/.exec(range);
    if (!match) {
      res.writeHead(416, { "Content-Range": `bytes */${stat.size}` });
      res.end();
      return;
    }

    let start = match[1] === "" ? 0 : Number(match[1]);
    let end = match[2] === "" ? stat.size - 1 : Number(match[2]);
    if (Number.isNaN(start) || Number.isNaN(end) || start > end || start >= stat.size) {
      res.writeHead(416, { "Content-Range": `bytes */${stat.size}` });
      res.end();
      return;
    }
    end = Math.min(end, stat.size - 1);
    headers["Content-Range"] = `bytes ${start}-${end}/${stat.size}`;
    headers["Content-Length"] = end - start + 1;
    res.writeHead(206, headers);
    fs.createReadStream(filePath, { start, end }).pipe(res);
    return;
  }

  headers["Content-Length"] = stat.size;
  res.writeHead(status, headers);
  fs.createReadStream(filePath).pipe(res);
}

const server = http.createServer((req, res) => {
  const match = fileForRequest(req);
  if (!match) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }
  sendFile(req, res, match.filePath, match.status);
});

server.listen(port, "127.0.0.1", () => {
  console.log(`Serving ${rootDir} at http://127.0.0.1:${port}${basePath || ""}/`);
});
