"use client";

import { useState } from "react";
import { supabase } from "../lib/supabase";

export default function BuyWithBalance({
  productId,
  warrantyPriceCents,
}: {
  productId: string;
  warrantyPriceCents?: number | null;
}) {
  const [withWarranty, setWithWarranty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function buy() {
    setBusy(true);
    setMessage("");
    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError || !authData.user) {
      setBusy(false);
      setMessage("Sign in to use your store balance.");
      return;
    }

    const { data, error } = await supabase.rpc("purchase_product_with_balance", {
      p_product_id: productId,
      p_quantity: 1,
      p_warranty: withWarranty,
    });
    setBusy(false);

    if (error) {
      setMessage(error.message);
      return;
    }

    const result = data as {
      order_number?: string;
      balance_cents?: number;
    };
    setMessage(
      "Purchase successful · " +
        (result.order_number ?? "Order created") +
        (typeof result.balance_cents === "number"
          ? " · Remaining balance $" + (result.balance_cents / 100).toFixed(2)
          : "")
    );
  }

  return (
    <div style={{ marginTop: 10 }}>
      {typeof warrantyPriceCents === "number" ? (
        <label className="muted" style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
          <input type="checkbox" checked={withWarranty} onChange={event => setWithWarranty(event.target.checked)} disabled={busy} />
          With Warranty · ${(warrantyPriceCents / 100).toFixed(2)}
        </label>
      ) : null}
      <button className="btn" type="button" style={{ width: "100%" }} disabled={busy} onClick={buy}>
        {busy ? "Processing…" : "Buy with store balance"}
      </button>
      {message ? (
        <div className="muted" role="status" style={{ marginTop: 8, lineHeight: 1.5 }}>
          {message}{" "}
          {message.startsWith("Sign in") ? <a href="/account" style={{ textDecoration: "underline" }}>Sign in</a> : null}
          {message.startsWith("Purchase successful") ? <a href="/account" style={{ textDecoration: "underline" }}> View order</a> : null}
        </div>
      ) : null}
    </div>
  );
}
