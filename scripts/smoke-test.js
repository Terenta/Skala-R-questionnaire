"use strict";

const { spawn } = require("node:child_process");
const path = require("node:path");
const os = require("node:os");

const projectDir = path.resolve(__dirname, "..");
const dataDir = process.env.SMOKE_DATA_DIR || path.join(os.tmpdir(), "codex-reputation-analytics-smoke");
const port = 39123;
const baseUrl = `http://127.0.0.1:${port}`;
const credentials = Buffer.from("analytics:local-test-only").toString("base64");

const server = spawn(process.execPath, ["server.js"], {
  cwd: projectDir,
  env: {
    ...process.env,
    DATA_DIR: dataDir,
    PORT: String(port),
    ANALYTICS_USER: "analytics",
    ANALYTICS_PASSWORD: "local-test-only",
  },
  stdio: ["ignore", "pipe", "pipe"],
});

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
    await waitForServer();
    const unauthorized = await fetch(`${baseUrl}/analytics/`);
    const headers = { Authorization: `Basic ${credentials}` };
    const dashboard = await fetch(`${baseUrl}/analytics/`, { headers });
    const api = await fetch(`${baseUrl}/api/analytics/responses`, { headers });
    const payload = await api.json();
    const survey = await fetch(`${baseUrl}/`);

    const result = {
      unauthorized: unauthorized.status,
      dashboard: dashboard.status,
      api: api.status,
      records: payload.total,
      testRecords: payload.records?.filter((record) => record.isTest).length,
      survey: survey.status,
    };
    if (result.unauthorized !== 401 || result.dashboard !== 200 || result.api !== 200 || result.records !== 50 || result.testRecords !== 50 || result.survey !== 200) {
      throw new Error(`Smoke test failed: ${JSON.stringify(result)}`);
    }
    console.log(JSON.stringify({ ok: true, ...result }));
  } finally {
    server.kill();
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
