const loginPanel = document.getElementById("loginPanel");
const adminPanel = document.getElementById("adminPanel");
const loginForm = document.getElementById("loginForm");
const logoutBtn = document.getElementById("logoutBtn");
const categoryForm = document.getElementById("categoryForm");
const productForm = document.getElementById("productForm");
const categoryList = document.getElementById("categoryList");
const productList = document.getElementById("productList");
const productCategory = document.getElementById("productCategory");
const message = document.getElementById("message");
const summary = document.getElementById("summary");

let categories = [];
let products = [];

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
  const fd = new FormData(form);
  const json = Object.fromEntries(fd.entries());
  json.active = form.elements.active ? form.elements.active.checked : true;
  return json;
}

function setLoggedIn(on) {
  loginPanel.hidden = on;
  adminPanel.hidden = !on;
  logoutBtn.hidden = !on;
}

async function loadAll() {
  const [dashboard, catData, productData] = await Promise.all([
    api("/api/admin/dashboard"),
    api("/api/admin/categories"),
    api("/api/admin/products")
  ]);
  categories = catData.items || [];
  products = productData.items || [];
  summary.textContent = `${dashboard.activeProducts} produk aktif • ${dashboard.lowStockProducts} stok rendah • ${dashboard.outOfStockProducts} habis`;
  renderCategories();
  renderProducts();
}

function renderCategoryOptions(selected = "") {
  productCategory.innerHTML = `<option value="">Tanpa kategori</option>` + categories
    .filter((c) => c.active)
    .map((c) => `<option value="${c.id}" ${String(c.id) === String(selected) ? "selected" : ""}>${escapeHtml(c.name)}</option>`)
    .join("");
}

function renderCategories() {
  renderCategoryOptions(productForm.elements.category_id.value);
  categoryList.innerHTML = categories.map((c) => `
    <article class="admin-row">
      <div><strong>${escapeHtml(c.name)}</strong><br><small>${c.active ? "aktif" : "nonaktif"}</small></div>
      <div class="admin-actions">
        <button type="button" data-edit-category="${c.id}" class="button small secondary">Edit</button>
        <button type="button" data-delete-category="${c.id}" class="button small secondary">Nonaktifkan</button>
      </div>
    </article>
  `).join("");
}

function renderProducts() {
  productList.innerHTML = products.map((p) => `
    <article class="admin-row">
      <div>
        <strong>${escapeHtml(p.name)}</strong> <small>${p.active ? "aktif" : "nonaktif"}</small><br>
        <small>${escapeHtml(p.priceLabel)} • stok ${p.quantity} • ${escapeHtml(p.categoryName || "Tanpa kategori")} • barcode ${escapeHtml(p.barcode || "-")}</small>
      </div>
      <div class="admin-actions">
        <button type="button" data-edit-product="${p.id}" class="button small secondary">Edit</button>
        <button type="button" data-delete-product="${p.id}" class="button small secondary">Nonaktifkan</button>
      </div>
    </article>
  `).join("");
}

function resetCategoryForm() {
  categoryForm.reset();
  categoryForm.elements.id.value = "";
  categoryForm.elements.active.checked = true;
}

function resetProductForm() {
  productForm.reset();
  productForm.elements.id.value = "";
  productForm.elements.active.checked = true;
  productForm.elements.quantity.value = 0;
  renderCategoryOptions();
}

loginForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  try {
    await api("/api/auth/login", { method: "POST", body: JSON.stringify(formJson(loginForm)) });
    setLoggedIn(true);
    await loadAll();
  } catch (err) {
    alert(err.message);
  }
});

logoutBtn.addEventListener("click", async () => {
  await api("/api/auth/logout", { method: "POST" });
  setLoggedIn(false);
});

categoryForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  try {
    const id = categoryForm.elements.id.value;
    await api(id ? `/api/admin/categories/${id}` : "/api/admin/categories", {
      method: id ? "PUT" : "POST",
      body: JSON.stringify(formJson(categoryForm))
    });
    resetCategoryForm();
    await loadAll();
    showMessage("Kategori tersimpan.");
  } catch (err) {
    showMessage(err.message, true);
  }
});

productForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  try {
    const id = productForm.elements.id.value;
    await api(id ? `/api/admin/products/${id}` : "/api/admin/products", {
      method: id ? "PUT" : "POST",
      body: JSON.stringify(formJson(productForm))
    });
    resetProductForm();
    await loadAll();
    showMessage("Produk tersimpan.");
  } catch (err) {
    showMessage(err.message, true);
  }
});

document.getElementById("resetCategory").addEventListener("click", resetCategoryForm);
document.getElementById("resetProduct").addEventListener("click", resetProductForm);

categoryList.addEventListener("click", async (e) => {
  const editId = e.target.closest("[data-edit-category]")?.dataset.editCategory;
  const deleteId = e.target.closest("[data-delete-category]")?.dataset.deleteCategory;
  if (editId) {
    const c = categories.find((item) => String(item.id) === editId);
    categoryForm.elements.id.value = c.id;
    categoryForm.elements.name.value = c.name;
    categoryForm.elements.active.checked = c.active;
  }
  if (deleteId) {
    await api(`/api/admin/categories/${deleteId}`, { method: "DELETE" });
    await loadAll();
    showMessage("Kategori dinonaktifkan.");
  }
});

productList.addEventListener("click", async (e) => {
  const editId = e.target.closest("[data-edit-product]")?.dataset.editProduct;
  const deleteId = e.target.closest("[data-delete-product]")?.dataset.deleteProduct;
  if (editId) {
    const p = products.find((item) => String(item.id) === editId);
    productForm.elements.id.value = p.id;
    productForm.elements.name.value = p.name;
    productForm.elements.price.value = p.price;
    productForm.elements.unit.value = p.unit;
    productForm.elements.barcode.value = p.barcode || "";
    productForm.elements.quantity.value = p.quantity;
    productForm.elements.description.value = p.description || "";
    productForm.elements.active.checked = p.active;
    renderCategoryOptions(p.categoryId || "");
    window.location.hash = "products";
  }
  if (deleteId) {
    await api(`/api/admin/products/${deleteId}`, { method: "DELETE" });
    await loadAll();
    showMessage("Produk dinonaktifkan.");
  }
});

(async function boot() {
  const me = await api("/api/auth/me");
  const isAdmin = me.user?.role === "owner_admin";
  setLoggedIn(isAdmin);
  if (isAdmin) await loadAll();
})().catch(() => setLoggedIn(false));
