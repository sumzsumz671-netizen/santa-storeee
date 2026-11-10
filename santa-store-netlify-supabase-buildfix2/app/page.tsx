import { supabase } from "../lib/supabase";
import InventorySearch from "../components/InventorySearch";
import MarketAuthLinks from "../components/MarketAuthLinks";

export const dynamic = "force-dynamic";

type Product = {
  id: string; name: string; slug: string; description: string | null;
  category: string | null; badge: string | null; emoji: string | null;
  price_cents: number; warranty_price_cents: number | null;
  stock_count: number | null; stock_label: string | null;
  active: boolean; sort_order: number;
};
const money = (cents: number) => "$" + (cents / 100).toFixed(2);
const groups = [
  { category: "FLASH SALE", title: "Flash deals", subtitle: "Limited-time drops", accent: "purple" },
  { category: "NFA — Skinned Random Accounts", title: "Fortnite accounts", subtitle: "Browse account drops", accent: "purple" },
  { category: "NFA — Random V-Bucks Accounts", title: "V-Bucks accounts", subtitle: "Random V-Bucks inventory", accent: "violet" },
  { category: "NFA — Rare Season 2 Accounts", title: "Rare accounts", subtitle: "Season 2 and legacy cosmetics", accent: "pink" },
  { category: "NFA — Fortnite Exclusive Accounts", title: "Exclusive accounts", subtitle: "Special cosmetics and bundles", accent: "purple" },
  { category: "NFA — Fortnite OG Accounts", title: "OG accounts", subtitle: "Limited legacy drops", accent: "violet" },
  { category: "Fortnite FA Accounts", title: "Full Access accounts", subtitle: "Full Access inventory", accent: "pink" },
];

export default async function Home() {
  const { data, error } = await supabase.from("products")
    .select("id,name,slug,description,category,badge,emoji,price_cents,warranty_price_cents,stock_count,stock_label,active,sort_order")
    .eq("active", true).order("sort_order", { ascending: true });
  const products = (data ?? []) as Product[];
  const known = new Set(groups.map(g => g.category));
  const extra = [...new Set(products.map(p => p.category?.trim() || "Other")
    .filter(c => !known.has(c)))];
  const grouped = [...groups.map(g => ({ ...g, products: products.filter(p => p.category === g.category) })),
    ...extra.map(category => ({ category, title: category, subtitle: "More Sumz Store listings", accent: "purple",
      products: products.filter(p => (p.category?.trim() || "Other") === category) }))];

  return <div className="sumz-store min-h-screen bg-[#08070d] text-white">
    <header className="sticky top-0 z-40 border-b border-white/[.08] bg-[#08070d]/90 backdrop-blur-xl">
      <nav className="mx-auto flex max-w-7xl items-center justify-between gap-5 px-5 py-4">
        <a href="/" className="flex items-center gap-3 font-black tracking-tight"><span className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br from-violet-500 to-fuchsia-700 text-xl shadow-lg shadow-violet-900/40">S</span><span className="text-xl">SUMZ<span className="text-violet-400"> STORE</span><small className="block text-[10px] font-semibold tracking-[.25em] text-zinc-500">DIGITAL GOODS</small></span></a>
        <div className="hidden items-center gap-7 text-sm text-zinc-400 md:flex"><a className="hover:text-white" href="#catalog">Catalog</a><a className="hover:text-white" href="/account">My licenses & orders</a><a className="hover:text-white" href="/account">Support</a></div>
        <div className="flex items-center gap-3"><MarketAuthLinks/><a href="#catalog" className="rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-bold transition hover:bg-violet-500">Browse store ↗</a></div>
      </nav>
    </header>
    <main className="mx-auto max-w-7xl px-5">
      <section className="relative mt-8 overflow-hidden rounded-[2rem] border border-violet-400/20 bg-gradient-to-br from-[#171022] via-[#100c19] to-[#09080d] px-6 py-16 md:px-14 md:py-24">
        <div className="pointer-events-none absolute -right-24 -top-40 h-[32rem] w-[32rem] rounded-full bg-violet-600/20 blur-[100px]"/>
        <div className="pointer-events-none absolute bottom-0 right-0 h-72 w-72 rounded-full bg-fuchsia-600/10 blur-[90px]"/>
        <div className="relative max-w-3xl">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-violet-300/20 bg-violet-400/10 px-3 py-1.5 text-xs font-semibold text-violet-200"><span className="h-2 w-2 rounded-full bg-emerald-400"/> SUMZ STORE · DIGITAL DROPS</div>
          <h1 className="text-5xl font-black leading-[1.02] tracking-tight sm:text-7xl">Your next upgrade.<br/><span className="bg-gradient-to-r from-violet-300 via-purple-400 to-fuchsia-400 bg-clip-text text-transparent">One click away.</span></h1>
          <p className="mt-6 max-w-xl text-lg leading-8 text-zinc-400">Discover digital products, software, and exclusive drops in one clean marketplace. Your purchases and account details stay organized in your dashboard.</p>
          <div className="mt-9 flex flex-wrap gap-3"><a href="#catalog" className="rounded-xl bg-white px-6 py-3.5 font-bold text-black transition hover:bg-violet-100">Explore catalog →</a><a href="/account" className="rounded-xl border border-white/15 bg-white/[.04] px-6 py-3.5 font-semibold hover:bg-white/[.08]">Customer dashboard</a></div>
          <div className="mt-10 flex flex-wrap gap-x-7 gap-y-3 text-sm text-zinc-500"><span>✦ Curated digital inventory</span><span>✦ Account-based order history</span><span>✦ Support when you need it</span></div>
        </div>
      </section>
      <section className="grid gap-3 py-5 sm:grid-cols-3">
        {[["01","Browse","Find products and compare options"],["02","Checkout","Sign in and review your order"],["03","Manage","Track orders from your dashboard"]].map(([n,t,d])=><div key={n} className="flex items-center gap-4 rounded-2xl border border-white/[.07] bg-white/[.025] p-5"><span className="text-sm font-black text-violet-400">{n}</span><div><b className="block text-sm">{t}</b><span className="text-xs text-zinc-500">{d}</span></div></div>)}
      </section>
      <section id="catalog" className="scroll-mt-24 py-12">
        <div className="mb-8 flex flex-wrap items-end justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-[.25em] text-violet-400">THE MARKETPLACE</p><h2 className="mt-2 text-3xl font-black sm:text-4xl">Explore the catalog<span className="text-violet-400">.</span></h2><p className="mt-2 text-zinc-500">Find your next drop from the live inventory.</p></div><div className="rounded-xl border border-white/10 bg-white/[.03] px-4 py-3"><b className="text-xl">{products.length}</b><span className="ml-2 text-xs text-zinc-500">LIVE LISTINGS</span></div></div>
        {error ? <div className="rounded-2xl border border-red-500/20 bg-red-500/10 p-5 text-red-200">Catalog unavailable: {error.message}</div> : products.length ? <InventorySearch groups={grouped}/> : <div className="rounded-3xl border border-dashed border-white/15 bg-white/[.02] px-6 py-16 text-center"><div className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-violet-500/10 text-3xl text-violet-300">✦</div><h3 className="mt-5 text-xl font-bold">New drops are loading in</h3><p className="mt-2 text-zinc-500">No published products yet. Check back soon.</p><a href="https://discord.com/invite/sumz" className="mt-5 inline-block text-sm font-semibold text-violet-300 hover:text-white">Join the community ↗</a></div>}
      </section>
      <section className="mb-14 flex flex-col justify-between gap-6 rounded-3xl border border-violet-400/15 bg-gradient-to-r from-violet-950/40 to-[#15101d] p-7 md:flex-row md:items-center md:p-10"><div><p className="text-xs font-bold tracking-[.2em] text-violet-300">NEED HELP?</p><h2 className="mt-2 text-2xl font-black">We're here for you.</h2><p className="mt-2 text-zinc-400">View your purchases or contact support from your account.</p></div><a href="/account" className="rounded-xl border border-white/15 px-5 py-3 text-center font-semibold hover:bg-white/5">Open customer dashboard →</a></section>
    </main>
    <footer className="border-t border-white/[.08]"><div className="mx-auto flex max-w-7xl flex-col gap-4 px-5 py-8 text-xs text-zinc-500 md:flex-row md:items-center md:justify-between"><span>© {new Date().getFullYear()} SUMZ STORE · Digital products marketplace</span><div className="flex gap-5"><a href="/terms" className="hover:text-white">Terms</a><a href="/account" className="hover:text-white">Account</a><a href="/admin" className="hover:text-white">Admin</a><a href="https://discord.com/invite/sumz" className="hover:text-white">Discord ↗</a></div></div></footer>
  </div>;
}
