import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import express from "express";
import cookieParser from "cookie-parser";
import session from "express-session";
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
    stockStatus: row.quantity > 0 ? "available" : "out_of_stock",
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
    WHERE p.active = 1
    ORDER BY p.name ASC
  `);

  return stmt.all().map(mapCatalogProduct);
}

function getAdminProducts() {
  const stmt = db.prepare(`
    SELECT p.id, p.name, p.description, p.price, p.unit, p.barcode, p.active,
           c.name AS category_name,
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
    categoryName: row.category_name,
    quantity: row.quantity,
    stockStatus: row.quantity > 0 ? "available" : "out_of_stock",
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

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, db: "sqlite", mode: "local-only" });
});

app.get("/api/catalog/products", (_req, res) => {
  res.json({ items: getCatalogProducts() });
});

app.get("/api/admin/products", (_req, res) => {
  res.json({ items: getAdminProducts() });
});

app.get("/api/admin/dashboard", (_req, res) => {
  res.json(getDashboardSummary());
});

app.use(express.static(siteDir, { extensions: ["html"] }));

app.listen(PORT, "127.0.0.1", () => {
  console.log(`P001 local server running on http://127.0.0.1:${PORT}`);
});
