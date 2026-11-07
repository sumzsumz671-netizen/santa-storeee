"use client";

import { useState } from "react";
import { supabase } from "../lib/supabase";

const METHODS = [
  { value: "cash_app", label: "Cash App" },
  { value: "paypal", label: "PayPal" },
  { value: "crypto", label: "Cryptocurrency" },
  { value: "rewarble_gift_card", label: "Rewarble gift card" },
];

const PAYMENT_DETAILS = {
  cash_app: { label: "Cash App", recipient: "$Xavier3099451" },
  paypal: { label: "PayPal", recipient: "Sumzsumz71" },
  ltc: { label: "Litecoin (LTC)", recipient: "ltc1q97zk3t3l2jctu55uvepu7ztsgdjga303u5ep06" },
  sol: { label: "Solana (SOL)", recipient: "JAw1SafeeG19csGZ37oSpLmGfsyuCMnps9YN2BKoyJRh" },
  btc: { label: "Bitcoin (BTC)", recipient: "bc1qc7kqef7alaztl4r48d7pua3ncxmwh865s067ac" },
};

export default function ManualCheckout({
  productId,
  productName,
  priceCents,
  warrantyPriceCents,
}: {
  productId: string;
  productName: string;
  priceCents: number;
  warrantyPriceCents?: number | null;
}) {
  const [method, setMethod] = useState("cash_app");
  const [withWarranty, setWithWarranty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [orderNumber, setOrderNumber] = useState("");
  const [totalCents, setTotalCents] = useState(0);
  const [copied, setCopied] = useState("");

  const displayedTotal = withWarranty && typeof warrantyPriceCents === "number"
    ? warrantyPriceCents
    : priceCents;

  async function copyValue(label: string, value: string) {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(label + " copied");
    } catch {
      setCopied("Copy was blocked by your browser. Select and copy the address manually.");
    }
  }

  async function placeOrder() {
    setBusy(true);
    setMessage("");
    setCopied("");
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

    const result = data as { order_number?: string; total_cents?: number };
    setOrderNumber(result.order_number ?? "");
    setTotalCents(Number(result.total_cents ?? displayedTotal));
    setMessage("Order created. Send the payment below, then return to My Account and click I Have Paid to open your private order chat.");
  }

  return (
    <div style={{ marginTop: 10, borderTop: "1px solid #303036", paddingTop: 12 }}>
      {typeof warrantyPriceCents === "number" ? (
        <label className="muted" style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
          <input
            type="checkbox"
            checked={withWarranty}
            onChange={event => setWithWarranty(event.target.checked)}
            disabled={busy || !!orderNumber}
          />
          Add With Warranty · ${(warrantyPriceCents / 100).toFixed(2)}
        </label>
      ) : null}

      {!orderNumber ? (
        <>
          <label className="muted" htmlFor={"method-" + productId}>Payment method</label>
          <select
            id={"method-" + productId}
            className="input"
            style={{ width: "100%", marginTop: 7 }}
            value={method}
            onChange={event => setMethod(event.target.value)}
            disabled={busy}
          >
            {METHODS.map(option => <option value={option.value} key={option.value}>{option.label}</option>)}
          </select>
          <div className="muted" style={{ marginTop: 8 }}>Total: <b style={{ color: "white" }}>${(displayedTotal / 100).toFixed(2)}</b></div>
          <button className="btn secondary" type="button" style={{ width: "100%", marginTop: 8 }} disabled={busy} onClick={placeOrder}>
            {busy ? "Creating order…" : "Place order"}
          </button>
        </>
      ) : (
        <section style={{ border: "1px solid #444", borderRadius: 12, padding: 13, marginTop: 10 }}>
          <div className="eyebrow">PAYMENT INSTRUCTIONS</div>
          <h4 style={{ margin: "7px 0" }}>Order {orderNumber}</h4>
          <div style={{ fontSize: 22, fontWeight: 900, marginBottom: 12 }}>${(totalCents / 100).toFixed(2)} USD</div>

          {method === "cash_app" ? (
            <div>
              <b>Pay with Cash App</b>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 7, flexWrap: "wrap" }}>
                <code>{PAYMENT_DETAILS.cash_app.recipient}</code>
                <button className="btn secondary" type="button" onClick={() => void copyValue("Cash App tag", PAYMENT_DETAILS.cash_app.recipient)}>Copy tag</button>
              </div>
              <a
                className="btn"
                href="https://cash.app/$Xavier3099451"
                target="_blank"
                rel="noopener noreferrer"
                style={{ width: "100%", marginTop: 12 }}
              >
                Open Cash App to Pay
              </a>
              <p className="muted" style={{ marginTop: 8 }}>
                Enter the exact total shown above and put order {orderNumber} in the payment note.
              </p>
            </div>
          ) : null}

          {method === "paypal" ? (
            <div>
              <b>Pay with PayPal</b>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 7, flexWrap: "wrap" }}>
                <code>{PAYMENT_DETAILS.paypal.recipient}</code>
                <button className="btn secondary" type="button" onClick={() => void copyValue("PayPal recipient", PAYMENT_DETAILS.paypal.recipient)}>Copy name</button>
              </div>
              <a
                className="btn"
                href={`https://paypal.me/Sumzsumz71/${(totalCents / 100).toFixed(2)}`}
                target="_blank"
                rel="noopener noreferrer"
                style={{ width: "100%", marginTop: 12 }}
              >
                Open PayPal to Pay ${(totalCents / 100).toFixed(2)}
              </a>
            </div>
          ) : null}

          {method === "crypto" ? (
            <div style={{ display: "grid", gap: 12 }}>
              {[PAYMENT_DETAILS.ltc, PAYMENT_DETAILS.sol, PAYMENT_DETAILS.btc].map(wallet => (
                <div key={wallet.label} style={{ borderTop: "1px solid #393940", paddingTop: 10 }}>
                  <b>{wallet.label}</b>
                  <div style={{ overflowWrap: "anywhere", margin: "6px 0", fontSize: 12 }}>{wallet.recipient}</div>
                  <button className="btn secondary" type="button" onClick={() => void copyValue(wallet.label, wallet.recipient)}>Copy {wallet.label} address</button>
                </div>
              ))}
              <p className="muted">Only send the matching cryptocurrency to its matching network address. Confirm the coin and network before sending.</p>
            </div>
          ) : null}

          {method === "rewarble_gift_card" ? (
            <div>
              <b>Rewarble gift card</b>
              <p className="muted">Open your private order chat from My Account and ask support for the current gift-card redemption instructions before submitting the code.</p>
            </div>
          ) : null}

          <div style={{ borderTop: "1px solid #393940", marginTop: 13, paddingTop: 12 }}>
            <b>Payment reference / note</b>
            <p className="muted" style={{ margin: "5px 0" }}>Use your real order number so the payment can be matched to your purchase. Do not use an unrelated description.</p>
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <code>{orderNumber}</code>
              <button className="btn secondary" type="button" onClick={() => void copyValue("Order number", orderNumber)}>Copy order number</button>
            </div>
          </div>
          <a className="btn" href="/account" style={{ width: "100%", marginTop: 14 }}>Go to My Account · I Have Paid</a>
        </section>
      )}

      {message ? (
        <div className="muted" role="status" style={{ marginTop: 8, lineHeight: 1.5 }}>
          {message}{" "}
          {message.startsWith("Sign in") ? <a href="/account" style={{ textDecoration: "underline" }}>Sign in</a> : null}
        </div>
      ) : null}
      {copied ? <div className="muted" role="status" style={{ marginTop: 7 }}>{copied}</div> : null}
      {!orderNumber ? (
        <p className="muted" style={{ margin: "8px 0 0", lineHeight: 1.45 }}>
          {productName}. Place your order to see the payment destination and order reference.
        </p>
      ) : null}
    </div>
  );
}
