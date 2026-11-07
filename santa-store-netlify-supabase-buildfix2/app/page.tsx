import {supabase} from "../lib/supabase";
import BuyWithBalance from "../components/BuyWithBalance";
import ManualCheckout from "../components/ManualCheckout";

export const dynamic = "force-dynamic";
type Product={id:string;name:string;description:string|null;price_cents:number;price_max_cents:number|null;category:string|null;stock_label:string|null;badge:string|null;emoji:string|null;active:boolean};
const money=(c:number)=>"$"+(c/100).toFixed(2);
export default async function Home(){
 let products:Product[]=[];
 try{const {data}=await supabase.from("products").select("*").eq("active",true).order("sort_order").limit(100);products=(data||[]) as Product[]}catch{}
 const fallback:Product[]=[
 {id:"a",name:"4 Skins | 1,150 V-Bucks | 1009d",description:"NFA account",price_cents:300,price_max_cents:null,category:"Fortnite NFA",stock_label:"Inventory",badge:"NFA",emoji:"🎮",active:true},
 {id:"b",name:"Galaxy",description:"Full Access account",price_cents:6498,price_max_cents:6998,category:"Fortnite Full Access",stock_label:"Available",badge:"Full Access",emoji:"🌌",active:true},
 {id:"c",name:"Black Knight",description:"Full Access account",price_cents:7998,price_max_cents:9998,category:"Fortnite Full Access",stock_label:"Available",badge:"Full Access",emoji:"🛡️",active:true},
 {id:"d",name:"10,000+ Robux Inventory Account",description:"Roblox inventory account",price_cents:2798,price_max_cents:null,category:"Roblox",stock_label:"Available",badge:"Roblox",emoji:"💰",active:true},
 ];
 const shown=products.length?products:fallback;
 return <><header className="top"><nav className="nav"><a className="logo" href="/">🎄 SANTA<span>STORE</span></a><div style={{display:"flex",gap:12,alignItems:"center"}}><a className="muted" href="/account">My account</a><a className="btn" href="/account">Sign in</a></div></nav></header>
 <main className="wrap"><section className="hero"><div className="eyebrow">🎅 Sumz Market Holiday Drop</div><h1>Holiday deals.<br/><span style={{color:"#ef4444"}}>Instant excitement.</span></h1><p>Shop digital inventory and exclusive drops from Sumz Market. Browse the catalog and check back for new stock.</p><div style={{marginTop:24}}><a className="btn" href="#products">Shop the drop ↓</a></div></section>
 <section className="section" id="products"><div style={{display:"flex",justifyContent:"space-between",alignItems:"end",marginBottom:18}}><div><div className="eyebrow">The collection</div><h2 style={{fontSize:28,margin:"8px 0"}}>Sumz Market Stock</h2></div><span className="muted">Prices shown in USD</span></div>
 {!products.length&&<div className="notice" style={{marginBottom:18}}>Preview inventory is shown below. Add products in Supabase to publish your real catalog.</div>}
 <div className="grid">{shown.map(p=><article className="product" key={p.id}><div className="art">{p.emoji||"🎁"}</div><div className="pbody"><span className="pill">{p.badge||p.category||"Digital item"}</span><h3 style={{marginTop:12}}>{p.name}</h3><div className="muted">{p.description||p.stock_label||"Digital inventory"}</div><div className="price">{money(p.price_cents)}{p.price_max_cents?` – ${money(p.price_max_cents)}`:""}</div><a className="btn secondary" style={{width:"100%"}} href="/account">My account</a>{products.length>0&&<><BuyWithBalance productId={p.id}/><ManualCheckout productId={p.id} productName={p.name}/></>}</div></article>)}</div></section>
 <section className="section"><div className="notice"><b>Secure order processing</b><br/>Orders are reviewed and fulfilled after payment verification. Never share passwords or payment secrets with support.</div></section></main>
 <footer className="footer">© {new Date().getFullYear()} Sumz Market · Santa Store · <a href="/admin">Admin</a></footer></>}
