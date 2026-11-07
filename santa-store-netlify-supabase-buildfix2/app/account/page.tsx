"use client";

import { useState } from "react";
import { supabase } from "../../lib/supabase";

export default function Account() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState("");

  function validateEmail() {
    const cleanEmail = email.trim();
    if (!cleanEmail) {
      setMsg("Enter your email address first.");
      return null;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      setMsg("Enter a valid email address.");
      return null;
    }
    return cleanEmail;
  }

  async function signIn() {
    const cleanEmail = validateEmail();
    if (!cleanEmail) return;
    if (!password) {
      setMsg("Enter your password first.");
      return;
    }

    const { error } = await supabase.auth.signInWithPassword({
      email: cleanEmail,
      password,
    });
    setMsg(error?.message || "Signed in. Account dashboard setup is next.");
  }

  async function signUp() {
    const cleanEmail = validateEmail();
    if (!cleanEmail) return;
    if (password.length < 8) {
      setMsg("Your password must be at least 8 characters long.");
      return;
    }

    const { error } = await supabase.auth.signUp({
      email: cleanEmail,
      password,
      options: { emailRedirectTo: location.origin + "/account" },
    });
    setMsg(error?.message || "Check your email to verify your account.");
  }

  async function reset() {
    const cleanEmail = validateEmail();
    if (!cleanEmail) return;

    const { error } = await supabase.auth.resetPasswordForEmail(cleanEmail, {
      redirectTo: location.origin + "/account",
    });
    setMsg(error?.message || "Password reset email sent if the account exists.");
  }

  return (
    <main className="wrap">
      <a className="logo" href="/">🎄 SANTA<span>STORE</span></a>
      <div style={{ maxWidth: 440, margin: "60px auto" }}>
        <h1>Customer account</h1>
        <p className="muted">
          Sign in or create an account. Email verification is enabled through Supabase Auth.
        </p>
        <div style={{ display: "grid", gap: 12 }}>
          <input
            className="input"
            placeholder="Email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
          <input
            className="input"
            placeholder="Password (min. 8 characters)"
            type="password"
            autoComplete="current-password"
            minLength={8}
            required
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
          <button className="btn" type="button" onClick={signIn}>Sign in</button>
          <button className="btn secondary" type="button" onClick={signUp}>Create account</button>
          <button className="btn secondary" type="button" onClick={reset}>Forgot password</button>
          {msg && <div className="notice" role="status">{msg}</div>}
          <a className="muted" href="/">← Back to store</a>
        </div>
      </div>
    </main>
  );
}
