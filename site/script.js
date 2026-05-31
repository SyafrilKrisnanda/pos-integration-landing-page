const yearEl = document.getElementById("year");
if (yearEl) yearEl.textContent = new Date().getFullYear();

const grid = document.getElementById("grid");
const empty = document.getElementById("empty");
const search = document.getElementById("search");
const chips = document.getElementById("chips");

const DEFAULT_WA = "https://wa.me/6282132227306?text=";

function escapeHtml(str) {
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function toWaLink(message) {
  return `${DEFAULT_WA}${encodeURIComponent(message)}`;
}

function productImageSeed(name) {
  const key = String(name || "").toLowerCase();

  if (key.includes("beras")) return "./assets/products/rice-premium-5kg.png";
  if (key.includes("minyak")) return "./assets/products/minyak-goreng-1l.png";
  if (key.includes("gula")) return "./assets/products/gula-pasir-1kg.png";
  if (key.includes("air mineral") || key.includes("mineral")) return "./assets/products/air-mineral-600ml.png";

  // fallback dummy
  const assets = ["bakso-hero.png", "bakso-urat.png", "mie-ayam.png"];
  let hash = 0;
  for (let i = 0; i < key.length; i++) hash = (hash * 31 + key.charCodeAt(i)) >>> 0;
  return `./assets/${assets[hash % assets.length]}`;
}

function badge(stockStatus) {
  if (stockStatus === "available") return { text: "Tersedia", cls: "ok" };
  return { text: "Habis", cls: "off" };
}

function renderCard(p) {
  const b = badge(p.stockStatus);
  const cat = p.category ? `<span class="meta">${escapeHtml(p.category)}</span>` : "";
  const wa = toWaLink(p.whatsappText || `Halo, saya mau tanya ${p.name}.`);

  return `
    <article class="card" data-category="${escapeHtml(p.category || "")}">
      <div class="thumb">
        <img src="${productImageSeed(p.name)}" alt="${escapeHtml(p.name)}" loading="lazy" />
        <span class="badge ${b.cls}">${b.text}</span>
      </div>
      <div class="content">
        <h3 class="title">${escapeHtml(p.name)}</h3>
        <p class="desc">${escapeHtml(p.description || "")}</p>
        <div class="row">
          <strong class="price">${escapeHtml(p.priceLabel || "")}</strong>
          ${cat}
        </div>
        <a class="button primary full" href="${wa}" target="_blank" rel="noopener">Chat WhatsApp</a>
      </div>
    </article>
  `.trim();
}

function normalizeCategory(c) {
  const s = String(c || "").trim();
  return s.length ? s : "Lainnya";
}

function uniqueSorted(arr) {
  return Array.from(new Set(arr)).sort((a, b) => a.localeCompare(b, "id"));
}

function renderChips(categories, active) {
  const all = ["Semua", ...categories];
  chips.innerHTML = all
    .map((c) => {
      const isActive = c === active;
      return `<button class="chip ${isActive ? "active" : ""}" data-chip="${escapeHtml(c)}" type="button">${escapeHtml(c)}</button>`;
    })
    .join("");
}

function applyFilter(state, products) {
  const q = (state.query || "").trim().toLowerCase();
  const cat = state.category;

  const filtered = products.filter((p) => {
    const matchText =
      !q ||
      String(p.name || "").toLowerCase().includes(q) ||
      String(p.description || "").toLowerCase().includes(q) ||
      String(p.category || "").toLowerCase().includes(q);

    const pCat = normalizeCategory(p.category);
    const matchCat = cat === "Semua" || pCat === cat;
    return matchText && matchCat;
  });

  grid.innerHTML = filtered.map(renderCard).join("");
  empty.hidden = filtered.length !== 0;
}

async function main() {
  if (!grid) return;

  grid.innerHTML = `
    <div class="skeleton"></div>
    <div class="skeleton"></div>
    <div class="skeleton"></div>
    <div class="skeleton"></div>
    <div class="skeleton"></div>
    <div class="skeleton"></div>
  `;

  const res = await fetch("/api/catalog/products", { headers: { Accept: "application/json" } });
  const data = await res.json();
  const products = Array.isArray(data.items) ? data.items : [];

  const categories = uniqueSorted(products.map((p) => normalizeCategory(p.category)));
  const state = { query: "", category: "Semua" };

  if (chips) {
    renderChips(categories, state.category);
    chips.addEventListener("click", (e) => {
      const btn = e.target.closest("button[data-chip]");
      if (!btn) return;
      state.category = btn.dataset.chip;
      renderChips(categories, state.category);
      applyFilter(state, products);
    });
  }

  if (search) {
    search.addEventListener("input", () => {
      state.query = search.value;
      applyFilter(state, products);
    });
  }

  applyFilter(state, products);
}

main().catch((err) => {
  console.error(err);
  if (grid) grid.innerHTML = "";
  if (empty) {
    empty.hidden = false;
    empty.innerHTML = "<p><strong>Gagal memuat katalog.</strong></p><p>Coba refresh halaman.</p>";
  }
});
