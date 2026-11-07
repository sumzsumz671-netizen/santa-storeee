"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";

type OrderItem = {
  id: string;
  product_name: string;
  quantity: number;
  unit_price_cents: number;
};
type Order = {
  id: string;
  order_number: string;
  status: string;
  payment_method: string;
  total_cents: number;
  created_at: string;
  order_items: OrderItem[];
};

const money = (cents: number) => "$" + (cents / 100).toFixed(2);
const prettyStatus = (status: string) => status.replaceAll("_", " ");

export default function Account() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [userEmail, setUserEmail] = useState("");
  const [role, setRole] = useState("customer");
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    const { data: userResult, error: userError } = await supabase.auth.getUser();
    if (userError || !userResult.user) {
      setUserEmail("");
      setLoading(false);
      return;
    }
    setUserEmail(userResult.user.email ?? "");
    const [{ data: profile }, { data: orderRows, error: orderError }] = await Promise.all([
      supabase.from("profiles").select("role").eq("id", userResult.user.id).maybeSingle(),
      supabase
        .from("orders")
        .select("id,order_number,status,payment_method,total_cents,created_at,order_items(id,product_name,quantity,unit_price_cents)")
        .order("created_at", { ascending: false }),
    ]);
    setRole(profile?.role ?? "customer");
    setOrders((orderRows ?? []) as Order[]);
    setMessage(orderError ? "Your orders could not be loaded: " + orderError.message : "");
    setLoading(false);
  }, []);

  useEffect(() => {
    void loadDashboard();
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) {
        setUserEmail("");
        setOrders([]);
        setRole("customer");
      } else {
        setUserEmail(session.user.email ?? "");
        window.setTimeout(() => void loadDashboard(), 0);
      }
    });
    return () => listener.subscription.unsubscribe();
  }, [loadDashboard]);

  async function signIn() {
    if (!email.trim() || !password) {
      setMessage("Enter your email and password.");
      return;
    }
    setBusy(true);
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    setBusy(false);
    if (error) setMessage(error.message);
    else {
      setMessage("");
      await loadDashboard();
    }
  }

  async function signUp() {
    if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setMessage("Enter a valid email address.");
      return;
    }
    if (password.length < 8) {
      setMessage("Your password must be at least 8 characters long.");
      return;
    }
    setBusy(true);
    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: { emailRedirectTo: location.origin + "/account" },
    });
    setBusy(false);
    setMessage(error?.message ?? (data.session
      ? "Your account is ready."
      : "Account created. Check your email to verify it, then sign in."));
    if (data.session) await loadDashboard();
  }

  async function resetPassword() {
    if (!email.trim()) {
      setMessage("Enter your email address first.");
      return;
    }
    setBusy(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: location.origin + "/account",
    });
    setBusy(false);
    setMessage(error?.message ?? "Password reset email sent if the account exists.");
  }

  async function signOut() {
    setBusy(true);
    const { error } = await supabase.auth.signOut();
    setBusy(false);
    setMessage(error?.message ?? "You have been signed out.");
    setOrders([]);
    setUserEmail("");
  }

  return (
    <main className="wrap">
      <nav className="nav">
        <a className="logo" href="/">🎄 SANTA<span>STORE</span></a>
        <a className="muted" href="/">← Back to store</a>
      </nav>

      {loading ? (
        <div className="notice" style={{ maxWidth: 720, margin: "55px auto" }}>Loading your account…</div>
      ) : userEmail ? (
        <section style={{ maxWidth: 900, margin: "45px auto" }}>
          <div className="eyebrow">CUSTOMER ACCOUNT</div>
          <h1 style={{ fontSize: 34, margin: "8px 0" }}>Welcome back</h1>
          <p className="muted">Your orders and account information in one place.</p>

          <div className="grid" style={{ marginTop: 24, gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))" }}>
            <div className="product pbody">
              <div className="muted">Signed in as</div>
              <h3 style={{ marginTop: 9, overflowWrap: "anywhere" }}>{userEmail}</h3>
            </div>
            <div className="product pbody">
              <div className="muted">Account type</div>
              <h3 style={{ marginTop: 9, textTransform: "capitalize" }}>{role}</h3>
            </div>
            <div className="product pbody">
              <div className="muted">Orders</div>
              <h3 style={{ marginTop: 9 }}>{orders.length}</h3>
            </div>
          </div>

          {role === "admin" || role === "staff" ? (
            <div className="notice" style={{ marginTop: 22 }}>
              Staff account detected. <a href="/admin" style={{ textDecoration: "underline", fontWeight: 800 }}>Open the admin panel →</a>
            </div>
          ) : null}

          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, marginTop: 38, marginBottom: 14 }}>
            <h2 style={{ fontSize: 25, margin: 0 }}>Order history</h2>
            <button className="btn secondary" type="button" disabled={busy} onClick={signOut}>Sign out</button>
          </div>

          {message ? <div className="notice" role="status" style={{ marginBottom: 16 }}>{message}</div> : null}

          {orders.length === 0 ? (
            <div className="product pbody">
              <h3>No orders yet</h3>
              <p className="muted">When you place an order, its payment and delivery status will appear here.</p>
              <a className="btn" href="/#products">Browse the store</a>
            </div>
          ) : (
            <div style={{ display: "grid", gap: 14 }}>
              {orders.map(order => (
                <article className="product pbody" key={order.id}>
                  <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", gap: 10 }}>
                    <div>
                      <div className="muted">Order number</div>
                      <h3 style={{ margin: "5px 0" }}>{order.order_number}</h3>
                    </div>
                    <span className="pill" style={{ alignSelf: "start", textTransform: "capitalize" }}>{prettyStatus(order.status)}</span>
                  </div>
                  <div className="muted" style={{ marginTop: 8 }}>
                    {new Date(order.created_at).toLocaleString()} · {order.payment_method}
                  </div>
                  <div style={{ borderTop: "1px solid #303036", marginTop: 14, paddingTop: 12 }}>
                    {(order.order_items ?? []).map(item => (
                      <div key={item.id} style={{ display: "flex", justifyContent: "space-between", gap: 12, padding: "5px 0" }}>
                        <span>{item.product_name} × {item.quantity}</span>
                        <b>{money(item.unit_price_cents * item.quantity)}</b>
                      </div>
                    ))}
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", borderTop: "1px solid #303036", marginTop: 10, paddingTop: 12 }}>
                    <b>Total</b><b>{money(order.total_cents)}</b>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      ) : (
        <section style={{ maxWidth: 460, margin: "55px auto" }}>
          <h1 style={{ fontSize: 30 }}>Customer account</h1>
          <p className="muted">Sign in to view your order history, or create an account to get started.</p>
          <div style={{ display: "grid", gap: 12, marginTop: 22 }}>
            <input className="input" placeholder="Email" type="email" autoComplete="email" value={email} onChange={event => setEmail(event.target.value)} />
            <input className="input" placeholder="Password (min. 8 characters)" type="password" autoComplete="current-password" value={password} onChange={event => setPassword(event.target.value)} />
            <button className="btn" type="button" disabled={busy} onClick={signIn}>Sign in</button>
            <button className="btn secondary" type="button" disabled={busy} onClick={signUp}>Create account</button>
            <button className="btn secondary" type="button" disabled={busy} onClick={resetPassword}>Forgot password</button>
            {message ? <div className="notice" role="status">{message}</div> : null}
            <a className="muted" href="/">← Back to store</a>
          </div>
        </section>
      )}
    </main>
  );
}
