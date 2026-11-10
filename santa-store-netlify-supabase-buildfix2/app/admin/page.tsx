"use client";

import { useCallback, useEffect, useState } from "react";
import "./admin-theme.css";
import { supabase } from "../../lib/supabase";
import AdminSupportInbox from "../../components/AdminSupportInbox";
import AdminWalletTopups from "../../components/AdminWalletTopups";
import AdminStaffManagement from "../../components/AdminStaffManagement";
import AdminCustomerModeration from "../../components/AdminCustomerModeration";

type Product = {
  id: string; name: string; slug: string; description: string | null;
  category: string | null; emoji: string | null; badge: string | null;
  price_cents: number; price_max_cents: number | null;
  warranty_price_cents: number | null; stock_count: number | null;
  stock_label: string | null; active: boolean; sort_order: number;
};
type Order = {
  id: string; order_number: string; status: string; payment_method: string;
  payment_reference: string | null; total_cents: number; created_at: string;
  user_id: string;
};
const STATUSES = ["pending_payment", "paid", "processing", "completed", "cancelled", "refunded"];
const money = (cents: number) => "$" + (cents / 100).toFixed(2);
const pretty = (value: string) => value.replaceAll("_", " ");

export default function Admin() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [userEmail, setUserEmail] = useState("");
  const [role, setRole] = useState("");
  const [products, setProducts] = useState<Product[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [productName, setProductName] = useState("");
  const [productPrice, setProductPrice] = useState("");
  const [productWarrantyPrice, setProductWarrantyPrice] = useState("");
  const [productStockCount, setProductStockCount] = useState("");
  const [productCategory, setProductCategory] = useState("Fortnite");
  const [productDescription, setProductDescription] = useState("");
  const [productEmoji, setProductEmoji] = useState("🎮");
  const [productStock, setProductStock] = useState("Available");
  const [productActive, setProductActive] = useState(true);

  const loadAdmin = useCallback(async () => {
    setLoading(true);
    const { data: userResult } = await supabase.auth.getUser();
    if (!userResult.user) {
      setUserEmail("");
      setRole("");
      setLoading(false);
      return;
    }
    setUserEmail(userResult.user.email ?? "");
    const { data: profile, error: profileError } = await supabase
      .from("profiles").select("role").eq("id", userResult.user.id).maybeSingle();
    if (profileError || !profile || !["owner", "admin", "staff"].includes(profile.role)) {
      setRole("customer");
      setProducts([]);
      setOrders([]);
      setMessage("This account does not have staff permissions. Ask the store owner to grant admin access.");
      setLoading(false);
      return;
    }
    setRole(profile.role);
    const [{ data: productRows, error: productError }, { data: orderRows, error: orderError }] = await Promise.all([
      supabase.from("products").select("*").order("sort_order", { ascending: true }).order("created_at", { ascending: false }),
      supabase.from("orders").select("id,order_number,status,payment_method,payment_reference,total_cents,created_at,user_id").order("created_at", { ascending: false }),
    ]);
    setProducts((productRows ?? []) as Product[]);
    setOrders((orderRows ?? []) as Order[]);
    setMessage(productError?.message ?? orderError?.message ?? "");
    setLoading(false);
  }, []);

  useEffect(() => {
    void loadAdmin();
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) {
        setUserEmail("");
        setRole("");
      } else {
        setUserEmail(session.user.email ?? "");
        window.setTimeout(() => void loadAdmin(), 0);
      }
    });
    return () => listener.subscription.unsubscribe();
  }, [loadAdmin]);

  async function login() {
    if (!email.trim() || !password) {
      setMessage("Enter your admin email and password.");
      return;
    }
    setBusy(true);
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    setBusy(false);
    if (error) setMessage(error.message);
    else await loadAdmin();
  }

  async function logout() {
    await supabase.auth.signOut();
    setUserEmail("");
    setRole("");
    setProducts([]);
    setOrders([]);
    setMessage("Signed out.");
  }

  async function addProduct(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const cents = Math.round(Number(productPrice) * 100);
    const warrantyCents = productWarrantyPrice.trim() ? Math.round(Number(productWarrantyPrice) * 100) : null;
    const stockCount = productStockCount.trim() ? Number(productStockCount) : null;
    if (!productName.trim() || !Number.isFinite(cents) || cents < 0) {
      setMessage("Enter a product name and a valid price.");
      return;
    }
    if (warrantyCents !== null && (!Number.isFinite(warrantyCents) || warrantyCents < 0)) {
      setMessage("Enter a valid With Warranty price.");
      return;
    }
    if (stockCount !== null && (!Number.isInteger(stockCount) || stockCount < 0)) {
      setMessage("Enter a whole-number stock count of zero or more.");
      return;
    }
    const slugBase = productName.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    const slug = slugBase + "-" + Math.random().toString(36).slice(2, 7);
    setBusy(true);
    const { error } = await supabase.from("products").insert({
      name: productName.trim(),
      slug,
      description: productDescription.trim() || null,
      category: productCategory.trim() || null,
      badge: productCategory.trim() || "Digital item",
      emoji: productEmoji.trim() || "🎁",
      price_cents: cents,
      warranty_price_cents: warrantyCents,
      stock_count: stockCount,
      stock_label: stockCount === null ? (productStock.trim() || "Available") : stockCount === 0 ? "Out of stock" : stockCount + " in stock",
      active: productActive,
      sort_order: products.length + 1,
    });
    setBusy(false);
    if (error) setMessage("Could not add product: " + error.message);
    else {
      setMessage("Product added.");
      setProductName("");
      setProductPrice("");
      setProductWarrantyPrice("");
      setProductStockCount("");
      setProductDescription("");
      await loadAdmin();
    }
  }

  async function updateProduct(id: string, patch: Partial<Product>) {
    setBusy(true);
    const { error } = await supabase.from("products").update(patch).eq("id", id);
    setBusy(false);
    setMessage(error ? "Product update failed: " + error.message : "Product updated.");
    if (!error) await loadAdmin();
  }

  async function updateOrder(id: string, status: string) {
    if (status === "refunded") return;
    setBusy(true);
    const { error } = await supabase.from("orders").update({ status, updated_at: new Date().toISOString() }).eq("id", id);
    setBusy(false);
    if (error) setMessage("Order update failed: " + error.message);
    else {
      await loadAdmin();
      setMessage("Order status updated.");
    }
  }

  async function refundOrder(order: Order) {
    if (!window.confirm("Refund " + money(order.total_cents) + " to this customer's store balance? This cannot be undone.")) return;
    setBusy(true);
    const { data, error } = await supabase.rpc("refund_order_to_balance", {
      p_order_id: order.id,
      p_note: "Admin refund for order " + order.order_number,
    });
    setBusy(false);
    if (error) {
      setMessage("Refund failed: " + error.message);
      return;
    }
    const result = data as { refunded_cents?: number };
    await loadAdmin();
    setMessage("Refunded " + money(Number(result?.refunded_cents ?? order.total_cents)) + " to the customer's store balance.");
  }

  const canManage = role === "owner" || role === "admin" || role === "staff";

  return (
    <main className="wrap admin-shell">
      <nav className="nav">
        <a className="logo" href="/"><span style={{color:"#a78bfa"}}>SUMZ</span><span> STORE</span> <span style={{ color: "#a1a1aa", fontSize: 13 }}>ADMIN</span></a>
        <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
          <a className="muted" href="/">Storefront</a>
          <a className="muted" href="/account">Customer account</a>
          {userEmail ? <button className="btn secondary" type="button" onClick={logout}>Sign out</button> : null}
        </div>
      </nav>

      {loading ? <div className="notice" style={{ marginTop: 35 }}>Checking admin access…</div> : !userEmail ? (
        <section style={{ maxWidth: 440, margin: "55px auto" }}>
          <div className="eyebrow">PRIVATE STAFF AREA</div>
          <h1 style={{ fontSize: 30 }}>Admin sign in</h1>
          <p className="muted">Sign in with your store-owner account to manage inventory and orders.</p>
          <div style={{ display: "grid", gap: 12, marginTop: 20 }}>
            <input className="input" type="email" placeholder="Admin email" autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} />
            <input className="input" type="password" placeholder="Password" autoComplete="current-password" value={password} onChange={e => setPassword(e.target.value)} />
            <button className="btn" type="button" disabled={busy} onClick={login}>Sign in</button>
            {message ? <div className="notice" role="status">{message}</div> : null}
          </div>
        </section>
      ) : !canManage ? (
        <div className="notice" style={{ maxWidth: 700, margin: "45px auto" }}>
          This account ({userEmail}) is signed in but does not have admin permissions. Only authorized store staff can open this panel.
          {message ? <p>{message}</p> : null}
        </div>
      ) : (
        <section style={{ margin: "35px auto", maxWidth: 1120 }}>
          <div className="admin-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "end", gap: 18, flexWrap: "wrap", padding: "26px 0 20px", borderBottom: "1px solid #253d29" }}>
            <div>
              <div className="eyebrow">SUMZ STORE · CONTROL CENTER</div>
              <h1 style={{ fontSize: 36, margin: "8px 0" }}>Welcome back, {role === "owner" ? "Owner" : role}</h1>
              <p className="muted">Signed in as {userEmail}. Your store operations at a glance.</p>
            </div>
            <button className="btn secondary" type="button" onClick={() => void loadAdmin()} disabled={loading || busy}>{loading ? "Refreshing…" : "↻ Refresh dashboard"}</button>
          </div>

          <nav aria-label="Admin sections" className="admin-section-nav" style={{ display: "flex", gap: 9, flexWrap: "wrap", position: "sticky", top: 0, zIndex: 5, padding: "12px 0", background: "rgba(5,9,6,.96)", backdropFilter: "blur(12px)" }}>
            {[["Overview","#admin-overview"],["Support inbox","#admin-support"],["Customers","#admin-customers"],["Orders","#admin-orders"],["Inventory","#admin-inventory"],["Staff","#admin-staff"]].map(([label,href]) => (
              <a key={href} href={href} className="btn secondary" style={{ textDecoration: "none", fontSize: 12, padding: "9px 13px" }}>{label}</a>
            ))}
          </nav>

          <div id="admin-overview" className="grid" style={{ marginTop: 18, gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))" }}>
            <div className="product pbody"><div className="muted">Total products</div><div style={{ fontSize: 30, fontWeight: 900 }}>{products.length}</div></div>
            <div className="product pbody"><div className="muted">Active listings</div><div style={{ fontSize: 30, fontWeight: 900 }}>{products.filter(p => p.active).length}</div></div>
            <div className="product pbody"><div className="muted">Total orders</div><div style={{ fontSize: 30, fontWeight: 900 }}>{orders.length}</div></div>
            <div className="product pbody"><div className="muted">Awaiting payment</div><div style={{ fontSize: 30, fontWeight: 900 }}>{orders.filter(o => o.status === "pending_payment").length}</div></div>
          </div>

          {message ? <div className="notice" role="status" style={{ marginTop: 18 }}>{message}</div> : null}

          {role === "owner" ? <div id="admin-staff"><AdminStaffManagement /></div> : null}

          {role === "owner" || role === "admin" ? <div id="admin-customers"><AdminCustomerModeration /></div> : null}

          <div id="admin-support"><AdminSupportInbox isOwner={role === "owner"} /></div>

          <AdminWalletTopups />

          <div style={{ marginTop: 38 }}>
            <h2 id="admin-inventory" style={{ fontSize: 25 }}>Add a product</h2>
            <form className="product pbody" onSubmit={addProduct} style={{ display: "grid", gap: 12, marginTop: 12 }}>
              <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(190px,1fr))" }}>
                <input className="input" placeholder="Product name" value={productName} onChange={e => setProductName(e.target.value)} required />
                <input className="input" placeholder="Price / No Warranty (USD)" type="number" min="0" step="0.01" value={productPrice} onChange={e => setProductPrice(e.target.value)} required />
                <input className="input" placeholder="With Warranty price (optional)" type="number" min="0" step="0.01" value={productWarrantyPrice} onChange={e => setProductWarrantyPrice(e.target.value)} />
                <input className="input" placeholder="Stock quantity" type="number" min="0" step="1" value={productStockCount} onChange={e => setProductStockCount(e.target.value)} />
                <input className="input" placeholder="Category" value={productCategory} onChange={e => setProductCategory(e.target.value)} />
                <input className="input" placeholder="Emoji" value={productEmoji} onChange={e => setProductEmoji(e.target.value)} />
                <input className="input" placeholder="Stock label" value={productStock} onChange={e => setProductStock(e.target.value)} />
              </div>
              <textarea className="input" placeholder="Product description" rows={3} value={productDescription} onChange={e => setProductDescription(e.target.value)} />
              <label className="muted" style={{ display: "flex", alignItems: "center", gap: 9 }}>
                <input type="checkbox" checked={productActive} onChange={e => setProductActive(e.target.checked)} /> Publish this product on the storefront
              </label>
              <button className="btn" type="submit" disabled={busy}>Add product</button>
            </form>
          </div>

          <div style={{ marginTop: 38 }}>
            <h2 style={{ fontSize: 25 }}>Inventory ({products.length})</h2>
            {products.length === 0 ? <div className="product pbody muted" style={{ marginTop: 12 }}>No products have been added to the database yet. Add your first listing above.</div> : (
              <div style={{ display: "grid", gap: 12, marginTop: 12 }}>
                {products.map(product => (
                  <article className="product pbody" key={product.id}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", gap: 14, flexWrap: "wrap" }}>
                      <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                        <div className="art" style={{ width: 62, height: 62, borderRadius: 10, fontSize: 30 }}>{product.emoji ?? "🎁"}</div>
                        <div>
                          <b>{product.name}</b>
                          <div className="muted">{product.category ?? "Digital item"}</div>
                          <div className="muted">
                            {product.category === "Fortnite FA Accounts"
                              ? "No Warranty " + money(product.price_cents) + " · With Warranty " + (product.warranty_price_cents === null ? "—" : money(product.warranty_price_cents))
                              : money(product.price_cents)}
                            {" · Stock " + (product.stock_count === null ? (product.stock_label ?? "not set") : product.stock_count.toLocaleString())}
                          </div>
                        </div>
                      </div>
                      <label className="muted" style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <input type="checkbox" checked={product.active} disabled={busy} onChange={e => void updateProduct(product.id, { active: e.target.checked })} /> Published
                      </label>
                    </div>
                    <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", marginTop: 13 }}>
                      <input className="input" style={{ minWidth: 150, width: 180 }} aria-label={"Stock label for " + product.name} defaultValue={product.stock_label ?? "Available"} onBlur={e => { if (e.target.value !== (product.stock_label ?? "")) void updateProduct(product.id, { stock_label: e.target.value }); }} />
                      <input className="input" style={{ minWidth: 120, width: 140 }} type="number" min="0" step="1" aria-label={"Stock count for " + product.name} defaultValue={product.stock_count ?? ""} placeholder="Stock count" onBlur={e => {
                        const value = e.target.value.trim() === "" ? null : Number(e.target.value);
                        if (value !== null && (!Number.isInteger(value) || value < 0)) {
                          setMessage("Stock count must be a whole number of zero or more.");
                          return;
                        }
                        if (value !== product.stock_count) void updateProduct(product.id, {
                          stock_count: value,
                          stock_label: value === null ? "Available" : value === 0 ? "Out of stock" : value + " in stock",
                        });
                      }} />
                      <span className="muted">Slug: {product.slug}</span>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </div>

          <div style={{ marginTop: 38 }}>
            <h2 id="admin-orders" style={{ fontSize: 25 }}>Customer orders ({orders.length})</h2>
            {orders.length === 0 ? <div className="product pbody muted" style={{ marginTop: 12 }}>No customer orders have been placed yet.</div> : (
              <div style={{ display: "grid", gap: 12, marginTop: 12 }}>
                {orders.map(order => (
                  <article className="product pbody" key={order.id}>
                    <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
                      <div><b>{order.order_number}</b><div className="muted">{new Date(order.created_at).toLocaleString()} · {order.payment_method}</div><div className="muted">Customer ID: {order.user_id}</div></div>
                      <b>{money(order.total_cents)}</b>
                    </div>
                    {order.payment_reference ? <div className="muted" style={{ marginTop: 8 }}>Payment reference: {order.payment_reference}</div> : null}
                    <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginTop: 14 }}>
                      <span className="muted">Order status</span>
                      <select className="input" value={order.status} disabled={busy} onChange={e => void updateOrder(order.id, e.target.value)}>
                        {STATUSES.map(status => <option key={status} value={status} disabled={status === "refunded"}>{pretty(status)}</option>)}
                      </select>
                      {["paid", "processing", "completed"].includes(order.status) ? (
                        <button className="btn secondary" type="button" disabled={busy} onClick={() => void refundOrder(order)}>
                          Refund to balance
                        </button>
                      ) : order.status === "refunded" ? (
                        <span className="pill">Refunded to balance</span>
                      ) : null}
                    </div>
                  </article>
                ))}
              </div>
            )}
          </div>
        </section>
      )}
    </main>
  );
}
