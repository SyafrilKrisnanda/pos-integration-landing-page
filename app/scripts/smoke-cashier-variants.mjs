#!/usr/bin/env node
import { spawn } from "node:child_process";
import { DatabaseSync } from "node:sqlite";
import { mkdtempSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";

const appDir = path.resolve(import.meta.dirname, "..");
const externalBaseUrl = process.env.BASE_URL;
const port = Number(process.env.PORT || 9900 + Math.floor(Math.random() * 300));
const baseUrl = externalBaseUrl || `http://127.0.0.1:${port}`;
const tempDir = externalBaseUrl ? null : mkdtempSync(path.join(os.tmpdir(), "pos-cashier-smoke-"));
const dbPath = tempDir ? path.join(tempDir, "smoke.sqlite") : process.env.DB_PATH;
const results = [];
let server;

function record(name, ok, detail = "") {
  results.push({ name, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"} ${name}${detail ? ` — ${detail}` : ""}`);
}
function assert(condition, message) { if (!condition) throw new Error(message); }
function asArray(payload) { return Array.isArray(payload?.items) ? payload.items : []; }
function responseItem(payload) { return payload?.item || payload?.product || payload?.sku || payload; }
function compactCurrencyLabel(value) { return String(value ?? "").replace(/\s+/g, ""); }

async function request(method, urlPath, { body, cookie } = {}) {
  const res = await fetch(`${baseUrl}${urlPath}`, {
    method,
    headers: { ...(body ? { "content-type": "application/json" } : {}), ...(cookie ? { cookie } : {}) },
    body: body ? JSON.stringify(body) : undefined,
    redirect: "manual"
  });
  const text = await res.text();
  let json = null;
  try { json = text ? JSON.parse(text) : null; } catch { json = null; }
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
    } catch (error) { lastError = error; }
    await new Promise((resolve) => setTimeout(resolve, 150));
  }
  throw new Error(`server did not become ready: ${lastError?.message || "timeout"}`);
}

async function runTest(name, fn) {
  try { await fn(); record(name, true); } catch (error) { record(name, false, error.message); }
}
async function login(username, password = "admin123") {
  const res = await request("POST", "/api/auth/login", { body: { username, password } });
  assert(res.status === 200, `login ${username} expected 200, got ${res.status}: ${res.text}`);
  assert(res.cookie, `login ${username} did not set cookie`);
  return res.cookie;
}
async function productQuantity(adminCookie, productId) {
  const products = await request("GET", "/api/admin/products", { cookie: adminCookie });
  assert(products.status === 200, `admin products expected 200, got ${products.status}`);
  const product = asArray(products.json).find((item) => item.id === productId);
  assert(product, `product ${productId} not found`);
  return product.quantity;
}

async function main() {
  if (!externalBaseUrl) {
    server = spawn(process.execPath, ["src/server.js"], {
      cwd: appDir,
      env: { ...process.env, PORT: String(port), DB_PATH: dbPath, SESSION_SECRET: "cashier-smoke-test-secret" },
      stdio: ["ignore", "pipe", "pipe"]
    });
    server.stdout.on("data", (chunk) => process.stdout.write(`[server] ${chunk}`));
    server.stderr.on("data", (chunk) => process.stderr.write(`[server] ${chunk}`));
    await waitForServer();
  }

  const prefix = `CASHIER-SMOKE-${Date.now()}`;
  let adminCookie = "";
  let cashierCookie = "";
  let productId;
  let ecerSkuId;
  let packSkuId;
  let checkoutTransactionId;

  await runTest("owner/admin and cashier can log in", async () => {
    adminCookie = await login("admin");
    cashierCookie = await login("cashier");
  });

  await runTest("seeded Baterai AAA exposes ecer and pack variants consistently", async () => {
    const products = await request("GET", "/api/admin/products", { cookie: adminCookie });
    assert(products.status === 200, `admin products expected 200, got ${products.status}`);
    const battery = asArray(products.json).find((item) => item.name === "Baterai AAA");
    assert(battery, "seeded Baterai AAA product missing");
    assert(battery.baseUnit === "pcs", `Baterai AAA baseUnit expected pcs, got ${battery.baseUnit}`);
    assert(externalBaseUrl || battery.quantity === 24, `seeded Baterai AAA stock expected 24 pcs, got ${battery.quantity}`);

    const skus = await request("GET", `/api/admin/products/${battery.id}/skus`, { cookie: adminCookie });
    assert(skus.status === 200, `Baterai AAA SKU list expected 200, got ${skus.status}`);
    const ecer = asArray(skus.json).find((item) => item.name === "Ecer");
    const pack = asArray(skus.json).find((item) => item.name === "Pack 4");
    assert(ecer?.sellUnit === "pcs" && ecer?.conversionQty === 1 && ecer?.price === 3000, "seeded Baterai AAA ecer SKU mismatch");
    assert(pack?.sellUnit === "pack" && pack?.conversionQty === 4 && pack?.price === 10000, "seeded Baterai AAA pack SKU mismatch");

    const search = await request("GET", "/api/cashier/products/search?q=Baterai", { cookie: cashierCookie });
    assert(search.status === 200, `Baterai AAA cashier search expected 200, got ${search.status}`);
    assert(asArray(search.json).some((item) => item.skuId === ecer.id && item.displayName === "Baterai AAA - Ecer"), "seeded ecer SKU missing/misnamed in cashier search");
    assert(asArray(search.json).some((item) => item.skuId === pack.id && item.displayName === "Baterai AAA - Pack 4" && item.stockStatus === "available"), "seeded pack SKU missing/unavailable in cashier search");
  });

  await runTest("setup product with ecer and pack SKU variants", async () => {
    const create = await request("POST", "/api/admin/products", {
      cookie: adminCookie,
      body: { name: "Smoke Baterai AAA", description: "cashier variant smoke", baseUnit: "pcs", unit: "pcs", price: 2500, quantity: 6, active: true }
    });
    assert([200, 201].includes(create.status), `product create expected 200/201, got ${create.status}: ${create.text}`);
    productId = responseItem(create.json)?.id;
    assert(productId, "missing product id");

    const ecer = await request("POST", `/api/admin/products/${productId}/skus`, {
      cookie: adminCookie,
      body: { name: "Ecer", barcode: `${prefix}-ECER`, sellUnit: "pcs", conversionQty: 1, price: 3000, active: true }
    });
    assert([200, 201].includes(ecer.status), `ecer create expected 200/201, got ${ecer.status}: ${ecer.text}`);
    ecerSkuId = responseItem(ecer.json)?.id;

    const pack = await request("POST", `/api/admin/products/${productId}/skus`, {
      cookie: adminCookie,
      body: { name: "Pack 4", barcode: `${prefix}-PACK4`, sellUnit: "pack", conversionQty: 4, price: 10000, active: true }
    });
    assert([200, 201].includes(pack.status), `pack create expected 200/201, got ${pack.status}: ${pack.text}`);
    packSkuId = responseItem(pack.json)?.id;
    assert(ecerSkuId && packSkuId, "missing sku ids");
  });

  await runTest("cashier barcode and manual search return sellable SKUs", async () => {
    const barcode = await request("GET", `/api/cashier/products/search?barcode=${encodeURIComponent(`${prefix}-PACK4`)}`, { cookie: cashierCookie });
    assert(barcode.status === 200, `barcode search expected 200, got ${barcode.status}`);
    assert(asArray(barcode.json).some((item) => item.skuId === packSkuId && item.conversionQty === 4), "pack SKU missing from barcode search");

    const manual = await request("GET", "/api/cashier/products/search?q=Baterai", { cookie: cashierCookie });
    assert(manual.status === 200, `manual search expected 200, got ${manual.status}`);
    assert(asArray(manual.json).some((item) => item.skuId === ecerSkuId), "ecer SKU missing from manual search");
    assert(asArray(manual.json).some((item) => item.skuId === packSkuId), "pack SKU missing from manual search");
  });

  await runTest("checkout decrements base-unit stock and returns receipt summary", async () => {
    const checkout = await request("POST", "/api/cashier/checkout", {
      cookie: cashierCookie,
      body: { paymentMethod: "qris", items: [{ skuId: packSkuId, quantity: 1 }, { skuId: ecerSkuId, quantity: 1 }] }
    });
    assert([200, 201].includes(checkout.status), `checkout expected 200/201, got ${checkout.status}: ${checkout.text}`);
    const tx = checkout.json?.transaction;
    assert(tx?.id, "checkout response missing transaction id");
    checkoutTransactionId = tx.id;
    assert(tx.total === 13000, `expected total 13000, got ${tx?.total}`);
    assert(compactCurrencyLabel(tx.totalLabel) === "Rp13.000", `expected receipt totalLabel Rp13.000, got ${tx?.totalLabel}`);
    assert(tx.paymentMethod === "qris", `expected receipt paymentMethod qris, got ${tx?.paymentMethod}`);
    assert(Array.isArray(tx.items) && tx.items.length === 2, "receipt items missing");
    assert(tx.items.some((item) => item.skuId === packSkuId && item.displayName === "Smoke Baterai AAA - Pack 4" && item.quantitySold === 1 && item.baseUnitsConsumed === 4 && compactCurrencyLabel(item.subtotalLabel) === "Rp10.000"), "pack receipt did not snapshot display/conversion/subtotal data");
    assert(tx.items.some((item) => item.skuId === ecerSkuId && item.displayName === "Smoke Baterai AAA - Ecer" && item.quantitySold === 1 && item.baseUnitsConsumed === 1 && compactCurrencyLabel(item.unitPriceLabel) === "Rp3.000"), "ecer receipt did not snapshot display/conversion/price data");
    const qty = await productQuantity(adminCookie, productId);
    assert(qty === 1, `expected base stock 1 after consuming 5, got ${qty}`);
  });

  await runTest("transaction items store price and conversion snapshots", async () => {
    if (externalBaseUrl) return;
    assert(checkoutTransactionId, "missing checkout transaction id");
    const smokeDb = new DatabaseSync(dbPath, { readOnly: true });
    try {
      const rows = smokeDb.prepare(`
        SELECT sku_id, sku_name_snapshot, sell_unit_snapshot, conversion_qty_snapshot, quantity_sold, unit_price, subtotal
        FROM transaction_items
        WHERE transaction_id = ?
      `).all(checkoutTransactionId);
      assert(rows.length === 2, `expected 2 transaction item rows, got ${rows.length}`);
      const pack = rows.find((row) => row.sku_id === packSkuId);
      const ecer = rows.find((row) => row.sku_id === ecerSkuId);
      assert(pack, "pack transaction item missing");
      assert(ecer, "ecer transaction item missing");
      assert(pack.sku_name_snapshot === "Pack 4", `pack sku snapshot expected Pack 4, got ${pack.sku_name_snapshot}`);
      assert(pack.sell_unit_snapshot === "pack", `pack sell unit snapshot expected pack, got ${pack.sell_unit_snapshot}`);
      assert(pack.conversion_qty_snapshot === 4, `pack conversion snapshot expected 4, got ${pack.conversion_qty_snapshot}`);
      assert(pack.quantity_sold === 1 && pack.unit_price === 10000 && pack.subtotal === 10000, "pack quantity/price/subtotal snapshot mismatch");
      assert(ecer.sku_name_snapshot === "Ecer", `ecer sku snapshot expected Ecer, got ${ecer.sku_name_snapshot}`);
      assert(ecer.sell_unit_snapshot === "pcs", `ecer sell unit snapshot expected pcs, got ${ecer.sell_unit_snapshot}`);
      assert(ecer.conversion_qty_snapshot === 1, `ecer conversion snapshot expected 1, got ${ecer.conversion_qty_snapshot}`);
      assert(ecer.quantity_sold === 1 && ecer.unit_price === 3000 && ecer.subtotal === 3000, "ecer quantity/price/subtotal snapshot mismatch");
    } finally {
      smokeDb.close();
    }
  });

  await runTest("insufficient-stock checkout is rejected atomically", async () => {
    const before = await productQuantity(adminCookie, productId);
    const checkout = await request("POST", "/api/cashier/checkout", {
      cookie: cashierCookie,
      body: { paymentMethod: "cash", items: [{ skuId: ecerSkuId, quantity: 1 }, { skuId: packSkuId, quantity: 1 }] }
    });
    assert([400, 409].includes(checkout.status), `insufficient checkout expected 400/409, got ${checkout.status}: ${checkout.text}`);
    const after = await productQuantity(adminCookie, productId);
    assert(after === before, `stock changed after failed checkout: before ${before}, after ${after}`);
  });

  await runTest("out-of-stock and inactive SKUs are hidden from cashier search", async () => {
    let packSearch = await request("GET", `/api/cashier/products/search?barcode=${encodeURIComponent(`${prefix}-PACK4`)}`, { cookie: cashierCookie });
    assert(packSearch.status === 200, `pack search expected 200, got ${packSearch.status}`);
    assert(!asArray(packSearch.json).some((item) => item.skuId === packSkuId), "pack SKU sellable despite insufficient base stock");

    const disableEcer = await request("DELETE", `/api/admin/skus/${ecerSkuId}`, { cookie: adminCookie });
    assert([200, 204].includes(disableEcer.status), `disable ecer expected 200/204, got ${disableEcer.status}`);
    const ecerSearch = await request("GET", `/api/cashier/products/search?barcode=${encodeURIComponent(`${prefix}-ECER`)}`, { cookie: cashierCookie });
    assert(ecerSearch.status === 200, `ecer search expected 200, got ${ecerSearch.status}`);
    assert(!asArray(ecerSearch.json).some((item) => item.skuId === ecerSkuId), "inactive ecer SKU appears in cashier search");
  });

  await runTest("checkout rejects invalid payment, missing items, and non-positive quantities", async () => {
    const invalidPayment = await request("POST", "/api/cashier/checkout", {
      cookie: cashierCookie,
      body: { paymentMethod: "voucher", items: [{ skuId: packSkuId, quantity: 1 }] }
    });
    assert(invalidPayment.status === 400, `invalid payment expected 400, got ${invalidPayment.status}: ${invalidPayment.text}`);

    const missingItems = await request("POST", "/api/cashier/checkout", {
      cookie: cashierCookie,
      body: { paymentMethod: "cash", items: [] }
    });
    assert(missingItems.status === 400, `missing items expected 400, got ${missingItems.status}: ${missingItems.text}`);

    const zeroQuantity = await request("POST", "/api/cashier/checkout", {
      cookie: cashierCookie,
      body: { paymentMethod: "cash", items: [{ skuId: packSkuId, quantity: 0 }] }
    });
    assert(zeroQuantity.status === 400, `zero quantity expected 400, got ${zeroQuantity.status}: ${zeroQuantity.text}`);
  });

  await runTest("cashier cannot mutate owner/admin stock or SKU state", async () => {
    const stock = await request("POST", `/api/admin/products/${productId}/stock`, {
      cookie: cashierCookie,
      body: { quantity: 99, reason: "cashier privilege probe" }
    });
    assert([401, 403].includes(stock.status), `cashier stock update expected 401/403, got ${stock.status}`);

    const sku = await request("PATCH", `/api/admin/skus/${packSkuId}`, {
      cookie: cashierCookie,
      body: { price: 1 }
    });
    assert([401, 403].includes(sku.status), `cashier SKU update expected 401/403, got ${sku.status}`);
  });

  await runTest("concurrent checkout on one remaining unit leaves no negative inventory", async () => {
    const create = await request("POST", "/api/admin/products", {
      cookie: adminCookie,
      body: { name: "Smoke Concurrent Stock", description: "one-unit race smoke", baseUnit: "pcs", unit: "pcs", price: 1111, quantity: 1, active: true }
    });
    assert([200, 201].includes(create.status), `concurrent product create expected 200/201, got ${create.status}: ${create.text}`);
    const concurrentProductId = responseItem(create.json)?.id;
    const concurrentSkuId = responseItem(create.json)?.skus?.[0]?.id;
    assert(concurrentProductId && concurrentSkuId, "missing concurrent product/SKU ids");

    const body = { paymentMethod: "cash", items: [{ skuId: concurrentSkuId, quantity: 1 }] };
    const [first, second] = await Promise.all([
      request("POST", "/api/cashier/checkout", { cookie: cashierCookie, body }),
      request("POST", "/api/cashier/checkout", { cookie: cashierCookie, body })
    ]);
    const successes = [first, second].filter((res) => [200, 201].includes(res.status));
    const failures = [first, second].filter((res) => [400, 409].includes(res.status));
    assert(successes.length === 1, `expected exactly one successful concurrent checkout, got statuses ${first.status}/${second.status}`);
    assert(failures.length === 1, `expected exactly one rejected concurrent checkout, got statuses ${first.status}/${second.status}`);

    const after = await productQuantity(adminCookie, concurrentProductId);
    assert(after === 0, `expected stock 0 after concurrent race, got ${after}`);

    if (!externalBaseUrl) {
      const smokeDb = new DatabaseSync(dbPath, { readOnly: true });
      try {
        const soldRows = smokeDb.prepare("SELECT COUNT(*) AS count FROM transaction_items WHERE product_id = ?").get(concurrentProductId).count;
        assert(soldRows === 1, `expected one persisted sale row for concurrent product, got ${soldRows}`);
        const stockRow = smokeDb.prepare("SELECT quantity FROM stocks WHERE product_id = ?").get(concurrentProductId);
        assert(stockRow?.quantity === 0, `DB stock expected 0, got ${stockRow?.quantity}`);
      } finally {
        smokeDb.close();
      }
    }
  });

  const failed = results.filter((result) => !result.ok);
  console.log(`\nCashier variant smoke result: ${results.length - failed.length}/${results.length} passed`);
  if (failed.length) process.exitCode = 1;
}

try {
  await main();
} finally {
  if (server && !server.killed) server.kill("SIGTERM");
  if (tempDir) rmSync(tempDir, { recursive: true, force: true });
}
