"use client";

import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

export default function MarketAuthLinks() {
  const [signedIn, setSignedIn] = useState(false);

  useEffect(() => {
    let mounted = true;

    // Restore the persisted Supabase session when the storefront loads.
    supabase.auth.getSession().then(({ data }) => {
      if (mounted) setSignedIn(Boolean(data.session));
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (mounted) setSignedIn(Boolean(session));
    });

    return () => {
      mounted = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  return (
    <div className="market-auth-links">
      <a className="market-nav-account" href="/account">
        {signedIn ? "My Account" : "Sign in"}
      </a>
      <a className="market-login" href="/account">
        {signedIn ? "Account" : "Sign in"} <span>→</span>
      </a>
    </div>
  );
}
