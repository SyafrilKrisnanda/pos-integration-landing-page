#!/usr/bin/env node
import { spawn } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";

const appDir = path.resolve(import.meta.dirname, "..");
const externalBaseUrl = process.env.BASE_URL;
const port = Number(process.env.PORT || 8800 + Math.floor(Math.random() * 800));
const baseUrl = externalBaseUrl || `http://127.0.0.1:${port}`;
const tempDir = externalBaseUrl ? null : mkdtempSync(path.join(os.tmpdir(), "pos-smoke-"));
const dbPath = tempDir ? path.join(tempDir, "smoke.sqlite") : process.env.DB_PATH;
const results = [];
let server;

function record(name, ok, detail = "") {
  results.push({ name, ok, detail });
  const icon = ok ? "PASS" : "FAIL";
  console.log(`${icon} ${name}${detail ? ` — ${detail}` : ""}`);
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function containsKey(value, key) {
  if (Array.isArray(value)) return value.some((item) => containsKey(item, key));
  if (value && typeof value === "object") {
    if (Object.prototype.hasOwnProperty.call(value, key)) return true;
    return Object.values(value).some((item) => containsKey(item, key));
  }
  return false;
}

async function request(method, urlPath, { body, cookie } = {}) {
  const res = await fetch(`${baseUrl}${urlPath}`, {
    method,
    headers: {
      ...(body ? { "content-type": "application/json" } : {}),
      ...(cookie ? { cookie } : {})
    },
    body: body ? JSON.stringify(body) : undefined,
    redirect: "manual"
  });
  const text = await res.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = null;
  }
  const setCookie = res.headers.getSetCookie?.() ?? (res.headers.get("set-cookie") ? [res.headers.get("set-cookie")] : []);
  return { status: res.status, json, text, cookie: setCookie.map((line) => line.split(";")[0]).join("; ") };
}

async function waitForServer() {
  const deadline = Date.now() + 10_000;
  let lastError;
  while (Date.now() < deadline) {
    try {
      const res = await request("GET", "/api/health");
      if (res.status === 200) return;
    } catch (error) {
      lastError = error;
    }
    await new Promise((resolve) => setTimeout(resolve, 150));
  }
  throw new Error(`server did not become ready: ${lastError?.message || "timeout"}`);
}

async function runTest(name, fn) {
  try {
    await fn();
    record(name, true);
  } catch (error) {
    record(name, false, error.message);
  }
}

async function login(username, password = "admin123") {
  const res = await request("POST", "/api/auth/login", { body: { username, password } });
  assert([200, 204].includes(res.status), `login ${username} expected 200/204, got ${res.status}`);
  assert(res.cookie, `login ${username} did not set a session cookie`);
  return res.cookie;
}

async function main() {
  if (!externalBaseUrl) {
    server = spawn(process.execPath, ["src/server.js"], {
      cwd: appDir,
      env: { ...process.env, PORT: String(port), DB_PATH: dbPath, SESSION_SECRET: "smoke-test-secret" },
      stdio: ["ignore", "pipe", "pipe"]
    });
    server.stdout.on("data", (chunk) => process.stdout.write(`[server] ${chunk}`));
    server.stderr.on("data", (chunk) => process.stderr.write(`[server] ${chunk}`));
    server.on("exit", (code, signal) => {
      if (code !== null && code !== 0) console.error(`[server] exited with code ${code}`);
      if (signal) console.error(`[server] exited with signal ${signal}`);
    });
    await waitForServer();
  }

  await runTest("public health endpoint responds", async () => {
    const res = await request("GET", "/api/health");
    assert(res.status === 200, `expected 200, got ${res.status}`);
    assert(res.json?.ok === true, "expected { ok: true }");
  });

  await runTest("public catalog exposes only stockStatus, never raw quantity", async () => {
    const res = await request("GET", "/api/catalog/products");
    assert(res.status === 200, `expected 200, got ${res.status}`);
    assert(Array.isArray(res.json?.items), "expected items array");
    assert(!containsKey(res.json.items, "quantity"), "catalog response leaks quantity key");
    for (const item of res.json.items) {
      assert(["available", "out_of_stock"].includes(item.stockStatus), `invalid stockStatus for ${item.name}`);
    }
  });

  await runTest("admin APIs reject unauthenticated requests", async () => {
    const res = await request("GET", "/api/admin/products");
    assert([401, 403].includes(res.status), `expected 401/403, got ${res.status}`);
  });

  let adminCookie = "";
  let cashierCookie = "";

  await runTest("auth login accepts seeded admin and cashier, rejects bad password", async () => {
    adminCookie = await login("admin");
    cashierCookie = await login("cashier");
    const bad = await request("POST", "/api/auth/login", { body: { username: "admin", password: "wrong" } });
    assert([400, 401, 403].includes(bad.status), `bad password expected 400/401/403, got ${bad.status}`);
  });

  await runTest("cashier role cannot access owner/admin product management", async () => {
    if (!cashierCookie) cashierCookie = await login("cashier");
    const list = await request("GET", "/api/admin/products", { cookie: cashierCookie });
    assert([401, 403].includes(list.status), `cashier admin list expected 401/403, got ${list.status}`);
    const create = await request("POST", "/api/admin/products", {
      cookie: cashierCookie,
      body: { name: "Smoke Cashier Forbidden", price: 1000, unit: "pcs", barcode: `SMOKE-FORBID-${Date.now()}`, quantity: 1, active: true }
    });
    assert([401, 403, 405].includes(create.status), `cashier create expected 401/403/405, got ${create.status}`);
  });

  let smokeProductId;
  let smokeProduct;
  const barcode = `SMOKE-${Date.now()}`;

  await runTest("owner/admin can create product and duplicate barcode is rejected", async () => {
    if (!adminCookie) adminCookie = await login("admin");
    const create = await request("POST", "/api/admin/products", {
      cookie: adminCookie,
      body: { name: "Smoke Test Product", description: "temporary smoke item", price: 12345, unit: "pcs", barcode, quantity: 3, active: true }
    });
    assert([200, 201].includes(create.status), `create expected 200/201, got ${create.status}`);
    smokeProduct = create.json?.item || create.json?.product || create.json;
    smokeProductId = smokeProduct?.id;
    assert(smokeProductId, "create response did not include product id");

    const duplicate = await request("POST", "/api/admin/products", {
      cookie: adminCookie,
      body: { name: "Smoke Duplicate Barcode", price: 999, unit: "pcs", barcode, quantity: 1, active: true }
    });
    assert([400, 409].includes(duplicate.status), `duplicate barcode expected 400/409, got ${duplicate.status}`);
  });

  await runTest("active/inactive product controls catalog visibility", async () => {
    assert(smokeProductId, "missing smoke product id from create test");
    let catalog = await request("GET", "/api/catalog/products");
    assert(catalog.json.items.some((item) => item.barcode === barcode), "active in-stock product missing from catalog");

    const deactivate = await request("PUT", `/api/admin/products/${smokeProductId}`, {
      cookie: adminCookie,
      body: { ...smokeProduct, categoryId: smokeProduct.categoryId ?? null, active: false }
    });
    assert([200, 204].includes(deactivate.status), `deactivate expected 200/204, got ${deactivate.status}`);

    catalog = await request("GET", "/api/catalog/products");
    assert(!catalog.json.items.some((item) => item.barcode === barcode), "inactive product still appears in catalog");
  });

  await runTest("stock updates hide out-of-stock products without leaking quantity", async () => {
    assert(smokeProductId, "missing smoke product id from create test");
    await request("PUT", `/api/admin/products/${smokeProductId}`, { cookie: adminCookie, body: { ...smokeProduct, categoryId: smokeProduct.categoryId ?? null, active: true } });
    const zero = await request("POST", `/api/admin/products/${smokeProductId}/stock`, { cookie: adminCookie, body: { quantity: 0, reason: "smoke test zero" } });
    assert([200, 204].includes(zero.status), `stock=0 update expected 200/204, got ${zero.status}`);
    let catalog = await request("GET", "/api/catalog/products");
    let item = catalog.json.items.find((candidate) => candidate.barcode === barcode);
    assert(!item, "out-of-stock product still appears in catalog");
    assert(!containsKey(catalog.json.items, "quantity"), "catalog response leaks quantity key");

    const restock = await request("POST", `/api/admin/products/${smokeProductId}/stock`, { cookie: adminCookie, body: { quantity: 2, reason: "smoke test restock" } });
    assert([200, 204].includes(restock.status), `stock=2 update expected 200/204, got ${restock.status}`);
    catalog = await request("GET", "/api/catalog/products");
    item = catalog.json.items.find((candidate) => candidate.barcode === barcode);
    assert(item?.stockStatus === "available", `expected available, got ${item?.stockStatus}`);
  });

  await runTest("stock audit records owner/admin stock changes", async () => {
    const audits = await request("GET", "/api/admin/stock-audits", { cookie: adminCookie });
    assert(audits.status === 200, `audit list expected 200, got ${audits.status}`);
    assert(Array.isArray(audits.json?.items), "expected audit items array");
    assert(audits.json.items.some((item) => item.product_id === smokeProductId), "stock audit for smoke product not found");
  });

  const failed = results.filter((result) => !result.ok);
  console.log(`\nSmoke result: ${results.length - failed.length}/${results.length} passed`);
  if (failed.length) process.exitCode = 1;
}

try {
  await main();
} finally {
  if (server && !server.killed) server.kill("SIGTERM");
  if (tempDir) rmSync(tempDir, { recursive: true, force: true });
}
