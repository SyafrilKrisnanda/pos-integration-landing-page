import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import bcrypt from "bcryptjs";

export const DB_PATH = process.env.DB_PATH || path.resolve("./data/dev.sqlite");

function ensureDirForFile(filePath) {
  const dir = path.dirname(filePath);
  fs.mkdirSync(dir, { recursive: true });
}

export function openDb() {
  ensureDirForFile(DB_PATH);
  const db = new DatabaseSync(DB_PATH);
  db.exec("PRAGMA foreign_keys = ON;");
  db.exec("PRAGMA journal_mode = WAL;");
  return db;
}

export function initSchema(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL UNIQUE,
      role TEXT NOT NULL CHECK(role IN ('owner_admin','cashier')),
      password_hash TEXT NOT NULL,
      active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      category_id INTEGER,
      price INTEGER NOT NULL CHECK(price >= 0),
      unit TEXT NOT NULL CHECK(unit IN ('pcs','pack','kg','g','liter','ml','btl','box')),
      barcode TEXT UNIQUE,
      description TEXT NOT NULL DEFAULT '',
      active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY(category_id) REFERENCES categories(id)
    );

    CREATE TABLE IF NOT EXISTS stocks (
      product_id INTEGER PRIMARY KEY,
      quantity INTEGER NOT NULL CHECK(quantity >= 0),
      last_updated_by INTEGER,
      last_updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY(product_id) REFERENCES products(id) ON DELETE CASCADE,
      FOREIGN KEY(last_updated_by) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS stock_audits (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      product_id INTEGER NOT NULL,
      previous_quantity INTEGER NOT NULL CHECK(previous_quantity >= 0),
      new_quantity INTEGER NOT NULL CHECK(new_quantity >= 0),
      changed_by INTEGER,
      reason TEXT NOT NULL DEFAULT 'manual update',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY(product_id) REFERENCES products(id) ON DELETE CASCADE,
      FOREIGN KEY(changed_by) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      cashier_id INTEGER NOT NULL,
      total INTEGER NOT NULL CHECK(total >= 0),
      payment_method TEXT NOT NULL CHECK(payment_method IN ('cash','qris','other')),
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY(cashier_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS transaction_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      transaction_id INTEGER NOT NULL,
      product_id INTEGER NOT NULL,
      quantity INTEGER NOT NULL CHECK(quantity > 0),
      unit_price INTEGER NOT NULL CHECK(unit_price >= 0),
      subtotal INTEGER NOT NULL CHECK(subtotal >= 0),
      FOREIGN KEY(transaction_id) REFERENCES transactions(id) ON DELETE CASCADE,
      FOREIGN KEY(product_id) REFERENCES products(id)
    );

    CREATE INDEX IF NOT EXISTS idx_products_barcode ON products(barcode);
    CREATE INDEX IF NOT EXISTS idx_products_active ON products(active);
    CREATE INDEX IF NOT EXISTS idx_transactions_created_at ON transactions(created_at);
    CREATE INDEX IF NOT EXISTS idx_transaction_items_tx ON transaction_items(transaction_id);
    CREATE INDEX IF NOT EXISTS idx_stock_audits_product_created ON stock_audits(product_id, created_at);
  `);
}

export function seedDevData(db) {
  const userCount = db.prepare("SELECT COUNT(*) AS count FROM users").get().count;
  if (userCount === 0) {
    const passwordHash = bcrypt.hashSync("admin123", 10);
    db.prepare("INSERT INTO users (username, role, password_hash) VALUES (?, ?, ?)").run("admin", "owner_admin", passwordHash);
    db.prepare("INSERT INTO users (username, role, password_hash) VALUES (?, ?, ?)").run("cashier", "cashier", passwordHash);
  }

  const categoryCount = db.prepare("SELECT COUNT(*) AS count FROM categories").get().count;
  if (categoryCount === 0) {
    db.prepare("INSERT INTO categories (name) VALUES (?)").run("Sembako");
    db.prepare("INSERT INTO categories (name) VALUES (?)").run("Minuman");
  }

  const productCount = db.prepare("SELECT COUNT(*) AS count FROM products").get().count;
  if (productCount === 0) {
    const sembakoId = db.prepare("SELECT id FROM categories WHERE name = ?").get("Sembako").id;
    const minumanId = db.prepare("SELECT id FROM categories WHERE name = ?").get("Minuman").id;
    const insertProduct = db.prepare(`
      INSERT INTO products (name, category_id, price, unit, barcode, description, active)
      VALUES (?, ?, ?, ?, ?, ?, 1)
    `);
    const stock = db.prepare("INSERT INTO stocks (product_id, quantity) VALUES (?, ?)");

    const samples = [
      ["Beras Premium 5kg", sembakoId, 78000, "kg", "899001100001", "Beras premium kemasan 5kg.", 12],
      ["Minyak Goreng 1L", sembakoId, 19500, "liter", "899001100002", "Minyak goreng kemasan 1 liter.", 7],
      ["Gula Pasir 1kg", sembakoId, 16000, "kg", "899001100003", "Gula pasir kemasan 1kg.", 0],
      ["Air Mineral 600ml", minumanId, 4000, "ml", "899001100004", "Air mineral botol 600ml.", 24]
    ];

    for (const [name, categoryId, price, unit, barcode, description, quantity] of samples) {
      const result = insertProduct.run(name, categoryId, price, unit, barcode, description);
      stock.run(Number(result.lastInsertRowid), quantity);
    }
  }
}

export function initDb() {
  const db = openDb();
  initSchema(db);
  seedDevData(db);
  return db;
}
