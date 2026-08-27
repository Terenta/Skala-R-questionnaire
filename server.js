"use strict";

const http = require("node:http");
const fs = require("node:fs/promises");
const path = require("node:path");
const crypto = require("node:crypto");

const PORT = Number(process.env.PORT || 3000);
const DATA_DIR = path.resolve(process.env.DATA_DIR || "/data/responses");
const JOURNAL_DIR = path.resolve(process.env.JOURNAL_DIR || path.join(DATA_DIR, "..", "journal"));
const PUBLIC_DIR = path.join(__dirname, "public");
const MAX_BODY_BYTES = 320 * 1024;
const ANALYTICS_USER = String(process.env.ANALYTICS_USER || "");
const ANALYTICS_PASSWORD = String(process.env.ANALYTICS_PASSWORD || "");
const responseWriteQueues = new Map();
let journalWriteQueue = Promise.resolve();

const MIME_TYPES = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".txt": "text/plain; charset=utf-8",
  ".woff2": "font/woff2",
};

function commonHeaders() {
  return {
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "Referrer-Policy": "no-referrer",
    "Permissions-Policy": "camera=(), microphone=(), geolocation=(), payment=()",
    "Content-Security-Policy": "default-src 'self'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'; img-src 'self' data:; font-src 'self'; style-src 'self'; script-src 'self'; connect-src 'self'",
  };
}

function sendJson(res, statusCode, body) {
  const serialized = JSON.stringify(body);
  res.writeHead(statusCode, {
    ...commonHeaders(),
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "Content-Length": Buffer.byteLength(serialized),
  });
  res.end(serialized);
}

function sendError(res, statusCode, message) {
  sendJson(res, statusCode, { error: message });
}

function safeEqual(left, right) {
  const a = Buffer.from(String(left));
  const b = Buffer.from(String(right));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function hasAnalyticsAccess(req) {
  if (!ANALYTICS_USER || !ANALYTICS_PASSWORD) return false;
  const authorization = String(req.headers.authorization || "");
  if (!authorization.startsWith("Basic ")) return false;

  try {
    const decoded = Buffer.from(authorization.slice(6), "base64").toString("utf8");
    const separator = decoded.indexOf(":");
    if (separator < 0) return false;
    return safeEqual(decoded.slice(0, separator), ANALYTICS_USER)
      && safeEqual(decoded.slice(separator + 1), ANALYTICS_PASSWORD);
  } catch {
    return false;
  }
}

function requestAnalyticsAccess(res) {
  const message = "Требуется авторизация";
  res.writeHead(401, {
    ...commonHeaders(),
    "WWW-Authenticate": 'Basic realm="Reputation analytics", charset="UTF-8"',
    "Content-Type": "text/plain; charset=utf-8",
    "Cache-Control": "no-store",
    "Content-Length": Buffer.byteLength(message),
  });
  res.end(message);
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isResponseId(value) {
  return typeof value === "string" && /^[a-zA-Z0-9_-]{20,96}$/.test(value);
}

function safeStatus(value) {
  return ["in_progress", "completed", "screened_out"].includes(value)
    ? value
    : "in_progress";
}

function safeRevision(value) {
  const revision = Number(value);
  return Number.isSafeInteger(revision) && revision >= 0 ? revision : 0;
}

function safeSchemaVersion(value, fallback = 1) {
  const version = Number(value);
  return Number.isSafeInteger(version) && version >= 1 && version <= 100 ? version : fallback;
}

function readJson(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];

    req.on("data", (chunk) => {
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        reject(Object.assign(new Error("Слишком большой запрос"), { statusCode: 413 }));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });

    req.on("end", () => {
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString("utf8")));
      } catch {
        reject(Object.assign(new Error("Ожидался JSON"), { statusCode: 400 }));
      }
    });

    req.on("error", reject);
  });
}

async function loadExistingRecord(filePath) {
  try {
    return JSON.parse(await fs.readFile(filePath, "utf8"));
  } catch (error) {
    if (error && error.code === "ENOENT") return null;
    throw error;
  }
}

function withResponseLock(id, operation) {
  const previous = responseWriteQueues.get(id) || Promise.resolve();
  const current = previous.catch(() => undefined).then(operation);
  responseWriteQueues.set(id, current);
  return current.finally(() => {
    if (responseWriteQueues.get(id) === current) responseWriteQueues.delete(id);
  });
}

async function writeFileDurably(filePath, content) {
  const handle = await fs.open(filePath, "wx", 0o600);
  try {
    await handle.writeFile(content, { encoding: "utf8" });
    await handle.sync();
  } finally {
    await handle.close();
  }
}

async function appendFileDurably(filePath, content) {
  const handle = await fs.open(filePath, "a", 0o600);
  try {
    await handle.writeFile(content, { encoding: "utf8" });
    await handle.sync();
  } finally {
    await handle.close();
  }
}

async function syncDirectory(directoryPath) {
  if (process.platform === "win32") return;

  let handle;
  try {
    handle = await fs.open(directoryPath, "r");
    await handle.sync();
  } catch (error) {
    if (!["EINVAL", "ENOTSUP", "EPERM"].includes(error?.code)) throw error;
  } finally {
    await handle?.close();
  }
}

function appendJournal(record) {
  const fileName = `${String(record.updatedAt).slice(0, 10)}.ndjson`;
  const line = `${JSON.stringify(record)}\n`;
  const operation = journalWriteQueue
    .catch(() => undefined)
    .then(() => appendFileDurably(path.join(JOURNAL_DIR, fileName), line));
  journalWriteQueue = operation;
  return operation;
}

async function saveResponseUnlocked(id, payload) {
  if (!isPlainObject(payload) || !isPlainObject(payload.answers)) {
    throw Object.assign(new Error("Некорректная структура анкеты"), { statusCode: 400 });
  }

  const filePath = path.join(DATA_DIR, `${id}.json`);
  const existing = await loadExistingRecord(filePath);
  const incomingRevision = safeRevision(payload.revision);

  // A retried older request must never overwrite a newer answer.
  if (existing && safeRevision(existing.revision) >= incomingRevision) {
    return existing;
  }

  const now = new Date().toISOString();
  const record = {
    schemaVersion: safeSchemaVersion(payload.schemaVersion, safeSchemaVersion(existing?.schemaVersion, 1)),
    id,
    createdAt: existing?.createdAt || now,
    updatedAt: now,
    revision: incomingRevision,
    status: safeStatus(payload.status),
    answers: payload.answers,
    ...((existing?.isTest || id.startsWith("test-"))
      ? { isTest: true, testBatch: existing?.testBatch || "stability-test" }
      : {}),
  };

  const tempPath = path.join(
    DATA_DIR,
    `.${id}.${crypto.randomBytes(8).toString("hex")}.tmp`,
  );

  try {
    await writeFileDurably(tempPath, `${JSON.stringify(record, null, 2)}\n`);
    await appendJournal(record);
    await fs.rename(tempPath, filePath);
    await syncDirectory(DATA_DIR);
    return record;
  } catch (error) {
    await fs.rm(tempPath, { force: true }).catch(() => undefined);
    throw error;
  }
}

function saveResponse(id, payload) {
  return withResponseLock(id, () => saveResponseUnlocked(id, payload));
}

async function readAllResponses() {
  const entries = await fs.readdir(DATA_DIR, { withFileTypes: true });
  const records = [];
  let skipped = 0;

  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith(".json") || entry.name.startsWith(".")) continue;
    try {
      const record = JSON.parse(await fs.readFile(path.join(DATA_DIR, entry.name), "utf8"));
      if (isPlainObject(record) && isPlainObject(record.answers) && isResponseId(record.id)) {
        records.push(record);
      } else {
        skipped += 1;
      }
    } catch {
      skipped += 1;
    }
  }

  records.sort((left, right) => String(right.updatedAt || "").localeCompare(String(left.updatedAt || "")));
  return { records, skipped };
}

async function serveStatic(req, res, pathname) {
  let decoded;
  try {
    decoded = decodeURIComponent(pathname);
  } catch {
    sendError(res, 400, "Некорректный путь");
    return;
  }

  const requested = decoded === "/"
    ? "/index.html"
    : ["/analytics", "/analytics/"].includes(decoded)
      ? "/analytics/index.html"
      : decoded;
  const normalized = path.normalize(requested).replace(/^[\\/]+/, "");
  const filePath = path.resolve(PUBLIC_DIR, normalized);

  if (!filePath.startsWith(`${PUBLIC_DIR}${path.sep}`)) {
    sendError(res, 403, "Доступ запрещён");
    return;
  }

  try {
    const stat = await fs.stat(filePath);
    if (!stat.isFile()) throw Object.assign(new Error("Not found"), { code: "ENOENT" });

    const extension = path.extname(filePath).toLowerCase();
    res.writeHead(200, {
      ...commonHeaders(),
      "Content-Type": MIME_TYPES[extension] || "application/octet-stream",
      // The questionnaire is deployed frequently. Never let an older JS/CSS build
      // outlive the HTML shell, otherwise the form can fail before its first render.
      "Cache-Control": [".html", ".css", ".js"].includes(extension)
        ? "no-store"
        : "public, max-age=3600",
      "Content-Length": stat.size,
    });

    if (req.method !== "HEAD") {
      const content = await fs.readFile(filePath);
      res.end(content);
    } else {
      res.end();
    }
  } catch (error) {
    if (error && error.code === "ENOENT") {
      sendError(res, 404, "Страница не найдена");
      return;
    }
    throw error;
  }
}

async function handleRequest(req, res) {
  const origin = `http://${req.headers.host || "localhost"}`;
  const url = new URL(req.url || "/", origin);

  if (req.method === "GET" && url.pathname === "/health") {
    await Promise.all([fs.access(DATA_DIR, 6), fs.access(JOURNAL_DIR, 6)]);
    sendJson(res, 200, { ok: true, storage: "writable" });
    return;
  }

  const analyticsRoute = url.pathname === "/analytics"
    || url.pathname.startsWith("/analytics/")
    || url.pathname.startsWith("/api/analytics/");

  if (analyticsRoute) {
    if (!ANALYTICS_USER || !ANALYTICS_PASSWORD) {
      sendError(res, 503, "Панель аналитики не настроена");
      return;
    }
    if (!hasAnalyticsAccess(req)) {
      requestAnalyticsAccess(res);
      return;
    }
  }

  if (req.method === "GET" && url.pathname === "/api/analytics/responses") {
    const { records, skipped } = await readAllResponses();
    sendJson(res, 200, {
      generatedAt: new Date().toISOString(),
      total: records.length,
      skipped,
      records,
    });
    return;
  }

  const responseMatch = url.pathname.match(/^\/api\/responses\/([a-zA-Z0-9_-]{20,96})$/);
  if (req.method === "PUT" && responseMatch) {
    const id = responseMatch[1];
    if (!isResponseId(id)) {
      sendError(res, 400, "Некорректный идентификатор анкеты");
      return;
    }

    const payload = await readJson(req);
    const saved = await saveResponse(id, payload);
    sendJson(res, 200, {
      ok: true,
      revision: saved.revision,
      updatedAt: saved.updatedAt,
    });
    return;
  }

  if (req.method === "GET" || req.method === "HEAD") {
    await serveStatic(req, res, url.pathname);
    return;
  }

  sendError(res, 405, "Метод не поддерживается");
}

async function start() {
  await fs.mkdir(DATA_DIR, { recursive: true, mode: 0o700 });
  await fs.mkdir(JOURNAL_DIR, { recursive: true, mode: 0o700 });
  await Promise.all([fs.chmod(DATA_DIR, 0o700), fs.chmod(JOURNAL_DIR, 0o700)]);

  const server = http.createServer((req, res) => {
    handleRequest(req, res).catch((error) => {
      console.error("request_failed", error);
      if (!res.headersSent) {
        sendError(res, error?.statusCode || 500, "Не удалось сохранить ответ");
      } else {
        res.destroy();
      }
    });
  });

  server.listen(PORT, "0.0.0.0", () => {
    console.log(`Reputation survey listening on :${PORT}`);
  });

  const shutdown = (signal) => {
    console.log(`shutdown_${signal.toLowerCase()}`);
    server.close((error) => {
      process.exit(error ? 1 : 0);
    });
    windowlessShutdownTimer = setTimeout(() => process.exit(1), 12000);
    windowlessShutdownTimer.unref();
  };
  let windowlessShutdownTimer;
  process.once("SIGTERM", () => shutdown("SIGTERM"));
  process.once("SIGINT", () => shutdown("SIGINT"));
}

start().catch((error) => {
  console.error("startup_failed", error);
  process.exit(1);
});
