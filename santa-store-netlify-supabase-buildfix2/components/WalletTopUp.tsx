"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

type TopUpRequest = {
  id: string;
  request_number: string;
  amount_cents: number;
  payment_method: "cash_app" | "paypal" | "crypto";
  status: "pending" | "approved" | "rejected";
  customer_note: string | null;
  created_at: string;
};

const money = (cents: number) => "$" + (cents / 100).toFixed(2);

const PAYMENT = {
  cash_app: { recipient: "$Xavier3099451", href: "https://cash.app/$Xavier3099451" },
  paypal: { recipient: "Sumzsumz71" },
  crypto: {
    wallets: [
      { label: "Litecoin (LTC)", address: "ltc1q97zk3t3l2jctu55uvepu7ztsgdjga303u5ep06" },
      { label: "Solana (SOL)", address: "JAw1SafeeG19csGZ37oSpLmGfsyuCMnps9YN2BKoyJRh" },
      { label: "Bitcoin (BTC)", address: "bc1qc7kqef7alaztl4r48d7pua3ncxmwh865s067ac" },
    ],
  },
};

export default function WalletTopUp({ onWalletUpdated }: { onWalletUpdated?: () => void }) {
  const [userId, setUserId] = useState("");
  const [amount, setAmount] = useState("10");
  const [method, setMethod] = useState<"cash_app" | "paypal" | "crypto">("cash_app");
  const [customerNote, setCustomerNote] = useState("");
  const [requests, setRequests] = useState<TopUpRequest[]>([]);
  const [latestRequest, setLatestRequest] = useState<TopUpRequest | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [copied, setCopied] = useState("");

  const loadRequests = useCallback(async () => {
    const { data: authData } = await supabase.auth.getUser();
    if (!authData.user) return;
    setUserId(authData.user.id);
    const { data, error } = await supabase
      .from("wallet_topup_requests")
      .select("id,request_number,amount_cents,payment_method,status,customer_note,created_at")
      .eq("user_id", authData.user.id)
      .order("created_at", { ascending: false })
      .limit(10);

    if (error) {
      setMessage("Your top-up requests could not be loaded: " + error.message);
      return;
    }

    const rows = (data ?? []) as TopUpRequest[];
    setRequests(rows);
    setLatestRequest(current => current
      ? rows.find(row => row.id === current.id) ?? current
      : null);
  }, []);

  useEffect(() => { void loadRequests(); }, [loadRequests]);

  useEffect(() => {
    if (!userId) return;
    const channel = supabase
      .channel("wallet-topups-customer-" + userId)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "wallet_topup_requests", filter: "user_id=eq." + userId },
        payload => {
          const row = payload.new as { status?: string };
          void loadRequests();
          if (row.status === "approved") onWalletUpdated?.();
        }
      )
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [userId, loadRequests, onWalletUpdated]);

  async function copyValue(value: string, label: string) {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(label + " copied.");
    } catch {
      setCopied("Copy was blocked. Select and copy the address manually.");
    }
  }

  async function createRequest(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    setCopied("");

    const numericAmount = Number(amount);
    const cents = Math.round(numericAmount * 100);
    if (!Number.isFinite(numericAmount) || !Number.isSafeInteger(cents) || cents < 1000) {
      setMessage("The minimum store balance top-up is $10.00.");
      return;
    }
    if (!userId) {
      setMessage("Sign in again before requesting a top-up.");
      return;
    }

    setBusy(true);
    const { data, error } = await supabase
      .from("wallet_topup_requests")
      .insert({
        user_id: userId,
        amount_cents: cents,
        payment_method: method,
        customer_note: customerNote.trim() || null,
      })
      .select("id,request_number,amount_cents,payment_method,status,customer_note,created_at")
      .single();
    setBusy(false);

    if (error || !data) {
      setMessage("Could not create your top-up request: " + (error?.message ?? "Unknown error"));
      return;
    }

    const created = data as TopUpRequest;
    setLatestRequest(created);
    setRequests(current => [created, ...current.filter(row => row.id !== created.id)].slice(0, 10));
    setCustomerNote("");
    setMessage("Top-up request created. Send the exact payment below; your balance is credited after staff verifies it.");
  }

  function PaymentInstructions({ request }: { request: TopUpRequest }) {
    const dollars = (request.amount_cents / 100).toFixed(2);
    if (request.payment_method === "cash_app") {
      return (
        <div style={{ display: "grid", gap: 9 }}>
          <b>Pay with Cash App</b>
          <div className="muted">Send ${dollars} to <b style={{ color: "white" }}>{PAYMENT.cash_app.recipient}</b>.</div>
          <a className="btn" href={PAYMENT.cash_app.href} target="_blank" rel="noopener noreferrer">Open Cash App</a>
          <div className="muted">Put reference <b style={{ color: "white" }}>{request.request_number}</b> in the payment note.</div>
          <button className="btn secondary" type="button" onClick={() => void copyValue(request.request_number, "Top-up reference")}>Copy payment reference</button>
        </div>
      );
    }

    if (request.payment_method === "paypal") {
      return (
        <div style={{ display: "grid", gap: 9 }}>
          <b>Pay with PayPal</b>
          <div className="muted">Send ${dollars} to <b style={{ color: "white" }}>{PAYMENT.paypal.recipient}</b>.</div>
          <a className="btn" href={"https://paypal.me/Sumzsumz71/" + dollars} target="_blank" rel="noopener noreferrer">Open PayPal</a>
          <div className="notice">
            Choose <b>Goods and Services / Paying for an item or service</b> for this purchase, and put <b>{request.request_number}</b> in the payment note. Do not use Friends and Family for a store purchase.
          </div>
          <button className="btn secondary" type="button" onClick={() => void copyValue(request.request_number, "Top-up reference")}>Copy payment reference</button>
        </div>
      );
    }

    return (
      <div style={{ display: "grid", gap: 11 }}>
        <b>Pay with cryptocurrency</b>
        <div className="muted">Send the matching cryptocurrency to its matching network address. Send ${dollars} worth, and include {request.request_number} when the wallet supports a note.</div>
        {PAYMENT.crypto.wallets.map(wallet => (
          <div key={wallet.label} style={{ borderTop: "1px solid #49305e", paddingTop: 10 }}>
            <b>{wallet.label}</b>
            <div className="muted" style={{ overflowWrap: "anywhere", margin: "6px 0" }}>{wallet.address}</div>
            <button className="btn secondary" type="button" onClick={() => void copyValue(wallet.address, wallet.label + " address")}>Copy address</button>
          </div>
        ))}
      </div>
    );
  }

  return (
    <section className="product pbody" style={{ marginTop: 28 }}>
      <div className="eyebrow">STORE WALLET</div>
      <h2 style={{ fontSize: 24, margin: "7px 0" }}>Add money to your balance</h2>
      <p className="muted" style={{ marginTop: 0 }}>Top-ups start at $10.00. Your balance is only credited after Sumz Market verifies the payment.</p>

      <form onSubmit={createRequest} style={{ display: "grid", gap: 10, marginTop: 16 }}>
        <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))" }}>
          <label className="muted">
            Amount (USD)
            <input className="input" type="number" min="10" step="0.01" value={amount} onChange={event => setAmount(event.target.value)} style={{ width: "100%", marginTop: 6 }} required />
          </label>
          <label className="muted">
            Payment method
            <select className="input" value={method} onChange={event => setMethod(event.target.value as typeof method)} style={{ width: "100%", marginTop: 6 }}>
              <option value="cash_app">Cash App</option>
              <option value="paypal">PayPal</option>
              <option value="crypto">Cryptocurrency</option>
            </select>
          </label>
        </div>
        <label className="muted">
          Optional note
          <input className="input" maxLength={1000} value={customerNote} onChange={event => setCustomerNote(event.target.value)} placeholder="Anything staff should know" style={{ width: "100%", marginTop: 6 }} />
        </label>
        <button className="btn" type="submit" disabled={busy}>{busy ? "Creating request…" : "Request Balance Top-Up"}</button>
      </form>

      {message ? <div className="notice" role="status" style={{ marginTop: 12 }}>{message}</div> : null}

      {latestRequest ? (
        <div style={{ marginTop: 16, padding: 15, border: "1px solid #62417e", borderRadius: 12, background: "#160d20" }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
            <b>Top-up {latestRequest.request_number}</b>
            <span className="pill">{latestRequest.status.toUpperCase()}</span>
          </div>
          <div style={{ color: "#e4c6ff", fontSize: 23, fontWeight: 900, margin: "8px 0 13px" }}>{money(latestRequest.amount_cents)}</div>
          {latestRequest.status === "pending" ? (
            <>
              <PaymentInstructions request={latestRequest} />
              <p className="muted" style={{ marginBottom: 0 }}>Your wallet is not credited yet. Once staff confirms the payment, the balance and wallet history will update automatically.</p>
            </>
          ) : latestRequest.status === "approved" ? (
            <p className="muted">Payment approved and your store balance has been credited.</p>
          ) : (
            <p className="muted">This request was declined. Contact support if you think this is a mistake.</p>
          )}
          {copied ? <div className="muted" role="status" style={{ marginTop: 8 }}>{copied}</div> : null}
        </div>
      ) : null}

      <div style={{ marginTop: 18 }}>
        <b>Recent top-up requests</b>
        {requests.length === 0 ? (
          <p className="muted">No top-up requests yet.</p>
        ) : (
          <div style={{ display: "grid", gap: 8, marginTop: 9 }}>
            {requests.map(request => (
              <button
                key={request.id}
                className="btn secondary"
                type="button"
                style={{ display: "flex", justifyContent: "space-between", gap: 12, textAlign: "left", flexWrap: "wrap" }}
                onClick={() => setLatestRequest(request)}
              >
                <span>{request.request_number} · {money(request.amount_cents)}</span>
                <span>{request.status}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
