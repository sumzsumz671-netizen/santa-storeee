"use client";

import { useState } from "react";
import { supabase } from "../lib/supabase";

const METHODS = [
  { value: "cash_app", label: "Cash App" },
  { value: "paypal", label: "PayPal" },
  { value: "crypto", label: "Cryptocurrency" },
  { value: "rewarble_gift_card", label: "Rewarble gift card" },
];

export default function ManualCheckout({
  productId,
  productName,
  warrantyPriceCents,
}: {
  productId: string;
  productName: string;
  warrantyPriceCents?: number | null;
}) {
  const [method, setMethod] = useState("cash_app");
  const [withWarranty, setWithWarranty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [orderNumber, setOrderNumber] = useState("");

  async function placeOrder() {
    setBusy(true);
    setMessage("");
    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError || !authData.user) {
      setBusy(false);
      setMessage("Sign in before placing an order.");
      return;
    }

    const { data, error } = await supabase.rpc("create_manual_order", {
      p_product_id: productId,
      p_quantity: 1,
      p_payment_method: method,
      p_warranty: withWarranty,
    });
    setBusy(false);
    if (error) {
      setMessage(error.message);
      return;
    }

    const result = data as { order_number?: string };
    setOrderNumber(result.order_number ?? "");
    setMessage("Order created. After sending payment, open your account and click I Have Paid to chat with support.");
  }

  return (
    <div style={{ marginTop: 10, borderTop: "1px solid #303036", paddingTop: 12 }}>
      {typeof warrantyPriceCents === "number" ? (
        <label className="muted" style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
          <input type="checkbox" checked={withWarranty} onChange={event => setWithWarranty(event.target.checked)} disabled={busy || !!orderNumber} />
          Add With Warranty · ${(warrantyPriceCents / 100).toFixed(2)}
        </label>
      ) : null}
      <label className="muted" htmlFor={"method-" + productId}>Payment method</label>
      <select
        id={"method-" + productId}
        className="input"
        style={{ width: "100%", marginTop: 7 }}
        value={method}
        onChange={event => setMethod(event.target.value)}
        disabled={busy || !!orderNumber}
      >
        {METHODS.map(option => <option value={option.value} key={option.value}>{option.label}</option>)}
      </select>
      <button className="btn secondary" type="button" style={{ width: "100%", marginTop: 8 }} disabled={busy || !!orderNumber} onClick={placeOrder}>
        {busy ? "Creating order…" : "Place order"}
      </button>
      {message ? (
        <div className="muted" role="status" style={{ marginTop: 8, lineHeight: 1.5 }}>
          {orderNumber ? <b>Order {orderNumber}. </b> : null}
          {message}{" "}
          {message.startsWith("Sign in") ? <a href="/account" style={{ textDecoration: "underline" }}>Sign in</a> : null}
          {orderNumber ? <a href="/account" style={{ textDecoration: "underline", fontWeight: 800 }}> Go to account</a> : null}
        </div>
      ) : null}
      <p className="muted" style={{ margin: "8px 0 0", lineHeight: 1.45 }}>
        {productName}. Use the payment details provided by the store owner. Do not report payment until you have sent it.
      </p>
    </div>
  );
}
