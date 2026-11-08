"use client";

import { useEffect, useMemo, useState } from "react";
import BuyWithBalance from "./BuyWithBalance";
import ManualCheckout from "./ManualCheckout";
import { supabase } from "../lib/supabase";

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

const COSMETIC_ALIASES: Record<string, string> = {
  "royale bomber": "Royale Bomber",
  "merry minty axe": "Merry Mint Axe",
  "trail blazer": "Trailblazer",
  "mako glider": "Mako",
  "dark skully": "Dark Skully",
};

function productCosmeticNames(product: Product): string[] {
  const original = product.name.trim();
  if (/^OG Save The World$/i.test(original)) return [];

  const cleaned = original.replace(/\s+FA$/i, "");
  const parts = cleaned.split(/\s+\+\s+/);
  const names = parts
    .map(part => part.replace(/^OG\s+/i, "").replace(/\s+Stacked$/i, "").trim())
    .filter(part => part.length > 0)
    .filter(part => !/(inactive|last match|days ago|^stw$|save the world)/i.test(part))
    .filter(part => !/\b(v[- ]?bucks|skins?)\b/i.test(part))
    .map(part => COSMETIC_ALIASES[part.toLowerCase()] ?? part);

  return [...new Set(names)].slice(0, 4);
}

function fallbackProductImage(product: Product) {
  const name = product.name.toLowerCase();
  const category = (product.category ?? "").toLowerCase();

  if (name.includes("nitro")) return "/images/product-nitro.svg";
  if (name.includes("boost")) return "/images/product-boost.svg";
  if (name.includes("v-bucks") || name.includes("vbucks") || category.includes("v-bucks")) return "/images/product-vbucks.svg";
  if (category.includes("rare season") || category.includes("og accounts") || name.startsWith("og ")) return "/images/product-og-bundle.svg";
  if (category.includes("random accounts") || /\\bskins?\\b/i.test(name)) return "/images/product-random-skins.svg";
  if (category.includes("fa accounts")) return "/images/product-fa-accounts.svg";
  return "/images/product-fa-accounts.svg";
}

function ProductCard({ product, cosmeticImages, purchaseBlocked }: { product: Product; cosmeticImages: Record<string, string>; purchaseBlocked: boolean }) {
  const isFA = product.category === "Fortnite FA Accounts";
  const soldOut = product.stock_count === 0;
  const productImages = productCosmeticNames(product)
    .map(name => cosmeticImages[name])
    .filter((url): url is string => !!url)
    .slice(0, 3);
  const fallbackImage = fallbackProductImage(product);
  const stockText = product.stock_count === null
    ? (product.stock_label ?? "Stock not listed")
    : product.stock_count === 1
      ? "1 in stock"
      : product.stock_count.toLocaleString() + " in stock";

  return (
    <article className="market-product" key={product.id}>
      <div className="market-product-art has-product-image">
        <div className="market-product-glow" />
        {productImages.length > 0 ? (
          productImages.length === 1 ? (
            <img className="market-product-image" src={productImages[0]} alt={product.name} loading="lazy" />
          ) : (
            <div className="market-product-image-stack">
              {productImages.map((imageUrl, index) => (
                <img key={imageUrl} src={imageUrl} alt={product.name + " item " + (index + 1)} loading="lazy" />
              ))}
            </div>
          )
        ) : (
          <img className="market-product-image market-product-fallback" src={fallbackImage} alt={product.name} loading="lazy" />
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
        ) : purchaseBlocked ? (
          <div className="market-purchase-blocked" role="status">Purchasing disabled for this account</div>
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
  const [cosmeticImages, setCosmeticImages] = useState<Record<string, string>>({});
  const [purchaseBlocked, setPurchaseBlocked] = useState(false);
  const cosmeticNames = useMemo(
    () => [...new Set(groups.flatMap(group => group.products.flatMap(productCosmeticNames)))],
    [groups]
  );

  useEffect(() => {
    if (!cosmeticNames.length) return;
    const controller = new AbortController();

    fetch("/api/product-art?names=" + encodeURIComponent(JSON.stringify(cosmeticNames)), {
      signal: controller.signal,
    })
      .then(response => response.ok ? response.json() : Promise.reject(new Error("Artwork lookup unavailable")))
      .then(result => {
        if (result?.images && typeof result.images === "object") {
          setCosmeticImages(result.images as Record<string, string>);
        }
      })
      .catch(error => {
        if (error?.name !== "AbortError") {
          console.warn("Sumz Market product artwork could not be loaded.", error);
        }
      });

    return () => controller.abort();
  }, [cosmeticNames]);
  useEffect(() => {
    let active = true;

    const loadPurchaseAccess = async (userId: string | null) => {
      if (!userId) {
        if (active) setPurchaseBlocked(false);
        return;
      }
      const { data, error } = await supabase
        .from("profiles")
        .select("purchase_blocked")
        .eq("id", userId)
        .maybeSingle();
      if (active && !error) setPurchaseBlocked(data?.purchase_blocked === true);
      if (active && error) setPurchaseBlocked(false);
    };

    void supabase.auth.getUser().then(({ data, error }) => {
      if (active) void loadPurchaseAccess(error ? null : data.user?.id ?? null);
    });

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      window.setTimeout(() => {
        if (active) void loadPurchaseAccess(session?.user.id ?? null);
      }, 0);
    });

    return () => {
      active = false;
      authListener.subscription.unsubscribe();
    };
  }, []);

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
                {group.products.map(product => <ProductCard product={product} cosmeticImages={cosmeticImages} purchaseBlocked={purchaseBlocked} key={product.id} />)}
              </div>
            </section>
          ))}
        </div>
      )}
    </>
  );
}
