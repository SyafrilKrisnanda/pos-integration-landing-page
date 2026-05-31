import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import bcrypt from "bcryptjs";

export const DB_PATH = process.env.DB_PATH || path.resolve("./data/dev.sqlite");

function ensureDirForFile(filePath) {
  const dir = path.dirname(filePath);
  fs.mkdirSync(dir, { recursive: true });
}

function tableExists(db, name) {
  return Boolean(db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?").get(name));
}

function columnExists(db, table, column) {
  return db.prepare(`PRAGMA table_info(${table})`).all().some((row) => row.name === column);
}

function addColumnIfMissing(db, table, column, definition) {
  if (!columnExists(db, table, column)) db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
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

    CREATE TABLE IF NOT EXISTS product_masters (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      category_id INTEGER,
      description TEXT NOT NULL DEFAULT '',
      base_unit TEXT NOT NULL CHECK(base_unit IN ('pcs','pack','kg','g','liter','ml','btl','box')),
      active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY(category_id) REFERENCES categories(id)
    );

    CREATE TABLE IF NOT EXISTS product_skus (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      product_id INTEGER NOT NULL,
      name TEXT NOT NULL DEFAULT 'Default',
      barcode TEXT UNIQUE,
      sell_unit TEXT NOT NULL CHECK(sell_unit IN ('pcs','pack','kg','g','liter','ml','btl','box')),
      conversion_qty INTEGER NOT NULL CHECK(conversion_qty > 0),
      price INTEGER NOT NULL CHECK(price >= 0),
      active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY(product_id) REFERENCES product_masters(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS stocks (
      product_id INTEGER PRIMARY KEY,
      quantity INTEGER NOT NULL CHECK(quantity >= 0),
      last_updated_by INTEGER,
      last_updated_at TEXT NOT NULL DEFAULT (datetime('now')),
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
      FOREIGN KEY(changed_by) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      cashier_id INTEGER NOT NULL,
      total INTEGER NOT NULL CHECK(total >= 0),
      payment_method TEXT NOT NULL CHECK(payment_method IN ('cash','qris','other')),
      idempotency_key TEXT,
      request_hash TEXT,
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
      FOREIGN KEY(transaction_id) REFERENCES transactions(id) ON DELETE CASCADE
    );
  `);

  addColumnIfMissing(db, "transactions", "idempotency_key", "TEXT");
  addColumnIfMissing(db, "transactions", "request_hash", "TEXT");
  addColumnIfMissing(db, "transaction_items", "sku_id", "INTEGER");
  addColumnIfMissing(db, "transaction_items", "sku_name_snapshot", "TEXT");
  addColumnIfMissing(db, "transaction_items", "sell_unit_snapshot", "TEXT");
  addColumnIfMissing(db, "transaction_items", "conversion_qty_snapshot", "INTEGER");
  addColumnIfMissing(db, "transaction_items", "quantity_sold", "INTEGER");
  addColumnIfMissing(db, "stock_audits", "sku_id", "INTEGER");

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_products_barcode ON products(barcode);
    CREATE INDEX IF NOT EXISTS idx_products_active ON products(active);
    CREATE INDEX IF NOT EXISTS idx_product_masters_active ON product_masters(active);
    CREATE INDEX IF NOT EXISTS idx_product_skus_product ON product_skus(product_id);
    CREATE INDEX IF NOT EXISTS idx_product_skus_barcode ON product_skus(barcode);
    CREATE INDEX IF NOT EXISTS idx_product_skus_active ON product_skus(active);
    CREATE INDEX IF NOT EXISTS idx_transactions_created_at ON transactions(created_at);
    CREATE UNIQUE INDEX IF NOT EXISTS idx_transactions_cashier_idempotency ON transactions(cashier_id, idempotency_key) WHERE idempotency_key IS NOT NULL;
    CREATE INDEX IF NOT EXISTS idx_transaction_items_tx ON transaction_items(transaction_id);
    CREATE INDEX IF NOT EXISTS idx_transaction_items_sku ON transaction_items(sku_id);
    CREATE INDEX IF NOT EXISTS idx_stock_audits_product_created ON stock_audits(product_id, created_at);
  `);

  migrateLegacyProducts(db);
}

function migrateLegacyProducts(db) {
  if (!tableExists(db, "products")) return;
  const legacyRows = db.prepare(`
    SELECT p.id, p.name, p.category_id, p.description, p.unit, p.price, p.barcode, p.active, p.created_at, p.updated_at
    FROM products p
    LEFT JOIN product_masters pm ON pm.id = p.id
    WHERE pm.id IS NULL
    ORDER BY p.id ASC
  `).all();

  const insertMaster = db.prepare(`
    INSERT INTO product_masters (id, name, category_id, description, base_unit, active, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const insertSku = db.prepare(`
    INSERT INTO product_skus (product_id, name, barcode, sell_unit, conversion_qty, price, active, created_at, updated_at)
    VALUES (?, 'Default', ?, ?, 1, ?, ?, ?, ?)
  `);

  db.exec("BEGIN IMMEDIATE");
  try {
    for (const row of legacyRows) {
      insertMaster.run(row.id, row.name, row.category_id, row.description ?? "", row.unit, row.active, row.created_at, row.updated_at);
      insertSku.run(row.id, row.barcode, row.unit, row.price, row.active, row.created_at, row.updated_at);
    }
    db.exec("COMMIT");
  } catch (err) {
    db.exec("ROLLBACK");
    throw err;
  }

  const seq = db.prepare("SELECT COALESCE(MAX(id), 0) AS max_id FROM product_masters").get().max_id;
  const updated = db.prepare("UPDATE sqlite_sequence SET seq = MAX(seq, ?) WHERE name = 'product_masters'").run(seq);
  if (updated.changes === 0) db.prepare("INSERT INTO sqlite_sequence(name, seq) VALUES('product_masters', ?)").run(seq);
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

  const productCount = db.prepare("SELECT COUNT(*) AS count FROM product_masters").get().count;
  if (productCount === 0) {
    const sembakoId = db.prepare("SELECT id FROM categories WHERE name = ?").get("Sembako").id;
    const minumanId = db.prepare("SELECT id FROM categories WHERE name = ?").get("Minuman").id;
    const insertMaster = db.prepare(`
      INSERT INTO product_masters (name, category_id, description, base_unit, active)
      VALUES (?, ?, ?, ?, 1)
    `);
    const insertSku = db.prepare(`
      INSERT INTO product_skus (product_id, name, barcode, sell_unit, conversion_qty, price, active)
      VALUES (?, 'Default', ?, ?, 1, ?, 1)
    `);
    const insertLegacy = db.prepare(`
      INSERT INTO products (id, name, category_id, price, unit, barcode, description, active)
      VALUES (?, ?, ?, ?, ?, ?, ?, 1)
    `);
    const stock = db.prepare("INSERT INTO stocks (product_id, quantity) VALUES (?, ?)");

    const samples = [
      ["Beras Premium 5kg", sembakoId, 78000, "kg", "899001100001", "Beras premium kemasan 5kg.", 12],
      ["Minyak Goreng 1L", sembakoId, 19500, "liter", "899001100002", "Minyak goreng kemasan 1 liter.", 7],
      ["Gula Pasir 1kg", sembakoId, 16000, "kg", "899001100003", "Gula pasir kemasan 1kg.", 0],
      ["Air Mineral 600ml", minumanId, 4000, "ml", "899001100004", "Air mineral botol 600ml.", 24]
    ];

    for (const [name, categoryId, price, unit, barcode, description, quantity] of samples) {
      const result = insertMaster.run(name, categoryId, description, unit);
      const productId = Number(result.lastInsertRowid);
      insertSku.run(productId, barcode, unit, price);
      insertLegacy.run(productId, name, categoryId, price, unit, barcode, description);
      stock.run(productId, quantity);
    }
  }

  // Retail mixed-unit example: Baterai AAA (ecer vs pack 4).
  // Insert only if not present.
  const batteryExists = db.prepare("SELECT COUNT(*) AS count FROM product_masters WHERE name = ?").get("Baterai AAA").count;
  if (batteryExists === 0) {
    const sembako = db.prepare("SELECT id FROM categories WHERE name = ?").get("Sembako");
    const sembakoId = sembako?.id ?? null;

    const result = db.prepare(
      "INSERT INTO product_masters (name, category_id, description, base_unit, active) VALUES (?, ?, ?, ?, 1)"
    ).run("Baterai AAA", sembakoId, "Contoh produk retail: bisa dijual ecer atau per pack.", "pcs");
    const productId = Number(result.lastInsertRowid);

    // Legacy sync for older DBs that still enforce FK from stocks.product_id -> products.id.
    // Insert legacy product row first, then stocks.
    db.prepare(
      "INSERT OR IGNORE INTO products (id, name, category_id, price, unit, barcode, description, active) VALUES (?, ?, ?, ?, ?, ?, ?, 1)"
    ).run(productId, "Baterai AAA", sembakoId, 3000, "pcs", "899009990001", "Contoh produk retail: ecer/pack.");

    db.prepare("INSERT OR IGNORE INTO stocks (product_id, quantity) VALUES (?, ?)").run(productId, 24);

    // SKU: Ecer (1 pcs)
    db.prepare(
      "INSERT INTO product_skus (product_id, name, barcode, sell_unit, conversion_qty, price, active) VALUES (?, ?, ?, ?, ?, ?, 1)"
    ).run(productId, "Ecer", "899009990001", "pcs", 1, 3000);

    // SKU: Pack 4 (4 pcs)
    db.prepare(
      "INSERT INTO product_skus (product_id, name, barcode, sell_unit, conversion_qty, price, active) VALUES (?, ?, ?, ?, ?, ?, 1)"
    ).run(productId, "Pack 4", "899009990002", "pack", 4, 10000);
  }
}

export function initDb() {
  const db = openDb();
  initSchema(db);
  seedDevData(db);
  return db;
}
