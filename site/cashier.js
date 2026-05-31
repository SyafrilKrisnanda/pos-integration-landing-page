const loginPanel = document.getElementById("loginPanel");
const cashierPanel = document.getElementById("cashierPanel");
const loginForm = document.getElementById("loginForm");
const logoutBtn = document.getElementById("logoutBtn");
const searchForm = document.getElementById("searchForm");
const searchResults = document.getElementById("searchResults");
const cartList = document.getElementById("cartList");
const checkoutForm = document.getElementById("checkoutForm");
const clearCart = document.getElementById("clearCart");
const message = document.getElementById("message");
const receiptBox = document.getElementById("receiptBox");
const receipt = document.getElementById("receipt");

let cart = [];

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

function renderSearchResults(items = []) {
  if (!items.length) {
    searchResults.innerHTML = `<article class="admin-row"><div><strong>Tidak ada SKU sellable.</strong><br><small>Cek barcode, status aktif, atau stok base unit.</small></div></article>`;
    return;
  }
  searchResults.innerHTML = items.map((item) => `
    <article class="admin-row">
      <div>
        <strong>${escapeHtml(item.displayName)}</strong><br>
        <small>${escapeHtml(item.priceLabel)} / ${escapeHtml(item.sellUnit)} • konversi ${item.conversionQty} base unit • barcode ${escapeHtml(item.barcode || "-")}</small>
      </div>
      <div class="admin-actions">
        <button type="button" class="button small primary" data-add-sku="${item.skuId}">Tambah</button>
      </div>
    </article>
  `).join("");
  for (const item of items) {
    const button = searchResults.querySelector(`[data-add-sku="${item.skuId}"]`);
    if (button) button._sku = item;
  }
}

function renderCart() {
  if (!cart.length) {
    cartList.innerHTML = `<article class="admin-row"><div><strong>Cart kosong.</strong><br><small>Tambahkan SKU dari hasil pencarian.</small></div></article>`;
    return;
  }
  const total = cart.reduce((sum, line) => sum + lineSubtotal(line), 0);
  cartList.innerHTML = cart.map((line) => `
    <article class="admin-row">
      <div>
        <strong>${escapeHtml(line.displayName)}</strong><br>
        <small>${rupiah(line.price)} / ${escapeHtml(line.sellUnit)} • qty ${line.quantity} • konsumsi ${line.quantity * line.conversionQty} base unit • subtotal ${rupiah(lineSubtotal(line))}</small>
      </div>
      <div class="admin-actions">
        <button type="button" class="button small secondary" data-dec="${line.skuId}">−</button>
        <button type="button" class="button small secondary" data-inc="${line.skuId}">+</button>
        <button type="button" class="button small secondary" data-remove="${line.skuId}">Hapus</button>
      </div>
    </article>
  `).join("") + `<article class="admin-row"><div><strong>Total: ${rupiah(total)}</strong></div></article>`;
}

function addToCart(sku) {
  const existing = cart.find((line) => line.skuId === sku.skuId);
  if (existing) existing.quantity += 1;
  else cart.push({ ...sku, quantity: 1 });
  renderCart();
  showMessage(`${sku.displayName} ditambahkan ke cart.`);
}

loginForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  try {
    await api("/api/auth/login", { method: "POST", body: JSON.stringify(formJson(loginForm)) });
    setLoggedIn(true);
    renderCart();
  } catch (err) {
    showMessage(err.message, true);
  }
});

logoutBtn.addEventListener("click", async () => {
  await api("/api/auth/logout", { method: "POST" });
  cart = [];
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
      <article class="admin-row"><div><strong>Transaksi #${tx.id}</strong><br><small>${escapeHtml(tx.paymentMethod)} • total ${escapeHtml(tx.totalLabel)}</small></div></article>
      ${(tx.items || []).map((item) => `<article class="admin-row"><div><strong>${escapeHtml(item.displayName)}</strong><br><small>qty ${item.quantitySold} ${escapeHtml(item.sellUnit)} • konversi ${item.conversionQty} • ${escapeHtml(item.unitPriceLabel)} • subtotal ${escapeHtml(item.subtotalLabel)}</small></div></article>`).join("")}
    `;
    receiptBox.hidden = false;
    cart = [];
    renderCart();
    showMessage("Checkout berhasil.");
  } catch (err) {
    showMessage(err.message, true);
  }
});

(async function boot() {
  const me = await api("/api/auth/me");
  const isCashier = ["cashier", "owner_admin"].includes(me.user?.role);
  setLoggedIn(isCashier);
  renderCart();
})().catch(() => setLoggedIn(false));
