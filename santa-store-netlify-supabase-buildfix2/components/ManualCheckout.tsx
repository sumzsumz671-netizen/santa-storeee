"use client";

import { useState } from "react";
import { supabase } from "../lib/supabase";

const METHODS = [
  { value: "cash_app", label: "Cash App" },
  { value: "paypal", label: "PayPal" },
  { value: "crypto", label: "Cryptocurrency" },
  { value: "g2a_crypto", label: "G2A Gift Me Crypto" },
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
  const [selectedCrypto, setSelectedCrypto] = useState<"ltc" | "btc" | "sol">("ltc");
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

    const result = data as { order_id?: string; order_number?: string; total_cents?: number };
    setOrderNumber(result.order_number ?? "");
    setTotalCents(Number(result.total_cents ?? displayedTotal));
    setMessage("Order created. Send the payment below, then return to My Account and click I Have Paid to open your private order chat.");

    if (result.order_id) {
      void (async () => {
        try {
          const { data: sessionData } = await supabase.auth.getSession();
          const accessToken = sessionData.session?.access_token;
          if (!accessToken) return;
          const alertResponse = await fetch("/api/discord-new-order", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: "Bearer " + accessToken,
            },
            body: JSON.stringify({ orderId: result.order_id }),
          });
          if (!alertResponse.ok) {
            console.warn("Sumz Market order alert was not delivered to Discord.", await alertResponse.text());
          }
        } catch (alertError) {
          console.warn("Sumz Market order alert could not reach Discord.", alertError);
        }
      })();
    }
  }

  return (
    <div className="sumz-checkout">
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
          <div className="sumz-payment-label">Choose payment method</div>
          <div className="sumz-payment-grid" role="radiogroup" aria-label="Payment method">
            {METHODS.map(option => <button type="button" key={option.value} className={"sumz-payment-choice "+(method===option.value?"is-selected":"")} onClick={()=>setMethod(option.value)} disabled={busy} aria-pressed={method===option.value}>
              <span className={"sumz-payment-icon sumz-icon-"+option.value}>{option.value==="cash_app"?"$":option.value==="paypal"?"P":option.value==="crypto"?"₿":"G"}</span><span className="sumz-payment-copy"><b>{option.label}</b><small>{option.value==="cash_app"?"Fast mobile payment":option.value==="paypal"?"Pay securely with PayPal":option.value==="crypto"?"LTC · BTC · SOL":"Gift Me Crypto"}</small></span><span className="sumz-payment-radio">{method===option.value?"✓":""}</span>
            </button>)}
          </div>
          <div className="sumz-order-total"><span>Order total</span><strong>${(displayedTotal / 100).toFixed(2)} <small>USD</small></strong></div>
          <button className="sumz-place-order" type="button" disabled={busy} onClick={placeOrder}><span>{busy?"Creating order…":"Continue to payment"}</span><b>→</b></button>
          <p className="sumz-checkout-terms">By continuing, you agree to our <a href="/terms" className="sumz-terms-link">Terms</a>.</p>
        </>
      ) : (
        <section className="sumz-payment-instructions">
          <div className="eyebrow">PAYMENT INSTRUCTIONS</div>
          <h4 style={{ margin: "7px 0" }}>Order {orderNumber}</h4>
          <div className="sumz-payment-total">${(totalCents / 100).toFixed(2)} <small>USD</small></div>

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
              <div className="sumz-crypto-tabs">{(["ltc","btc","sol"] as const).map((coin)=><button type="button" className={selectedCrypto===coin?"active":""} key={coin} onClick={()=>setSelectedCrypto(coin)}>{coin.toUpperCase()}</button>)}</div>
              {[PAYMENT_DETAILS[selectedCrypto]].map(wallet => (
                <div key={wallet.label} style={{ borderTop: "1px solid #393940", paddingTop: 10 }}>
                  <b>{wallet.label}</b>
                  <div style={{ overflowWrap: "anywhere", margin: "6px 0", fontSize: 12 }}>{wallet.recipient}</div>
                  <button className="btn secondary" type="button" onClick={() => void copyValue(wallet.label, wallet.recipient)}>Copy {wallet.label} address</button>
                </div>
              ))}
              <p className="muted">Only send the matching cryptocurrency to its matching network address. Confirm the coin and network before sending.</p>
            </div>
          ) : null}

          {method === "g2a_crypto" ? (
            <div>
              <b>G2A Gift Me Crypto</b>
              <p className="muted">Purchase crypto through G2A Gift Me Crypto, then send payment proof in your order chat so support can verify it.</p>
              <a className="btn" href="https://www.g2a.com/pl/category/gift-me-crypto-c4071" target="_blank" rel="noopener noreferrer" style={{ width: "100%", marginTop: 10 }}>Open G2A Gift Me Crypto ↗</a>
            </div>
          ) : null}

          <div className="sumz-payment-reference">
            <b>Payment reference / note</b>
            <p className="muted" style={{ margin: "5px 0" }}>Use your real order number so the payment can be matched to your purchase. Do not use an unrelated description.</p>
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <code>{orderNumber}</code>
              <button className="btn secondary" type="button" onClick={() => void copyValue("Order number", orderNumber)}>Copy order number</button>
            </div>
          </div>
          <a className="sumz-place-order" href="/account"><span>Open order chat · I Have Paid</span><b>→</b></a>
        </section>
      )}

      {message ? (
        <div className="muted" role="status" style={{ marginTop: 8, lineHeight: 1.5 }}>
          {message}{" "}
          {message.startsWith("Sign in") ? <a href="/account" style={{ textDecoration: "underline" }}>Sign in</a> : null}
        </div>
      ) : null}
      {copied ? <div className="muted" role="status" style={{ marginTop: 7 }}>{copied}</div> : null}
      {!orderNumber ? <p className="sumz-checkout-hint">Secure checkout · Order details appear after you continue.</p> : null}
    </div>
  );
}
