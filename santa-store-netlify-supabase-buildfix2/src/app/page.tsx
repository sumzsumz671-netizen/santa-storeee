import { supabase } from "@/lib/supabase";
export const dynamic = "force-dynamic";
export default async function Home(){
 const {data: products}=await supabase.from("products").select("id,name,slug,description,category,badge,emoji,price_cents,price_max_cents,stock_label").eq("active",true).order("sort_order",{ascending:true});
 const items=products??[];
 return <main className="shell"><nav className="nav"><a className="logo" href="/">🎅 SANTA <span>STORE</span></a><div className="flex gap-3 items-center"><a className="pill" href="/account">My Account</a><a className="btn" href="/login">Sign in</a></div></nav>
 <section className="hero"><p className="eyebrow">❄ CHRISTMAS DROP · 2026 ❄</p><h1>Holiday deals.<br/><span>Instant magic.</span></h1><p className="muted max-w-xl">Explore the seasonal collection of digital products and premium license plans.</p><a className="btn mt-5" href="#catalog">Explore the collection ↓</a></section>
 <div className="section-title" id="catalog"><div><p className="eyebrow">THE NORTH POLE INVENTORY</p><h2 className="text-3xl font-black">Featured products</h2></div><span className="pill">Secure checkout · Verified delivery</span></div>
 <section className="products">{items.map(p=><article className="product" key={p.id}><div className="tag">{p.category??"Digital product"}</div><h3>{p.name}</h3><p className="muted text-sm">{(p.description??"").slice(0,130)}</p><div className="price">${(p.price_cents/100).toFixed(2)}{p.price_max_cents?` – $${(p.price_max_cents/100).toFixed(2)}`:""}</div><a className="btn w-full" href={`/product/${p.slug}`}>View product</a></article>)}</section>
 <footer className="footer">© 2026 Santa Store · <a href="https://discord.gg/sumz">Discord support</a> · Christmas edition <span className="snow">❄</span></footer></main>
}
