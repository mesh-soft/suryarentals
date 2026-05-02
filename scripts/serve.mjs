import http from "node:http";
import fs from "node:fs/promises";
import fsSync from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "./generate-site.mjs";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const root = path.join(projectRoot, "dist");
let port = Number(process.env.PORT || 4173);
const types = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".xml": "application/xml; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".svg": "image/svg+xml"
};

let buildTimer;
let building = Promise.resolve();

const queueBuild = () => {
  clearTimeout(buildTimer);
  buildTimer = setTimeout(() => {
    building = building
      .then(() => build())
      .catch((error) => console.error(`Build failed: ${error.message}`));
  }, 120);
};

await build();

fsSync.watch(path.join(projectRoot, "config", "site.json"), queueBuild);
fsSync.watch(path.join(projectRoot, "assets"), { recursive: true }, queueBuild);

const server = http.createServer(async (request, response) => {
  try {
    await building;
    const url = new URL(request.url, `http://localhost:${port}`);
    const pathname = decodeURIComponent(url.pathname);
    const relativePath = pathname.replace(/^[/\\]+/, "");
    const normalizedPath = path.normalize(relativePath);
    const cleanPath = (normalizedPath === "." ? "" : normalizedPath).replace(/^(\.\.(?:[/\\]|$))+/, "");
    const requested = path.resolve(root, cleanPath || "index.html");
    const rootPrefix = root.endsWith(path.sep) ? root : `${root}${path.sep}`;
    const filePath = requested === root || requested.startsWith(rootPrefix) ? requested : path.join(root, "index.html");
    const body = await fs.readFile(filePath);
    response.writeHead(200, { "content-type": types[path.extname(filePath)] || "application/octet-stream" });
    response.end(body);
  } catch {
    response.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
    response.end("Not found");
  }
});

const listen = () => {
  server.listen(port, () => {
    console.log(`Preview: http://127.0.0.1:${port}`);
    console.log("Watching config/site.json and assets for changes...");
  });
};

server.on("error", (error) => {
  if (error.code === "EADDRINUSE" && !process.env.PORT) {
    console.log(`Port ${port} is busy, trying ${port + 1}...`);
    port += 1;
    listen();
    return;
  }
  throw error;
});

listen();
