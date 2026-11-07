import { supabase } from "../lib/supabase";
import BuyWithBalance from "../components/BuyWithBalance";
import ManualCheckout from "../components/ManualCheckout";

export const dynamic = "force-dynamic";

type Product = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  category: string | null;
  badge: string | null;
  emoji: string | null;
  price_cents: number;
  warranty_price_cents: number | null;
  stock_count: number | null;
  stock_label: string | null;
  active: boolean;
  sort_order: number;
};

const money = (cents: number) => "$" + (cents / 100).toFixed(2);

const inventoryGroups = [
  {
    category: "NFA — Skinned Random Accounts",
    title: "NFA — Skinned Random Accounts",
    subtitle: "Random NFA accounts grouped by skin count",
  },
  {
    category: "NFA — Random V-Bucks Accounts",
    title: "NFA — Random V-Bucks Accounts",
    subtitle: "Random accounts with V-Bucks",
  },
  {
    category: "NFA — Rare Season 2 Accounts",
    title: "NFA — Rare Season 2 Accounts",
    subtitle: "Rare Season 2 cosmetics and accounts",
  },
  {
    category: "NFA — Fortnite Exclusive Accounts",
    title: "NFA — Fortnite Exclusive Accounts",
    subtitle: "Exclusive skins, bundles, and cosmetics",
  },
  {
    category: "NFA — Fortnite OG Accounts",
    title: "NFA — Fortnite OG Accounts",
    subtitle: "OG accounts · Limited stock",
  },
  {
    category: "Fortnite FA Accounts",
    title: "Fortnite FA Accounts",
    subtitle: "Full Access pricing shown with and without warranty",
  },
];

function ProductCard({ product }: { product: Product }) {
  const isFA = product.category === "Fortnite FA Accounts";
  const stockText = product.stock_count === null
    ? (product.stock_label ?? "Stock not listed")
    : product.stock_count === 1
      ? "1 in stock"
      : product.stock_count.toLocaleString() + " in stock";

  return (
    <article className="product" key={product.id}>
      <div className="art">{product.emoji || "🎁"}</div>
      <div className="pbody">
        <span className="pill">{product.badge || product.category || "Digital item"}</span>
        <h3 style={{ marginTop: 12 }}>{product.name}</h3>
        {product.description ? <div className="muted">{product.description}</div> : null}

        {isFA ? (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, margin: "16px 0 10px" }}>
            <div style={{ border: "1px solid #393940", borderRadius: 10, padding: 10 }}>
              <div className="muted">No Warranty</div>
              <div className="price" style={{ margin: "6px 0 0" }}>{money(product.price_cents)}</div>
            </div>
            <div style={{ border: "1px solid #393940", borderRadius: 10, padding: 10 }}>
              <div className="muted">With Warranty</div>
              <div className="price" style={{ margin: "6px 0 0" }}>
                {product.warranty_price_cents === null ? "—" : money(product.warranty_price_cents)}
              </div>
            </div>
          </div>
        ) : (
          <div className="price">{money(product.price_cents)}</div>
        )}

        <div className="stock-line">
          <span className="stock-dot" />
          <span>{stockText}</span>
        </div>
        <div style={{ marginTop: 14 }}>
          <BuyWithBalance productId={product.id} />
          <ManualCheckout productId={product.id} productName={product.name} />
        </div>
      </div>
    </article>
  );
}

export default async function Home() {
  const { data, error } = await supabase
    .from("products")
    .select("id,name,slug,description,category,badge,emoji,price_cents,warranty_price_cents,stock_count,stock_label,active,sort_order")
    .eq("active", true)
    .order("sort_order", { ascending: true });

  const products = (data ?? []) as Product[];
  const groupedProducts = inventoryGroups
    .map(group => ({
      ...group,
      products: products.filter(product => product.category === group.category),
    }))
    .filter(group => group.products.length > 0);

  return (
    <>
      <header className="top">
        <nav className="nav">
          <a className="logo" href="/">🎄 SANTA<span>STORE</span></a>
          <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
            <a className="muted" href="/account">My account</a>
            <a className="btn" href="/account">Sign in</a>
          </div>
        </nav>
      </header>

      <main className="wrap">
        <section className="hero">
          <div className="eyebrow">🎅 Sumz Market Holiday Drop</div>
          <h1>Holiday deals.<br /><span style={{ color: "#ef4444" }}>Instant excitement.</span></h1>
          <p>Shop digital inventory and exclusive drops from Sumz Market. Browse the catalog by account type and category.</p>
          <div style={{ marginTop: 24 }}>
            <a className="btn" href="#inventory">Browse inventory ↓</a>
          </div>
        </section>

        <section className="section" id="inventory">
          <div className="inventory-heading">
            <div>
              <div className="eyebrow">THE COLLECTION</div>
              <h2 style={{ fontSize: 30, margin: "8px 0" }}>🛒 SUMZ MARKET — COMPLETE INVENTORY & STOCK</h2>
            </div>
            <span className="muted">{products.length.toLocaleString()} listings · Prices in USD</span>
          </div>

          {error ? (
            <div className="notice">The inventory could not be loaded: {error.message}</div>
          ) : products.length === 0 ? (
            <div className="notice">No active products are published yet. Add products in the admin panel.</div>
          ) : (
            <div className="inventory-groups">
              {groupedProducts.map(group => (
                <section className="inventory-group" id={group.category.toLowerCase().replace(/[^a-z0-9]+/g, "-")} key={group.category}>
                  <div className="inventory-group-heading">
                    <div>
                      <div className="eyebrow">{group.products.length} LISTINGS</div>
                      <h2>{group.title}</h2>
                      <p className="muted">{group.subtitle}</p>
                    </div>
                  </div>
                  <div className="grid">
                    {group.products.map(product => <ProductCard product={product} key={product.id} />)}
                  </div>
                </section>
              ))}
            </div>
          )}
        </section>

        <section className="section">
          <div className="notice">
            <b>Secure order processing</b><br />
            Choose a payment method, place your order, and click <b>I Have Paid</b> in your account after sending payment to open a private order chat.
          </div>
        </section>
      </main>

      <footer className="footer">© {new Date().getFullYear()} Sumz Market · Santa Store · <a href="/admin">Admin</a></footer>
    </>
  );
}
