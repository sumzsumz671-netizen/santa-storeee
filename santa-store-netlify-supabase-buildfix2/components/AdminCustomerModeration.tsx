"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";

type Customer = {
  id: string;
  email: string | null;
  full_name: string | null;
  role: string;
  purchase_blocked: boolean;
  purchase_block_reason: string | null;
  purchase_blocked_at: string | null;
};

type BanResult = {
  purchase_blocked?: boolean;
  deleted_account_request_tickets?: number;
  deleted_conversation_ids?: string[];
  attachment_paths?: string[];
};

export default function AdminCustomerModeration() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState("");
  const [message, setMessage] = useState("");

  const loadCustomers = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("profiles")
      .select("id,email,full_name,role,purchase_blocked,purchase_block_reason,purchase_blocked_at")
      .eq("role", "customer")
      .order("created_at", { ascending: false });

    if (error) {
      setMessage("Could not load customer accounts: " + error.message);
      setCustomers([]);
    } else {
      setCustomers((data ?? []) as Customer[]);
      setMessage("");
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void loadCustomers();
  }, [loadCustomers]);

  const filteredCustomers = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return customers;
    return customers.filter(customer =>
      [customer.email, customer.full_name, customer.id]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(term)
    );
  }, [customers, query]);

  async function setPurchaseBlock(customer: Customer, blocked: boolean) {
    let reason: string | null = null;

    if (blocked) {
      const entered = window.prompt(
        "Optional reason for blocking purchases for " + (customer.email ?? "this customer") + ":",
        customer.purchase_block_reason ?? ""
      );
      if (entered === null) return;
      reason = entered.trim().slice(0, 500) || null;

      const confirmed = window.confirm(
        "Block " + (customer.email ?? "this customer") + " from placing new orders?\n\n" +
        "Any website support tickets tied to clearly labeled account/custom-request products will also be deleted. " +
        "Normal order/payment chats and purchase history will remain."
      );
      if (!confirmed) return;
    } else {
      if (!window.confirm("Restore purchasing access for " + (customer.email ?? "this customer") + "?")) return;
    }

    setBusyId(customer.id);
    setMessage("");
    const { data, error } = await supabase.rpc("admin_set_purchase_block", {
      p_user_id: customer.id,
      p_blocked: blocked,
      p_reason: reason,
    });
    setBusyId("");

    if (error) {
      setMessage((blocked ? "Could not block purchases: " : "Could not restore purchasing: ") + error.message);
      return;
    }

    const result = data as BanResult;
    let attachmentNote = "";
    const paths = Array.isArray(result?.attachment_paths) ? result.attachment_paths : [];
    if (blocked && paths.length) {
      const { error: storageError } = await supabase.storage
        .from("support-attachments")
        .remove(paths);
      if (storageError) {
        attachmentNote = " The website request ticket records were deleted, but some private attachment files could not be removed: " + storageError.message;
      }
    }

    await loadCustomers();
    if (blocked) {
      const removed = Number(result?.deleted_account_request_tickets ?? 0);
      setMessage(
        "Purchasing blocked for " + (customer.email ?? "the customer") +
        ". Deleted " + removed + " matching website account/custom-request ticket" + (removed === 1 ? "" : "s") + "." +
        attachmentNote
      );
    } else {
      setMessage("Purchasing access restored for " + (customer.email ?? "the customer") + ".");
    }
  }

  const blockedCount = customers.filter(customer => customer.purchase_blocked).length;

  return (
    <section style={{ marginTop: 42 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <div>
          <div className="eyebrow">CUSTOMER ACCESS CONTROL</div>
          <h2 style={{ fontSize: 25, margin: "7px 0" }}>Ban / unban customers</h2>
          <p className="muted">Block a customer from placing new orders through either checkout method, or restore their access.</p>
        </div>
        <button className="btn secondary" type="button" onClick={() => void loadCustomers()} disabled={loading || !!busyId}>
          {loading ? "Refreshing…" : "Refresh customers"}
        </button>
      </div>

      <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", marginTop: 15 }}>
        <div className="product pbody"><div className="muted">Customer accounts</div><div style={{ fontSize: 27, fontWeight: 900 }}>{customers.length}</div></div>
        <div className="product pbody"><div className="muted">Purchase blocked</div><div style={{ fontSize: 27, fontWeight: 900, color: "#ff8b8b" }}>{blockedCount}</div></div>
      </div>

      <div className="product pbody" style={{ marginTop: 14 }}>
        <label className="muted" htmlFor="customer-ban-search">Search by customer email or name</label>
        <input
          id="customer-ban-search"
          className="input"
          style={{ width: "100%", marginTop: 8 }}
          type="search"
          placeholder="Search customers…"
          value={query}
          onChange={event => setQuery(event.target.value)}
        />
        <p className="muted" style={{ margin: "9px 0 0", fontSize: 11, lineHeight: 1.55 }}>
          Blocking removes only website support chats linked to products clearly labeled as Account Request or Custom Request. It does not delete normal order/payment chats, orders, or Discord tickets.
        </p>
      </div>

      {message ? <div className="notice" role="status" style={{ marginTop: 12 }}>{message}</div> : null}

      <div style={{ display: "grid", gap: 10, marginTop: 13 }}>
        {loading && customers.length === 0 ? (
          <div className="product pbody muted">Loading customer accounts…</div>
        ) : filteredCustomers.length === 0 ? (
          <div className="product pbody muted">No customers match that search.</div>
        ) : filteredCustomers.map(customer => (
          <article className="product pbody" key={customer.id}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 14, flexWrap: "wrap" }}>
              <div style={{ minWidth: 0, flex: 1 }}>
                <b style={{ overflowWrap: "anywhere" }}>{customer.full_name || customer.email || "Customer"}</b>
                {customer.full_name && customer.email ? <div className="muted" style={{ marginTop: 4, overflowWrap: "anywhere" }}>{customer.email}</div> : null}
                <div className="muted" style={{ marginTop: 5, fontSize: 10 }}>Customer account</div>
                {customer.purchase_blocked ? (
                  <div style={{ marginTop: 9, color: "#fca5a5", fontSize: 12, fontWeight: 800 }}>
                    Purchases blocked{customer.purchase_blocked_at ? " · " + new Date(customer.purchase_blocked_at).toLocaleString() : ""}
                  </div>
                ) : (
                  <div style={{ marginTop: 9, color: "#a3e635", fontSize: 12, fontWeight: 800 }}>Purchasing enabled</div>
                )}
                {customer.purchase_blocked && customer.purchase_block_reason ? (
                  <div className="muted" style={{ marginTop: 5, overflowWrap: "anywhere" }}>Reason: {customer.purchase_block_reason}</div>
                ) : null}
              </div>
              <button
                className={customer.purchase_blocked ? "btn" : "btn secondary"}
                type="button"
                disabled={busyId === customer.id}
                style={customer.purchase_blocked
                  ? { minWidth: 145, background: "linear-gradient(110deg,#4b8c1e,#86d83c)", color: "#071006", border: "1px solid #b8ff73" }
                  : { minWidth: 145, borderColor: "#8b3c3c", color: "#fca5a5" }}
                onClick={() => void setPurchaseBlock(customer, !customer.purchase_blocked)}
              >
                {busyId === customer.id ? "Saving…" : customer.purchase_blocked ? "Unban customer" : "Ban from buying"}
              </button>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
