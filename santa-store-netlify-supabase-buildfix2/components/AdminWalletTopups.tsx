"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

type TopUpRequest = {
  id: string;
  user_id: string;
  request_number: string;
  amount_cents: number;
  payment_method: string;
  status: string;
  customer_note: string | null;
  created_at: string;
};

type Profile = { id: string; email: string | null; full_name: string | null };
const money = (cents: number) => "$" + (cents / 100).toFixed(2);

export default function AdminWalletTopups() {
  const [requests, setRequests] = useState<TopUpRequest[]>([]);
  const [profiles, setProfiles] = useState<Record<string, Profile>>({});
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState("");
  const [message, setMessage] = useState("");

  const loadRequests = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("wallet_topup_requests")
      .select("id,user_id,request_number,amount_cents,payment_method,status,customer_note,created_at")
      .order("created_at", { ascending: false })
      .limit(100);

    if (error) {
      setMessage("Could not load wallet top-ups: " + error.message);
      setRequests([]);
      setLoading(false);
      return;
    }

    const rows = (data ?? []) as TopUpRequest[];
    const userIds = [...new Set(rows.map(row => row.user_id))];
    if (userIds.length) {
      const { data: profileRows } = await supabase
        .from("profiles")
        .select("id,email,full_name")
        .in("id", userIds);
      setProfiles(Object.fromEntries(((profileRows ?? []) as Profile[]).map(row => [row.id, row])));
    } else {
      setProfiles({});
    }

    setRequests(rows);
    setLoading(false);
  }, []);

  useEffect(() => {
    void loadRequests();
    const channel = supabase
      .channel("admin-wallet-topups")
      .on("postgres_changes", { event: "*", schema: "public", table: "wallet_topup_requests" }, () => { void loadRequests(); })
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [loadRequests]);

  async function review(request: TopUpRequest, approve: boolean) {
    const action = approve ? "approve and credit" : "reject";
    const prompt = approve
      ? "Confirm you have received $" + (request.amount_cents / 100).toFixed(2) + " for " + request.request_number + " and credit the customer's balance?"
      : "Reject top-up request " + request.request_number + "?";
    if (!window.confirm(prompt)) return;

    setBusyId(request.id);
    setMessage("");
    const { data, error } = await supabase.rpc("review_wallet_topup", {
      p_request_id: request.id,
      p_approve: approve,
      p_note: approve ? "Verified payment for " + request.request_number : "Top-up request rejected by staff.",
    });
    setBusyId("");

    if (error) {
      setMessage("Could not " + action + ": " + error.message);
      return;
    }

    const result = data as { credited_cents?: number; balance_cents?: number; status?: string };
    setMessage(approve
      ? "Approved. " + money(Number(result?.credited_cents ?? request.amount_cents)) + " was added to the customer's store balance."
      : "Top-up request rejected.");
    await loadRequests();
  }

  const pendingCount = requests.filter(request => request.status === "pending").length;

  return (
    <section style={{ marginTop: 38 }}>
      <div className="eyebrow">CUSTOMER WALLETS</div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <h2 style={{ fontSize: 25, margin: "7px 0" }}>Balance top-up requests ({pendingCount} pending)</h2>
        <button className="btn secondary" type="button" disabled={loading} onClick={() => void loadRequests()}>
          {loading ? "Refreshing…" : "Refresh top-ups"}
        </button>
      </div>
      <p className="muted">Verify the payment in your payment app before approving. Approval adds the requested amount to the customer's wallet.</p>
      {message ? <div className="notice" role="status" style={{ margin: "12px 0" }}>{message}</div> : null}
      {loading && requests.length === 0 ? (
        <div className="product pbody muted">Loading top-up requests…</div>
      ) : requests.length === 0 ? (
        <div className="product pbody muted">No balance top-up requests yet.</div>
      ) : (
        <div style={{ display: "grid", gap: 10, marginTop: 12 }}>
          {requests.map(request => {
            const profile = profiles[request.user_id];
            return (
              <article className="product pbody" key={request.id}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                  <div>
                    <b>{request.request_number}</b>
                    <div className="muted">{profile?.email ?? profile?.full_name ?? "Customer"} · {new Date(request.created_at).toLocaleString()}</div>
                    <div className="muted" style={{ marginTop: 4 }}>Method: {request.payment_method.replaceAll("_", " ")}</div>
                    {request.customer_note ? <div className="muted" style={{ marginTop: 4 }}>Customer note: {request.customer_note}</div> : null}
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ color: "#e4c6ff", fontSize: 22, fontWeight: 900 }}>{money(request.amount_cents)}</div>
                    <span className="pill">{request.status.toUpperCase()}</span>
                  </div>
                </div>
                {request.status === "pending" ? (
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 14 }}>
                    <button className="btn" type="button" disabled={busyId === request.id} onClick={() => void review(request, true)}>
                      {busyId === request.id ? "Reviewing…" : "Approve & Credit Balance"}
                    </button>
                    <button className="btn secondary" type="button" disabled={busyId === request.id} onClick={() => void review(request, false)}>
                      Reject Request
                    </button>
                  </div>
                ) : null}
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
