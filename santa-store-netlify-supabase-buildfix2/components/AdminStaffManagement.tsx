"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

type StaffMember = {
  id: string;
  email: string | null;
  full_name: string | null;
  created_at: string;
};

export default function AdminStaffManagement() {
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");

  const loadStaff = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("profiles")
      .select("id,email,full_name,created_at")
      .eq("role", "staff")
      .order("created_at", { ascending: true });

    if (error) {
      setMessage("Could not load staff accounts: " + error.message);
      setStaff([]);
    } else {
      setStaff((data ?? []) as StaffMember[]);
      setMessage("");
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void loadStaff();
  }, [loadStaff]);

  async function updateStaff(address: string, enabled: boolean) {
    const normalizedEmail = address.trim().toLowerCase();
    if (!normalizedEmail) {
      setMessage("Enter the email address of an existing Sumz Market account.");
      return;
    }
    if (!enabled && !window.confirm("Remove staff access for " + normalizedEmail + "? They will lose access to the admin panel.")) {
      return;
    }

    setBusy(normalizedEmail);
    setMessage("");
    const { error } = await supabase.rpc("owner_set_staff", {
      p_email: normalizedEmail,
      p_enabled: enabled,
    });
    setBusy("");

    if (error) {
      setMessage(error.message);
      return;
    }

    setEmail("");
    setMessage(enabled
      ? normalizedEmail + " now has staff access to the admin panel."
      : normalizedEmail + " has been returned to customer access.");
    await loadStaff();
  }

  return (
    <section className="product pbody" style={{ marginTop: 28 }}>
      <div className="eyebrow">OWNER CONTROLS</div>
      <h2 style={{ fontSize: 24, margin: "7px 0" }}>Admin & staff access</h2>
      <p className="muted" style={{ lineHeight: 1.6, marginTop: 0 }}>
        Add someone who already has a Sumz Market customer account. Staff can manage the store, orders, and regular support chats, but cannot view private delivery messages or their attachments. Only the owner can manage staff.
      </p>

      <form
        onSubmit={event => {
          event.preventDefault();
          void updateStaff(email, true);
        }}
        style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) auto", gap: 9, marginTop: 14 }}
      >
        <input
          className="input"
          type="email"
          autoComplete="off"
          placeholder="Existing customer's email"
          value={email}
          onChange={event => setEmail(event.target.value)}
          disabled={!!busy}
          required
        />
        <button className="btn" type="submit" disabled={!!busy || !email.trim()}>
          {busy === email.trim().toLowerCase() ? "Adding…" : "Add staff"}
        </button>
      </form>

      {message ? <div className="notice" role="status" style={{ marginTop: 12 }}>{message}</div> : null}

      <div style={{ borderTop: "1px solid #30213f", marginTop: 18, paddingTop: 15 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <b>Current staff ({staff.length})</b>
          <button className="btn secondary" type="button" onClick={() => void loadStaff()} disabled={loading}>
            {loading ? "Refreshing…" : "Refresh staff"}
          </button>
        </div>
        {loading ? (
          <p className="muted">Loading staff accounts…</p>
        ) : staff.length === 0 ? (
          <p className="muted">No staff accounts have been added yet. Your owner account remains separate.</p>
        ) : (
          <div style={{ display: "grid", gap: 9, marginTop: 12 }}>
            {staff.map(member => (
              <div key={member.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap", padding: 12, border: "1px solid #393044", borderRadius: 10, background: "#111114" }}>
                <div>
                  <b>{member.full_name || member.email || "Staff account"}</b>
                  {member.full_name && member.email ? <div className="muted">{member.email}</div> : null}
                  <span className="pill" style={{ marginTop: 6 }}>Staff access</span>
                </div>
                <button
                  className="btn secondary"
                  type="button"
                  disabled={!!busy}
                  onClick={() => void updateStaff(member.email ?? "", false)}
                >
                  {busy === (member.email ?? "").toLowerCase() ? "Removing…" : "Remove access"}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
