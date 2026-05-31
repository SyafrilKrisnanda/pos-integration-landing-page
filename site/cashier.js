const loginPanel = document.getElementById("loginPanel");
const cashierPanel = document.getElementById("cashierPanel");
const loginForm = document.getElementById("loginForm");
const logoutBtn = document.getElementById("logoutBtn");
const searchForm = document.getElementById("searchForm");
const searchResults = document.getElementById("searchResults");
const categoryChips = document.getElementById("categoryChips");
const catalogList = document.getElementById("catalogList");
const cartList = document.getElementById("cartList");
const checkoutForm = document.getElementById("checkoutForm");
const clearCart = document.getElementById("clearCart");
const message = document.getElementById("message");
const receiptBox = document.getElementById("receiptBox");
const receipt = document.getElementById("receipt");

let cart = [];
let cashierCatalog = [];
let categories = [];
let activeCategory = "all";

function escapeHtml(str) {
  return String(str ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function showMessage(text, isError = false) {
  message.hidden = false;
  message.textContent = text;
  message.classList.toggle("error", isError);
}

async function api(path, options = {}) {
  const res = await fetch(path, {
    headers: { Accept: "application/json", "Content-Type": "application/json", ...(options.headers || {}) },
    ...options
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data;
}

function formJson(form) {
  return Object.fromEntries(new FormData(form).entries());
}

function setLoggedIn(on) {
  loginPanel.hidden = on;
  cashierPanel.hidden = !on;
  logoutBtn.hidden = !on;
}

function lineSubtotal(line) {
  return line.price * line.quantity;
}

function rupiah(amount) {
  return new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(amount);
}

function formatReceiptDate(value) {
  if (!value) return "-";
  const date = new Date(String(value).replace(" ", "T") + "Z");
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("id-ID", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(date);
}

function renderSearchResults(items = []) {
  if (!items.length) {
    searchResults.innerHTML = `<article class="admin-row empty-row"><div><strong>Tidak ada SKU sellable.</strong><br><small>Cek barcode, status aktif, atau stok base unit.</small></div></article>`;
    return;
  }
  searchResults.innerHTML = items.map((item) => `
    <article class="admin-row pos-row sku-row">
      <div class="row-main">
        <strong>${escapeHtml(item.displayName)}</strong>
        <small>${escapeHtml(item.categoryName || "Tanpa kategori")} • konversi ${item.conversionQty} base unit • barcode ${escapeHtml(item.barcode || "-")}</small>
      </div>
      <div class="row-side">
        <span class="price-pill">${escapeHtml(item.priceLabel)} / ${escapeHtml(item.sellUnit)}</span>
        <button type="button" class="button small primary" data-add-sku="${item.skuId}">Tambah</button>
      </div>
    </article>
  `).join("");
  for (const item of items) {
    const button = searchResults.querySelector(`[data-add-sku="${item.skuId}"]`);
    if (button) button._sku = item;
  }
}

function renderCategoryChips() {
  const all = [{ id: "all", name: "Semua" }, ...categories];
  categoryChips.innerHTML = all.map((category) => `
    <button type="button" class="chip ${String(activeCategory) === String(category.id) ? "active" : ""}" data-category="${escapeHtml(category.id)}">
      ${escapeHtml(category.name)}
    </button>
  `).join("");
}

function filteredCatalog() {
  return cashierCatalog.filter((item) => {
    if (activeCategory === "all") return true;
    if (activeCategory === "none") return item.categoryId == null;
    return String(item.categoryId) === String(activeCategory);
  });
}

function renderCatalog() {
  const items = filteredCatalog();
  if (!items.length) {
    catalogList.innerHTML = `<article class="admin-row empty-row"><div><strong>Belum ada SKU di kategori ini.</strong></div></article>`;
    return;
  }
  catalogList.innerHTML = items.map((item) => `
    <article class="admin-row pos-row sku-row">
      <div class="row-main">
        <strong>${escapeHtml(item.displayName)}</strong>
        <small>${escapeHtml(item.categoryName || "Tanpa kategori")} • konversi ${item.conversionQty} base unit</small>
      </div>
      <div class="row-side">
        <span class="price-pill">${escapeHtml(item.priceLabel)} / ${escapeHtml(item.sellUnit)}</span>
        <button type="button" class="button small primary" data-catalog-add="${item.skuId}">Tambah</button>
      </div>
    </article>
  `).join("");
  for (const item of items) {
    const button = catalogList.querySelector(`[data-catalog-add="${item.skuId}"]`);
    if (button) button._sku = item;
  }
}

function renderCart() {
  if (!cart.length) {
    cartList.innerHTML = `<article class="admin-row empty-row"><div><strong>Cart kosong.</strong><br><small>Tambahkan SKU dari katalog atau hasil pencarian.</small></div></article>`;
    return;
  }
  const total = cart.reduce((sum, line) => sum + lineSubtotal(line), 0);
  cartList.innerHTML = cart.map((line) => `
    <article class="admin-row pos-row cart-row">
      <div class="row-main">
        <strong>${escapeHtml(line.displayName)}</strong>
        <small>${rupiah(line.price)} / ${escapeHtml(line.sellUnit)} • konsumsi ${line.quantity * line.conversionQty} base unit</small>
      </div>
      <div class="cart-controls" aria-label="Kontrol qty ${escapeHtml(line.displayName)}">
        <button type="button" class="button small secondary qty-btn" data-dec="${line.skuId}">−</button>
        <span class="qty-pill">${line.quantity}</span>
        <button type="button" class="button small secondary qty-btn" data-inc="${line.skuId}">+</button>
        <strong class="line-subtotal">${rupiah(lineSubtotal(line))}</strong>
        <button type="button" class="button small secondary remove-btn" data-remove="${line.skuId}">Hapus</button>
      </div>
    </article>
  `).join("") + `<article class="admin-row cart-total"><span>Total</span><strong>${rupiah(total)}</strong></article>`;
}

function addToCart(sku) {
  const existing = cart.find((line) => line.skuId === sku.skuId);
  if (existing) existing.quantity += 1;
  else cart.push({ ...sku, quantity: 1 });
  renderCart();
  showMessage(`${sku.displayName} ditambahkan ke cart.`);
}

async function loadCatalog() {
  const data = await api("/api/cashier/catalog");
  categories = (data.categories || []).map((item) => ({
    id: item.id ?? "none",
    name: item.name
  }));
  cashierCatalog = data.items || [];
  renderCategoryChips();
  renderCatalog();
}

loginForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  try {
    await api("/api/auth/login", { method: "POST", body: JSON.stringify(formJson(loginForm)) });
    setLoggedIn(true);
    await loadCatalog();
    renderCart();
  } catch (err) {
    showMessage(err.message, true);
  }
});

logoutBtn.addEventListener("click", async () => {
  await api("/api/auth/logout", { method: "POST" });
  cart = [];
  cashierCatalog = [];
  setLoggedIn(false);
});

searchForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  try {
    const term = searchForm.elements.term.value.trim();
    const looksBarcode = /^[A-Za-z0-9._:-]+$/.test(term);
    let data = looksBarcode ? await api(`/api/cashier/products/search?barcode=${encodeURIComponent(term)}`) : { items: [] };
    if (!looksBarcode || !(data.items || []).length) data = await api(`/api/cashier/products/search?q=${encodeURIComponent(term)}`);
    renderSearchResults(data.items || []);
    if ((data.items || []).length === 1 && looksBarcode) addToCart(data.items[0]);
  } catch (err) {
    showMessage(err.message, true);
  }
});

searchResults.addEventListener("click", (e) => {
  const btn = e.target.closest("[data-add-sku]");
  if (btn?._sku) addToCart(btn._sku);
});

catalogList.addEventListener("click", (e) => {
  const btn = e.target.closest("[data-catalog-add]");
  if (btn?._sku) addToCart(btn._sku);
});

categoryChips.addEventListener("click", (e) => {
  const btn = e.target.closest("[data-category]");
  if (!btn) return;
  activeCategory = btn.dataset.category;
  renderCategoryChips();
  renderCatalog();
});

cartList.addEventListener("click", (e) => {
  const inc = e.target.closest("[data-inc]")?.dataset.inc;
  const dec = e.target.closest("[data-dec]")?.dataset.dec;
  const remove = e.target.closest("[data-remove]")?.dataset.remove;
  if (inc) cart.find((line) => String(line.skuId) === inc).quantity += 1;
  if (dec) {
    const line = cart.find((candidate) => String(candidate.skuId) === dec);
    line.quantity -= 1;
    if (line.quantity <= 0) cart = cart.filter((candidate) => String(candidate.skuId) !== dec);
  }
  if (remove) cart = cart.filter((line) => String(line.skuId) !== remove);
  renderCart();
});

clearCart.addEventListener("click", () => {
  cart = [];
  receiptBox.hidden = true;
  renderCart();
});

checkoutForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  if (!cart.length) return showMessage("Cart masih kosong.", true);
  try {
    const payload = {
      paymentMethod: checkoutForm.elements.paymentMethod.value,
      items: cart.map((line) => ({ skuId: line.skuId, quantity: line.quantity }))
    };
    const data = await api("/api/cashier/checkout", { method: "POST", body: JSON.stringify(payload) });
    const tx = data.transaction;
    receipt.innerHTML = `
      <div class="receipt-card">
        <div class="receipt-head">
          <div>
            <strong>Receipt #${tx.id}</strong>
            <small>${escapeHtml(formatReceiptDate(tx.createdAt))}</small>
          </div>
          <div class="receipt-meta">
            <small>Bayar: ${escapeHtml(tx.paymentMethod.toUpperCase())}</small>
          </div>
        </div>
        <div class="receipt-lines">
          ${(tx.items || []).map((item) => `
            <div class="receipt-line">
              <div>
                <strong>${escapeHtml(item.displayName)}</strong>
                <small>${item.quantitySold} × ${escapeHtml(item.sellUnit)} • ${escapeHtml(item.unitPriceLabel)}</small>
              </div>
              <div class="receipt-line-right">
                <strong>${escapeHtml(item.subtotalLabel)}</strong>
                <small>${item.baseUnitsConsumed} base unit</small>
              </div>
            </div>
          `).join("")}
        </div>
        <div class="receipt-total">
          <strong>Total</strong>
          <strong>${escapeHtml(tx.totalLabel)}</strong>
        </div>
      </div>
    `;
    receiptBox.hidden = false;
    cart = [];
    renderCart();
    await loadCatalog();
    showMessage("Checkout berhasil.");
  } catch (err) {
    showMessage(err.message, true);
  }
});

(async function boot() {
  const me = await api("/api/auth/me");
  const isCashier = ["cashier", "owner_admin"].includes(me.user?.role);
  setLoggedIn(isCashier);
  if (isCashier) await loadCatalog();
  renderCart();
})().catch(() => setLoggedIn(false));
