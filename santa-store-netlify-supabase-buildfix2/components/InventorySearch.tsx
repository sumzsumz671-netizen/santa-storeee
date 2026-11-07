"use client";

import { useMemo, useState } from "react";
import BuyWithBalance from "./BuyWithBalance";
import ManualCheckout from "./ManualCheckout";

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

type InventoryGroup = {
  category: string;
  title: string;
  subtitle: string;
  accent: string;
  products: Product[];
};

const money = (cents: number) => "$" + (cents / 100).toFixed(2);

function productImage(product: Product) {
  const value = (product.name + " " + (product.description ?? "") + " " + (product.category ?? "")).toLowerCase();
  if (value.includes("skull trooper") || value.includes("skull")) return "/images/product-skull.svg";
  if (value.includes("wildcat")) return "/images/product-wildcat.svg";
  if (value.includes("nitro")) return "/images/product-nitro.svg";
  if (value.includes("boost")) return "/images/product-boost.svg";
  return null;
}

function ProductCard({ product }: { product: Product }) {
  const isFA = product.category === "Fortnite FA Accounts";
  const soldOut = product.stock_count === 0;
  const image = productImage(product);
  const stockText = product.stock_count === null
    ? (product.stock_label ?? "Stock not listed")
    : product.stock_count === 1
      ? "1 in stock"
      : product.stock_count.toLocaleString() + " in stock";

  return (
    <article className="market-product" key={product.id}>
      <div className={"market-product-art" + (image ? " has-product-image" : "")}>
        <div className="market-product-glow" />
        {image ? (
          <img className="market-product-image" src={image} alt={product.name} loading="lazy" />
        ) : (
          <span className="market-product-emoji">{product.emoji || "🎁"}</span>
        )}
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

export default function InventorySearch({ groups }: { groups: InventoryGroup[] }) {
  const [query, setQuery] = useState("");
  const filteredGroups = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return groups;
    return groups
      .map(group => ({
        ...group,
        products: group.products.filter(product => [
          product.name,
          product.category,
          product.badge,
          product.description,
          product.slug,
        ].filter(Boolean).join(" ").toLowerCase().includes(term)),
      }))
      .filter(group => group.products.length > 0);
  }, [groups, query]);

  const resultCount = filteredGroups.reduce((total, group) => total + group.products.length, 0);

  return (
    <>
      <div className="market-search-wrap">
        <label className="market-search-label" htmlFor="market-inventory-search">FIND YOUR NEXT ACCOUNT</label>
        <div className="market-search-box">
          <span className="market-search-icon" aria-hidden="true">⌕</span>
          <input
            id="market-inventory-search"
            className="market-search-input"
            type="search"
            value={query}
            onChange={event => setQuery(event.target.value)}
            placeholder="Search accounts, skins, V-Bucks, Nitro, boosts…"
            autoComplete="off"
          />
          {query ? (
            <button className="market-search-clear" type="button" onClick={() => setQuery("")}>Clear</button>
          ) : (
            <span className="market-search-shortcut">SEARCH</span>
          )}
        </div>
        <div className="market-search-meta" aria-live="polite">
          {query.trim()
            ? resultCount + " matching " + (resultCount === 1 ? "listing" : "listings")
            : "Search by product name, category, or description"}
        </div>
      </div>

      {filteredGroups.length === 0 ? (
        <div className="market-empty-state">
          <span>⌕</span>
          <h3>No matching accounts found</h3>
          <p>Try another name or search term, or clear your search to see all available listings.</p>
          <button className="market-primary-button" type="button" onClick={() => setQuery("")}>Clear Search <span>→</span></button>
        </div>
      ) : (
        <div className="market-inventory-groups">
          {filteredGroups.map(group => (
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
    </>
  );
}
