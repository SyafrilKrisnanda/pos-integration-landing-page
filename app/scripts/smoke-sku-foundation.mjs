#!/usr/bin/env node
import { spawn } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";

const appDir = path.resolve(import.meta.dirname, "..");
const externalBaseUrl = process.env.BASE_URL;
const port = Number(process.env.PORT || 9600 + Math.floor(Math.random() * 400));
const baseUrl = externalBaseUrl || `http://127.0.0.1:${port}`;
const tempDir = externalBaseUrl ? null : mkdtempSync(path.join(os.tmpdir(), "pos-sku-smoke-"));
const dbPath = tempDir ? path.join(tempDir, "smoke.sqlite") : process.env.DB_PATH;
const results = [];
let server;

function record(name, ok, detail = "") {
  results.push({ name, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"} ${name}${detail ? ` — ${detail}` : ""}`);
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

function asArray(payload) {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.items)) return payload.items;
  if (Array.isArray(payload?.skus)) return payload.skus;
  return [];
}

function responseItem(payload) {
  return payload?.item || payload?.product || payload?.sku || payload;
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

async function mutate(methods, urlPath, options) {
  let last;
  for (const method of methods) {
    last = await request(method, urlPath, options);
    if (last.status !== 404 && last.status !== 405) return last;
  }
  return last;
}

async function main() {
  if (!externalBaseUrl) {
    server = spawn(process.execPath, ["src/server.js"], {
      cwd: appDir,
      env: { ...process.env, PORT: String(port), DB_PATH: dbPath, SESSION_SECRET: "sku-smoke-test-secret" },
      stdio: ["ignore", "pipe", "pipe"]
    });
    server.stdout.on("data", (chunk) => process.stdout.write(`[server] ${chunk}`));
    server.stderr.on("data", (chunk) => process.stderr.write(`[server] ${chunk}`));
    await waitForServer();
  }

  const barcodePrefix = `SKU-SMOKE-${Date.now()}`;
  let adminCookie = "";
  let productId;
  let ecerSkuId;
  let packSkuId;

  await runTest("auth provides owner/admin session", async () => {
    adminCookie = await login("admin");
  });

  await runTest("migration creates product masters with default SKUs", async () => {
    const products = await request("GET", "/api/admin/products", { cookie: adminCookie });
    assert(products.status === 200, `admin product list expected 200, got ${products.status}`);
    const items = asArray(products.json);
    assert(items.length >= 4, "expected seeded products to migrate into product masters");
    for (const product of items) {
      assert(product.baseUnit || product.base_unit, `product ${product.id ?? product.name} missing baseUnit`);
      const skus = await request("GET", `/api/admin/products/${product.id}/skus`, { cookie: adminCookie });
      assert(skus.status === 200, `SKU list for product ${product.id} expected 200, got ${skus.status}`);
      assert(asArray(skus.json).length >= 1, `product ${product.id} has no migrated/default SKU`);
    }
  });

  await runTest("owner/admin can create product master with stock stored in base unit", async () => {
    const create = await mutate(["POST"], "/api/admin/products", {
      cookie: adminCookie,
      body: {
        name: "Smoke SKU Foundation Product",
        description: "temporary product master for SKU foundation smoke",
        baseUnit: "pcs",
        base_unit: "pcs",
        quantity: 6,
        active: true
      }
    });
    assert([200, 201].includes(create.status), `product master create expected 200/201, got ${create.status}: ${create.text}`);
    const product = responseItem(create.json);
    productId = product?.id;
    assert(productId, "product master create response did not include id");
    assert((product.baseUnit || product.base_unit) === "pcs", "product master did not preserve base unit pcs");
    assert(product.quantity === 6 || product.stockQuantity === 6 || product.baseStockQuantity === 6, "admin response should expose base-unit stock quantity as 6");
  });

  await runTest("admin SKU CRUD works under product master", async () => {
    assert(productId, "missing productId from product master create test");
    const createEcer = await request("POST", `/api/admin/products/${productId}/skus`, {
      cookie: adminCookie,
      body: { name: "Ecer", barcode: `${barcodePrefix}-ECER`, sellUnit: "pcs", sell_unit: "pcs", conversionQty: 1, conversion_qty: 1, price: 3000, active: true }
    });
    assert([200, 201].includes(createEcer.status), `create ecer SKU expected 200/201, got ${createEcer.status}: ${createEcer.text}`);
    ecerSkuId = responseItem(createEcer.json)?.id;
    assert(ecerSkuId, "create ecer SKU response did not include id");

    const createPack = await request("POST", `/api/admin/products/${productId}/skus`, {
      cookie: adminCookie,
      body: { name: "Pack 4", barcode: `${barcodePrefix}-PACK4`, sellUnit: "pack", sell_unit: "pack", conversionQty: 4, conversion_qty: 4, price: 10000, active: true }
    });
    assert([200, 201].includes(createPack.status), `create pack SKU expected 200/201, got ${createPack.status}: ${createPack.text}`);
    packSkuId = responseItem(createPack.json)?.id;
    assert(packSkuId, "create pack SKU response did not include id");

    const list = await request("GET", `/api/admin/products/${productId}/skus`, { cookie: adminCookie });
    assert(list.status === 200, `SKU list expected 200, got ${list.status}`);
    const skus = asArray(list.json);
    assert(skus.some((sku) => sku.id === ecerSkuId), "ecer SKU missing from list");
    assert(skus.some((sku) => sku.id === packSkuId), "pack SKU missing from list");

    const patch = await mutate(["PATCH", "PUT"], `/api/admin/skus/${ecerSkuId}`, {
      cookie: adminCookie,
      body: { name: "Ecer Updated", barcode: `${barcodePrefix}-ECER`, sellUnit: "pcs", sell_unit: "pcs", conversionQty: 1, conversion_qty: 1, price: 3500, active: true }
    });
    assert([200, 204].includes(patch.status), `SKU update expected 200/204, got ${patch.status}: ${patch.text}`);
  });

  await runTest("duplicate barcode across SKUs is rejected", async () => {
    assert(productId, "missing productId from product master create test");
    const duplicate = await request("POST", `/api/admin/products/${productId}/skus`, {
      cookie: adminCookie,
      body: { name: "Duplicate Barcode", barcode: `${barcodePrefix}-ECER`, sellUnit: "pcs", sell_unit: "pcs", conversionQty: 1, conversion_qty: 1, price: 999, active: true }
    });
    assert([400, 409].includes(duplicate.status), `duplicate SKU barcode expected 400/409, got ${duplicate.status}`);
  });

  await runTest("stock updates remain product-master/base-unit scoped", async () => {
    assert(productId, "missing productId from product master create test");
    const update = await mutate(["PATCH", "POST"], `/api/admin/products/${productId}/stock`, {
      cookie: adminCookie,
      body: { quantity: 3, reason: "sku foundation smoke base-unit correction" }
    });
    assert([200, 204].includes(update.status), `stock update expected 200/204, got ${update.status}: ${update.text}`);

    const products = await request("GET", "/api/admin/products", { cookie: adminCookie });
    const product = asArray(products.json).find((item) => item.id === productId);
    assert(product, "updated product missing from admin list");
    assert((product.baseUnit || product.base_unit) === "pcs", "stock product did not keep base unit pcs");
    assert(product.quantity === 3 || product.stockQuantity === 3 || product.baseStockQuantity === 3, "stock quantity should be 3 base units after update");

    const skus = asArray((await request("GET", `/api/admin/products/${productId}/skus`, { cookie: adminCookie })).json);
    const pack = skus.find((sku) => sku.id === packSkuId);
    const packConversion = pack?.conversionQty ?? pack?.conversion_qty;
    assert(Number(packConversion) === 4, "pack SKU conversion should remain 4 base units, not own stock quantity");
  });

  await runTest("inactive SKU is hidden from catalog while product/catalog never leaks raw quantity", async () => {
    assert(ecerSkuId && packSkuId, "missing SKU ids from CRUD test");
    const disablePack = await request("DELETE", `/api/admin/skus/${packSkuId}`, { cookie: adminCookie });
    assert([200, 204].includes(disablePack.status), `SKU delete/disable expected 200/204, got ${disablePack.status}: ${disablePack.text}`);

    const catalog = await request("GET", "/api/catalog/products");
    assert(catalog.status === 200, `catalog expected 200, got ${catalog.status}`);
    assert(!containsKey(catalog.json, "quantity"), "catalog response leaks quantity key");
    assert(!containsKey(catalog.json, "stockQuantity"), "catalog response leaks stockQuantity key");
    assert(!containsKey(catalog.json, "baseStockQuantity"), "catalog response leaks baseStockQuantity key");
    const serialized = JSON.stringify(catalog.json);
    assert(!serialized.includes(`${barcodePrefix}-PACK4`), "inactive SKU still appears in public catalog");
  });

  const failed = results.filter((result) => !result.ok);
  console.log(`\nSKU foundation smoke result: ${results.length - failed.length}/${results.length} passed`);
  if (failed.length) process.exitCode = 1;
}

try {
  await main();
} finally {
  if (server && !server.killed) server.kill("SIGTERM");
  if (tempDir) rmSync(tempDir, { recursive: true, force: true });
}
