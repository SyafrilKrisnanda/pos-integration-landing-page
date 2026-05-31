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
    cookie: {
      httpOnly: true,
      sameSite: "lax",
      secure: false,
      maxAge: 1000 * 60 * 60 * 8
    }
  })
);

function rupiah(amount) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0
  }).format(amount);
}

function badRequest(res, message, details = undefined) {
  return res.status(400).json({ error: message, details });
}

function forbidden(res) {
  return res.status(403).json({ error: "owner_admin role required" });
}

function notFound(res, entity = "resource") {
  return res.status(404).json({ error: `${entity} not found` });
}

function toBoolInt(value, fallback = 1) {
  if (value === undefined || value === null || value === "") return fallback;
  return value === true || value === 1 || value === "1" || value === "true" ? 1 : 0;
}

function optionalText(value) {
  if (value === undefined || value === null) return null;
  const text = String(value).trim();
  return text.length ? text : null;
}

function requiredText(value, name) {
  const text = optionalText(value);
  if (!text) throw new Error(`${name} is required`);
  return text;
}

function asMoney(value, name = "price") {
  const n = Number(value);
  if (!Number.isInteger(n) || n < 0) throw new Error(`${name} must be a non-negative integer`);
  return n;
}

function asQuantity(value) {
  const n = Number(value);
  if (!Number.isInteger(n) || n < 0) throw new Error("quantity must be a non-negative integer");
  return n;
}

function asCategoryId(value) {
  if (value === undefined || value === null || value === "") return null;
  const n = Number(value);
  if (!Number.isInteger(n) || n <= 0) throw new Error("category_id must be a positive integer or null");
  return n;
}

function currentUser(req) {
  return req.session?.user ?? null;
}

function publicUser(user) {
  if (!user) return null;
  return { id: user.id, username: user.username, role: user.role };
}

function requireAuth(req, res, next) {
  if (!currentUser(req)) return res.status(401).json({ error: "login required" });
  return next();
}

function requireOwnerAdmin(req, res, next) {
  const user = currentUser(req);
  if (!user) return res.status(401).json({ error: "login required" });
  if (user.role !== "owner_admin") return forbidden(res);
  return next();
}

function mapCatalogProduct(row) {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    price: row.price,
    priceLabel: rupiah(row.price),
    unit: row.unit,
    barcode: row.barcode,
    category: row.category_name ?? null,
    stockStatus: "available",
    whatsappText: `Halo, saya mau tanya ${row.name}.`
  };
}

function getCatalogProducts() {
  const stmt = db.prepare(`
    SELECT p.id, p.name, p.description, p.price, p.unit, p.barcode,
           c.name AS category_name,
           COALESCE(s.quantity, 0) AS quantity
    FROM products p
    LEFT JOIN categories c ON c.id = p.category_id
    LEFT JOIN stocks s ON s.product_id = p.id
    WHERE p.active = 1 AND COALESCE(s.quantity, 0) > 0
    ORDER BY p.name ASC
  `);

  return stmt.all().map(mapCatalogProduct);
}

function getAdminProducts() {
  const stmt = db.prepare(`
    SELECT p.id, p.name, p.description, p.price, p.unit, p.barcode, p.active,
           p.category_id, c.name AS category_name,
           COALESCE(s.quantity, 0) AS quantity,
           p.updated_at
    FROM products p
    LEFT JOIN categories c ON c.id = p.category_id
    LEFT JOIN stocks s ON s.product_id = p.id
    ORDER BY p.created_at DESC, p.id DESC
  `);

  return stmt.all().map((row) => ({
    id: row.id,
    name: row.name,
    description: row.description,
    price: row.price,
    priceLabel: rupiah(row.price),
    unit: row.unit,
    barcode: row.barcode,
    active: Boolean(row.active),
    categoryId: row.category_id,
    categoryName: row.category_name,
    quantity: row.quantity,
    stockStatus: row.quantity > 0 ? "available" : "out_of_stock",
    updatedAt: row.updated_at
  }));
}

function getCategories() {
  return db.prepare(`
    SELECT id, name, active, created_at, updated_at
    FROM categories
    ORDER BY active DESC, name ASC
  `).all().map((row) => ({
    id: row.id,
    name: row.name,
    active: Boolean(row.active),
    createdAt: row.created_at,
    updatedAt: row.updated_at
  }));
}

function getDashboardSummary() {
  const totals = db.prepare(`
    SELECT
      COUNT(*) AS transaction_count,
      COALESCE(SUM(total), 0) AS total_sales
    FROM transactions
  `).get();

  const activeProducts = db.prepare(`
    SELECT COUNT(*) AS count FROM products WHERE active = 1
  `).get();

  const lowStock = db.prepare(`
    SELECT COUNT(*) AS count
    FROM stocks s
    JOIN products p ON p.id = s.product_id
    WHERE p.active = 1 AND s.quantity BETWEEN 1 AND 5
  `).get();

  const outOfStock = db.prepare(`
    SELECT COUNT(*) AS count
    FROM stocks s
    JOIN products p ON p.id = s.product_id
    WHERE p.active = 1 AND s.quantity = 0
  `).get();

  return {
    transactionCount: totals.transaction_count,
    totalSales: totals.total_sales,
    totalSalesLabel: rupiah(totals.total_sales),
    activeProducts: activeProducts.count,
    lowStockProducts: lowStock.count,
    outOfStockProducts: outOfStock.count
  };
}

function productPayload(body, partial = false) {
  const payload = {};
  if (!partial || body.name !== undefined) payload.name = requiredText(body.name, "name");
  if (!partial || body.price !== undefined) payload.price = asMoney(body.price);
  if (!partial || body.unit !== undefined) payload.unit = requiredText(body.unit, "unit");
  if (!partial || body.category_id !== undefined || body.categoryId !== undefined) {
    payload.categoryId = asCategoryId(body.category_id ?? body.categoryId);
  }
  if (!partial || body.barcode !== undefined) payload.barcode = optionalText(body.barcode);
  if (!partial || body.description !== undefined) payload.description = String(body.description ?? "").trim();
  if (!partial || body.active !== undefined) payload.active = toBoolInt(body.active, 1);
  if (!partial || body.quantity !== undefined) payload.quantity = asQuantity(body.quantity ?? 0);
  return payload;
}

function handleSqlError(res, err) {
  const message = String(err?.message || "");
  if (message.includes("UNIQUE constraint failed: products.barcode")) return badRequest(res, "barcode must be unique");
  if (message.includes("UNIQUE constraint failed: categories.name")) return badRequest(res, "category name must be unique");
  if (message.includes("CHECK constraint failed")) return badRequest(res, "invalid value", message);
  if (message.includes("FOREIGN KEY constraint failed")) return badRequest(res, "referenced record does not exist");
  console.error(err);
  return res.status(500).json({ error: "internal server error" });
}

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, db: "sqlite", mode: "local-only" });
});

app.post("/api/auth/login", (req, res) => {
  const username = optionalText(req.body.username);
  const password = String(req.body.password ?? "");
  if (!username || !password) return badRequest(res, "username and password are required");

  const user = db.prepare(`
    SELECT id, username, role, password_hash, active
    FROM users
    WHERE username = ?
  `).get(username);

  if (!user || !user.active || !bcrypt.compareSync(password, user.password_hash)) {
    return res.status(401).json({ error: "invalid username or password" });
  }

  req.session.user = publicUser(user);
  res.json({ user: req.session.user });
});

app.post("/api/auth/logout", (req, res) => {
  req.session.destroy(() => res.json({ ok: true }));
});

app.get("/api/auth/me", (req, res) => {
  res.json({ user: publicUser(currentUser(req)) });
});

app.get("/api/catalog/products", (_req, res) => {
  res.json({ items: getCatalogProducts() });
});

app.get("/api/admin/dashboard", requireOwnerAdmin, (_req, res) => {
  res.json(getDashboardSummary());
});

app.get("/api/admin/categories", requireOwnerAdmin, (_req, res) => {
  res.json({ items: getCategories() });
});

app.post("/api/admin/categories", requireOwnerAdmin, (req, res) => {
  try {
    const name = requiredText(req.body.name, "name");
    const active = toBoolInt(req.body.active, 1);
    const result = db.prepare("INSERT INTO categories (name, active) VALUES (?, ?)").run(name, active);
    res.status(201).json({ item: getCategories().find((c) => c.id === Number(result.lastInsertRowid)) });
  } catch (err) {
    if (err.message?.includes("required")) return badRequest(res, err.message);
    return handleSqlError(res, err);
  }
});

app.put("/api/admin/categories/:id", requireOwnerAdmin, (req, res) => {
  try {
    const id = Number(req.params.id);
    const existing = db.prepare("SELECT id FROM categories WHERE id = ?").get(id);
    if (!existing) return notFound(res, "category");
    const name = requiredText(req.body.name, "name");
    const active = toBoolInt(req.body.active, 1);
    db.prepare("UPDATE categories SET name = ?, active = ?, updated_at = datetime('now') WHERE id = ?").run(name, active, id);
    res.json({ item: getCategories().find((c) => c.id === id) });
  } catch (err) {
    if (err.message?.includes("required")) return badRequest(res, err.message);
    return handleSqlError(res, err);
  }
});

app.delete("/api/admin/categories/:id", requireOwnerAdmin, (req, res) => {
  const id = Number(req.params.id);
  const existing = db.prepare("SELECT id FROM categories WHERE id = ?").get(id);
  if (!existing) return notFound(res, "category");
  db.prepare("UPDATE categories SET active = 0, updated_at = datetime('now') WHERE id = ?").run(id);
  res.json({ ok: true, softDeleted: true });
});

app.get("/api/admin/products", requireOwnerAdmin, (_req, res) => {
  res.json({ items: getAdminProducts() });
});

app.post("/api/admin/products", requireOwnerAdmin, (req, res) => {
  try {
    const p = productPayload(req.body);
    const insert = db.prepare(`
      INSERT INTO products (name, category_id, price, unit, barcode, description, active)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    const result = insert.run(p.name, p.categoryId, p.price, p.unit, p.barcode, p.description, p.active);
    const productId = Number(result.lastInsertRowid);
    db.prepare("INSERT INTO stocks (product_id, quantity, last_updated_by) VALUES (?, ?, ?)").run(productId, p.quantity, currentUser(req).id);
    res.status(201).json({ item: getAdminProducts().find((item) => item.id === productId) });
  } catch (err) {
    if (err.message?.includes("required") || err.message?.includes("must be")) return badRequest(res, err.message);
    return handleSqlError(res, err);
  }
});

app.put("/api/admin/products/:id", requireOwnerAdmin, (req, res) => {
  try {
    const id = Number(req.params.id);
    const existing = db.prepare("SELECT id FROM products WHERE id = ?").get(id);
    if (!existing) return notFound(res, "product");
    const p = productPayload(req.body);
    db.prepare(`
      UPDATE products
      SET name = ?, category_id = ?, price = ?, unit = ?, barcode = ?, description = ?, active = ?, updated_at = datetime('now')
      WHERE id = ?
    `).run(p.name, p.categoryId, p.price, p.unit, p.barcode, p.description, p.active, id);
    if (req.body.quantity !== undefined) {
      updateStock(id, p.quantity, currentUser(req).id, optionalText(req.body.reason) || "product update");
    }
    res.json({ item: getAdminProducts().find((item) => item.id === id) });
  } catch (err) {
    if (err.message?.includes("required") || err.message?.includes("must be")) return badRequest(res, err.message);
    return handleSqlError(res, err);
  }
});

app.delete("/api/admin/products/:id", requireOwnerAdmin, (req, res) => {
  const id = Number(req.params.id);
  const existing = db.prepare("SELECT id FROM products WHERE id = ?").get(id);
  if (!existing) return notFound(res, "product");
  db.prepare("UPDATE products SET active = 0, updated_at = datetime('now') WHERE id = ?").run(id);
  res.json({ ok: true, softDeleted: true });
});

function updateStock(productId, nextQuantity, userId, reason) {
  const product = db.prepare("SELECT id FROM products WHERE id = ?").get(productId);
  if (!product) throw new Error("product not found");

  const current = db.prepare("SELECT quantity FROM stocks WHERE product_id = ?").get(productId);
  const previousQuantity = current ? current.quantity : 0;
  db.prepare(`
    INSERT INTO stocks (product_id, quantity, last_updated_by, last_updated_at)
    VALUES (?, ?, ?, datetime('now'))
    ON CONFLICT(product_id) DO UPDATE SET
      quantity = excluded.quantity,
      last_updated_by = excluded.last_updated_by,
      last_updated_at = datetime('now')
  `).run(productId, nextQuantity, userId);

  db.prepare(`
    INSERT INTO stock_audits (product_id, previous_quantity, new_quantity, changed_by, reason)
    VALUES (?, ?, ?, ?, ?)
  `).run(productId, previousQuantity, nextQuantity, userId, reason || "manual update");
}

app.post("/api/admin/products/:id/stock", requireOwnerAdmin, (req, res) => {
  try {
    const id = Number(req.params.id);
    const quantity = asQuantity(req.body.quantity);
    updateStock(id, quantity, currentUser(req).id, optionalText(req.body.reason) || "manual update");
    res.json({ item: getAdminProducts().find((item) => item.id === id) });
  } catch (err) {
    if (err.message === "product not found") return notFound(res, "product");
    if (err.message?.includes("quantity")) return badRequest(res, err.message);
    return handleSqlError(res, err);
  }
});

app.get("/api/admin/stock-audits", requireOwnerAdmin, (_req, res) => {
  const items = db.prepare(`
    SELECT a.id, a.product_id, p.name AS product_name, a.previous_quantity, a.new_quantity,
           u.username AS changed_by_username, a.reason, a.created_at
    FROM stock_audits a
    JOIN products p ON p.id = a.product_id
    LEFT JOIN users u ON u.id = a.changed_by
    ORDER BY a.created_at DESC, a.id DESC
    LIMIT 100
  `).all();
  res.json({ items });
});

app.use(express.static(siteDir, { extensions: ["html"] }));

app.listen(PORT, "127.0.0.1", () => {
  console.log(`P001 local server running on http://127.0.0.1:${PORT}`);
});
