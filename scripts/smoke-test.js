"use strict";

const fs = require("node:fs");
const { spawn, spawnSync } = require("node:child_process");
const path = require("node:path");
const os = require("node:os");

const projectDir = path.resolve(__dirname, "..");
const dataRoot = fs.mkdtempSync(path.join(os.tmpdir(), "reputation-smoke-"));
const dataDir = path.join(dataRoot, "responses");
const journalDir = path.join(dataRoot, "journal");
const port = 39123;
const baseUrl = `http://127.0.0.1:${port}`;
const credentials = Buffer.from("analytics:local-test-only").toString("base64");
let server;

async function waitForServer() {
  for (let attempt = 0; attempt < 30; attempt += 1) {
    try {
      const response = await fetch(`${baseUrl}/health`);
      if (response.ok) return;
    } catch {
      // The process is still starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error("Server did not start");
}

async function main() {
  try {
    const seeded = spawnSync(process.execPath, ["scripts/seed-test-responses.js"], {
      cwd: projectDir,
      env: { ...process.env, DATA_DIR: dataDir },
      encoding: "utf8",
    });
    if (seeded.status !== 0) {
      throw new Error(`Unable to prepare smoke data: ${seeded.stderr || seeded.stdout}`);
    }

    server = spawn(process.execPath, ["server.js"], {
      cwd: projectDir,
      env: {
        ...process.env,
        DATA_DIR: dataDir,
        JOURNAL_DIR: journalDir,
        PORT: String(port),
        ANALYTICS_USER: "analytics",
        ANALYTICS_PASSWORD: "local-test-only",
      },
      stdio: ["ignore", "pipe", "pipe"],
    });

    await waitForServer();
    const unauthorized = await fetch(`${baseUrl}/analytics/`);
    const headers = { Authorization: `Basic ${credentials}` };
    const dashboard = await fetch(`${baseUrl}/analytics/`, { headers });
    const api = await fetch(`${baseUrl}/api/analytics/responses`, { headers });
    const payload = await api.json();
    const survey = await fetch(`${baseUrl}/`);
    const font = await fetch(`${baseUrl}/assets/fonts/manrope-cyrillic.woff2`);
    const fontBytes = (await font.arrayBuffer()).byteLength;
    const contentSecurityPolicy = survey.headers.get("content-security-policy") || "";

    const result = {
      unauthorized: unauthorized.status,
      dashboard: dashboard.status,
      api: api.status,
      records: payload.total,
      testRecords: payload.records?.filter((record) => record.isTest).length,
      survey: survey.status,
      font: font.status,
      fontType: font.headers.get("content-type"),
      fontBytes,
      fontPolicy: contentSecurityPolicy.includes("font-src 'self'"),
    };
    if (
      result.unauthorized !== 401
      || result.dashboard !== 200
      || result.api !== 200
      || result.records !== 50
      || result.testRecords !== 50
      || result.survey !== 200
      || result.font !== 200
      || result.fontType !== "font/woff2"
      || result.fontBytes < 10_000
      || !result.fontPolicy
    ) {
      throw new Error(`Smoke test failed: ${JSON.stringify(result)}`);
    }
    console.log(JSON.stringify({ ok: true, ...result }));
  } finally {
    server?.kill();
    fs.rmSync(dataRoot, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
