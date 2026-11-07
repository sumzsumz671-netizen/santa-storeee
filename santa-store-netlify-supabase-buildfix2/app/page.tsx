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
    title: "NFA Skinned Accounts",
    subtitle: "Random NFA accounts grouped by skin count",
    accent: "purple",
  },
  {
    category: "NFA — Random V-Bucks Accounts",
    title: "V-Bucks Accounts",
    subtitle: "Random accounts with V-Bucks",
    accent: "violet",
  },
  {
    category: "NFA — Rare Season 2 Accounts",
    title: "Rare Season 2 Accounts",
    subtitle: "Rare Season 2 cosmetics and accounts",
    accent: "pink",
  },
  {
    category: "NFA — Fortnite Exclusive Accounts",
    title: "Fortnite Exclusives",
    subtitle: "Exclusive skins, bundles, and cosmetics",
    accent: "purple",
  },
  {
    category: "NFA — Fortnite OG Accounts",
    title: "Fortnite OG Accounts",
    subtitle: "OG accounts · Limited stock",
    accent: "violet",
  },
  {
    category: "Fortnite FA Accounts",
    title: "Fortnite FA Accounts",
    subtitle: "Full Access pricing shown with and without warranty",
    accent: "pink",
  },
];

function ProductCard({ product }: { product: Product }) {
  const isFA = product.category === "Fortnite FA Accounts";
  const soldOut = product.stock_count === 0;
  const stockText = product.stock_count === null
    ? (product.stock_label ?? "Stock not listed")
    : product.stock_count === 1
      ? "1 in stock"
      : product.stock_count.toLocaleString() + " in stock";

  return (
    <article className="market-product" key={product.id}>
      <div className="market-product-art">
        <div className="market-product-glow" />
        <span className="market-product-emoji">{product.emoji || "🎁"}</span>
        <span className="market-product-badge">{product.badge || product.category || "Digital item"}</span>
      </div>
      <div className="market-product-body">
        <h3>{product.name}</h3>
        {product.description ? <p className="muted market-product-description">{product.description}</p> : null}

        {isFA ? (
          <div className="market-price-options">
            <div className="market-price-option">
              <span>No Warranty</span>
              <strong>{money(product.price_cents)}</strong>
            </div>
            <div className="market-price-option market-price-option-featured">
              <span>With Warranty</span>
              <strong>{product.warranty_price_cents === null ? "—" : money(product.warranty_price_cents)}</strong>
            </div>
          </div>
        ) : (
          <div className="market-product-price">{money(product.price_cents)}</div>
        )}

        <div className="market-stock">
          <span className={"market-stock-dot" + (soldOut ? " is-sold-out" : "")} />
          <span>{soldOut ? "Out of stock" : stockText}</span>
        </div>
        {soldOut ? (
          <div className="market-sold-out">Currently unavailable</div>
        ) : (
          <div className="market-buy-actions">
            <BuyWithBalance productId={product.id} warrantyPriceCents={product.warranty_price_cents} />
            <ManualCheckout productId={product.id} productName={product.name} priceCents={product.price_cents} warrantyPriceCents={product.warranty_price_cents} />
          </div>
        )}
      </div>
    </article>
  );
}

function Feature({ icon, title, description }: { icon: string; title: string; description: string }) {
  return (
    <div className="market-feature">
      <span className="market-feature-icon">{icon}</span>
      <div>
        <b>{title}</b>
        <span>{description}</span>
      </div>
    </div>
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
      <header className="market-top">
        <nav className="market-nav">
          <a className="market-brand" href="/" aria-label="Sumz Market home">
            <span className="market-brand-mark">♛</span>
            <span className="market-brand-words">SUMZ<span>MARKET</span></span>
          </a>
          <div className="market-nav-links">
            <a className="market-nav-active" href="/">Home</a>
            <a href="#inventory">Shop</a>
            <a href="/account">Support</a>
            <a href="/account">My Account</a>
            <a className="market-nav-discord" href="https://discord.com/invite/sumz" target="_blank" rel="noopener noreferrer">Discord <span>↗</span></a>
          </div>
          <a className="market-login" href="/account">Sign in <span>→</span></a>
        </nav>
      </header>

      <main className="market-wrap">
        <section className="market-hero">
          <div className="market-hero-grid" />
          <div className="market-hero-copy">
            <div className="market-trust-pill"><span>✦</span> VERIFIED SINCE 2021</div>
            <p className="market-kicker">YOUR DIGITAL MARKETPLACE</p>
            <h1>SUMZ <span>MARKET</span></h1>
            <p className="market-hero-description">
              Cheap, instant, and trusted digital accounts. Find your next favorite drop at Sumz Market.
            </p>
            <div className="market-hero-actions">
              <a className="market-primary-button" href="#inventory">Shop Now <span>→</span></a>
              <a className="market-discord-button" href="https://discord.com/invite/sumz" target="_blank" rel="noopener noreferrer"><span>◉</span> Join Discord</a>
            </div>
            <div className="market-hero-note"><span className="market-live-dot" /> Live inventory · Prices in USD</div>
          </div>
          <div className="market-hero-visual" aria-label="Sumz Market crown emblem">
            <div className="market-orbit market-orbit-one" />
            <div className="market-orbit market-orbit-two" />
            <div className="market-crown-halo" />
            <div className="market-crown">♛</div>
            <div className="market-floating-card market-floating-top"><span>✦</span><div><b>Premium drops</b><small>New stock, ready to shop</small></div></div>
            <div className="market-floating-card market-floating-bottom"><span>⚡</span><div><b>Instant checkout</b><small>Secure order processing</small></div></div>
            <div className="market-visual-caption">SUMZ MARKET <span>✦ EST. 2021</span></div>
          </div>
          <div className="market-hero-bottom">
            <span>BUILT FOR THE COMMUNITY</span>
            <span>ACCOUNTS <i>·</i> NITRO <i>·</i> BOOSTS <i>·</i> MORE</span>
          </div>
        </section>

        <section className="market-features" aria-label="Store benefits">
          <Feature icon="ϟ" title="Instant Delivery" description="Fast digital delivery" />
          <Feature icon="⬡" title="Secure Payments" description="Clear order details" />
          <Feature icon="♧" title="24/7 Support" description="Help when you need it" />
          <Feature icon="✧" title="Video Proof Policy" description="Shop with confidence" />
        </section>

        <section className="market-inventory section" id="inventory">
          <div className="market-section-heading">
            <div>
              <div className="market-section-kicker"><span>✦</span> THE COLLECTION</div>
              <h2>Featured <span>inventory</span></h2>
              <p>Explore the latest listings available in the Sumz Market store.</p>
            </div>
            <div className="market-listing-count"><strong>{products.length.toLocaleString()}</strong><span>ACTIVE LISTINGS</span></div>
          </div>

          {error ? (
            <div className="notice">The inventory could not be loaded: {error.message}</div>
          ) : products.length === 0 ? (
            <div className="market-empty-state">
              <span>♛</span>
              <h3>New drops are on the way</h3>
              <p>No active products are published right now. Check back soon.</p>
              <a className="market-discord-button" href="https://discord.com/invite/sumz" target="_blank" rel="noopener noreferrer">Join our Discord ↗</a>
            </div>
          ) : (
            <div className="market-inventory-groups">
              {groupedProducts.map(group => (
                <section className="market-inventory-group" id={group.category.toLowerCase().replace(/[^a-z0-9]+/g, "-")} key={group.category}>
                  <div className="market-group-heading">
                    <div>
                      <span className="market-group-count">{String(group.products.length).padStart(2, "0")} LISTINGS</span>
                      <h3>{group.title}</h3>
                      <p>{group.subtitle}</p>
                    </div>
                    <span className="market-group-arrow">↘</span>
                  </div>
                  <div className="market-product-grid">
                    {group.products.map(product => <ProductCard product={product} key={product.id} />)}
                  </div>
                </section>
              ))}
            </div>
          )}
        </section>

        <section className="market-support-banner">
          <div className="market-support-icon">♛</div>
          <div>
            <span>NEED A HAND?</span>
            <h2>We're here to help.</h2>
            <p>Have a question about an order? Visit your customer account to contact Sumz Market support.</p>
          </div>
          <a className="market-discord-button" href="/account">Get Support <span>→</span></a>
        </section>
      </main>

      <footer className="market-footer">
        <a className="market-brand" href="/"><span className="market-brand-mark">♛</span><span className="market-brand-words">SUMZ<span>MARKET</span></span></a>
        <span>© {new Date().getFullYear()} SUMZ MARKET · VERIFIED SINCE 2021</span>
        <div><a href="/account">My Account</a><a href="/admin">Admin</a><a href="https://discord.com/invite/sumz" target="_blank" rel="noopener noreferrer">Discord ↗</a></div>
      </footer>
    </>
  );
}
