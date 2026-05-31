import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import express from "express";
import cookieParser from "cookie-parser";
import session from "express-session";
import bcrypt from "bcryptjs";
import { initDb } from "./db.js";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "../..");
const siteDir = path.join(repoRoot, "site");

const PORT = Number(process.env.PORT || 8790);
const SESSION_SECRET = process.env.SESSION_SECRET || "dev-only-change-me";
const VALID_UNITS = new Set(["pcs", "pack", "kg", "g", "liter", "ml", "btl", "box"]);

const db = initDb();
const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(
  session({
    secret: SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: { httpOnly: true, sameSite: "lax", secure: false, maxAge: 1000 * 60 * 60 * 8 }
  })
);

function rupiah(amount) {
  return new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(amount);
}
function badRequest(res, message, details = undefined) { return res.status(400).json({ error: message, details }); }
function forbidden(res) { return res.status(403).json({ error: "owner_admin role required" }); }
function notFound(res, entity = "resource") { return res.status(404).json({ error: `${entity} not found` }); }
function optionalText(value) { if (value === undefined || value === null) return null; const text = String(value).trim(); return text.length ? text : null; }
function requiredText(value, name) { const text = optionalText(value); if (!text) throw new Error(`${name} is required`); return text; }
function toBoolInt(value, fallback = 1) { if (value === undefined || value === null || value === "") return fallback; return value === true || value === 1 || value === "1" || value === "true" ? 1 : 0; }
function asMoney(value, name = "price") { const n = Number(value); if (!Number.isInteger(n) || n < 0) throw new Error(`${name} must be a non-negative integer`); return n; }
function asQuantity(value, name = "quantity") { const n = Number(value); if (!Number.isInteger(n) || n < 0) throw new Error(`${name} must be a non-negative integer`); return n; }
function asPositiveQuantity(value, name = "conversion_qty") { const n = Number(value); if (!Number.isInteger(n) || n <= 0) throw new Error(`${name} must be a positive integer`); return n; }
function asCategoryId(value) { if (value === undefined || value === null || value === "") return null; const n = Number(value); if (!Number.isInteger(n) || n <= 0) throw new Error("category_id must be a positive integer or null"); return n; }
function asUnit(value, name) { const unit = requiredText(value, name); if (!VALID_UNITS.has(unit)) throw new Error(`${name} is invalid`); return unit; }
function currentUser(req) { return req.session?.user ?? null; }
function publicUser(user) { return user ? { id: user.id, username: user.username, role: user.role } : null; }
function requireOwnerAdmin(req, res, next) { const user = currentUser(req); if (!user) return res.status(401).json({ error: "login required" }); if (user.role !== "owner_admin") return forbidden(res); return next(); }
function requireAuth(req, res, next) { if (!currentUser(req)) return res.status(401).json({ error: "login required" }); return next(); }
function requireCashierOrOwner(req, res, next) { const user = currentUser(req); if (!user) return res.status(401).json({ error: "login required" }); if (!["cashier", "owner_admin"].includes(user.role)) return res.status(403).json({ error: "cashier role required" }); return next(); }

function handleSqlError(res, err) {
  const message = String(err?.message || "");
  if (message.includes("UNIQUE constraint failed: product_skus.barcode") || message.includes("UNIQUE constraint failed: products.barcode")) return badRequest(res, "barcode must be unique");
  if (message.includes("UNIQUE constraint failed: categories.name")) return badRequest(res, "category name must be unique");
  if (message.includes("CHECK constraint failed")) return badRequest(res, "invalid value", message);
  if (message.includes("FOREIGN KEY constraint failed")) return badRequest(res, "referenced record does not exist");
  console.error(err);
  return res.status(500).json({ error: "internal server error" });
}

function mapSku(row) {
  return {
    id: row.id,
    productId: row.product_id,
    name: row.name,
    barcode: row.barcode,
    sellUnit: row.sell_unit,
    conversionQty: row.conversion_qty,
    price: row.price,
    priceLabel: rupiah(row.price),
    active: Boolean(row.active),
    updatedAt: row.updated_at
  };
}

function skusForProduct(productId, activeOnly = false) {
  return db.prepare(`
    SELECT id, product_id, name, barcode, sell_unit, conversion_qty, price, active, updated_at
    FROM product_skus
    WHERE product_id = ? ${activeOnly ? "AND active = 1" : ""}
    ORDER BY active DESC, id ASC
  `).all(productId).map(mapSku);
}

function mapAdminProduct(row, includeSkus = true) {
  const skus = includeSkus ? skusForProduct(row.id) : [];
  const primarySku = skus.find((sku) => sku.active) || skus[0] || null;
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    baseUnit: row.base_unit,
    unit: primarySku?.sellUnit ?? row.base_unit,
    price: primarySku?.price ?? 0,
    priceLabel: rupiah(primarySku?.price ?? 0),
    barcode: primarySku?.barcode ?? null,
    active: Boolean(row.active),
    categoryId: row.category_id,
    categoryName: row.category_name,
    quantity: row.quantity,
    stockStatus: row.quantity > 0 && skus.some((sku) => sku.active && row.quantity >= sku.conversionQty) ? "available" : "out_of_stock",
    skus,
    updatedAt: row.updated_at
  };
}

function getAdminProducts() {
  return db.prepare(`
    SELECT pm.id, pm.name, pm.description, pm.base_unit, pm.active, pm.category_id,
           c.name AS category_name, COALESCE(s.quantity, 0) AS quantity, pm.updated_at
    FROM product_masters pm
    LEFT JOIN categories c ON c.id = pm.category_id
    LEFT JOIN stocks s ON s.product_id = pm.id
    ORDER BY pm.created_at DESC, pm.id DESC
  `).all().map((row) => mapAdminProduct(row));
}

function getAdminProduct(id) {
  const row = db.prepare(`
    SELECT pm.id, pm.name, pm.description, pm.base_unit, pm.active, pm.category_id,
           c.name AS category_name, COALESCE(s.quantity, 0) AS quantity, pm.updated_at
    FROM product_masters pm
    LEFT JOIN categories c ON c.id = pm.category_id
    LEFT JOIN stocks s ON s.product_id = pm.id
    WHERE pm.id = ?
  `).get(id);
  return row ? mapAdminProduct(row) : null;
}

function getCatalogProducts() {
  return db.prepare(`
    SELECT pm.id, pm.name, pm.description, pm.base_unit, c.name AS category_name,
           COALESCE(s.quantity, 0) AS quantity,
           MIN(CASE WHEN ps.active = 1 THEN ps.price END) AS min_price,
           (SELECT ps2.barcode FROM product_skus ps2 WHERE ps2.product_id = pm.id AND ps2.active = 1 ORDER BY ps2.id ASC LIMIT 1) AS barcode,
           EXISTS(SELECT 1 FROM product_skus ps3 WHERE ps3.product_id = pm.id AND ps3.active = 1 AND COALESCE(s.quantity, 0) >= ps3.conversion_qty) AS sellable
    FROM product_masters pm
    LEFT JOIN categories c ON c.id = pm.category_id
    LEFT JOIN stocks s ON s.product_id = pm.id
    LEFT JOIN product_skus ps ON ps.product_id = pm.id
    WHERE pm.active = 1
    GROUP BY pm.id
    ORDER BY pm.name ASC
  `).all().filter((row) => row.sellable).map((row) => ({
    id: row.id,
    name: row.name,
    description: row.description,
    price: row.min_price ?? 0,
    priceLabel: rupiah(row.min_price ?? 0),
    unit: row.base_unit,
    barcode: row.barcode,
    category: row.category_name ?? null,
    stockStatus: "available",
    whatsappText: `Halo, saya mau tanya ${row.name}.`
  }));
}

function getCategories() {
  return db.prepare(`SELECT id, name, active, created_at, updated_at FROM categories ORDER BY active DESC, name ASC`).all().map((row) => ({
    id: row.id, name: row.name, active: Boolean(row.active), createdAt: row.created_at, updatedAt: row.updated_at
  }));
}

function getDashboardSummary() {
  const totals = db.prepare(`SELECT COUNT(*) AS transaction_count, COALESCE(SUM(total), 0) AS total_sales FROM transactions`).get();
  const activeProducts = db.prepare(`SELECT COUNT(*) AS count FROM product_masters WHERE active = 1`).get();
  const lowStock = db.prepare(`SELECT COUNT(*) AS count FROM stocks s JOIN product_masters pm ON pm.id = s.product_id WHERE pm.active = 1 AND s.quantity BETWEEN 1 AND 5`).get();
  const outOfStock = db.prepare(`SELECT COUNT(*) AS count FROM stocks s JOIN product_masters pm ON pm.id = s.product_id WHERE pm.active = 1 AND s.quantity = 0`).get();
  const topSku = db.prepare(`
    SELECT ti.sku_id, COALESCE(ti.sku_name_snapshot, ps.name) AS sku_name, SUM(COALESCE(ti.quantity_sold, ti.quantity)) AS sold
    FROM transaction_items ti LEFT JOIN product_skus ps ON ps.id = ti.sku_id
    GROUP BY ti.sku_id, sku_name ORDER BY sold DESC LIMIT 1
  `).get();
  return { transactionCount: totals.transaction_count, totalSales: totals.total_sales, totalSalesLabel: rupiah(totals.total_sales), activeProducts: activeProducts.count, lowStockProducts: lowStock.count, outOfStockProducts: outOfStock.count, topSellingSku: topSku ?? null };
}

function productPayload(body, partial = false) {
  const payload = {};
  if (!partial || body.name !== undefined) payload.name = requiredText(body.name, "name");
  if (!partial || body.category_id !== undefined || body.categoryId !== undefined) payload.categoryId = asCategoryId(body.category_id ?? body.categoryId);
  if (!partial || body.description !== undefined) payload.description = String(body.description ?? "").trim();
  if (!partial || body.base_unit !== undefined || body.baseUnit !== undefined || body.unit !== undefined) payload.baseUnit = asUnit(body.base_unit ?? body.baseUnit ?? body.unit, "base_unit");
  if (!partial || body.active !== undefined) payload.active = toBoolInt(body.active, 1);
  if (!partial || body.quantity !== undefined) payload.quantity = asQuantity(body.quantity ?? 0);
  return payload;
}

function skuPayload(body, partial = false) {
  const payload = {};
  if (!partial || body.name !== undefined) payload.name = requiredText(body.name, "sku name");
  if (!partial || body.barcode !== undefined) payload.barcode = optionalText(body.barcode);
  if (!partial || body.sell_unit !== undefined || body.sellUnit !== undefined || body.unit !== undefined) payload.sellUnit = asUnit(body.sell_unit ?? body.sellUnit ?? body.unit, "sell_unit");
  if (!partial || body.conversion_qty !== undefined || body.conversionQty !== undefined) payload.conversionQty = asPositiveQuantity(body.conversion_qty ?? body.conversionQty ?? 1);
  if (!partial || body.price !== undefined) payload.price = asMoney(body.price);
  if (!partial || body.active !== undefined) payload.active = toBoolInt(body.active, 1);
  return payload;
}

function syncLegacyProduct(productId) {
  const product = getAdminProduct(productId);
  if (!product) return;
  db.prepare(`
    INSERT INTO products (id, name, category_id, price, unit, barcode, description, active, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
    ON CONFLICT(id) DO UPDATE SET
      name = excluded.name, category_id = excluded.category_id, price = excluded.price, unit = excluded.unit,
      barcode = excluded.barcode, description = excluded.description, active = excluded.active, updated_at = datetime('now')
  `).run(product.id, product.name, product.categoryId, product.price, product.unit, product.barcode, product.description, product.active ? 1 : 0);
}

function updateStock(productId, nextQuantity, userId, reason) {
  const product = db.prepare("SELECT id FROM product_masters WHERE id = ?").get(productId);
  if (!product) throw new Error("product not found");
  const current = db.prepare("SELECT quantity FROM stocks WHERE product_id = ?").get(productId);
  const previousQuantity = current ? current.quantity : 0;
  db.prepare(`
    INSERT INTO stocks (product_id, quantity, last_updated_by, last_updated_at)
    VALUES (?, ?, ?, datetime('now'))
    ON CONFLICT(product_id) DO UPDATE SET quantity = excluded.quantity, last_updated_by = excluded.last_updated_by, last_updated_at = datetime('now')
  `).run(productId, nextQuantity, userId);
  db.prepare(`INSERT INTO stock_audits (product_id, previous_quantity, new_quantity, changed_by, reason) VALUES (?, ?, ?, ?, ?)`).run(productId, previousQuantity, nextQuantity, userId, reason || "manual update");
}

app.get("/api/health", (_req, res) => res.json({ ok: true, db: "sqlite", mode: "local-only" }));
app.post("/api/auth/login", (req, res) => {
  const username = optionalText(req.body.username); const password = String(req.body.password ?? "");
  if (!username || !password) return badRequest(res, "username and password are required");
  const user = db.prepare(`SELECT id, username, role, password_hash, active FROM users WHERE username = ?`).get(username);
  if (!user || !user.active || !bcrypt.compareSync(password, user.password_hash)) return res.status(401).json({ error: "invalid username or password" });
  req.session.user = publicUser(user); res.json({ user: req.session.user });
});
app.post("/api/auth/logout", (req, res) => req.session.destroy(() => res.json({ ok: true })));
app.get("/api/auth/me", (req, res) => res.json({ user: publicUser(currentUser(req)) }));
app.get("/api/catalog/products", (_req, res) => res.json({ items: getCatalogProducts() }));

app.get("/api/admin/dashboard", requireOwnerAdmin, (_req, res) => res.json(getDashboardSummary()));
app.get("/api/admin/categories", requireOwnerAdmin, (_req, res) => res.json({ items: getCategories() }));
app.post("/api/admin/categories", requireOwnerAdmin, (req, res) => { try { const name = requiredText(req.body.name, "name"); const active = toBoolInt(req.body.active, 1); const result = db.prepare("INSERT INTO categories (name, active) VALUES (?, ?)").run(name, active); res.status(201).json({ item: getCategories().find((c) => c.id === Number(result.lastInsertRowid)) }); } catch (err) { if (err.message?.includes("required")) return badRequest(res, err.message); return handleSqlError(res, err); } });
app.put("/api/admin/categories/:id", requireOwnerAdmin, (req, res) => { try { const id = Number(req.params.id); if (!db.prepare("SELECT id FROM categories WHERE id = ?").get(id)) return notFound(res, "category"); const name = requiredText(req.body.name, "name"); const active = toBoolInt(req.body.active, 1); db.prepare("UPDATE categories SET name = ?, active = ?, updated_at = datetime('now') WHERE id = ?").run(name, active, id); res.json({ item: getCategories().find((c) => c.id === id) }); } catch (err) { if (err.message?.includes("required")) return badRequest(res, err.message); return handleSqlError(res, err); } });
app.delete("/api/admin/categories/:id", requireOwnerAdmin, (req, res) => { const id = Number(req.params.id); if (!db.prepare("SELECT id FROM categories WHERE id = ?").get(id)) return notFound(res, "category"); db.prepare("UPDATE categories SET active = 0, updated_at = datetime('now') WHERE id = ?").run(id); res.json({ ok: true, softDeleted: true }); });

app.get("/api/admin/products", requireOwnerAdmin, (_req, res) => res.json({ items: getAdminProducts() }));
app.post("/api/admin/products", requireOwnerAdmin, (req, res) => {
  try {
    const p = productPayload(req.body);
    const s = skuPayload({ name: req.body.skuName ?? req.body.sku_name ?? "Default", barcode: req.body.barcode, sellUnit: req.body.sellUnit ?? req.body.sell_unit ?? p.baseUnit, conversionQty: req.body.conversionQty ?? req.body.conversion_qty ?? 1, price: req.body.price ?? 0, active: req.body.skuActive ?? req.body.active }, false);
    db.exec("BEGIN IMMEDIATE");
    try {
      const result = db.prepare(`INSERT INTO product_masters (name, category_id, description, base_unit, active) VALUES (?, ?, ?, ?, ?)`).run(p.name, p.categoryId, p.description, p.baseUnit, p.active);
      const productId = Number(result.lastInsertRowid);
      db.prepare(`INSERT INTO product_skus (product_id, name, barcode, sell_unit, conversion_qty, price, active) VALUES (?, ?, ?, ?, ?, ?, ?)`).run(productId, s.name, s.barcode, s.sellUnit, s.conversionQty, s.price, s.active);
      db.prepare("INSERT INTO stocks (product_id, quantity, last_updated_by) VALUES (?, ?, ?)").run(productId, p.quantity, currentUser(req).id);
      db.exec("COMMIT");
      syncLegacyProduct(productId);
      res.status(201).json({ item: getAdminProduct(productId) });
    } catch (err) { db.exec("ROLLBACK"); throw err; }
  } catch (err) { if (err.message?.includes("required") || err.message?.includes("must be") || err.message?.includes("invalid")) return badRequest(res, err.message); return handleSqlError(res, err); }
});

function updateProductHandler(req, res) {
  try {
    const id = Number(req.params.id); if (!db.prepare("SELECT id FROM product_masters WHERE id = ?").get(id)) return notFound(res, "product");
    const p = productPayload(req.body);
    db.prepare(`UPDATE product_masters SET name = ?, category_id = ?, description = ?, base_unit = ?, active = ?, updated_at = datetime('now') WHERE id = ?`).run(p.name, p.categoryId, p.description, p.baseUnit, p.active, id);
    if (req.body.price !== undefined || req.body.barcode !== undefined || req.body.unit !== undefined || req.body.sellUnit !== undefined) {
      const firstSku = db.prepare("SELECT * FROM product_skus WHERE product_id = ? ORDER BY id ASC LIMIT 1").get(id);
      const s = skuPayload({ name: req.body.skuName ?? firstSku?.name ?? "Default", barcode: req.body.barcode ?? firstSku?.barcode, sellUnit: req.body.sellUnit ?? req.body.sell_unit ?? req.body.unit ?? firstSku?.sell_unit ?? p.baseUnit, conversionQty: req.body.conversionQty ?? req.body.conversion_qty ?? firstSku?.conversion_qty ?? 1, price: req.body.price ?? firstSku?.price ?? 0, active: req.body.skuActive ?? firstSku?.active ?? p.active }, false);
      if (firstSku) db.prepare(`UPDATE product_skus SET name = ?, barcode = ?, sell_unit = ?, conversion_qty = ?, price = ?, active = ?, updated_at = datetime('now') WHERE id = ?`).run(s.name, s.barcode, s.sellUnit, s.conversionQty, s.price, s.active, firstSku.id);
    }
    if (req.body.quantity !== undefined) updateStock(id, p.quantity, currentUser(req).id, optionalText(req.body.reason) || "product update");
    syncLegacyProduct(id);
    res.json({ item: getAdminProduct(id) });
  } catch (err) { if (err.message?.includes("required") || err.message?.includes("must be") || err.message?.includes("invalid")) return badRequest(res, err.message); return handleSqlError(res, err); }
}
app.put("/api/admin/products/:id", requireOwnerAdmin, updateProductHandler);
app.patch("/api/admin/products/:id", requireOwnerAdmin, updateProductHandler);
app.delete("/api/admin/products/:id", requireOwnerAdmin, (req, res) => { const id = Number(req.params.id); if (!db.prepare("SELECT id FROM product_masters WHERE id = ?").get(id)) return notFound(res, "product"); db.prepare("UPDATE product_masters SET active = 0, updated_at = datetime('now') WHERE id = ?").run(id); syncLegacyProduct(id); res.json({ ok: true, softDeleted: true }); });

app.get("/api/admin/products/:id/skus", requireOwnerAdmin, (req, res) => { const id = Number(req.params.id); if (!db.prepare("SELECT id FROM product_masters WHERE id = ?").get(id)) return notFound(res, "product"); res.json({ items: skusForProduct(id) }); });
app.post("/api/admin/products/:id/skus", requireOwnerAdmin, (req, res) => { try { const productId = Number(req.params.id); if (!db.prepare("SELECT id FROM product_masters WHERE id = ?").get(productId)) return notFound(res, "product"); const s = skuPayload(req.body); const result = db.prepare(`INSERT INTO product_skus (product_id, name, barcode, sell_unit, conversion_qty, price, active) VALUES (?, ?, ?, ?, ?, ?, ?)`).run(productId, s.name, s.barcode, s.sellUnit, s.conversionQty, s.price, s.active); syncLegacyProduct(productId); res.status(201).json({ item: skusForProduct(productId).find((sku) => sku.id === Number(result.lastInsertRowid)) }); } catch (err) { if (err.message?.includes("required") || err.message?.includes("must be") || err.message?.includes("invalid")) return badRequest(res, err.message); return handleSqlError(res, err); } });
function updateSkuHandler(req, res) { try { const id = Number(req.params.id); const existing = db.prepare("SELECT * FROM product_skus WHERE id = ?").get(id); if (!existing) return notFound(res, "sku"); const incoming = skuPayload(req.body, true); const next = { name: incoming.name ?? existing.name, barcode: Object.hasOwn(incoming, "barcode") ? incoming.barcode : existing.barcode, sellUnit: incoming.sellUnit ?? existing.sell_unit, conversionQty: incoming.conversionQty ?? existing.conversion_qty, price: incoming.price ?? existing.price, active: incoming.active ?? existing.active }; db.prepare(`UPDATE product_skus SET name = ?, barcode = ?, sell_unit = ?, conversion_qty = ?, price = ?, active = ?, updated_at = datetime('now') WHERE id = ?`).run(next.name, next.barcode, next.sellUnit, next.conversionQty, next.price, next.active, id); syncLegacyProduct(existing.product_id); res.json({ item: skusForProduct(existing.product_id).find((sku) => sku.id === id) }); } catch (err) { if (err.message?.includes("required") || err.message?.includes("must be") || err.message?.includes("invalid")) return badRequest(res, err.message); return handleSqlError(res, err); } }
app.patch("/api/admin/skus/:id", requireOwnerAdmin, updateSkuHandler);
app.put("/api/admin/skus/:id", requireOwnerAdmin, updateSkuHandler);
app.delete("/api/admin/skus/:id", requireOwnerAdmin, (req, res) => { const id = Number(req.params.id); const existing = db.prepare("SELECT product_id FROM product_skus WHERE id = ?").get(id); if (!existing) return notFound(res, "sku"); db.prepare("UPDATE product_skus SET active = 0, updated_at = datetime('now') WHERE id = ?").run(id); syncLegacyProduct(existing.product_id); res.json({ ok: true, softDeleted: true }); });

function stockHandler(req, res) { try { const id = Number(req.params.id); const quantity = asQuantity(req.body.quantity); updateStock(id, quantity, currentUser(req).id, optionalText(req.body.reason) || "manual update"); res.json({ item: getAdminProduct(id) }); } catch (err) { if (err.message === "product not found") return notFound(res, "product"); if (err.message?.includes("quantity")) return badRequest(res, err.message); return handleSqlError(res, err); } }
app.post("/api/admin/products/:id/stock", requireOwnerAdmin, stockHandler);
app.patch("/api/admin/products/:id/stock", requireOwnerAdmin, stockHandler);
app.get("/api/admin/stock-audits", requireOwnerAdmin, (_req, res) => { const items = db.prepare(`SELECT a.id, a.product_id, pm.name AS product_name, a.sku_id, a.previous_quantity, a.new_quantity, u.username AS changed_by_username, a.reason, a.created_at FROM stock_audits a JOIN product_masters pm ON pm.id = a.product_id LEFT JOIN users u ON u.id = a.changed_by ORDER BY a.created_at DESC, a.id DESC LIMIT 100`).all(); res.json({ items }); });

function mapSellableSku(row) {
  return { skuId: row.sku_id, productId: row.product_id, productName: row.product_name, skuName: row.sku_name, displayName: row.sku_name === "Default" ? row.product_name : `${row.product_name} - ${row.sku_name}`, barcode: row.barcode, sellUnit: row.sell_unit, conversionQty: row.conversion_qty, price: row.price, priceLabel: rupiah(row.price), stockStatus: row.quantity >= row.conversion_qty ? "available" : "out_of_stock" };
}
app.get("/api/cashier/products/search", requireCashierOrOwner, (req, res) => {
  const barcode = optionalText(req.query.barcode); const q = optionalText(req.query.q);
  if (!barcode && !q) return badRequest(res, "barcode or q is required");
  const rows = db.prepare(`
    SELECT ps.id AS sku_id, ps.product_id, ps.name AS sku_name, ps.barcode, ps.sell_unit, ps.conversion_qty, ps.price,
           pm.name AS product_name, COALESCE(s.quantity, 0) AS quantity
    FROM product_skus ps JOIN product_masters pm ON pm.id = ps.product_id LEFT JOIN stocks s ON s.product_id = pm.id
    WHERE pm.active = 1 AND ps.active = 1
      AND (? IS NULL OR ps.barcode = ?)
      AND (? IS NULL OR pm.name LIKE ? OR ps.name LIKE ?)
    ORDER BY pm.name ASC, ps.id ASC LIMIT 25
  `).all(barcode, barcode, q, q ? `%${q}%` : null, q ? `%${q}%` : null).filter((row) => row.quantity >= row.conversion_qty).map(mapSellableSku);
  res.json({ items: rows });
});

app.post("/api/cashier/checkout", requireCashierOrOwner, (req, res) => {
  const user = currentUser(req); const paymentMethod = optionalText(req.body.payment_method ?? req.body.paymentMethod) || "cash"; const lines = Array.isArray(req.body.items) ? req.body.items : [];
  if (!["cash", "qris", "other"].includes(paymentMethod)) return badRequest(res, "payment_method is invalid");
  if (!lines.length) return badRequest(res, "items are required");
  try {
    let response;
    db.exec("BEGIN IMMEDIATE");
    try {
      const snapshots = [];
      const consumptionByProduct = new Map();
      const stockByProduct = new Map();
      for (const line of lines) {
        const skuId = Number(line.sku_id ?? line.skuId); const quantitySold = asPositiveQuantity(line.quantity ?? line.quantitySold, "quantity");
        const sku = db.prepare(`SELECT ps.*, pm.name AS product_name, pm.active AS product_active, COALESCE(s.quantity, 0) AS stock_qty FROM product_skus ps JOIN product_masters pm ON pm.id = ps.product_id LEFT JOIN stocks s ON s.product_id = pm.id WHERE ps.id = ?`).get(skuId);
        if (!sku || !sku.active || !sku.product_active) throw new Error(`sku ${skuId} is not sellable`);
        const consume = sku.conversion_qty * quantitySold;
        consumptionByProduct.set(sku.product_id, (consumptionByProduct.get(sku.product_id) || 0) + consume);
        stockByProduct.set(sku.product_id, sku.stock_qty);
        snapshots.push({ sku, quantitySold, consume, subtotal: sku.price * quantitySold });
      }
      for (const [productId, consume] of consumptionByProduct.entries()) {
        if ((stockByProduct.get(productId) || 0) < consume) throw new Error(`insufficient stock for product ${productId}`);
      }
      const total = snapshots.reduce((sum, item) => sum + item.subtotal, 0);
      const tx = db.prepare(`INSERT INTO transactions (cashier_id, total, payment_method) VALUES (?, ?, ?)`).run(user.id, total, paymentMethod);
      const transactionId = Number(tx.lastInsertRowid);
      for (const item of snapshots) {
        db.prepare(`UPDATE stocks SET quantity = quantity - ?, last_updated_by = ?, last_updated_at = datetime('now') WHERE product_id = ?`).run(item.consume, user.id, item.sku.product_id);
        db.prepare(`INSERT INTO transaction_items (transaction_id, product_id, sku_id, sku_name_snapshot, sell_unit_snapshot, conversion_qty_snapshot, quantity, quantity_sold, unit_price, subtotal) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(transactionId, item.sku.product_id, item.sku.id, item.sku.name, item.sku.sell_unit, item.sku.conversion_qty, item.quantitySold, item.quantitySold, item.sku.price, item.subtotal);
      }
      db.exec("COMMIT");
      response = { id: transactionId, total, totalLabel: rupiah(total), paymentMethod };
    } catch (err) { db.exec("ROLLBACK"); throw err; }
    res.status(201).json({ transaction: response });
  } catch (err) { if (err.message?.includes("sku") || err.message?.includes("stock") || err.message?.includes("quantity")) return badRequest(res, err.message); return handleSqlError(res, err); }
});

app.use(express.static(siteDir, { extensions: ["html"] }));
app.listen(PORT, "127.0.0.1", () => console.log(`P001 local server running on http://127.0.0.1:${PORT}`));
