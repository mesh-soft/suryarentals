import http from "node:http";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const configPath = path.join(root, "config", "site.json");
const editorPath = path.join(root, "tools", "config-editor.html");
const port = Number(process.env.PORT || 4180);

const send = (response, status, body, type = "text/plain; charset=utf-8") => {
  response.writeHead(status, {
    "content-type": type,
    "cache-control": "no-store"
  });
  response.end(body);
};

const readBody = async (request) => {
  const chunks = [];
  for await (const chunk of request) chunks.push(chunk);
  return Buffer.concat(chunks).toString("utf8");
};

const normalizeConfig = (value) => {
  if (!value || typeof value !== "object") throw new Error("Config must be a JSON object.");
  for (const key of ["site", "booking", "trustBadges", "packages", "testimonials", "faq"]) {
    if (!(key in value)) throw new Error(`Missing top-level key: ${key}`);
  }
  if (!Array.isArray(value.packages?.cars)) throw new Error("packages.cars must be an array.");
  if (!Array.isArray(value.testimonials)) throw new Error("testimonials must be an array.");
  if (!Array.isArray(value.faq)) throw new Error("faq must be an array.");
  return `${JSON.stringify(value, null, 2)}\n`;
};

const server = http.createServer(async (request, response) => {
  try {
    const url = new URL(request.url, `http://localhost:${port}`);

    if (url.pathname === "/" || url.pathname === "/editor") {
      return send(response, 200, await fs.readFile(editorPath, "utf8"), "text/html; charset=utf-8");
    }

    if (url.pathname === "/api/site-config" && request.method === "GET") {
      return send(response, 200, await fs.readFile(configPath, "utf8"), "application/json; charset=utf-8");
    }

    if (url.pathname === "/api/site-config" && request.method === "POST") {
      const parsed = JSON.parse(await readBody(request));
      await fs.writeFile(configPath, normalizeConfig(parsed));
      return send(response, 200, JSON.stringify({ ok: true }), "application/json; charset=utf-8");
    }

    return send(response, 404, "Not found");
  } catch (error) {
    return send(response, 400, JSON.stringify({ error: error.message }), "application/json; charset=utf-8");
  }
});

server.listen(port, "127.0.0.1", () => {
  console.log(`Config editor: http://127.0.0.1:${port}`);
});
