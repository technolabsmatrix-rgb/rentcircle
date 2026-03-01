import { useState, useMemo, useEffect, useRef } from "react";
import { fetchProducts, fetchTags, fetchFlags, fetchCustomFields, fetchPlans, fromDbProduct, subscribeTo, supabase, onAuthChange } from "../lib/supabase";
import { insertProduct, updateProduct as updateProductInDb, deleteProduct as deleteProductInDb, insertOrder, fetchOrders } from "../lib/supabase";

// Fetch active categories from Supabase
const fetchCategories = () =>
  supabase.from("categories").select("*").eq("active", true).order("name")
    .then(({ data, error }) => { if (error) throw error; return data || []; });

const INR = (amount) => `₹${Number(amount).toLocaleString("en-IN")}`;
const C = { dark: "#1a1a2e", gold: "#f59e0b", bg: "#f8f7f4", muted: "#6b7280", border: "#e5e7eb", red: "#ef4444", green: "#10b981", purple: "#7c3aed" };

const RC_CACHE_KEY = "rc_products_v1";
const RC_CACHE_TTL = 5 * 60 * 1000;
function readCache() {
  try {
    const raw = localStorage.getItem(RC_CACHE_KEY);
    if (!raw) return null;
    const { ts, data } = JSON.parse(raw);
    if (!Array.isArray(data) || !data.length) return null;
    return { data, stale: Date.now() - ts > RC_CACHE_TTL };
  } catch { return null; }
}
function writeCache(products) {
  try { localStorage.setItem(RC_CACHE_KEY, JSON.stringify({ ts: Date.now(), data: products })); } catch { }
}

const ORDER_STATUS_COLORS = { active: "#10b981", pending: "#f59e0b", completed: "#6366f1", cancelled: "#ef4444" };

function MyOrdersPage({ user, allProducts }) {
  const [orders, setOrders]             = useState([]);
  const [loading, setLoading]           = useState(true);
  const [search, setSearch]             = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const myProductIds = useMemo(
    () => new Set(allProducts.filter(p => p.ownerEmail === user?.email).map(p => Number(p.id))),
    [allProducts, user]
  );

  useEffect(() => {
    fetchOrders()
      .then(data => setOrders(data.filter(o => myProductIds.has(Number(o.product_id)))))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [myProductIds]);

  const filtered = useMemo(() => {
    let r = orders;
    if (statusFilter !== "all") r = r.filter(o => o.status === statusFilter);
    if (search.trim()) {
      const q = search.toLowerCase();
      r = r.filter(o => (o.product||"").toLowerCase().includes(q)||(o.id||"").toLowerCase().includes(q)||(o.user_name||"").toLowerCase().includes(q)||(o.user_email||"").toLowerCase().includes(q));
    }
    return r;
  }, [orders, statusFilter, search]);

  const totalRevenue   = orders.reduce((s, o) => s + (o.amount || 0), 0);
  const activeCount    = orders.filter(o => o.status === "active").length;
  const completedCount = orders.filter(o => o.status === "completed").length;

  if (loading) return <div style={{ padding:"6rem 2rem",textAlign:"center",fontFamily:"'Outfit',sans-serif" }}><div style={{ fontSize:"2.5rem",marginBottom:"1rem" }}>⏳</div><p style={{ color:C.muted }}>Loading your orders...</p></div>;

  return (
    <div style={{ padding:"2.5rem 2rem",maxWidth:"1200px",margin:"0 auto",fontFamily:"'Outfit',sans-serif" }}>
      <div style={{ marginBottom:"2rem" }}>
        <h1 style={{ fontWeight:900,fontSize:"2rem",marginBottom:"0.25rem",color:C.dark }}>📋 My Orders</h1>
        <p style={{ color:C.muted }}>Orders placed on your listed products</p>
      </div>
      <div style={{ display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(160px,1fr))",gap:"1rem",marginBottom:"2rem" }}>
        {[{label:"Total Orders",value:orders.length,icon:"📦",color:C.dark},{label:"Active",value:activeCount,icon:"🟢",color:"#10b981"},{label:"Completed",value:completedCount,icon:"✅",color:"#6366f1"},{label:"Revenue",value:`₹${Number(totalRevenue).toLocaleString("en-IN")}`,icon:"💰",color:C.green}].map(s=>(
          <div key={s.label} style={{ background:"#fff",borderRadius:"16px",padding:"1.25rem 1.5rem",border:`1px solid ${C.border}`,boxShadow:"0 2px 8px rgba(0,0,0,0.04)" }}>
            <div style={{ fontSize:"1.5rem",marginBottom:"0.4rem" }}>{s.icon}</div>
            <div style={{ fontSize:"1.5rem",fontWeight:900,color:s.color }}>{s.value}</div>
            <div style={{ fontSize:"0.78rem",color:C.muted,fontWeight:600,marginTop:"0.2rem" }}>{s.label}</div>
          </div>
        ))}
      </div>
      <div style={{ display:"flex",gap:"0.75rem",marginBottom:"1.5rem",flexWrap:"wrap",alignItems:"center" }}>
        <div style={{ flex:"1 1 220px",display:"flex",alignItems:"center",gap:"0.5rem",background:"#fff",borderRadius:"12px",padding:"0.6rem 1rem",border:`1.5px solid ${C.border}` }}>
          <span style={{ color:C.muted }}>🔍</span>
          <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search order ID, product, renter..." style={{ border:"none",outline:"none",background:"transparent",fontFamily:"'Outfit',sans-serif",fontSize:"0.9rem",color:C.dark,width:"100%" }} />
          {search&&<button onClick={()=>setSearch("")} style={{ border:"none",background:"none",cursor:"pointer",color:C.muted,fontSize:"0.8rem" }}>✕</button>}
        </div>
        <div style={{ display:"flex",gap:"0.5rem",flexWrap:"wrap" }}>
          {["all","active","pending","completed","cancelled"].map(s=>(
            <button key={s} onClick={()=>setStatusFilter(s)} style={{ padding:"0.5rem 1rem",borderRadius:"20px",border:`1.5px solid ${statusFilter===s?(ORDER_STATUS_COLORS[s]||C.dark):C.border}`,background:statusFilter===s?(ORDER_STATUS_COLORS[s]||C.dark):"#fff",color:statusFilter===s?"#fff":C.muted,cursor:"pointer",fontWeight:600,fontSize:"0.82rem",fontFamily:"'Outfit',sans-serif",transition:"all 0.15s" }}>
              {s==="all"?`All (${orders.length})`:s.charAt(0).toUpperCase()+s.slice(1)+` (${orders.filter(o=>o.status===s).length})`}
            </button>
          ))}
        </div>
      </div>
      {filtered.length===0?(
        <div style={{ textAlign:"center",padding:"5rem 2rem",background:"#fff",borderRadius:"20px",border:`2px dashed ${C.border}` }}>
          <div style={{ fontSize:"3.5rem",marginBottom:"1rem" }}>{orders.length===0?"📭":"🔍"}</div>
          <h3 style={{ fontWeight:800,marginBottom:"0.5rem",color:C.dark }}>{orders.length===0?"No orders yet":"No matching orders"}</h3>
          <p style={{ color:C.muted }}>{orders.length===0?"When renters place orders on your products, they'll appear here.":"Try adjusting your search or filter."}</p>
        </div>
      ):(
        <div style={{ background:"#fff",borderRadius:"20px",border:`1px solid ${C.border}`,overflow:"hidden",boxShadow:"0 2px 10px rgba(0,0,0,0.05)" }}>
          <div style={{ display:"grid",gridTemplateColumns:"1.1fr 1.3fr 1.2fr 0.6fr 0.9fr 1.1fr 0.9fr",gap:"0.75rem",padding:"0.85rem 1.5rem",background:C.bg,borderBottom:`1px solid ${C.border}` }}>
            {["Order ID","Product","Renter","Days","Amount","Dates","Status"].map(h=>(
              <div key={h} style={{ fontSize:"0.72rem",fontWeight:700,color:C.muted,textTransform:"uppercase",letterSpacing:"0.05em" }}>{h}</div>
            ))}
          </div>
          {filtered.map((o,i)=>{
            const sc=ORDER_STATUS_COLORS[o.status]||C.muted;
            return (
              <div key={o.id} style={{ display:"grid",gridTemplateColumns:"1.1fr 1.3fr 1.2fr 0.6fr 0.9fr 1.1fr 0.9fr",gap:"0.75rem",padding:"1rem 1.5rem",alignItems:"center",borderBottom:i<filtered.length-1?`1px solid ${C.border}`:"none",transition:"background 0.15s" }} onMouseEnter={e=>e.currentTarget.style.background=C.bg} onMouseLeave={e=>e.currentTarget.style.background=""}>
                <div style={{ fontFamily:"monospace",fontWeight:700,color:C.dark,fontSize:"0.82rem" }}>{o.id}</div>
                <div style={{ fontWeight:700,fontSize:"0.88rem",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap" }}>{o.product||"—"}</div>
                <div>
                  <div style={{ fontWeight:600,fontSize:"0.85rem",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap" }}>{o.user_name||"—"}</div>
                  <div style={{ color:C.muted,fontSize:"0.72rem",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap" }}>{o.user_email||""}</div>
                </div>
                <div style={{ fontWeight:600,fontSize:"0.88rem" }}>{o.days??"-"}d</div>
                <div style={{ fontWeight:800,color:C.green,fontSize:"0.95rem" }}>₹{Number(o.amount||0).toLocaleString("en-IN")}</div>
                <div>
                  <div style={{ fontSize:"0.78rem",fontWeight:600 }}>{o.start_date||"—"}</div>
                  <div style={{ fontSize:"0.72rem",color:C.muted }}>→ {o.end_date||"—"}</div>
                </div>
                <span style={{ background:`${sc}18`,color:sc,border:`1.5px solid ${sc}40`,borderRadius:"20px",padding:"0.25rem 0.65rem",fontSize:"0.75rem",fontWeight:700,whiteSpace:"nowrap",display:"inline-block" }}>
                  {(o.status||"").charAt(0).toUpperCase()+(o.status||"").slice(1)}
                </span>
              </div>
            );
          })}
        </div>
      )}
      {filtered.length>0&&<div style={{ marginTop:"0.75rem",color:C.muted,fontSize:"0.82rem",textAlign:"right" }}>Showing {filtered.length} of {orders.length} order{orders.length!==1?"s":""}</div>}
    </div>
  );
}

/* ─── Master User ─── */
const MASTER_USER = {
  email: "master@rentcircle.in",
  password: "master@123",
  profile: {
    name: "Master Admin",
    email: "master@rentcircle.in",
    avatar: "M",
    subscription: "master", // special flag
    isMaster: true,
    emailVerified: true,
    phoneVerified: true,
    plan: "Master",
    city: "Ahmedabad",
    phone: "+91 00000 00000",
  },
};

const LOGO_SRC = "data:image/png;base64,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";

const defaultProducts = [
  { id: 1, name: "Sony A7 III Camera", category: "Electronics", priceDay: 2099, priceMonth: 45000, priceYear: 420000, unit: "day", image: "📷", rating: 4.9, reviews: 128, badge: "Popular", owner: null },
  { id: 2, name: "DJI Mavic 3 Drone", category: "Electronics", priceDay: 3799, priceMonth: 75000, priceYear: 720000, unit: "day", image: "🚁", rating: 4.8, reviews: 89, badge: "Hot", owner: null },
  { id: 3, name: "Trek Mountain Bike", category: "Sports", priceDay: 1249, priceMonth: 22000, priceYear: 199000, unit: "day", image: "🚵", rating: 4.7, reviews: 213, badge: null, owner: null },
  { id: 4, name: "Camping Tent (6-person)", category: "Outdoor", priceDay: 1649, priceMonth: 28000, priceYear: 260000, unit: "day", image: "⛺", rating: 4.6, reviews: 156, badge: null, owner: null },
  { id: 5, name: 'MacBook Pro 16"', category: "Electronics", priceDay: 2899, priceMonth: 58000, priceYear: 550000, unit: "day", image: "💻", rating: 4.9, reviews: 302, badge: "Top Rated", owner: null },
  { id: 6, name: "Canon EF 70-200mm Lens", category: "Electronics", priceDay: 1499, priceMonth: 28000, priceYear: 260000, unit: "day", image: "🔭", rating: 4.8, reviews: 67, badge: null, owner: null },
  { id: 7, name: "Surfboard (Longboard)", category: "Sports", priceDay: 1849, priceMonth: 32000, priceYear: 300000, unit: "day", image: "🏄", rating: 4.5, reviews: 94, badge: null, owner: null },
  { id: 8, name: "PS5 Gaming Console", category: "Gaming", priceDay: 999, priceMonth: 18000, priceYear: 170000, unit: "day", image: "🎮", rating: 4.9, reviews: 445, badge: "Popular", owner: null },
  { id: 9, name: "Kayak (Single)", category: "Outdoor", priceDay: 2299, priceMonth: 42000, priceYear: 390000, unit: "day", image: "🛶", rating: 4.6, reviews: 71, badge: null, owner: null },
];
const categories = ["All", "Electronics", "Sports", "Outdoor", "Gaming", "Tools", "Fashion"];
const PRODUCT_EMOJIS = ["📷","🚁","🚵","⛺","💻","🔭","🏄","🎮","🛶","🎸","🏋️","🎨","🔨","🚗","🛴","🎯","🏕️","📺","🎻","🧳"];
// UI config per plan (colors, accent, listingLimit) — merged with live DB data
const PLAN_UI = {
  starter:  { color: "#e8f4fd", accent: "#2563eb", listingLimit: 3,   popular: false },
  pro:      { color: "#fdf4e8", accent: "#d97706", listingLimit: 20,  popular: true  },
  business: { color: "#f0fdf4", accent: "#16a34a", listingLimit: 999, popular: false },
};
const DEFAULT_PLANS = [
  { id: "starter",  name: "Starter",  price: 749,  features: ["5 rentals/month","List up to 3 products","Standard delivery","Email support","Basic insurance"],                                   ...PLAN_UI.starter  },
  { id: "pro",      name: "Pro",      price: 2399, features: ["Unlimited rentals","List up to 20 products","Priority delivery","24/7 support","Full insurance","Early access"],                  ...PLAN_UI.pro      },
  { id: "business", name: "Business", price: 6599, features: ["Team accounts (5)","Unlimited product listings","Same-day delivery","Dedicated manager","Premium insurance","API access"],        ...PLAN_UI.business },
];
// Maps DB plan row → frontend plan shape (merges live price/features with UI config)
function dbPlanToFrontend(dbPlan) {
  const key = dbPlan.name?.toLowerCase();
  const ui  = PLAN_UI[key] || { color: "#f8f7f4", accent: "#f59e0b", listingLimit: 10, popular: false };
  return {
    id:             key,
    name:           dbPlan.name,
    price:          dbPlan.price,
    features:       Array.isArray(dbPlan.features) ? dbPlan.features : [],
    active:         dbPlan.active,
    subscribers:    dbPlan.subscribers,
    productExpiry:  dbPlan.productExpiry || null,
    ...ui,
  };
}


/* ─── Helpers ─── */
const PageHero = ({ icon, title, subtitle }) => (
  <div style={{ background: `linear-gradient(135deg, ${C.dark} 0%, #16213e 100%)`, color: "#fff", padding: "5rem 2rem 4rem", textAlign: "center", position: "relative", overflow: "hidden" }}>
    <div style={{ position: "absolute", inset: 0, background: "radial-gradient(circle at 70% 30%, rgba(245,158,11,0.08) 0%, transparent 60%)" }} />
    <div style={{ position: "relative", zIndex: 1 }}>
      <div style={{ fontSize: "3rem", marginBottom: "1rem" }}>{icon}</div>
      <h1 style={{ fontSize: "clamp(2rem, 5vw, 3.5rem)", fontWeight: 900, letterSpacing: "-0.03em", marginBottom: "1rem" }}>{title}</h1>
      <p style={{ color: "rgba(255,255,255,0.6)", fontSize: "1.1rem", maxWidth: "520px", margin: "0 auto" }}>{subtitle}</p>
    </div>
  </div>
);
const Section = ({ children, white }) => (
  <div style={{ background: white ? "#fff" : C.bg, padding: "4rem 2rem" }}>
    <div style={{ maxWidth: "900px", margin: "0 auto" }}>{children}</div>
  </div>
);
const PolicySection = ({ title, children, icon }) => (
  <div style={{ marginBottom: "2.5rem", padding: "2rem", background: "#fff", borderRadius: "20px", boxShadow: "0 2px 10px rgba(0,0,0,0.05)", border: `1px solid ${C.border}` }}>
    <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "1rem" }}>
      <span style={{ fontSize: "1.5rem" }}>{icon}</span>
      <h3 style={{ fontWeight: 800, fontSize: "1.15rem", color: C.dark }}>{title}</h3>
    </div>
    <div style={{ color: C.muted, lineHeight: 1.85, fontSize: "0.95rem" }}>{children}</div>
  </div>
);

/* ─── Tag Badge ─── */
function TagBadge({ tag }) {
  if (!tag) return null;
  return (
    <span style={{ background: tag.bg || "rgba(249,115,22,0.12)", color: tag.color || "#f97316", borderRadius: "20px", padding: "0.18rem 0.55rem", fontSize: "0.68rem", fontWeight: 700, display: "inline-flex", alignItems: "center", gap: "0.2rem", whiteSpace: "nowrap" }}>
      {tag.emoji} {tag.name}
    </span>
  );
}

/* ─── Auth Modal ─── */
function AuthModal({ onClose, onLogin, flags = {}, customFields = [] }) {
  const [mode, setMode]       = useState("login");
  const [step, setStep]       = useState("form"); // "form" | "check_email" | "done"
  const [email, setEmail]     = useState("");
  const [password, setPassword] = useState("");
  const [name, setName]       = useState("");
  const [customData, setCustomData] = useState({});
  const [loading, setLoading] = useState(false);
  const [focused, setFocused] = useState(null);
  const [errors, setErrors]   = useState({});

  const inp = (id) => ({ width: "100%", border: `1.5px solid ${errors[id] ? C.red : focused === id ? C.dark : C.border}`, borderRadius: "12px", padding: "0.8rem 1rem", outline: "none", fontSize: "0.9rem", fontFamily: "'Outfit', sans-serif", boxSizing: "border-box", marginBottom: errors[id] ? "0.2rem" : "0.75rem", transition: "border-color 0.2s", color: C.dark, background: "#fff" });

  const socialProviders = [
    { name: "Google",   bg: "#fff",     color: "#374151", border: `1.5px solid ${C.border}`, logo: <svg width="18" height="18" viewBox="0 0 48 48"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/><path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.18 1.48-4.97 2.33-8.16 2.33-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/></svg> },
    { name: "Facebook", bg: "#1877F2",  color: "#fff",    border: "none", logo: <svg width="18" height="18" viewBox="0 0 24 24" fill="white"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg> },
  ];

  // ── Real Supabase OAuth (hidden until configured) ─────────
  const handleSocial = async (providerName) => {
    setLoading(true); setErrors({});
    const { error } = await supabase.auth.signInWithOAuth({
      provider: providerName.toLowerCase(),
      options: { redirectTo: window.location.origin },
    });
    if (error) { setErrors({ general: error.message }); setLoading(false); }
  };

  const validate = () => {
    const errs = {};
    if (!email)                          errs.email    = "Required";
    if (!password || password.length < 6) errs.password = "Min 6 characters";
    if (mode === "signup" && !name)       errs.name     = "Required";
    customFields.forEach(cf => { if (cf.required && !customData[cf.key]) errs[cf.key] = "Required"; });
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  // ── Sign Up — Supabase sends real confirmation email ──────
  const handleSignUp = async () => {
    if (!validate()) return;
    setLoading(true); setErrors({});
    const { data: signUpData, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: name, ...customData },   // stored in user metadata
        emailRedirectTo: window.location.origin,     // where to land after clicking email link
      },
    });
    if (error) {
      setLoading(false);
      setErrors({ general: error.message });
      return;
    }
    // ── Write to profiles table so Admin panel sees the user ──
    if (signUpData?.user) {
      const u = signUpData.user;
      const joined = new Date().toLocaleDateString("en-IN", { month: "short", year: "numeric" });
      await supabase.from("profiles").upsert([{
        id:             u.id,
        name:           name || u.email.split("@")[0],
        email:          u.email,
        phone:          customData?.phone || "",
        city:           customData?.city  || "",
        plan:           "None",
        status:         "active",
        rentals:        0,
        joined,
        email_verified: false,
        phone_verified: false,
      }], { onConflict: "id" });
    }
    setLoading(false);
    setStep("check_email"); // show "check your inbox" screen
  };

  // ── Sign In — real Supabase password login ────────────────
  const handleSignIn = async () => {
    if (!validate()) return;

    // ── Master user bypass ────────────────────────────────
    if (email === MASTER_USER.email && password === MASTER_USER.password) {
      onLogin(MASTER_USER.profile);
      return;
    }

    setLoading(true); setErrors({});
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) {
      if (error.message.includes("Email not confirmed")) {
        setErrors({ general: "Please confirm your email first. Check your inbox for the verification link." });
      } else if (error.message.includes("Invalid login")) {
        setErrors({ general: "Incorrect email or password." });
      } else {
        setErrors({ general: error.message });
      }
      return;
    }
    const u = data.user;
    const displayName = u.user_metadata?.full_name || u.user_metadata?.name || u.email.split("@")[0];

    // ── Ensure profile row exists (covers OAuth + any missed signups) ──
    const joined = new Date().toLocaleDateString("en-IN", { month: "short", year: "numeric" });
    await supabase.from("profiles").upsert([{
      id:             u.id,
      name:           displayName,
      email:          u.email,
      phone:          u.user_metadata?.phone || "",
      city:           u.user_metadata?.city  || "",
      plan:           "None",
      status:         "active",
      rentals:        0,
      joined,
      email_verified: !!u.email_confirmed_at,
      phone_verified: false,
    }], { onConflict: "id", ignoreDuplicates: false });

    onLogin({
      name:          displayName,
      email:         u.email,
      avatar:        displayName[0].toUpperCase(),
      subscription:  null,
      emailVerified: !!u.email_confirmed_at,
      phoneVerified: false,
      supabaseId:    u.id,
    });
  };

  const handleSubmit = () => mode === "signup" ? handleSignUp() : handleSignIn();

  // ── Forgot password ───────────────────────────────────────
  const handleForgotPassword = async () => {
    if (!email) { setErrors({ email: "Enter your email first" }); return; }
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: window.location.origin,
    });
    setLoading(false);
    if (error) {
      setErrors({ general: error.message });
    } else {
      setErrors({ general: "" });
      setStep("forgot_sent");
    }
  };

  // ── "Check your inbox" screen (after signup) ──────────────
  if (step === "check_email") {
    return (
      <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(10,10,20,0.75)", zIndex: 300, display: "flex", alignItems: "center", justifyContent: "center", padding: "1rem", backdropFilter: "blur(6px)" }}>
        <div onClick={e => e.stopPropagation()} style={{ background: "#fff", borderRadius: "28px", padding: "2.5rem", width: "100%", maxWidth: "400px", boxShadow: "0 40px 100px rgba(0,0,0,0.3)", textAlign: "center", position: "relative" }}>
          <button onClick={onClose} style={{ position: "absolute", top: "1.25rem", right: "1.25rem", border: "none", background: "#f3f4f6", borderRadius: "50%", width: "32px", height: "32px", cursor: "pointer" }}>✕</button>
          <div style={{ width: "72px", height: "72px", background: "linear-gradient(135deg,#dbeafe,#bfdbfe)", borderRadius: "22px", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "2rem", margin: "0 auto 1.25rem" }}>📧</div>
          <h2 style={{ fontSize: "1.4rem", fontWeight: 800, marginBottom: "0.5rem" }}>Check your inbox!</h2>
          <p style={{ color: C.muted, fontSize: "0.9rem", lineHeight: 1.6, marginBottom: "1.5rem" }}>
            We sent a confirmation link to<br /><strong>{email}</strong><br />Click it to activate your account.
          </p>
          <div style={{ background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: "12px", padding: "0.75rem 1rem", fontSize: "0.83rem", color: "#166534", marginBottom: "1.5rem" }}>
            ✅ After confirming, come back and sign in.
          </div>
          <button onClick={() => { setStep("form"); setMode("login"); }} style={{ width: "100%", background: C.dark, color: "#fff", border: "none", borderRadius: "12px", padding: "0.85rem", cursor: "pointer", fontWeight: 700, fontSize: "0.95rem", fontFamily: "'Outfit', sans-serif" }}>
            Go to Sign In →
          </button>
          <button onClick={async () => {
            await supabase.auth.resend({ type: "signup", email });
            setErrors({ resent: "Resent! Check your inbox." });
          }} style={{ width: "100%", background: "transparent", border: `1.5px solid ${C.border}`, borderRadius: "12px", padding: "0.7rem", cursor: "pointer", fontWeight: 600, fontSize: "0.85rem", color: C.muted, fontFamily: "'Outfit', sans-serif", marginTop: "0.6rem" }}>
            Resend confirmation email
          </button>
          {errors.resent && <p style={{ color: "#16a34a", fontSize: "0.8rem", marginTop: "0.5rem" }}>{errors.resent}</p>}
        </div>
      </div>
    );
  }

  // ── "Reset email sent" screen ─────────────────────────────
  if (step === "forgot_sent") {
    return (
      <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(10,10,20,0.75)", zIndex: 300, display: "flex", alignItems: "center", justifyContent: "center", padding: "1rem", backdropFilter: "blur(6px)" }}>
        <div onClick={e => e.stopPropagation()} style={{ background: "#fff", borderRadius: "28px", padding: "2.5rem", width: "100%", maxWidth: "400px", boxShadow: "0 40px 100px rgba(0,0,0,0.3)", textAlign: "center", position: "relative" }}>
          <button onClick={onClose} style={{ position: "absolute", top: "1.25rem", right: "1.25rem", border: "none", background: "#f3f4f6", borderRadius: "50%", width: "32px", height: "32px", cursor: "pointer" }}>✕</button>
          <div style={{ fontSize: "3rem", marginBottom: "1rem" }}>🔑</div>
          <h2 style={{ fontSize: "1.4rem", fontWeight: 800, marginBottom: "0.5rem" }}>Password reset sent!</h2>
          <p style={{ color: C.muted, fontSize: "0.9rem", lineHeight: 1.6 }}>Check <strong>{email}</strong> for a reset link.</p>
          <button onClick={onClose} style={{ marginTop: "1.5rem", width: "100%", background: C.dark, color: "#fff", border: "none", borderRadius: "12px", padding: "0.85rem", cursor: "pointer", fontWeight: 700, fontFamily: "'Outfit', sans-serif" }}>Done</button>
        </div>
      </div>
    );
  }

  // ── Main login / signup form ──────────────────────────────
  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(10,10,20,0.75)", zIndex: 300, display: "flex", alignItems: "center", justifyContent: "center", padding: "1rem", backdropFilter: "blur(6px)" }}>
      <div onClick={e => e.stopPropagation()} style={{ background: "#fff", borderRadius: "28px", padding: "2.5rem", width: "100%", maxWidth: "440px", boxShadow: "0 40px 100px rgba(0,0,0,0.3)", position: "relative", maxHeight: "90vh", overflowY: "auto" }}>
        <button onClick={onClose} style={{ position: "absolute", top: "1.25rem", right: "1.25rem", border: "none", background: "#f3f4f6", borderRadius: "50%", width: "32px", height: "32px", cursor: "pointer" }}>✕</button>
        <div style={{ fontSize: "2rem", marginBottom: "0.6rem" }}>🏪</div>
        <h2 style={{ fontSize: "1.5rem", fontWeight: 800, margin: "0 0 0.25rem" }}>{mode === "login" ? "Welcome back!" : "Join RentCircle"}</h2>
        <p style={{ color: C.muted, fontSize: "0.85rem", marginBottom: "1.5rem" }}>{mode === "login" ? "Sign in to continue renting" : "Join 5,510+ happy renters"}</p>

        {/* SOCIAL LOGIN — hidden, re-enable when OAuth is configured
        {socialProviders.map(p => (
          <button key={p.name} disabled={loading} onClick={() => handleSocial(p.name)} style={{ width: "100%", border: p.border, borderRadius: "12px", padding: "0.8rem 1rem", background: p.bg, color: p.color, cursor: "pointer", fontWeight: 700, fontSize: "0.9rem", display: "flex", alignItems: "center", justifyContent: "center", gap: "0.75rem", fontFamily: "'Outfit', sans-serif", marginBottom: "0.6rem", boxShadow: "0 1px 6px rgba(0,0,0,0.1)" }}>
            {p.logo}<span>Continue with {p.name}</span>
          </button>
        ))}
        <div style={{ display: "flex", alignItems: "center", gap: "1rem", margin: "1rem 0", color: C.muted, fontSize: "0.8rem" }}>
          <div style={{ flex: 1, height: "1px", background: C.border }} /><span>or use email</span><div style={{ flex: 1, height: "1px", background: C.border }} />
        </div>
        */}

        {errors.general && (
          <div style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.25)", borderRadius: "10px", padding: "0.65rem 1rem", marginBottom: "1rem", color: "#dc2626", fontSize: "0.83rem" }}>
            ⚠ {errors.general}
          </div>
        )}

        {mode === "signup" && (
          <>
            <input style={inp("name")} placeholder="Full name *" value={name} onChange={e => setName(e.target.value)} onFocus={() => setFocused("name")} onBlur={() => setFocused(null)} onKeyDown={e => e.key === "Enter" && handleSubmit()} />
            {errors.name && <p style={{ color: C.red, fontSize: "0.75rem", marginTop: "-0.5rem", marginBottom: "0.5rem" }}>{errors.name}</p>}
          </>
        )}

        <input style={inp("email")} type="email" placeholder="Email address *" value={email} onChange={e => setEmail(e.target.value)} onFocus={() => setFocused("email")} onBlur={() => setFocused(null)} onKeyDown={e => e.key === "Enter" && handleSubmit()} />
        {errors.email && <p style={{ color: C.red, fontSize: "0.75rem", marginTop: "-0.5rem", marginBottom: "0.5rem" }}>{errors.email}</p>}

        <input style={inp("pass")} type="password" placeholder="Password *" value={password} onChange={e => setPassword(e.target.value)} onFocus={() => setFocused("pass")} onBlur={() => setFocused(null)} onKeyDown={e => e.key === "Enter" && handleSubmit()} />
        {errors.password && <p style={{ color: C.red, fontSize: "0.75rem", marginTop: "-0.5rem", marginBottom: "0.5rem" }}>{errors.password}</p>}

        {/* Custom registration fields from admin */}
        {mode === "signup" && customFields.length > 0 && (
          <div style={{ background: "#f9fafb", borderRadius: "14px", padding: "1rem", marginBottom: "0.75rem", border: `1px solid ${C.border}` }}>
            <div style={{ fontSize: "0.72rem", fontWeight: 700, color: C.muted, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "0.75rem" }}>Additional Information</div>
            {customFields.map(cf => (
              <div key={cf.key}>
                <input style={{ ...inp(cf.key), background: "#fff" }} type={cf.type || "text"} placeholder={`${cf.label}${cf.required ? " *" : ""}`}
                  value={customData[cf.key] || ""} onChange={e => setCustomData(d => ({ ...d, [cf.key]: e.target.value }))}
                  onFocus={() => setFocused(cf.key)} onBlur={() => setFocused(null)} />
                {errors[cf.key] && <p style={{ color: C.red, fontSize: "0.75rem", marginTop: "-0.5rem", marginBottom: "0.5rem" }}>{errors[cf.key]}</p>}
              </div>
            ))}
          </div>
        )}

        {mode === "login" && (
          <div style={{ textAlign: "right", marginBottom: "0.75rem" }}>
            <button onClick={handleForgotPassword} style={{ background: "none", border: "none", color: C.dark, fontWeight: 600, cursor: "pointer", fontSize: "0.8rem" }}>
              Forgot password?
            </button>
          </div>
        )}


        {mode === "signup" && (
          <div style={{ background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: "10px", padding: "0.65rem 1rem", marginBottom: "0.75rem", fontSize: "0.82rem", color: "#166534", display: "flex", gap: "0.5rem", alignItems: "flex-start" }}>
            <span>📧</span>
            <span>After signing up, you'll receive a confirmation email. Click the link to activate your account.</span>
          </div>
        )}

        <button onClick={handleSubmit} disabled={loading} style={{ width: "100%", background: C.dark, color: "#fff", border: "none", borderRadius: "12px", padding: "0.9rem", cursor: loading ? "not-allowed" : "pointer", fontWeight: 800, fontSize: "1rem", fontFamily: "'Outfit', sans-serif", opacity: loading ? 0.7 : 1 }}>
          {loading ? "Please wait…" : mode === "login" ? "Sign In →" : "Create Account →"}
        </button>
        <div style={{ textAlign: "center", marginTop: "1.25rem", fontSize: "0.85rem", color: C.muted }}>
          {mode === "login" ? "No account? " : "Have account? "}
          <button onClick={() => { setMode(mode === "login" ? "signup" : "login"); setErrors({}); }} style={{ background: "none", border: "none", color: C.dark, fontWeight: 700, cursor: "pointer", fontFamily: "'Outfit', sans-serif", fontSize: "0.85rem" }}>{mode === "login" ? "Sign up free" : "Sign in"}</button>
        </div>
      </div>
    </div>
  );
}

/* ─── Subscription Gate Modal ─── */
function SubscriptionGate({ onClose, onSubscribe, user }) {
  const [loading, setLoading] = useState(null);
  const handleBuy = (plan) => {
    setLoading(plan.id);
    setTimeout(() => { setLoading(null); onSubscribe(plan); }, 1600);
  };
  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(10,10,20,0.8)", zIndex: 350, display: "flex", alignItems: "center", justifyContent: "center", padding: "1rem", backdropFilter: "blur(8px)" }}>
      <div onClick={e => e.stopPropagation()} style={{ background: "#fff", borderRadius: "28px", padding: "2.5rem", width: "100%", maxWidth: "780px", boxShadow: "0 40px 100px rgba(0,0,0,0.35)", position: "relative", maxHeight: "90vh", overflowY: "auto" }}>
        <button onClick={onClose} style={{ position: "absolute", top: "1.25rem", right: "1.25rem", border: "none", background: "#f3f4f6", borderRadius: "50%", width: "32px", height: "32px", cursor: "pointer", fontSize: "0.9rem" }}>✕</button>
        <div style={{ textAlign: "center", marginBottom: "2rem" }}>
          <div style={{ width: "64px", height: "64px", background: "linear-gradient(135deg, #7c3aed, #a855f7)", borderRadius: "20px", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "2rem", margin: "0 auto 1rem" }}>🔒</div>
          <h2 style={{ fontSize: "1.75rem", fontWeight: 900, letterSpacing: "-0.03em", marginBottom: "0.5rem" }}>Subscription Required</h2>
          <p style={{ color: C.muted, fontSize: "0.95rem", maxWidth: "480px", margin: "0 auto" }}>
            To list your own products on RentCircle and earn money, you need an active subscription. Choose a plan below to get started.
          </p>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "1.25rem" }}>
          {DEFAULT_PLANS.map(plan => (
            <div key={plan.id} style={{ background: plan.color, borderRadius: "20px", padding: "1.75rem", border: plan.popular ? `3px solid ${plan.accent}` : `3px solid transparent`, position: "relative", display: "flex", flexDirection: "column" }}>
              {plan.popular && <div style={{ position: "absolute", top: "-13px", left: "50%", transform: "translateX(-50%)", background: plan.accent, color: "#fff", borderRadius: "50px", padding: "0.25rem 0.9rem", fontSize: "0.72rem", fontWeight: 700, whiteSpace: "nowrap" }}>MOST POPULAR</div>}
              <div style={{ fontWeight: 900, fontSize: "1.15rem", marginBottom: "0.15rem" }}>{plan.name}</div>
              <div style={{ fontSize: "1.9rem", fontWeight: 900, margin: "0.5rem 0" }}>{INR(plan.price)}<span style={{ fontSize: "0.85rem", fontWeight: 400, color: C.muted }}>/mo</span></div>
              <div style={{ background: "rgba(0,0,0,0.06)", borderRadius: "8px", padding: "0.5rem 0.75rem", marginBottom: "1rem", fontSize: "0.82rem", fontWeight: 700, color: plan.accent }}>
                📦 List up to {plan.listingLimit >= 999 ? "unlimited" : plan.listingLimit} products
              </div>
              <ul style={{ listStyle: "none", padding: 0, margin: "0 0 1.25rem", flex: 1, display: "flex", flexDirection: "column", gap: "0.45rem" }}>
                {plan.features.map(f => <li key={f} style={{ display: "flex", gap: "0.5rem", fontSize: "0.83rem", color: C.dark, alignItems: "flex-start" }}><span style={{ color: plan.accent, flexShrink: 0, marginTop: "1px" }}>✓</span>{f}</li>)}
              </ul>
              <button onClick={() => handleBuy(plan)} disabled={!!loading} style={{ width: "100%", background: loading === plan.id ? "rgba(0,0,0,0.2)" : plan.accent, color: "#fff", border: "none", borderRadius: "12px", padding: "0.85rem", cursor: loading === plan.id ? "not-allowed" : "pointer", fontWeight: 800, fontFamily: "'Outfit', sans-serif", fontSize: "0.9rem", transition: "all 0.2s", display: "flex", alignItems: "center", justifyContent: "center", gap: "0.5rem" }}>
                {loading === plan.id ? <><span style={{ display: "inline-block", animation: "rc-spin 0.8s linear infinite" }}>⏳</span> Processing...</> : `Subscribe — ${INR(plan.price)}/mo`}
              </button>
            </div>
          ))}
        </div>
        <p style={{ textAlign: "center", color: C.muted, fontSize: "0.78rem", marginTop: "1.5rem" }}>Cancel anytime · Secure payment via Razorpay · All prices inclusive of GST</p>
      </div>
      <style>{`@keyframes rc-spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}

/* ─── Price Display Helper ─── */
function PriceDisplay({ p, size = "md" }) {
  const [period, setPeriod] = useState("day");
  const price = period === "day" ? p.priceDay : period === "month" ? p.priceMonth : p.priceYear;
  const label = period === "day" ? "/day" : period === "month" ? "/month" : "/year";
  const tabs = [["day","D"],["month","M"],["year","Y"]];
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap" }}>
      <div>
        <span style={{ fontSize: size === "lg" ? "1.5rem" : "1.1rem", fontWeight: 900 }}>{INR(price || 0)}</span>
        <span style={{ fontSize: "0.72rem", color: C.muted, marginLeft: "2px" }}>{label}</span>
      </div>
      <div style={{ display: "flex", background: "#f3f4f6", borderRadius: "8px", overflow: "hidden", flexShrink: 0 }}>
        {tabs.map(([k, l]) => (
          <button key={k} onClick={e => { e.stopPropagation(); setPeriod(k); }} style={{ border: "none", padding: "0.2rem 0.4rem", background: period === k ? C.dark : "transparent", color: period === k ? "#fff" : C.muted, cursor: "pointer", fontSize: "0.65rem", fontWeight: 700, fontFamily: "'Outfit', sans-serif" }}>{l}</button>
        ))}
      </div>
    </div>
  );
}


function PhotoUploader({ photos, onChange, maxPhotos = 8, accentColor, bgColor, borderColor, textColor, mutedColor }) {
  const accent = accentColor || C.dark;
  const bg = bgColor || C.bg;
  const border = borderColor || C.border;
  const text = textColor || C.dark;
  const muted = mutedColor || C.muted;
  const [dragOver, setDragOver] = useState(false);
  const [activeIdx, setActiveIdx] = useState(0);

  const readFiles = (files) => {
    const remaining = maxPhotos - photos.length;
    const toRead = Array.from(files).slice(0, remaining);
    toRead.forEach(file => {
      if (!file.type.startsWith("image/")) return;
      const reader = new FileReader();
      reader.onload = e => onChange(prev => [...prev, { id: Date.now() + Math.random(), url: e.target.result, name: file.name }]);
      reader.readAsDataURL(file);
    });
  };

  const handleDrop = e => { e.preventDefault(); setDragOver(false); readFiles(e.dataTransfer.files); };
  const handleFile = e => readFiles(e.target.files);
  const remove = (id) => { onChange(prev => { const n = prev.filter(p => p.id !== id); setActiveIdx(i => Math.min(i, n.length - 1)); return n; }); };
  const moveLeft = (idx) => { if (idx === 0) return; onChange(prev => { const a = [...prev]; [a[idx-1], a[idx]] = [a[idx], a[idx-1]]; setActiveIdx(idx-1); return a; }); };
  const moveRight = (idx) => { if (idx === photos.length-1) return; onChange(prev => { const a = [...prev]; [a[idx+1], a[idx]] = [a[idx], a[idx+1]]; setActiveIdx(idx+1); return a; }); };

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.6rem" }}>
        <label style={{ fontSize: "0.78rem", fontWeight: 700, color: muted, textTransform: "uppercase", letterSpacing: "0.05em" }}>Product Photos</label>
        <span style={{ fontSize: "0.75rem", color: muted }}>{photos.length}/{maxPhotos} photos{photos.length > 0 ? " · drag to reorder" : ""}</span>
      </div>

      {/* Main drop zone + preview area */}
      {photos.length === 0 ? (
        <label onDragOver={e => { e.preventDefault(); setDragOver(true); }} onDragLeave={() => setDragOver(false)} onDrop={handleDrop}
          style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", border: `2px dashed ${dragOver ? accent : border}`, borderRadius: "16px", padding: "2.5rem 1rem", cursor: "pointer", background: dragOver ? `${accent}08` : bg, transition: "all 0.2s", gap: "0.75rem" }}>
          <input type="file" multiple accept="image/*" style={{ display: "none" }} onChange={handleFile} />
          <div style={{ width: "56px", height: "56px", borderRadius: "16px", background: `${accent}12`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.75rem" }}>📸</div>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontWeight: 700, fontSize: "0.95rem", color: text }}>Drop photos here or click to upload</div>
            <div style={{ color: muted, fontSize: "0.8rem", marginTop: "0.25rem" }}>JPG, PNG, WEBP · Up to {maxPhotos} photos · First photo is cover</div>
          </div>
          <div style={{ background: accent, color: "#fff", borderRadius: "10px", padding: "0.5rem 1.25rem", fontSize: "0.85rem", fontWeight: 700 }}>Choose Photos</div>
        </label>
      ) : (
        <div>
          {/* Large preview of active photo */}
          <div style={{ position: "relative", borderRadius: "14px", overflow: "hidden", marginBottom: "0.75rem", background: bg, border: `1px solid ${border}` }}>
            <img src={photos[activeIdx]?.url} alt="" style={{ width: "100%", height: "200px", objectFit: "cover", display: "block" }} />
            {activeIdx === 0 && <div style={{ position: "absolute", top: "0.6rem", left: "0.6rem", background: accent, color: "#fff", borderRadius: "6px", padding: "0.2rem 0.55rem", fontSize: "0.72rem", fontWeight: 700 }}>⭐ Cover</div>}
            <div style={{ position: "absolute", top: "0.6rem", right: "0.6rem", display: "flex", gap: "0.4rem" }}>
              <button onClick={() => moveLeft(activeIdx)} disabled={activeIdx === 0} style={{ width: "28px", height: "28px", borderRadius: "8px", border: "none", background: "rgba(0,0,0,0.55)", color: "#fff", cursor: activeIdx === 0 ? "default" : "pointer", fontSize: "0.75rem", opacity: activeIdx === 0 ? 0.3 : 1 }}>←</button>
              <button onClick={() => moveRight(activeIdx)} disabled={activeIdx === photos.length-1} style={{ width: "28px", height: "28px", borderRadius: "8px", border: "none", background: "rgba(0,0,0,0.55)", color: "#fff", cursor: activeIdx === photos.length-1 ? "default" : "pointer", fontSize: "0.75rem", opacity: activeIdx === photos.length-1 ? 0.3 : 1 }}>→</button>
              <button onClick={() => remove(photos[activeIdx].id)} style={{ width: "28px", height: "28px", borderRadius: "8px", border: "none", background: "rgba(220,38,38,0.85)", color: "#fff", cursor: "pointer", fontSize: "0.75rem" }}>✕</button>
            </div>
            <div style={{ position: "absolute", bottom: "0.6rem", right: "0.6rem", background: "rgba(0,0,0,0.5)", color: "#fff", borderRadius: "6px", padding: "0.15rem 0.5rem", fontSize: "0.72rem" }}>{activeIdx+1}/{photos.length}</div>
          </div>
          {/* Thumbnails row */}
          <div style={{ display: "flex", gap: "0.5rem", overflowX: "auto", paddingBottom: "0.25rem" }}>
            {photos.map((p, i) => (
              <div key={p.id} onClick={() => setActiveIdx(i)} style={{ position: "relative", flexShrink: 0, width: "60px", height: "60px", borderRadius: "10px", overflow: "hidden", border: `2px solid ${i === activeIdx ? accent : border}`, cursor: "pointer", transition: "border-color 0.15s" }}>
                <img src={p.url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                {i === 0 && <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, background: `${accent}cc`, color: "#fff", fontSize: "0.58rem", fontWeight: 700, textAlign: "center", padding: "1px 0" }}>COVER</div>}
              </div>
            ))}
            {photos.length < maxPhotos && (
              <label style={{ flexShrink: 0, width: "60px", height: "60px", borderRadius: "10px", border: `2px dashed ${border}`, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", background: bg, fontSize: "1.3rem", color: muted }}>
                <input type="file" multiple accept="image/*" style={{ display: "none" }} onChange={handleFile} />+
              </label>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── Add / Edit Product Modal ─── */
function AddProductModal({ onClose, onSave, editProduct, user, adminTags = [], categories: dbCategories = [], availableCities = [] }) {
  const plan = DEFAULT_PLANS.find(p => p.id === user?.subscription);
  // Use DB categories (active ones), fallback to hardcoded list if DB is empty
  const categoryList = dbCategories.length > 0
    ? dbCategories.map(c => c.name)
    : ["Electronics", "Sports", "Outdoor", "Gaming", "Tools", "Fashion"];
  const [form, setForm] = useState(editProduct ? { ...editProduct } : { name: "", category: categoryList[0] || "Electronics", priceDay: "", priceMonth: "", priceYear: "", description: "", image: "📷", condition: "Excellent", location: "", tags: [] });
  const [photos, setPhotos] = useState(editProduct?.photos || []);
  const [focused, setFocused] = useState(null);
  const [step, setStep] = useState(1);
  const [errors, setErrors] = useState({});
  const [editConfirmed, setEditConfirmed] = useState(false);

  const inp = (id) => ({
    width: "100%", borderRadius: "12px", padding: "0.8rem 1rem", outline: "none",
    fontSize: "0.9rem", fontFamily: "'Outfit', sans-serif", boxSizing: "border-box",
    color: C.dark, transition: "border-color 0.2s, background 0.2s",
    border: `1.5px solid ${errors[id] ? "#ef4444" : focused === id ? C.dark : C.border}`,
    background: errors[id] ? "#fff5f5" : "#fff",
  });

  const ErrMsg = ({ field }) => errors[field]
    ? <div style={{ color: "#ef4444", fontSize: "0.75rem", marginTop: "0.3rem", marginBottom: "0.25rem", fontWeight: 600, display: "flex", alignItems: "center", gap: "0.3rem" }}>⚠ {errors[field]}</div>
    : null;

  const toggleTag = (tagId) => setForm(f => {
    const tags = f.tags || [];
    return { ...f, tags: tags.includes(tagId) ? tags.filter(t => t !== tagId) : [...tags, tagId] };
  });

  const validateStep1 = () => {
    const e = {};
    if (!form.name?.trim()) e.name = "Product name is required";
    if (!form.priceDay || Number(form.priceDay) <= 0) e.priceDay = "Price per day is required and must be > 0";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const validate = () => {
    const e = {};
    if (!form.name?.trim()) e.name = "Product name is required";
    if (!form.priceDay || Number(form.priceDay) <= 0) e.priceDay = "Price per day is required and must be > 0";
    if (!form.location?.trim()) e.location = "City is required";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleContinue = () => { if (validateStep1()) setStep(2); };

  const handleSave = () => {
    const e = {};
    if (!form.name?.trim()) e.name = "Product name is required";
    if (!form.priceDay || Number(form.priceDay) <= 0) e.priceDay = "Price per day is required and must be > 0";
    if (!form.location?.trim()) e.location = "City is required";
    setErrors(e);
    if (Object.keys(e).length > 0) {
      // Go back to the step that has the first error
      if (e.name || e.priceDay) { setStep(1); return; }
      if (e.location) { setStep(3); return; }
      return;
    }
    const isEdit = !!editProduct;
    if (isEdit && !editConfirmed) return;
    onSave({
      ...form,
      photos,
      tags: user?.isMaster ? (form.tags || []) : [],
      priceDay: Number(form.priceDay),
      priceMonth: form.priceMonth ? Number(form.priceMonth) : Math.round(Number(form.priceDay) * 25),
      priceYear: form.priceYear ? Number(form.priceYear) : Math.round(Number(form.priceDay) * 280),
      id: editProduct?.id || Date.now(),
      rating: editProduct?.rating || 5.0,
      reviews: editProduct?.reviews || 0,
      unit: "day",
      owner: user.name,
      ownerEmail: user.email,
      status: isEdit ? (editProduct.status || "active") : "active",
      badge: isEdit ? (editProduct.badge || "New") : "Pending Review",
    });
  };

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(10,10,20,0.8)", zIndex: 350, display: "flex", alignItems: "center", justifyContent: "center", padding: "1rem", backdropFilter: "blur(8px)" }}>
      <div onClick={e => e.stopPropagation()} style={{ background: "#fff", borderRadius: "28px", width: "100%", maxWidth: "580px", maxHeight: "92vh", boxShadow: "0 40px 100px rgba(0,0,0,0.3)", display: "flex", flexDirection: "column", overflow: "hidden" }}>
        {/* Header */}
        <div style={{ background: `linear-gradient(135deg, ${C.dark}, #16213e)`, padding: "1.75rem 2rem", color: "#fff", position: "relative", flexShrink: 0 }}>
          <button onClick={onClose} style={{ position: "absolute", top: "1.25rem", right: "1.25rem", border: "none", background: "rgba(255,255,255,0.15)", borderRadius: "50%", width: "32px", height: "32px", cursor: "pointer", color: "#fff", fontSize: "0.9rem" }}>✕</button>
          <div style={{ fontSize: "1.5rem", marginBottom: "0.4rem" }}>{editProduct ? "✏️" : "➕"}</div>
          <h3 style={{ fontWeight: 900, fontSize: "1.3rem", marginBottom: "0.25rem" }}>{editProduct ? "Edit Listing" : "List Your Product"}</h3>
          <p style={{ opacity: 0.65, fontSize: "0.85rem" }}>{plan && `${plan.name} plan · `}Earn money by renting out your items</p>
          <div style={{ display: "flex", gap: "0.5rem", marginTop: "1rem" }}>
            {[1, 2, 3].map(s => <div key={s} style={{ height: "4px", flex: 1, borderRadius: "2px", background: step >= s ? C.gold : "rgba(255,255,255,0.2)", transition: "background 0.3s" }} />)}
          </div>
          <div style={{ display: "flex", gap: "1.5rem", marginTop: "0.75rem" }}>
            {[["1","Details"], ["2","Photos"], ["3","Extras"]].map(([n, label]) => (
              <span key={n} style={{ fontSize: "0.75rem", opacity: step >= Number(n) ? 1 : 0.45, fontWeight: step === Number(n) ? 700 : 400 }}>{n}. {label}</span>
            ))}
          </div>
        </div>
        {/* Body - scrollable */}
        <div style={{ padding: "2rem", overflowY: "auto", flex: 1 }}>
          {step === 1 && (
            <>
              <div style={{ marginBottom: "1rem" }}>
                <label style={{ display: "block", fontSize: "0.78rem", fontWeight: 700, color: C.muted, marginBottom: "0.4rem", textTransform: "uppercase", letterSpacing: "0.05em" }}>Product Name *</label>
                <input style={inp("name")} placeholder="e.g. Canon 5D Mark IV Camera" value={form.name}
                  onChange={e => { setForm(f => ({ ...f, name: e.target.value })); setErrors(ev => ({ ...ev, name: "" })); }}
                  onFocus={() => setFocused("name")} onBlur={() => setFocused(null)} />
                <ErrMsg field="name" />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem", marginBottom: "1rem" }}>
                <div>
                  <label style={{ display: "block", fontSize: "0.78rem", fontWeight: 700, color: C.muted, marginBottom: "0.4rem", textTransform: "uppercase", letterSpacing: "0.05em" }}>Category *</label>
                  <select style={{ ...inp("cat"), width: "100%" }} value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))} onFocus={() => setFocused("cat")} onBlur={() => setFocused(null)}>
                    {categoryList.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ display: "block", fontSize: "0.78rem", fontWeight: 700, color: C.muted, marginBottom: "0.4rem", textTransform: "uppercase", letterSpacing: "0.05em" }}>Price / Day (₹) *</label>
                  <input style={inp("priceDay")} type="number" min="1" placeholder="e.g. 1500" value={form.priceDay}
                    onChange={e => { setForm(f => ({ ...f, priceDay: e.target.value })); setErrors(ev => ({ ...ev, priceDay: "" })); }}
                    onFocus={() => setFocused("priceDay")} onBlur={() => setFocused(null)} />
                  <ErrMsg field="priceDay" />
                </div>
              </div>
              {/* Month and Year pricing */}
              <div style={{ background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: "14px", padding: "1rem 1.25rem", marginBottom: "1rem" }}>
                <div style={{ fontSize: "0.78rem", fontWeight: 700, color: "#16a34a", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "0.75rem" }}>💡 Optional — Long-term pricing (leave blank to auto-calculate)</div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
                  <div>
                    <label style={{ display: "block", fontSize: "0.78rem", fontWeight: 700, color: C.muted, marginBottom: "0.4rem", textTransform: "uppercase", letterSpacing: "0.05em" }}>Price / Month (₹)</label>
                    <input style={{ ...inp("priceMonth"), marginBottom: 0 }} type="number" placeholder={form.priceDay ? `Auto: ${INR(Math.round(Number(form.priceDay)*25))}` : "e.g. 35000"} value={form.priceMonth} onChange={e => setForm(f => ({ ...f, priceMonth: e.target.value }))} onFocus={() => setFocused("priceMonth")} onBlur={() => setFocused(null)} />
                  </div>
                  <div>
                    <label style={{ display: "block", fontSize: "0.78rem", fontWeight: 700, color: C.muted, marginBottom: "0.4rem", textTransform: "uppercase", letterSpacing: "0.05em" }}>Price / Year (₹)</label>
                    <input style={{ ...inp("priceYear"), marginBottom: 0 }} type="number" placeholder={form.priceDay ? `Auto: ${INR(Math.round(Number(form.priceDay)*280))}` : "e.g. 360000"} value={form.priceYear} onChange={e => setForm(f => ({ ...f, priceYear: e.target.value }))} onFocus={() => setFocused("priceYear")} onBlur={() => setFocused(null)} />
                  </div>
                </div>
              </div>
              <div style={{ marginBottom: "1.5rem" }}>
                <label style={{ display: "block", fontSize: "0.78rem", fontWeight: 700, color: C.muted, marginBottom: "0.4rem", textTransform: "uppercase", letterSpacing: "0.05em" }}>Description</label>
                <textarea style={{ ...inp("desc"), height: "80px", resize: "vertical" }} placeholder="Describe your product — age, accessories included, usage notes..." value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} onFocus={() => setFocused("desc")} onBlur={() => setFocused(null)} />
              </div>
              <button onClick={handleContinue} style={{ width: "100%", background: C.dark, color: "#fff", border: "none", borderRadius: "12px", padding: "0.9rem", cursor: "pointer", fontWeight: 800, fontFamily: "'Outfit', sans-serif" }}>
                Continue →
              </button>
            </>
          )}
          {step === 2 && (
            <>
              <PhotoUploader photos={photos} onChange={setPhotos} maxPhotos={8} />
              <div style={{ marginTop: "1.5rem", display: "flex", gap: "0.75rem" }}>
                <button onClick={() => setStep(1)} style={{ flex: 1, padding: "0.9rem", border: `2px solid ${C.border}`, borderRadius: "12px", background: "#fff", cursor: "pointer", fontWeight: 700, fontFamily: "'Outfit', sans-serif", color: C.dark }}>← Back</button>
                <button onClick={() => setStep(3)} style={{ flex: 2, padding: "0.9rem", border: "none", borderRadius: "12px", background: C.dark, color: "#fff", cursor: "pointer", fontWeight: 800, fontFamily: "'Outfit', sans-serif" }}>
                  Continue {photos.length > 0 ? `(${photos.length} photo${photos.length>1?"s":""})` : "(skip)"} →
                </button>
              </div>
            </>
          )}
          {step === 3 && (
            <>
              <div style={{ marginBottom: "1.25rem" }}>
                <label style={{ display: "block", fontSize: "0.78rem", fontWeight: 700, color: C.muted, marginBottom: "0.75rem", textTransform: "uppercase", letterSpacing: "0.05em" }}>Pick an Emoji Icon {photos.length > 0 ? "(used as fallback)" : ""}</label>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
                  {PRODUCT_EMOJIS.map(e => (
                    <button key={e} onClick={() => setForm(f => ({ ...f, image: e }))} style={{ width: "42px", height: "42px", borderRadius: "10px", border: `2px solid ${form.image === e ? C.dark : C.border}`, background: form.image === e ? C.bg : "#fff", fontSize: "1.3rem", cursor: "pointer", transition: "all 0.15s" }}>{e}</button>
                  ))}
                </div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem", marginBottom: "1rem" }}>
                <div>
                  <label style={{ display: "block", fontSize: "0.78rem", fontWeight: 700, color: C.muted, marginBottom: "0.4rem", textTransform: "uppercase", letterSpacing: "0.05em" }}>Condition</label>
                  <select style={{ ...inp("cond"), width: "100%" }} value={form.condition} onChange={e => setForm(f => ({ ...f, condition: e.target.value }))} onFocus={() => setFocused("cond")} onBlur={() => setFocused(null)}>
                    {["Like New", "Excellent", "Good", "Fair"].map(c => <option key={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ display: "block", fontSize: "0.78rem", fontWeight: 700, color: C.muted, marginBottom: "0.4rem", textTransform: "uppercase", letterSpacing: "0.05em" }}>Location / City *</label>
                  {availableCities.length > 0 ? (
                    <select style={{ ...inp("location"), cursor: "pointer" }} value={form.location} onChange={e => { setForm(f => ({ ...f, location: e.target.value })); setErrors(ev => ({ ...ev, location: "" })); }} onFocus={() => setFocused("location")} onBlur={() => setFocused(null)}>
                      <option value="">Select city...</option>
                      {availableCities.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  ) : (
                    <input style={inp("location")} placeholder="e.g. Mumbai" value={form.location} onChange={e => { setForm(f => ({ ...f, location: e.target.value })); setErrors(ev => ({ ...ev, location: "" })); }} onFocus={() => setFocused("location")} onBlur={() => setFocused(null)} />
                  )}
                  <ErrMsg field="location" />
                  {availableCities.length > 0 && (
                    <a
                      href="https://wa.me/919169168009?text=Hi%2C%20I%20want%20to%20list%20a%20product%20but%20my%20city%20is%20not%20in%20the%20list.%20Can%20you%20please%20add%20it%3F"
                      target="_blank"
                      rel="noreferrer"
                      style={{ display: "flex", alignItems: "center", gap: "0.4rem", marginTop: "0.4rem", fontSize: "0.75rem", color: "#25D366", fontWeight: 600, textDecoration: "none", lineHeight: 1.4 }}
                    >
                      <span style={{ fontSize: "0.95rem" }}>💬</span>
                      City not listed? WhatsApp us to get it added
                    </a>
                  )}
                </div>
              </div>
              {/* Tags — master user only */}
              {user?.isMaster && adminTags.length > 0 && (
                <div style={{ marginBottom: "1.25rem" }}>
                  <label style={{ display: "block", fontSize: "0.78rem", fontWeight: 700, color: C.muted, marginBottom: "0.6rem", textTransform: "uppercase", letterSpacing: "0.05em" }}>Product Tags <span style={{ fontWeight: 400, textTransform: "none", letterSpacing: 0 }}>(optional)</span></label>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
                    {adminTags.map(tag => {
                      const selected = (form.tags || []).includes(tag.id);
                      return (
                        <button key={tag.id} onClick={() => toggleTag(tag.id)}
                          style={{ display: "inline-flex", alignItems: "center", gap: "0.3rem", padding: "0.4rem 0.85rem", borderRadius: "20px", border: `2px solid ${selected ? tag.color : C.border}`, background: selected ? tag.bg : "#fff", color: selected ? tag.color : C.muted, fontFamily: "'Outfit', sans-serif", fontSize: "0.82rem", fontWeight: selected ? 700 : 500, cursor: "pointer", transition: "all 0.15s" }}>
                          {selected && <span style={{ fontSize: "0.65rem" }}>✓</span>}
                          {tag.emoji} {tag.name}
                        </button>
                      );
                    })}
                  </div>
                  {(form.tags || []).length > 0 && (
                    <div style={{ marginTop: "0.5rem", fontSize: "0.75rem", color: C.muted }}>{(form.tags || []).length} tag{(form.tags || []).length > 1 ? "s" : ""} selected</div>
                  )}
                </div>
              )}
              {/* Preview */}
              <div style={{ background: C.bg, borderRadius: "16px", padding: "1.25rem", marginBottom: "1.5rem", border: `1px solid ${C.border}` }}>
                <div style={{ fontSize: "0.78rem", fontWeight: 700, color: C.muted, marginBottom: "0.75rem", textTransform: "uppercase", letterSpacing: "0.05em" }}>Preview</div>
                <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
                  <div style={{ width: "64px", height: "64px", borderRadius: "12px", overflow: "hidden", flexShrink: 0, background: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "2rem", border: `1px solid ${C.border}` }}>
                    {photos.length > 0 ? <img src={photos[0].url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : form.image}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700, fontSize: "0.95rem" }}>{form.name || "Your Product Name"}</div>
                    <div style={{ color: C.muted, fontSize: "0.82rem" }}>{form.category} · {form.condition}</div>
                    <div style={{ color: C.dark, fontWeight: 800, fontSize: "1rem", marginTop: "0.2rem" }}>{form.priceDay ? INR(form.priceDay) : "₹0"}/day</div>
                    {(form.tags || []).length > 0 && adminTags.length > 0 && (
                      <div style={{ display: "flex", gap: "0.3rem", flexWrap: "wrap", marginTop: "0.4rem" }}>
                        {(form.tags || []).map(tid => {
                          const tag = adminTags.find(t => t.id === tid);
                          return tag ? <TagBadge key={tid} tag={tag} /> : null;
                        })}
                      </div>
                    )}
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "0.3rem" }}>
                    <span style={{ background: "#dcfce7", color: "#166534", borderRadius: "6px", padding: "0.2rem 0.5rem", fontSize: "0.72rem", fontWeight: 700 }}>New</span>
                    {photos.length > 0 && <span style={{ background: "#dbeafe", color: "#1e40af", borderRadius: "6px", padding: "0.2rem 0.5rem", fontSize: "0.72rem", fontWeight: 700 }}>📸 {photos.length}</span>}
                  </div>
                </div>
              </div>
              {editProduct && (
                <div style={{ background: "#fffbeb", border: "2px solid #f59e0b", borderRadius: "14px", padding: "1rem 1.25rem", marginBottom: "1rem" }}>
                  <div style={{ display: "flex", gap: "0.75rem", alignItems: "flex-start" }}>
                    <span style={{ fontSize: "1.4rem", flexShrink: 0, lineHeight: 1 }}>⚠️</span>
                    <div>
                      <div style={{ fontWeight: 800, fontSize: "0.92rem", color: "#92400e", marginBottom: "0.35rem" }}>Your listing will be taken down for re-approval</div>
                      <div style={{ fontSize: "0.82rem", color: "#78350f", lineHeight: 1.55 }}>Saving changes will send this listing back to admin for review. <strong>It will be hidden from the marketplace</strong> until an admin approves it again.</div>
                      <label style={{ display: "flex", alignItems: "center", gap: "0.6rem", marginTop: "0.85rem", cursor: "pointer" }}>
                        <input type="checkbox" checked={editConfirmed} onChange={e => setEditConfirmed(e.target.checked)} style={{ width: "16px", height: "16px", accentColor: "#f59e0b", cursor: "pointer", flexShrink: 0 }} />
                        <span style={{ fontSize: "0.82rem", fontWeight: 700, color: "#92400e" }}>I understand my listing will be unpublished until re-approved</span>
                      </label>
                    </div>
                  </div>
                </div>
              )}
              <div style={{ display: "flex", gap: "0.75rem" }}>
                <button onClick={() => setStep(2)} style={{ flex: 1, padding: "0.9rem", border: `2px solid ${C.border}`, borderRadius: "12px", background: "#fff", cursor: "pointer", fontWeight: 700, fontFamily: "'Outfit', sans-serif", color: C.dark }}>← Back</button>
                <button onClick={handleSave} style={{ flex: 2, padding: "0.9rem", border: "none", borderRadius: "12px", background: editProduct && !editConfirmed ? "#9ca3af" : C.green, color: "#fff", cursor: editProduct && !editConfirmed ? "not-allowed" : "pointer", fontWeight: 800, fontFamily: "'Outfit', sans-serif", transition: "background 0.2s" }}>
                  {editProduct ? "Save Changes ✓" : "Publish Listing 🚀"}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/* ─── My Listings Page ─── */
function MyListingsPage({ user, allProducts, plans: livePlans, onAddProduct, onEditProduct, onDeleteProduct, onUpgrade, navigate }) {
  const myListings = allProducts.filter(p => p.ownerEmail === user?.email);
  const isMaster = user?.isMaster;
  const planList = livePlans || DEFAULT_PLANS;
  const plan = isMaster ? null : planList.find(p => p.id === user?.subscription);
  const limit = isMaster ? Infinity : (plan ? (plan.listingLimit ?? plan.rentals ?? 0) : 0);
  const canAdd = isMaster || myListings.length < limit;

  return (
    <>
      <PageHero icon="🏪" title="My Listings" subtitle="Manage the products you've listed for rent on RentCircle." />
      <div style={{ padding: "3rem 2rem", maxWidth: "1100px", margin: "0 auto" }}>
        {/* Status Banner */}
        {isMaster ? (
          <div style={{ background: "linear-gradient(135deg, #f5f3ff, #ede9fe)", border: "2px solid #7c3aed", borderRadius: "20px", padding: "1.5rem 2rem", marginBottom: "2rem", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "1rem" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
              <div style={{ width: "48px", height: "48px", borderRadius: "14px", background: "#7c3aed", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.5rem" }}>👑</div>
              <div>
                <div style={{ fontWeight: 800, fontSize: "1.1rem" }}>Master User — Full Access</div>
                <div style={{ color: C.muted, fontSize: "0.88rem" }}>Unlimited listings · No subscription required</div>
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
              <div style={{ background: "#fff", borderRadius: "12px", padding: "0.6rem 1.2rem", border: `1px solid ${C.border}` }}>
                <div style={{ fontSize: "1.4rem", fontWeight: 900, color: "#7c3aed" }}>{myListings.length}</div>
                <div style={{ fontSize: "0.75rem", color: C.muted }}>Active</div>
              </div>
              <div style={{ background: "#fff", borderRadius: "12px", padding: "0.6rem 1.2rem", border: `1px solid ${C.border}` }}>
                <div style={{ fontSize: "1.4rem", fontWeight: 900, color: C.green }}>{INR(myListings.reduce((s, p) => s + (p.priceDay || p.price || 0), 0))}</div>
                <div style={{ fontSize: "0.75rem", color: C.muted }}>Total/day</div>
              </div>
            </div>
          </div>
        ) : plan ? (
          <div style={{ background: `linear-gradient(135deg, ${plan.color}, #fff)`, border: `2px solid ${plan.accent}`, borderRadius: "20px", padding: "1.5rem 2rem", marginBottom: "2rem", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "1rem" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
              <div style={{ width: "48px", height: "48px", borderRadius: "14px", background: plan.accent, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.5rem" }}>⭐</div>
              <div>
                <div style={{ fontWeight: 800, fontSize: "1.1rem" }}>{plan.name} Plan Active</div>
                <div style={{ color: C.muted, fontSize: "0.88rem" }}>{INR(plan.price)}/month · {myListings.length}/{limit >= 999 ? "∞" : limit} products listed</div>
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
              <div style={{ background: "#fff", borderRadius: "12px", padding: "0.6rem 1.2rem", border: `1px solid ${C.border}` }}>
                <div style={{ fontSize: "1.4rem", fontWeight: 900, color: plan.accent }}>{myListings.length}</div>
                <div style={{ fontSize: "0.75rem", color: C.muted }}>Active</div>
              </div>
              <div style={{ background: "#fff", borderRadius: "12px", padding: "0.6rem 1.2rem", border: `1px solid ${C.border}` }}>
                <div style={{ fontSize: "1.4rem", fontWeight: 900, color: C.green }}>{INR(myListings.reduce((s, p) => s + (p.priceDay || p.price || 0), 0))}</div>
                <div style={{ fontSize: "0.75rem", color: C.muted }}>Total/day</div>
              </div>
            </div>
          </div>
        ) : (
          <div style={{ background: "linear-gradient(135deg, #faf5ff, #f5f3ff)", border: "2px solid #a855f7", borderRadius: "20px", padding: "2.5rem", marginBottom: "2rem", textAlign: "center" }}>
            <div style={{ fontSize: "3rem", marginBottom: "1rem" }}>🔒</div>
            <h3 style={{ fontWeight: 900, fontSize: "1.4rem", marginBottom: "0.5rem" }}>No Subscription Yet</h3>
            <p style={{ color: C.muted, marginBottom: "1.5rem", maxWidth: "440px", margin: "0 auto 1.5rem" }}>You need an active subscription to list your products. Start earning today — plans from just {INR(749)}/month.</p>
            <button onClick={onUpgrade} style={{ background: "#7c3aed", color: "#fff", border: "none", borderRadius: "14px", padding: "1rem 2.5rem", fontWeight: 800, fontSize: "1rem", cursor: "pointer", fontFamily: "'Outfit', sans-serif" }}>View Plans & Subscribe →</button>
          </div>
        )}

        {/* Add Product Button */}
        {(isMaster || plan) && (
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem" }}>
            <h2 style={{ fontWeight: 800, fontSize: "1.4rem" }}>Your Products <span style={{ color: C.muted, fontSize: "1rem", fontWeight: 400 }}>({myListings.length}{!isMaster && limit < 999 ? `/${limit}` : ""})</span></h2>
            <button onClick={canAdd ? onAddProduct : null} style={{ background: canAdd ? C.green : "#e5e7eb", color: canAdd ? "#fff" : C.muted, border: "none", borderRadius: "12px", padding: "0.75rem 1.5rem", cursor: canAdd ? "pointer" : "not-allowed", fontWeight: 700, fontFamily: "'Outfit', sans-serif", display: "flex", alignItems: "center", gap: "0.5rem" }}>
              {canAdd ? "➕ Add New Product" : `Limit reached (${limit})`}
            </button>
          </div>
        )}

        {/* Product Grid */}
        {myListings.length === 0 && (isMaster || plan) ? (
          <div style={{ textAlign: "center", padding: "4rem", background: "#fff", borderRadius: "20px", border: `2px dashed ${C.border}` }}>
            <div style={{ fontSize: "4rem", marginBottom: "1rem" }}>📦</div>
            <h3 style={{ fontWeight: 800, marginBottom: "0.5rem" }}>No listings yet</h3>
            <p style={{ color: C.muted, marginBottom: "1.5rem" }}>Add your first product and start earning today!</p>
            <button onClick={onAddProduct} style={{ background: C.dark, color: "#fff", border: "none", borderRadius: "12px", padding: "0.9rem 2rem", cursor: "pointer", fontWeight: 800, fontFamily: "'Outfit', sans-serif" }}>List Your First Product →</button>
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: "1.25rem" }}>
            {myListings.map(p => (
              <div key={p.id} style={{ background: p.status === "inactive" ? "#f9fafb" : "#fff", borderRadius: "20px", overflow: "hidden", boxShadow: "0 2px 10px rgba(0,0,0,0.06)", border: `2px solid ${p.status === "inactive" ? "#e5e7eb" : C.border}`, transition: "all 0.2s", opacity: p.status === "inactive" ? 0.75 : 1 }} onMouseEnter={e => { if (p.status !== "inactive") e.currentTarget.style.borderColor = C.gold; }} onMouseLeave={e => e.currentTarget.style.borderColor = p.status === "inactive" ? "#e5e7eb" : C.border}>
                <div style={{ position: "relative", height: "160px", background: `linear-gradient(135deg, ${C.bg}, #fff)`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  {p.photos?.length > 0
                    ? <img src={p.photos[0].url} alt={p.name} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
                    : <span style={{ fontSize: "3.5rem" }}>{p.image}</span>}
                  {p.badge === "Pending Review"
                    ? <span style={{ position: "absolute", top: "0.75rem", right: "0.75rem", background: "#fef3c7", color: "#92400e", borderRadius: "6px", padding: "0.2rem 0.5rem", fontSize: "0.7rem", fontWeight: 700 }}>⏳ Pending Review</span>
                    : p.badge === "Rejected"
                    ? <span style={{ position: "absolute", top: "0.75rem", right: "0.75rem", background: "#fee2e2", color: "#991b1b", borderRadius: "6px", padding: "0.2rem 0.5rem", fontSize: "0.7rem", fontWeight: 700 }}>✕ Rejected</span>
                    : p.status === "inactive"
                    ? <span style={{ position: "absolute", top: "0.75rem", right: "0.75rem", background: "#f3f4f6", color: "#6b7280", borderRadius: "6px", padding: "0.2rem 0.5rem", fontSize: "0.7rem", fontWeight: 700 }}>⏰ Expired</span>
                    : <span style={{ position: "absolute", top: "0.75rem", right: "0.75rem", background: "#dcfce7", color: "#166534", borderRadius: "6px", padding: "0.2rem 0.5rem", fontSize: "0.7rem", fontWeight: 700 }}>✓ Live</span>
                  }
                  {p.photos?.length > 0 && <span style={{ position: "absolute", bottom: "0.6rem", left: "0.6rem", background: "rgba(0,0,0,0.55)", color: "#fff", borderRadius: "6px", padding: "0.15rem 0.5rem", fontSize: "0.7rem", fontWeight: 600 }}>📸 {p.photos.length}</span>}
                </div>
                <div style={{ padding: "1.25rem" }}>
                  <div style={{ fontWeight: 700, fontSize: "1rem", marginBottom: "0.25rem" }}>{p.name}</div>
                  <div style={{ color: C.muted, fontSize: "0.8rem", marginBottom: "0.75rem" }}>{p.category} · {p.condition || "Good"} condition{p.location ? ` · ${p.location}` : ""}</div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
                    <PriceDisplay p={p} />
                    <div style={{ color: C.muted, fontSize: "0.82rem" }}>⭐ {p.rating?.toFixed(1)} · {p.reviews} reviews</div>
                  </div>
                  {p.status === "inactive" ? (
                    <div style={{ background: "#fef3c7", borderRadius: "10px", padding: "0.6rem 0.75rem", fontSize: "0.8rem", color: "#92400e", fontWeight: 600, textAlign: "center" }}>
                      ⏰ Listing expired — upgrade your plan to reactivate
                    </div>
                  ) : (
                  <div style={{ display: "flex", gap: "0.6rem" }}>
                    <button onClick={() => onEditProduct(p)} style={{ flex: 1, padding: "0.6rem", border: `2px solid ${C.border}`, borderRadius: "10px", background: "#fff", cursor: "pointer", fontWeight: 700, fontFamily: "'Outfit', sans-serif", fontSize: "0.85rem" }}>✏️ Edit</button>
                    <button
                      onClick={() => isMaster && onDeleteProduct(p.id)}
                      disabled={!isMaster}
                      title={!isMaster ? "Only master admin can delete listings" : "Delete listing"}
                      style={{ flex: 1, padding: "0.6rem", border: "none", borderRadius: "10px", background: isMaster ? "rgba(239,68,68,0.08)" : "rgba(0,0,0,0.04)", color: isMaster ? C.red : "#9ca3af", cursor: isMaster ? "pointer" : "not-allowed", fontWeight: 700, fontFamily: "'Outfit', sans-serif", fontSize: "0.85rem", opacity: isMaster ? 1 : 0.5 }}>🗑️ Delete</button>
                  </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Upgrade CTA if near limit — hidden for master */}
        {!isMaster && plan && plan.id !== "business" && myListings.length >= limit * 0.8 && (
          <div style={{ marginTop: "2rem", background: "linear-gradient(135deg, #faf5ff, #f5f3ff)", border: "2px solid #a855f7", borderRadius: "20px", padding: "1.75rem", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "1rem" }}>
            <div>
              <div style={{ fontWeight: 800, fontSize: "1.05rem", marginBottom: "0.25rem" }}>⚡ You're nearing your listing limit!</div>
              <div style={{ color: C.muted, fontSize: "0.88rem" }}>Upgrade your plan to list more products and earn more.</div>
            </div>
            <button onClick={onUpgrade} style={{ background: "#7c3aed", color: "#fff", border: "none", borderRadius: "12px", padding: "0.85rem 1.75rem", cursor: "pointer", fontWeight: 800, fontFamily: "'Outfit', sans-serif" }}>Upgrade Plan →</button>
          </div>
        )}
      </div>
    </>
  );
}

/* ─── Contact Page ─── */
function ContactPage() {
  const [form, setForm] = useState({ name: "", email: "", subject: "", message: "" });
  const [sent, setSent] = useState(false);
  const [focused, setFocused] = useState(null);
  const inp = (id) => ({ width: "100%", border: `1.5px solid ${focused === id ? C.dark : C.border}`, borderRadius: "12px", padding: "0.85rem 1rem", outline: "none", fontSize: "0.95rem", fontFamily: "'Outfit', sans-serif", boxSizing: "border-box", color: C.dark, transition: "border-color 0.2s", background: "#fff" });
  return (
    <>
      <PageHero icon="📬" title="Contact Us" subtitle="We're here to help. Reach out and we'll respond within 24 hours." />
      <Section>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1.6fr", gap: "3rem", alignItems: "start" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
            {[{ icon: "📍", title: "Our Office", lines: ["Rent Circle", "201 Maruti 4, Opp Parivar Party Plot,", "Vasna, Ahmedabad 380007", "Gujarat, India"] }, { icon: "📞", title: "Phone", lines: ["+91 91691 68009", "Mon–Sat, 9 AM – 8 PM IST"] }, { icon: "✉️", title: "Email", lines: ["support@rentcircle.in", "business@rentcircle.in"] }].map(c => (
              <div key={c.title} style={{ background: "#fff", borderRadius: "16px", padding: "1.25rem 1.5rem", border: `1px solid ${C.border}` }}>
                <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "0.6rem" }}><span style={{ fontSize: "1.4rem" }}>{c.icon}</span><span style={{ fontWeight: 700 }}>{c.title}</span></div>
                {c.lines.map((l, i) => <div key={i} style={{ color: C.muted, fontSize: "0.88rem" }}>{l}</div>)}
              </div>
            ))}
            <a href="https://wa.me/919169168009" target="_blank" rel="noreferrer" style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "0.75rem", background: "#25D366", color: "#fff", borderRadius: "16px", padding: "1rem 1.5rem", fontWeight: 800, fontSize: "1rem", textDecoration: "none", boxShadow: "0 4px 16px rgba(37,211,102,0.35)", transition: "transform 0.2s, box-shadow 0.2s" }}
              onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-2px)"; e.currentTarget.style.boxShadow = "0 8px 24px rgba(37,211,102,0.45)"; }}
              onMouseLeave={e => { e.currentTarget.style.transform = ""; e.currentTarget.style.boxShadow = "0 4px 16px rgba(37,211,102,0.35)"; }}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="white"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
              WhatsApp Us
            </a>
          </div>
          <div style={{ background: "#fff", borderRadius: "24px", padding: "2.5rem", boxShadow: "0 4px 20px rgba(0,0,0,0.07)", border: `1px solid ${C.border}` }}>
            {sent ? (
              <div style={{ textAlign: "center", padding: "3rem 0" }}>
                <div style={{ fontSize: "4rem", marginBottom: "1rem" }}>🎉</div>
                <h3 style={{ fontWeight: 800, fontSize: "1.5rem", marginBottom: "0.5rem" }}>Message Sent!</h3>
                <p style={{ color: C.muted }}>We'll reply within 24 hours.</p>
                <button onClick={() => { setSent(false); setForm({ name: "", email: "", subject: "", message: "" }); }} style={{ marginTop: "1.5rem", background: C.dark, color: "#fff", border: "none", borderRadius: "12px", padding: "0.8rem 2rem", cursor: "pointer", fontWeight: 700, fontFamily: "'Outfit', sans-serif" }}>Send Another</button>
              </div>
            ) : (
              <>
                <h3 style={{ fontWeight: 800, fontSize: "1.3rem", marginBottom: "0.25rem" }}>Send a Message</h3>
                <p style={{ color: C.muted, fontSize: "0.88rem", marginBottom: "1.75rem" }}>Fill in the form and our team will get back to you.</p>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem", marginBottom: "0.75rem" }}>
                  <div><label style={{ display: "block", fontSize: "0.78rem", fontWeight: 700, color: C.muted, marginBottom: "0.4rem", textTransform: "uppercase", letterSpacing: "0.05em" }}>Name *</label><input style={inp("n")} placeholder="Your name" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} onFocus={() => setFocused("n")} onBlur={() => setFocused(null)} /></div>
                  <div><label style={{ display: "block", fontSize: "0.78rem", fontWeight: 700, color: C.muted, marginBottom: "0.4rem", textTransform: "uppercase", letterSpacing: "0.05em" }}>Email *</label><input style={inp("e")} type="email" placeholder="your@email.com" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} onFocus={() => setFocused("e")} onBlur={() => setFocused(null)} /></div>
                </div>
                <div style={{ marginBottom: "0.75rem" }}>
                  <label style={{ display: "block", fontSize: "0.78rem", fontWeight: 700, color: C.muted, marginBottom: "0.4rem", textTransform: "uppercase", letterSpacing: "0.05em" }}>Subject</label>
                  <select style={{ ...inp("s"), width: "100%" }} value={form.subject} onChange={e => setForm(f => ({ ...f, subject: e.target.value }))} onFocus={() => setFocused("s")} onBlur={() => setFocused(null)}>
                    <option value="">Select a topic</option>
                    {["Rental Query","Payment Issue","Delivery Problem","Return Request","Product Listing","Account Help","Other"].map(o => <option key={o}>{o}</option>)}
                  </select>
                </div>
                <div style={{ marginBottom: "1.5rem" }}>
                  <label style={{ display: "block", fontSize: "0.78rem", fontWeight: 700, color: C.muted, marginBottom: "0.4rem", textTransform: "uppercase", letterSpacing: "0.05em" }}>Message *</label>
                  <textarea style={{ ...inp("m"), height: "130px", resize: "vertical" }} placeholder="Describe your issue..." value={form.message} onChange={e => setForm(f => ({ ...f, message: e.target.value }))} onFocus={() => setFocused("m")} onBlur={() => setFocused(null)} />
                </div>
                <button onClick={() => { if (form.name && form.email && form.message) setSent(true); }} style={{ width: "100%", background: C.dark, color: "#fff", border: "none", borderRadius: "12px", padding: "1rem", cursor: "pointer", fontWeight: 800, fontFamily: "'Outfit', sans-serif" }}>Send Message →</button>
              </>
            )}
          </div>
        </div>
      </Section>
    </>
  );
}

/* ─── About Page ─── */
function AboutPage({ onAuth }) {
  return (
    <>
      {/* Hero */}
      <PageHero icon="🔵" title="Welcome to Rent Circle" subtitle="A trusted rental platform connecting people who want to rent with those who want to offer products on rent." />

      {/* Welcome / Intro */}
      <Section white>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "3rem", alignItems: "center" }} className="rc-about-grid">
          <div>
            <div style={{ display: "inline-flex", alignItems: "center", gap: "0.5rem", background: "rgba(249,115,22,0.08)", border: `1px solid ${C.border}`, borderRadius: "20px", padding: "0.35rem 1rem", fontSize: "0.78rem", fontWeight: 700, color: C.accent, marginBottom: "1.25rem", textTransform: "uppercase", letterSpacing: "0.06em" }}>
              Who We Are
            </div>
            <h2 style={{ fontSize: "2rem", fontWeight: 900, letterSpacing: "-0.03em", lineHeight: 1.25, marginBottom: "1.25rem", color: C.dark }}>
              Simple. Secure.<br /><span style={{ color: C.gold }}>Convenient.</span>
            </h2>
            <p style={{ color: C.muted, lineHeight: 1.9, marginBottom: "1rem", fontSize: "0.97rem" }}>
              Rent Circle is a trusted rental platform designed to connect people who want to rent products with those who want to offer products on rent. Our platform creates a simple, secure, and convenient space where both renters and product owners can benefit.
            </p>
            <p style={{ color: C.muted, lineHeight: 1.9, fontSize: "0.97rem" }}>
              Whether you are looking to rent items for short-term use or want to earn by listing your products, Rent Circle makes the process smooth and reliable.
            </p>
            {/* Stats row */}
            <div style={{ display: "flex", gap: "2rem", marginTop: "2rem", paddingTop: "1.5rem", borderTop: `1px solid ${C.border}` }}>
              {[["9","Products"],["5,510","Renters"],["100+","Cities"]].map(([n,l]) => (
                <div key={l}>
                  <div style={{ fontSize: "1.7rem", fontWeight: 900, color: C.dark }}>{n}</div>
                  <div style={{ color: C.muted, fontSize: "0.82rem", marginTop: "0.1rem" }}>{l}</div>
                </div>
              ))}
            </div>
          </div>
          {/* Value cards */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
            {[
              { icon: "♻️", title: "Sustainable", desc: "Rent instead of buy — reduce waste and promote smart consumption" },
              { icon: "💰", title: "Affordable", desc: "Access premium products at a fraction of the purchase price" },
              { icon: "🛡️", title: "Secure", desc: "Every transaction is safe, transparent, and fully insured" },
              { icon: "🤝", title: "Reliable", desc: "Trusted by renters and owners across India" },
            ].map(v => (
              <div key={v.title} style={{ background: C.bg, borderRadius: "18px", padding: "1.4rem", border: `1px solid ${C.border}`, transition: "box-shadow 0.2s" }}
                onMouseEnter={e => e.currentTarget.style.boxShadow = "0 8px 24px rgba(0,0,0,0.08)"}
                onMouseLeave={e => e.currentTarget.style.boxShadow = ""}>
                <div style={{ fontSize: "1.75rem", marginBottom: "0.6rem" }}>{v.icon}</div>
                <div style={{ fontWeight: 800, fontSize: "0.95rem", marginBottom: "0.35rem", color: C.dark }}>{v.title}</div>
                <div style={{ color: C.muted, fontSize: "0.8rem", lineHeight: 1.6 }}>{v.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </Section>

      {/* What We Do */}
      <Section>
        <div style={{ textAlign: "center", marginBottom: "2.5rem" }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: "0.5rem", background: "rgba(249,115,22,0.08)", border: `1px solid ${C.border}`, borderRadius: "20px", padding: "0.35rem 1rem", fontSize: "0.78rem", fontWeight: 700, color: C.accent, marginBottom: "1rem", textTransform: "uppercase", letterSpacing: "0.06em" }}>
            What We Do
          </div>
          <h2 style={{ fontSize: "2rem", fontWeight: 900, letterSpacing: "-0.03em", color: C.dark, marginBottom: "0.75rem" }}>Bridging the Gap</h2>
          <p style={{ color: C.muted, maxWidth: "520px", margin: "0 auto", lineHeight: 1.8, fontSize: "0.97rem" }}>
            At Rent Circle, we connect two kinds of people — and make it work seamlessly for both.
          </p>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr auto 1fr", gap: "1.5rem", alignItems: "center", marginBottom: "2.5rem" }}>
          {/* Renters card */}
          <div style={{ background: "#fff", borderRadius: "22px", padding: "2rem", border: `1px solid ${C.border}`, boxShadow: "0 4px 20px rgba(0,0,0,0.05)", textAlign: "center" }}>
            <div style={{ width: "64px", height: "64px", borderRadius: "20px", background: "rgba(37,99,235,0.08)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "2rem", margin: "0 auto 1rem" }}>🙋</div>
            <div style={{ fontWeight: 800, fontSize: "1.1rem", marginBottom: "0.5rem", color: C.dark }}>Renters</div>
            <p style={{ color: C.muted, fontSize: "0.88rem", lineHeight: 1.7 }}>Individuals who need products on rent — for a day, a week, or a month.</p>
            <div style={{ marginTop: "1rem", display: "flex", flexWrap: "wrap", gap: "0.4rem", justifyContent: "center" }}>
              {["Short-term use","Affordable access","No ownership hassle"].map(t => (
                <span key={t} style={{ background: "rgba(37,99,235,0.07)", color: "#2563eb", borderRadius: "20px", padding: "0.25rem 0.7rem", fontSize: "0.75rem", fontWeight: 600 }}>{t}</span>
              ))}
            </div>
          </div>
          {/* Connector */}
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "0.5rem" }}>
            <div style={{ width: "52px", height: "52px", borderRadius: "50%", background: `linear-gradient(135deg, ${C.accent}, ${C.gold})`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.3rem", boxShadow: "0 4px 16px rgba(249,115,22,0.3)" }}>🔄</div>
            <div style={{ fontSize: "0.72rem", fontWeight: 700, color: C.accent, textTransform: "uppercase", letterSpacing: "0.06em", textAlign: "center" }}>Rent<br />Circle</div>
          </div>
          {/* Owners card */}
          <div style={{ background: "#fff", borderRadius: "22px", padding: "2rem", border: `1px solid ${C.border}`, boxShadow: "0 4px 20px rgba(0,0,0,0.05)", textAlign: "center" }}>
            <div style={{ width: "64px", height: "64px", borderRadius: "20px", background: "rgba(16,185,129,0.08)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "2rem", margin: "0 auto 1rem" }}>🏪</div>
            <div style={{ fontWeight: 800, fontSize: "1.1rem", marginBottom: "0.5rem", color: C.dark }}>Owners</div>
            <p style={{ color: C.muted, fontSize: "0.88rem", lineHeight: 1.7 }}>Individuals or businesses who want to list products and earn from their idle assets.</p>
            <div style={{ marginTop: "1rem", display: "flex", flexWrap: "wrap", gap: "0.4rem", justifyContent: "center" }}>
              {["Earn passively","Reach more renters","Simple listing"].map(t => (
                <span key={t} style={{ background: "rgba(16,185,129,0.07)", color: "#059669", borderRadius: "20px", padding: "0.25rem 0.7rem", fontSize: "0.75rem", fontWeight: 600 }}>{t}</span>
              ))}
            </div>
          </div>
        </div>
        {/* Goal banner */}
        <div style={{ background: `linear-gradient(135deg, rgba(249,115,22,0.06), rgba(245,158,11,0.06))`, border: `1px solid ${C.border}`, borderRadius: "18px", padding: "1.5rem 2rem", textAlign: "center" }}>
          <p style={{ color: C.dark, fontSize: "1rem", lineHeight: 1.8, fontWeight: 500 }}>
            Our goal is to promote <strong>smart usage</strong>, <strong>affordability</strong>, and <strong>sustainability</strong> by encouraging renting instead of buying.<br />
            <span style={{ color: C.muted, fontSize: "0.92rem" }}>We believe access is more important than ownership.</span>
          </p>
        </div>
      </Section>

      {/* Mission & Vision */}
      <Section white>
        <div style={{ textAlign: "center", marginBottom: "2.5rem" }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: "0.5rem", background: "rgba(249,115,22,0.08)", border: `1px solid ${C.border}`, borderRadius: "20px", padding: "0.35rem 1rem", fontSize: "0.78rem", fontWeight: 700, color: C.accent, marginBottom: "1rem", textTransform: "uppercase", letterSpacing: "0.06em" }}>
            Our Purpose
          </div>
          <h2 style={{ fontSize: "2rem", fontWeight: 900, letterSpacing: "-0.03em", color: C.dark }}>Mission & Vision</h2>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.5rem" }} className="rc-about-grid">
          {/* Mission */}
          <div style={{ background: `linear-gradient(135deg, ${C.dark} 0%, #16213e 100%)`, borderRadius: "22px", padding: "2.5rem", color: "#fff" }}>
            <div style={{ width: "52px", height: "52px", borderRadius: "16px", background: "rgba(255,255,255,0.1)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.6rem", marginBottom: "1.25rem" }}>🎯</div>
            <div style={{ fontSize: "0.75rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", opacity: 0.5, marginBottom: "0.5rem" }}>Our Mission</div>
            <h3 style={{ fontSize: "1.4rem", fontWeight: 900, marginBottom: "1rem", lineHeight: 1.3 }}>Building a reliable rental marketplace</h3>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
              {[
                "Makes renting easy and transparent",
                "Creates earning opportunities for product owners",
                "Encourages cost-effective and sustainable consumption",
              ].map((item, i) => (
                <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: "0.75rem" }}>
                  <div style={{ width: "22px", height: "22px", borderRadius: "50%", background: C.gold, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.7rem", fontWeight: 900, color: C.dark, flexShrink: 0, marginTop: "1px" }}>✓</div>
                  <span style={{ fontSize: "0.9rem", lineHeight: 1.6, opacity: 0.88 }}>{item}</span>
                </div>
              ))}
            </div>
          </div>
          {/* Vision */}
          <div style={{ background: "#fff", borderRadius: "22px", padding: "2.5rem", border: `1px solid ${C.border}`, boxShadow: "0 4px 20px rgba(0,0,0,0.05)" }}>
            <div style={{ width: "52px", height: "52px", borderRadius: "16px", background: `rgba(249,115,22,0.1)`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.6rem", marginBottom: "1.25rem" }}>🔭</div>
            <div style={{ fontSize: "0.75rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: C.muted, marginBottom: "0.5rem" }}>Our Vision</div>
            <h3 style={{ fontSize: "1.4rem", fontWeight: 900, marginBottom: "1rem", color: C.dark, lineHeight: 1.3 }}>Becoming the leading rental platform</h3>
            <p style={{ color: C.muted, lineHeight: 1.85, fontSize: "0.95rem" }}>
              We aim to become a leading rental platform where people can confidently rent and list products with <strong style={{ color: C.dark }}>trust</strong>, <strong style={{ color: C.dark }}>convenience</strong>, and <strong style={{ color: C.dark }}>security</strong>.
            </p>
            <div style={{ marginTop: "1.5rem", padding: "1rem 1.25rem", background: C.bg, borderRadius: "14px", border: `1px solid ${C.border}` }}>
              <div style={{ fontSize: "0.82rem", color: C.muted, lineHeight: 1.7 }}>
                💡 <em>We believe access is more important than ownership — and we're building the platform that makes that possible across India.</em>
              </div>
            </div>
          </div>
        </div>
      </Section>


      {/* Meet Our Founders */}
      <Section white>
        <div style={{ textAlign: "center", marginBottom: "2.5rem" }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: "0.5rem", background: "rgba(249,115,22,0.08)", border: `1px solid ${C.border}`, borderRadius: "20px", padding: "0.35rem 1rem", fontSize: "0.78rem", fontWeight: 700, color: C.accent, marginBottom: "1rem", textTransform: "uppercase", letterSpacing: "0.06em" }}>
            The Team
          </div>
          <h2 style={{ fontSize: "2rem", fontWeight: 900, letterSpacing: "-0.03em", color: C.dark, marginBottom: "0.75rem" }}>Meet Our Founders</h2>
          <p style={{ color: C.muted, maxWidth: "480px", margin: "0 auto", lineHeight: 1.8, fontSize: "0.97rem" }}>The people behind Rent Circle — driven by a shared vision to make renting simple, smart, and accessible for everyone.</p>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: "2rem", maxWidth: "820px", margin: "0 auto" }}>

          {/* Karishma */}
          <div style={{ background: "#fff", borderRadius: "24px", overflow: "hidden", border: `1px solid ${C.border}`, boxShadow: "0 8px 32px rgba(0,0,0,0.07)", display: "flex", minHeight: "340px", transition: "transform 0.25s, box-shadow 0.25s" }}
            onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-4px)"; e.currentTarget.style.boxShadow = "0 20px 48px rgba(0,0,0,0.13)"; }}
            onMouseLeave={e => { e.currentTarget.style.transform = ""; e.currentTarget.style.boxShadow = "0 8px 32px rgba(0,0,0,0.07)"; }}>
            <div style={{ width: "280px", flexShrink: 0, overflow: "hidden", position: "relative" }}>
              <img src="data:image/jpeg;base64,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" alt="Karishma Meghani" style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "center 10%", display: "block" }} />
            </div>
            <div style={{ padding: "2.5rem 2.25rem", display: "flex", flexDirection: "column", justifyContent: "center", flex: 1 }}>
              <div style={{ display: "inline-flex", alignSelf: "flex-start", background: C.gold, color: C.dark, borderRadius: "20px", padding: "0.3rem 1rem", fontSize: "0.72rem", fontWeight: 800, marginBottom: "1.1rem", letterSpacing: "0.04em" }}>✦ Founder</div>
              <h3 style={{ fontSize: "1.55rem", fontWeight: 900, color: C.dark, marginBottom: "0.3rem", letterSpacing: "-0.02em" }}>Karishma Meghani</h3>
              <div style={{ fontSize: "0.82rem", color: C.accent, fontWeight: 700, marginBottom: "1.25rem", display: "flex", alignItems: "center", gap: "0.4rem" }}>
                <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: C.accent, display: "inline-block" }} />
                Founder, Rent Circle
              </div>
              <p style={{ color: C.muted, fontSize: "0.93rem", lineHeight: 1.9, margin: 0 }}>
                Karishma Meghani founded Rent Circle with a vision to simplify the rental experience and create a platform that benefits both renters and providers.
              </p>
            </div>
          </div>

          {/* Jaimin */}
          <div style={{ background: "#fff", borderRadius: "24px", overflow: "hidden", border: `1px solid ${C.border}`, boxShadow: "0 8px 32px rgba(0,0,0,0.07)", display: "flex", minHeight: "340px", transition: "transform 0.25s, box-shadow 0.25s" }}
            onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-4px)"; e.currentTarget.style.boxShadow = "0 20px 48px rgba(0,0,0,0.13)"; }}
            onMouseLeave={e => { e.currentTarget.style.transform = ""; e.currentTarget.style.boxShadow = "0 8px 32px rgba(0,0,0,0.07)"; }}>
            <div style={{ width: "280px", flexShrink: 0, overflow: "hidden", position: "relative" }}>
              <img src="data:image/jpeg;base64,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" alt="Jaimin Meghani" style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "center 10%", display: "block" }} />
            </div>
            <div style={{ padding: "2.5rem 2.25rem", display: "flex", flexDirection: "column", justifyContent: "center", flex: 1 }}>
              <div style={{ display: "inline-flex", alignSelf: "flex-start", background: C.dark, color: "#fff", borderRadius: "20px", padding: "0.3rem 1rem", fontSize: "0.72rem", fontWeight: 800, marginBottom: "1.1rem", letterSpacing: "0.04em" }}>✦ Co-Founder</div>
              <h3 style={{ fontSize: "1.55rem", fontWeight: 900, color: C.dark, marginBottom: "0.3rem", letterSpacing: "-0.02em" }}>Jaimin Meghani</h3>
              <div style={{ fontSize: "0.82rem", color: C.accent, fontWeight: 700, marginBottom: "1.25rem", display: "flex", alignItems: "center", gap: "0.4rem" }}>
                <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: C.accent, display: "inline-block" }} />
                Co-Founder, Rent Circle
              </div>
              <p style={{ color: C.muted, fontSize: "0.93rem", lineHeight: 1.9, margin: 0 }}>
                Jaimin Meghani co-founded Rent Circle with a mission to build a strong, technology-driven rental ecosystem that empowers users and promotes smart consumption.
              </p>
            </div>
          </div>

        </div>
      </Section>

            {/* CTA */}
      <Section>
        <div style={{ background: `linear-gradient(135deg, ${C.dark} 0%, #16213e 100%)`, borderRadius: "24px", padding: "3.5rem 2rem", textAlign: "center", color: "#fff", position: "relative", overflow: "hidden" }}>
          <div style={{ position: "absolute", inset: 0, background: "radial-gradient(circle at 70% 30%, rgba(245,158,11,0.1) 0%, transparent 60%)" }} />
          <div style={{ position: "relative", zIndex: 1 }}>
            <div style={{ fontSize: "2.5rem", marginBottom: "1rem" }}>🚀</div>
            <h2 style={{ fontSize: "2rem", fontWeight: 900, marginBottom: "0.75rem" }}>Ready to Start Renting?</h2>
            <p style={{ opacity: 0.65, marginBottom: "2rem", maxWidth: "440px", margin: "0 auto 2rem", lineHeight: 1.7 }}>Join 5,510+ renters and owners already using Rent Circle to rent smarter and earn better.</p>
            <button onClick={onAuth} style={{ background: C.gold, border: "none", borderRadius: "14px", padding: "1rem 2.5rem", fontWeight: 800, fontSize: "1.05rem", color: C.dark, cursor: "pointer", fontFamily: "'Outfit', sans-serif", boxShadow: "0 8px 24px rgba(245,158,11,0.35)" }}>Get Started Free →</button>
          </div>
        </div>
      </Section>
    </>
  );
}

/* ─── Policy pages ─── */
function PrivacyPage() {
  return (
    <>
      <PageHero icon="🔒" title="Privacy Policy" subtitle="At Rent Circle, we respect your privacy just like we expect others to respect ours." />

      <Section white>
        <div style={{ maxWidth: "760px", margin: "0 auto" }}>

          {/* Intro */}
          <p style={{ color: C.muted, lineHeight: 1.9, fontSize: "0.97rem", marginBottom: "1.5rem" }}>
            We do not rent, sell, or share your personal information with third parties. This Privacy Policy explains:
          </p>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.6rem", marginBottom: "2.5rem" }}>
            {[
              { icon: "📋", text: "What personal information we collect" },
              { icon: "🎯", text: "How we use that information" },
              { icon: "🤝", text: "With whom it may be shared" },
              { icon: "⚙️", text: "The choices you have regarding your data" },
              { icon: "🔐", text: "The steps we take to protect your information" },
              { icon: "✏️", text: "How you can update or correct your details" },
            ].map(item => (
              <div key={item.text} style={{ display: "flex", alignItems: "flex-start", gap: "0.6rem", background: C.bg, borderRadius: "12px", padding: "0.75rem 1rem", border: `1px solid ${C.border}` }}>
                <span style={{ fontSize: "1rem", flexShrink: 0 }}>{item.icon}</span>
                <span style={{ color: C.muted, fontSize: "0.85rem", lineHeight: 1.6 }}>{item.text}</span>
              </div>
            ))}
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>

            {/* Collection */}
            <PolicySection icon="📋" title="1. Collection of Personal Information">
              <p style={{ marginBottom: "0.75rem" }}>Rent Circle collects email addresses and contact details only from users who:</p>
              <ul style={{ paddingLeft: "1.25rem", display: "flex", flexDirection: "column", gap: "0.4rem", marginBottom: "1rem" }}>
                <li>Subscribe to our newsletters</li>
                <li>Place an order or inquiry through our website</li>
              </ul>
              <p style={{ marginBottom: "0.75rem" }}>The information collected is used for:</p>
              <ul style={{ paddingLeft: "1.25rem", display: "flex", flexDirection: "column", gap: "0.4rem", marginBottom: "1rem" }}>
                <li>Internal review and record keeping</li>
                <li>Improving our website content and services</li>
                <li>Informing users about updates, offers, or important notifications</li>
              </ul>
              <div style={{ background: "rgba(16,185,129,0.07)", border: "1px solid rgba(16,185,129,0.2)", borderRadius: "10px", padding: "0.75rem 1rem", fontSize: "0.88rem", color: "#059669", fontWeight: 600 }}>
                ✓ We do not sell, trade, or publicly share your email address or personal information with any company or individual.
              </div>
              <p style={{ marginTop: "0.75rem", color: C.muted, fontSize: "0.9rem" }}>
                If you subscribe to our email communications, you may unsubscribe at any time using the unsubscribe option provided.
              </p>
            </PolicySection>

            {/* Cookies */}
            <PolicySection icon="🍪" title="2. Cookies">
              <p style={{ marginBottom: "0.75rem" }}>Like most websites, Rent Circle uses browser cookies to enhance user experience. Cookies help us:</p>
              <ul style={{ paddingLeft: "1.25rem", display: "flex", flexDirection: "column", gap: "0.4rem", marginBottom: "1rem" }}>
                <li>Track website activity and user preferences</li>
                <li>Maintain session information during transactions</li>
                <li>Understand traffic patterns to improve our services</li>
              </ul>
              <p style={{ marginBottom: "0.75rem" }}>Cookies do not reveal your name or personal identity unless you voluntarily provide that information.</p>
              <p>You may choose to disable or manage cookies through your browser settings. However, disabling cookies may limit certain features or functionalities of the website.</p>
            </PolicySection>

            {/* Security */}
            <PolicySection icon="🔐" title="3. Security Measures">
              <p style={{ marginBottom: "0.75rem" }}>We take reasonable precautions to protect your personal information from misuse, unauthorized access, or disclosure.</p>
              <p style={{ marginBottom: "0.75rem" }}>However, we may share personal information with government or law enforcement authorities if required by law, such as in response to a subpoena, court order, or official investigation. We fully cooperate with authorities in cases involving suspected illegal activities.</p>
              <p>We also reserve the right to report any activity that we believe, in good faith, to be unlawful.</p>
            </PolicySection>

            {/* Policy Updates */}
            <PolicySection icon="🔄" title="4. Policy Updates">
              <p>Rent Circle reserves the right to update or modify this Privacy Policy at any time. Any changes will be posted on this page with the revised version.</p>
            </PolicySection>

            {/* Contact */}
            <div style={{ background: `linear-gradient(135deg, ${C.dark}, #16213e)`, borderRadius: "20px", padding: "2rem", color: "#fff" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "1.25rem" }}>
                <span style={{ fontSize: "1.4rem" }}>📬</span>
                <h3 style={{ fontWeight: 800, fontSize: "1.05rem" }}>Questions about your privacy?</h3>
              </div>
              <p style={{ opacity: 0.7, fontSize: "0.88rem", marginBottom: "1.25rem" }}>Reach out to us and we'll be happy to help.</p>
              <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                <a href="https://www.rentcircle.co.in" target="_blank" rel="noreferrer" style={{ display: "flex", alignItems: "center", gap: "0.75rem", color: C.gold, fontWeight: 700, textDecoration: "none", fontSize: "0.92rem" }}>
                  🌐 <span>www.rentcircle.co.in</span>
                </a>
                <a href="tel:9169168009" style={{ display: "flex", alignItems: "center", gap: "0.75rem", color: C.gold, fontWeight: 700, textDecoration: "none", fontSize: "0.92rem" }}>
                  📞 <span>+91 91691 68009</span>
                </a>
              </div>
            </div>

          </div>
        </div>
      </Section>
    </>
  );
}
function RefundPage() {
  return (
    <>
      <PageHero icon="💸" title="Refund Policy" subtitle="We aim to provide a smooth and transparent rental experience for both renters and product owners." />

      {/* Effective date + intro */}
      <Section white>
        <div style={{ maxWidth: "760px", margin: "0 auto" }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: "0.5rem", background: "rgba(249,115,22,0.08)", border: `1px solid ${C.border}`, borderRadius: "20px", padding: "0.35rem 1rem", fontSize: "0.78rem", fontWeight: 700, color: C.accent, marginBottom: "1.5rem", letterSpacing: "0.04em" }}>
            📅 Effective Date: 1st March 2026
          </div>
          <p style={{ color: C.muted, lineHeight: 1.9, fontSize: "0.97rem", marginBottom: "2rem" }}>
            Welcome to Rent Circle. This Refund Policy outlines the terms under which refunds may be issued on our platform.
          </p>

          {/* Quick summary cards */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: "1rem", marginBottom: "2.5rem" }}>
            {[
              { icon: "🔒", label: "Security Deposit", desc: "Refunded in 5–7 working days", color: "#2563eb", bg: "rgba(37,99,235,0.07)" },
              { icon: "✅", label: "Pre-Delivery Cancel", desc: "Full refund to renter", color: "#059669", bg: "rgba(5,150,105,0.07)" },
              { icon: "🔄", label: "Owner Cancels", desc: "Full refund guaranteed", color: "#7c3aed", bg: "rgba(124,58,237,0.07)" },
              { icon: "⚠️", label: "Damaged Product", desc: "Report within 24 hours", color: "#d97706", bg: "rgba(217,119,6,0.07)" },
            ].map(c => (
              <div key={c.label} style={{ background: c.bg, borderRadius: "16px", padding: "1.25rem", textAlign: "center", border: `1px solid ${c.color}22` }}>
                <div style={{ fontSize: "1.75rem", marginBottom: "0.5rem" }}>{c.icon}</div>
                <div style={{ fontWeight: 800, fontSize: "0.88rem", color: c.color, marginBottom: "0.3rem" }}>{c.label}</div>
                <div style={{ color: C.muted, fontSize: "0.78rem", lineHeight: 1.5 }}>{c.desc}</div>
              </div>
            ))}
          </div>

          {/* Policy sections */}
          <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>

            <PolicySection icon="🔒" title="1. Security Deposit Refund">
              Security deposits are collected to cover potential damages, late returns, or contract violations.
              <ul style={{ marginTop: "0.75rem", paddingLeft: "1.25rem", display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                <li>If the rented product is returned on time and in the same condition as received, the <strong>full security deposit will be refunded</strong>.</li>
                <li>Refunds will be processed within <strong>5–7 working days</strong> after inspection of the product.</li>
                <li>Any deductions (if applicable) will be clearly communicated with proper justification.</li>
              </ul>
            </PolicySection>

            <PolicySection icon="🙋" title="2. Order Cancellation by Renter">
              <ul style={{ marginTop: "0.5rem", paddingLeft: "1.25rem", display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                <li>If the renter cancels <strong>before product delivery</strong>, a full refund will be issued (excluding payment gateway charges, if any).</li>
                <li>If the renter cancels <strong>after delivery</strong>, the rental amount may not be refundable. Eligibility will depend on the reason for cancellation and approval by Rent Circle.</li>
                <li>Refund processing may take <strong>5–10 working days</strong> depending on the payment method.</li>
              </ul>
            </PolicySection>

            <PolicySection icon="🏪" title="3. Order Cancellation by Product Owner">
              <ul style={{ marginTop: "0.5rem", paddingLeft: "1.25rem", display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                <li>If the product owner cancels after confirmation, the renter will receive a <strong>full refund</strong>.</li>
                <li>Rent Circle may take necessary action against repeated cancellations by product owners.</li>
              </ul>
            </PolicySection>

            <PolicySection icon="📦" title="4. Damaged or Incorrect Product">
              <ul style={{ marginTop: "0.5rem", paddingLeft: "1.25rem", display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                <li>If a renter receives a damaged or incorrect product, they must <strong>notify Rent Circle within 24 hours</strong> of delivery with proper photo/video proof.</li>
                <li>After verification, Rent Circle may arrange a replacement or initiate a refund as applicable.</li>
              </ul>
            </PolicySection>

            <PolicySection icon="⏰" title="5. Late Returns">
              <ul style={{ marginTop: "0.5rem", paddingLeft: "1.25rem", display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                <li>Late returns may result in <strong>additional rental charges</strong>.</li>
                <li>Security deposit refunds may be adjusted accordingly.</li>
              </ul>
            </PolicySection>

            {/* Non-refundable — highlighted differently */}
            <div style={{ background: "rgba(239,68,68,0.05)", border: "1px solid rgba(239,68,68,0.18)", borderRadius: "20px", padding: "1.75rem 2rem" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "1rem" }}>
                <span style={{ fontSize: "1.4rem" }}>🚫</span>
                <h3 style={{ fontWeight: 800, fontSize: "1.05rem", color: C.dark }}>6. Non-Refundable Situations</h3>
              </div>
              <p style={{ color: C.muted, fontSize: "0.9rem", marginBottom: "0.75rem" }}>Refunds will <strong>not</strong> be provided in the following cases:</p>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.6rem" }}>
                {[
                  "Normal wear and tear of the product",
                  "Minor damages not affecting functionality",
                  "Failure to provide required proof for complaints",
                  "Violation of Rent Circle's Terms & Conditions",
                ].map(item => (
                  <div key={item} style={{ display: "flex", alignItems: "flex-start", gap: "0.5rem", background: "rgba(239,68,68,0.06)", borderRadius: "10px", padding: "0.6rem 0.85rem" }}>
                    <span style={{ color: "#ef4444", fontWeight: 800, flexShrink: 0 }}>✕</span>
                    <span style={{ color: C.muted, fontSize: "0.85rem", lineHeight: 1.5 }}>{item}</span>
                  </div>
                ))}
              </div>
            </div>

            <PolicySection icon="💳" title="7. Refund Processing">
              <ul style={{ marginTop: "0.5rem", paddingLeft: "1.25rem", display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                <li>All approved refunds will be processed through the <strong>original mode of payment</strong>.</li>
                <li>Processing time may vary depending on banks and payment providers.</li>
                <li>Rent Circle is not responsible for delays caused by third-party payment gateways.</li>
              </ul>
            </PolicySection>

            {/* Contact */}
            <div style={{ background: `linear-gradient(135deg, ${C.dark}, #16213e)`, borderRadius: "20px", padding: "2rem", color: "#fff" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "1.25rem" }}>
                <span style={{ fontSize: "1.4rem" }}>📬</span>
                <h3 style={{ fontWeight: 800, fontSize: "1.05rem" }}>8. Contact Us</h3>
              </div>
              <p style={{ opacity: 0.7, fontSize: "0.88rem", marginBottom: "1.25rem" }}>For refund-related queries, please reach out to us:</p>
              <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                <a href="https://www.rentcircle.co.in" target="_blank" rel="noreferrer" style={{ display: "flex", alignItems: "center", gap: "0.75rem", color: C.gold, fontWeight: 700, textDecoration: "none", fontSize: "0.92rem" }}>
                  🌐 <span>www.rentcircle.co.in</span>
                </a>
                <a href="tel:9169168009" style={{ display: "flex", alignItems: "center", gap: "0.75rem", color: C.gold, fontWeight: 700, textDecoration: "none", fontSize: "0.92rem" }}>
                  📞 <span>+91 91691 68009</span>
                </a>
              </div>
            </div>

          </div>
        </div>
      </Section>
    </>
  );
}
function TermsPage() {
  return (
    <>
      <PageHero icon="📜" title="Terms & Conditions" subtitle="Please read these terms carefully before accessing or using Rent Circle." />

      <Section white>
        <div style={{ maxWidth: "760px", margin: "0 auto" }}>

          {/* Intro banner */}
          <div style={{ background: `linear-gradient(135deg, rgba(249,115,22,0.06), rgba(245,158,11,0.06))`, border: `1px solid ${C.border}`, borderRadius: "16px", padding: "1.25rem 1.5rem", marginBottom: "2rem", fontSize: "0.92rem", color: C.muted, lineHeight: 1.85 }}>
            These Website Standard Terms and Conditions ("Terms") govern your access to and use of this Website. By accessing or using this Website, you agree to be legally bound by these Terms in their entirety. <strong style={{ color: C.dark }}>Rent Circle is owned and operated by Karishma Jaimin Meghani.</strong>
          </div>

          {/* Eligibility note */}
          <div style={{ display: "flex", gap: "0.75rem", background: "rgba(37,99,235,0.06)", border: "1px solid rgba(37,99,235,0.15)", borderRadius: "14px", padding: "1rem 1.25rem", marginBottom: "2rem" }}>
            <span style={{ fontSize: "1.2rem", flexShrink: 0 }}>⚖️</span>
            <p style={{ color: C.muted, fontSize: "0.88rem", lineHeight: 1.8, margin: 0 }}>
              Access is available only to individuals legally capable of entering binding contracts under the <strong style={{ color: C.dark }}>Indian Contract Act, 1872</strong>. If you are below 18 years of age, you may use the Platform only under the supervision and consent of a parent or legal guardian.
            </p>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>

            <PolicySection icon="📖" title="1. Introduction">
              This Website serves as an online platform enabling users to list and advertise items for rent ("Lender"), interact with potential renters ("Borrowers"), agree upon rental terms, and facilitate payments related to such rental transactions.
            </PolicySection>

            <PolicySection icon="👤" title="2. User Account">
              If you access the Platform, you shall be solely responsible for maintaining the confidentiality of your login credentials, including your display name and password, and for all activities carried out under your account. If any information provided by you is found to be false, inaccurate, outdated, or incomplete, or if we reasonably suspect the same, Rent Circle reserves the right to suspend, terminate, or restrict your access to the Platform at its sole discretion.
            </PolicySection>

            <PolicySection icon="⚠️" title="3. Disclaimer">
              <p style={{ marginBottom: "0.75rem" }}>The Website merely acts as a facilitator for listing rental items, enabling communication between lenders and borrowers, execution of rental agreements, and payment facilitation. Rent Circle does not independently offer any item for rent on its own behalf.</p>
              <ul style={{ paddingLeft: "1.25rem", display: "flex", flexDirection: "column", gap: "0.45rem" }}>
                <li>All obligations and responsibilities of the lender and borrower shall be governed strictly by the agreement executed between them.</li>
                <li>Rent Circle shall not be held liable for any failure or breach of obligations by either party involved in the transaction.</li>
                <li>Both lender and borrower shall be solely responsible for resolving any disputes, claims, or disagreements arising between them.</li>
              </ul>
            </PolicySection>

            <PolicySection icon="💡" title="4. Intellectual Property Rights">
              Unless otherwise stated, Rent Circle owns all intellectual property rights in relation to the Website and the material published on it. All such rights are reserved. You are granted a limited, non-exclusive license to access and view the content available on the Website, subject to compliance with these Terms.
            </PolicySection>

            {/* Restrictions — special highlighted section */}
            <div style={{ background: "rgba(239,68,68,0.04)", border: "1px solid rgba(239,68,68,0.15)", borderRadius: "20px", padding: "1.75rem 2rem" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "1.1rem" }}>
                <span style={{ fontSize: "1.4rem" }}>🚫</span>
                <h3 style={{ fontWeight: 800, fontSize: "1.05rem", color: C.dark }}>5. Restrictions</h3>
              </div>
              <p style={{ color: C.muted, fontSize: "0.88rem", marginBottom: "1rem" }}>You are specifically restricted from:</p>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.55rem" }}>
                {[
                  "Publishing Website material without authorization",
                  "Selling or commercializing any Website material",
                  "Using the Website to damage its functionality or reputation",
                  "Engaging in activities that hinder other users",
                  "Using the Website in violation of applicable laws",
                  "Performing data mining, scraping, or extraction",
                  "Using malware, bots, or automated scripts",
                  "Providing false or misleading information",
                  "Posting defamatory, obscene, or offensive content",
                  "Promoting unlawful activities or causing harm",
                  "Sending unsolicited marketing communications",
                  "Posting content harmful to minors",
                  "Infringing intellectual property or privacy rights",
                  "Advertising counterfeit or illegal products",
                  "Threatening public order or national integrity",
                ].map(item => (
                  <div key={item} style={{ display: "flex", alignItems: "flex-start", gap: "0.5rem", background: "rgba(239,68,68,0.05)", borderRadius: "10px", padding: "0.55rem 0.8rem" }}>
                    <span style={{ color: "#ef4444", fontWeight: 800, flexShrink: 0, fontSize: "0.8rem" }}>✕</span>
                    <span style={{ color: C.muted, fontSize: "0.82rem", lineHeight: 1.5 }}>{item}</span>
                  </div>
                ))}
              </div>
              <p style={{ color: C.muted, fontSize: "0.82rem", marginTop: "1rem", fontStyle: "italic" }}>Failure to comply may result in removal of content, suspension or termination of access, and reporting to appropriate legal authorities.</p>
            </div>

            <PolicySection icon="📝" title="6. User Content">
              "Your Content" refers to any material such as text, images, videos, or audio that you upload or display on the Website. By submitting such content, you grant Rent Circle a worldwide, non-exclusive, royalty-free, and sublicensable license to use, reproduce, modify, publish, and distribute such content across media platforms. You confirm that your content does not infringe upon any third-party rights. Rent Circle reserves the right to remove or modify any user content without prior notice.
            </PolicySection>

            <PolicySection icon="🔒" title="7. Privacy">
              <p style={{ marginBottom: "0.75rem" }}>We collect and process your personal information, including sensitive financial details (if applicable), in accordance with the <strong style={{ color: C.dark }}>Information Technology Act, 2000</strong> and applicable rules. Such information may be stored using reasonable security measures.</p>
              <ul style={{ paddingLeft: "1.25rem", display: "flex", flexDirection: "column", gap: "0.45rem" }}>
                <li>We may share personal data with our affiliated entities for operational or marketing purposes, unless you opt-out.</li>
                <li>We may disclose your personal data where required by law or to comply with legal processes.</li>
                <li>In the event of a merger or acquisition, your personal information may be transferred to the new entity, which shall remain bound by this Privacy Policy.</li>
              </ul>
            </PolicySection>

            <PolicySection icon="❕" title="8. No Warranties">
              This Website is provided on an "as is" and "as available" basis without any warranties, express or implied. Nothing contained herein shall be construed as professional advice.
            </PolicySection>

            <PolicySection icon="🪪" title="9. KYC Compliance">
              Upon request by Rent Circle, you agree to promptly provide any documents or information necessary to comply with applicable legal or regulatory requirements.
            </PolicySection>

            <PolicySection icon="⚖️" title="10. Limitation of Liability">
              The Website may contain third-party content for which we assume no responsibility. All services are provided on an "as is where is" basis. Under no circumstances shall Rent Circle, its directors, officers, or employees be held liable for any loss, damage, or harm arising from your use of the Website or transactions conducted through it.
            </PolicySection>

            <PolicySection icon="🤝" title="11. Indemnification">
              You agree to indemnify and hold Rent Circle harmless from any claims, liabilities, damages, losses, or expenses arising from your breach of these Terms.
            </PolicySection>

            <PolicySection icon="🔧" title="12. Severability">
              If any provision of these Terms is deemed invalid or unenforceable, the remaining provisions shall continue in full force.
            </PolicySection>

            <PolicySection icon="🔄" title="13. Amendment of Terms">
              Rent Circle reserves the right to modify these Terms at any time. Continued use of the Website constitutes acceptance of the revised Terms.
            </PolicySection>

            <PolicySection icon="📄" title="14. Entire Agreement">
              These Terms constitute the complete agreement between you and Rent Circle regarding use of the Website.
            </PolicySection>

            {/* Governing Law — dark card */}
            <div style={{ background: `linear-gradient(135deg, ${C.dark}, #16213e)`, borderRadius: "20px", padding: "2rem", color: "#fff" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "1rem" }}>
                <span style={{ fontSize: "1.4rem" }}>🇮🇳</span>
                <h3 style={{ fontWeight: 800, fontSize: "1.05rem" }}>15. Governing Law & Jurisdiction</h3>
              </div>
              <p style={{ opacity: 0.8, fontSize: "0.92rem", lineHeight: 1.8 }}>
                These Terms shall be governed by the laws of India and subject to the exclusive jurisdiction of courts located in <strong style={{ color: C.gold }}>Ahmedabad, Gujarat, India</strong>.
              </p>
            </div>

          </div>
        </div>
      </Section>
    </>
  );
}

/* ─── Rent Modal Photo Carousel ─── */
function RentPhotoCarousel({ photos, fallback }) {
  const [idx, setIdx] = useState(0);
  if (!photos || photos.length === 0) {
    return <div style={{ height: "220px", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "6rem", background: `linear-gradient(135deg, ${C.bg}, #fff)` }}>{fallback}</div>;
  }
  return (
    <div style={{ position: "relative", height: "260px", background: "#000", flexShrink: 0 }}>
      <img src={photos[idx].url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block", opacity: 0.95 }} />
      {/* Arrows */}
      {photos.length > 1 && <>
        <button onClick={e => { e.stopPropagation(); setIdx(i => (i - 1 + photos.length) % photos.length); }}
          style={{ position: "absolute", left: "0.75rem", top: "50%", transform: "translateY(-50%)", background: "rgba(0,0,0,0.5)", border: "none", borderRadius: "50%", width: "36px", height: "36px", color: "#fff", cursor: "pointer", fontSize: "1rem", display: "flex", alignItems: "center", justifyContent: "center" }}>‹</button>
        <button onClick={e => { e.stopPropagation(); setIdx(i => (i + 1) % photos.length); }}
          style={{ position: "absolute", right: "0.75rem", top: "50%", transform: "translateY(-50%)", background: "rgba(0,0,0,0.5)", border: "none", borderRadius: "50%", width: "36px", height: "36px", color: "#fff", cursor: "pointer", fontSize: "1rem", display: "flex", alignItems: "center", justifyContent: "center" }}>›</button>
      </>}
      {/* Dot indicators */}
      {photos.length > 1 && (
        <div style={{ position: "absolute", bottom: "0.75rem", left: "50%", transform: "translateX(-50%)", display: "flex", gap: "0.4rem" }}>
          {photos.map((_, i) => <div key={i} onClick={e => { e.stopPropagation(); setIdx(i); }} style={{ width: i === idx ? "20px" : "8px", height: "8px", borderRadius: "4px", background: i === idx ? "#fff" : "rgba(255,255,255,0.5)", cursor: "pointer", transition: "all 0.2s" }} />)}
        </div>
      )}
      {/* Counter */}
      <div style={{ position: "absolute", top: "0.75rem", right: "0.75rem", background: "rgba(0,0,0,0.5)", color: "#fff", borderRadius: "20px", padding: "0.25rem 0.65rem", fontSize: "0.75rem", fontWeight: 600 }}>{idx + 1} / {photos.length}</div>
    </div>
  );
}

/* ─── Profile Page ─── */
function ProfilePage({ user, onUpdate, onUpgrade, currentPlan, navigate, availableCities = [] }) {
  const [form, setForm] = useState({
    name: user?.name || "",
    email: user?.email || "",
    phone: user?.phone || "",
    city: user?.city || "",
    bio: user?.bio || "",
  });
  const [focused, setFocused] = useState(null);
  const [saved, setSaved] = useState(false);
  const [tab, setTab] = useState("profile"); // "profile" | "security" | "subscription"

  const inp = (id) => ({
    width: "100%", border: `1.5px solid ${focused === id ? C.dark : C.border}`, borderRadius: "12px",
    padding: "0.8rem 1rem", outline: "none", fontSize: "0.92rem", fontFamily: "'Outfit', sans-serif",
    boxSizing: "border-box", transition: "border-color 0.2s", color: C.dark, background: "#fff",
  });

  const handleSave = () => {
    onUpdate({ ...user, ...form });
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  const initials = (user?.name || "U").split(" ").map(w => w[0]).join("").toUpperCase().slice(0, 2);

  return (
    <>
      <PageHero icon="👤" title="My Profile" subtitle="Manage your personal information and account settings." />
      <div style={{ padding: "3rem 2rem", maxWidth: "900px", margin: "0 auto" }}>

        {/* Tab bar */}
        <div style={{ display: "flex", gap: "0.5rem", marginBottom: "2rem", background: "#fff", borderRadius: "16px", padding: "0.4rem", border: `1px solid ${C.border}`, boxShadow: "0 2px 8px rgba(0,0,0,0.04)", width: "fit-content" }}>
          {[["profile","👤 Profile"],["security","🔒 Security"],["subscription","⭐ Subscription"]].map(([key, label]) => (
            <button key={key} onClick={() => setTab(key)} style={{ padding: "0.55rem 1.25rem", borderRadius: "10px", border: "none", background: tab === key ? C.dark : "transparent", color: tab === key ? "#fff" : C.muted, fontFamily: "'Outfit', sans-serif", fontWeight: tab === key ? 700 : 500, fontSize: "0.88rem", cursor: "pointer", transition: "all 0.2s", whiteSpace: "nowrap" }}>
              {label}
            </button>
          ))}
        </div>

        {/* ── PROFILE TAB ── */}
        {tab === "profile" && (
          <div style={{ display: "grid", gridTemplateColumns: "280px 1fr", gap: "2rem", alignItems: "start" }} className="rc-profile-grid">
            {/* Avatar card */}
            <div style={{ background: "#fff", borderRadius: "24px", padding: "2rem", border: `1px solid ${C.border}`, textAlign: "center", boxShadow: "0 2px 12px rgba(0,0,0,0.05)", position: "sticky", top: "90px" }}>
              <div style={{ width: "96px", height: "96px", borderRadius: "50%", background: currentPlan ? currentPlan.accent : `linear-gradient(135deg, ${C.dark}, #2d3a6e)`, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 900, fontSize: "2rem", margin: "0 auto 1.25rem", boxShadow: "0 8px 24px rgba(0,0,0,0.15)" }}>{initials}</div>
              <div style={{ fontWeight: 800, fontSize: "1.1rem", marginBottom: "0.25rem", color: C.dark }}>{form.name || user?.name}</div>
              <div style={{ color: C.muted, fontSize: "0.82rem", marginBottom: "1rem" }}>{user?.email}</div>
              {currentPlan ? (
                <div style={{ background: currentPlan.color, color: currentPlan.accent, borderRadius: "8px", padding: "0.35rem 0.85rem", fontSize: "0.78rem", fontWeight: 700, display: "inline-block", marginBottom: "1rem" }}>⭐ {currentPlan.name} Plan</div>
              ) : (
                <div onClick={() => onUpgrade()} style={{ background: "#faf5ff", color: "#7c3aed", borderRadius: "8px", padding: "0.35rem 0.85rem", fontSize: "0.78rem", fontWeight: 700, display: "inline-block", marginBottom: "1rem", cursor: "pointer", border: "1px solid rgba(124,58,237,0.2)" }}>🔒 No Plan</div>
              )}
              <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", textAlign: "left", fontSize: "0.82rem", color: C.muted }}>
                {[
                  ["📧", "Email", user?.emailVerified ? "✅ Verified" : "⚠️ Not verified"],
                  ["📱", "Phone", user?.phoneVerified ? "✅ Verified" : "⚠️ Not verified"],
                  ["🗓️", "Member since", "2025"],
                ].map(([icon, label, val]) => (
                  <div key={label} style={{ display: "flex", justifyContent: "space-between", padding: "0.4rem 0", borderBottom: `1px solid ${C.border}` }}>
                    <span>{icon} {label}</span>
                    <span style={{ fontWeight: 600, color: val.includes("✅") ? "#059669" : val.includes("⚠️") ? "#d97706" : C.dark }}>{val}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Form */}
            <div style={{ background: "#fff", borderRadius: "24px", padding: "2rem", border: `1px solid ${C.border}`, boxShadow: "0 2px 12px rgba(0,0,0,0.05)" }}>
              <h3 style={{ fontWeight: 800, fontSize: "1.15rem", marginBottom: "1.5rem", color: C.dark }}>Personal Information</h3>

              {saved && (
                <div style={{ background: "#f0fdf4", border: "1px solid #86efac", borderRadius: "10px", padding: "0.75rem 1rem", marginBottom: "1.25rem", color: "#166534", fontSize: "0.88rem", fontWeight: 600 }}>
                  ✅ Profile updated successfully!
                </div>
              )}

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", marginBottom: "1rem" }}>
                <div>
                  <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 700, color: C.muted, marginBottom: "0.4rem", textTransform: "uppercase", letterSpacing: "0.05em" }}>Full Name</label>
                  <input style={inp("name")} placeholder="Your full name" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} onFocus={() => setFocused("name")} onBlur={() => setFocused(null)} />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 700, color: C.muted, marginBottom: "0.4rem", textTransform: "uppercase", letterSpacing: "0.05em" }}>Email</label>
                  <input style={{ ...inp("email"), background: "#f9fafb", color: C.muted, cursor: "not-allowed" }} value={form.email} readOnly disabled />
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", marginBottom: "1rem" }}>
                <div>
                  <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 700, color: C.muted, marginBottom: "0.4rem", textTransform: "uppercase", letterSpacing: "0.05em" }}>Phone Number</label>
                  <input style={inp("phone")} placeholder="+91 XXXXX XXXXX" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} onFocus={() => setFocused("phone")} onBlur={() => setFocused(null)} />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 700, color: C.muted, marginBottom: "0.4rem", textTransform: "uppercase", letterSpacing: "0.05em" }}>City / Location</label>
                  {availableCities.length > 0 ? (
                    <select style={inp("city")} value={form.city} onChange={e => setForm(f => ({ ...f, city: e.target.value }))} onFocus={() => setFocused("city")} onBlur={() => setFocused(null)}>
                      <option value="">Select city...</option>
                      {availableCities.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  ) : (
                    <input style={inp("city")} placeholder="e.g. Mumbai, Delhi..." value={form.city} onChange={e => setForm(f => ({ ...f, city: e.target.value }))} onFocus={() => setFocused("city")} onBlur={() => setFocused(null)} />
                  )}
                </div>
              </div>

              <div style={{ marginBottom: "1.5rem" }}>
                <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 700, color: C.muted, marginBottom: "0.4rem", textTransform: "uppercase", letterSpacing: "0.05em" }}>Bio <span style={{ fontWeight: 400, textTransform: "none" }}>(optional)</span></label>
                <textarea style={{ ...inp("bio"), height: "100px", resize: "vertical" }} placeholder="Tell other renters a bit about yourself..." value={form.bio} onChange={e => setForm(f => ({ ...f, bio: e.target.value }))} onFocus={() => setFocused("bio")} onBlur={() => setFocused(null)} />
              </div>

              <div style={{ display: "flex", gap: "0.75rem" }}>
                <button onClick={() => navigate("home")} style={{ flex: 1, padding: "0.9rem", border: `2px solid ${C.border}`, borderRadius: "12px", background: "#fff", cursor: "pointer", fontWeight: 700, fontFamily: "'Outfit', sans-serif", color: C.dark }}>Cancel</button>
                <button onClick={handleSave} style={{ flex: 2, padding: "0.9rem", border: "none", borderRadius: "12px", background: C.dark, color: "#fff", cursor: "pointer", fontWeight: 800, fontFamily: "'Outfit', sans-serif", fontSize: "1rem" }}>Save Changes ✓</button>
              </div>
            </div>
          </div>
        )}

        {/* ── SECURITY TAB ── */}
        {tab === "security" && (
          <div style={{ background: "#fff", borderRadius: "24px", padding: "2rem", border: `1px solid ${C.border}`, boxShadow: "0 2px 12px rgba(0,0,0,0.05)", maxWidth: "560px" }}>
            <h3 style={{ fontWeight: 800, fontSize: "1.15rem", marginBottom: "0.5rem", color: C.dark }}>Password & Security</h3>
            <p style={{ color: C.muted, fontSize: "0.88rem", marginBottom: "2rem" }}>Manage your password and account security settings.</p>

            {[
              { label: "Email Verification", status: user?.emailVerified, desc: "Verified accounts get priority support and higher trust scores.", action: user?.emailVerified ? null : "Resend Email", color: "#059669", bg: "#f0fdf4" },
              { label: "Phone Verification", status: user?.phoneVerified, desc: "Adding a verified phone number increases your account security.", action: user?.phoneVerified ? null : "Verify Now", color: "#2563eb", bg: "#eff6ff" },
            ].map(item => (
              <div key={item.label} style={{ background: item.status ? item.bg : "#fff9f0", borderRadius: "14px", padding: "1.25rem 1.5rem", marginBottom: "1rem", border: `1px solid ${item.status ? item.color + "33" : "#d9770633"}`, display: "flex", justifyContent: "space-between", alignItems: "center", gap: "1rem", flexWrap: "wrap" }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: "0.95rem", color: C.dark, marginBottom: "0.2rem" }}>
                    {item.status ? "✅" : "⚠️"} {item.label}
                  </div>
                  <div style={{ color: C.muted, fontSize: "0.82rem" }}>{item.desc}</div>
                </div>
                {item.action && (
                  <button style={{ padding: "0.5rem 1.1rem", border: `1.5px solid ${item.color}`, borderRadius: "10px", background: "#fff", color: item.color, fontFamily: "'Outfit', sans-serif", fontWeight: 700, fontSize: "0.82rem", cursor: "pointer", whiteSpace: "nowrap" }}>{item.action}</button>
                )}
              </div>
            ))}

            <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: "1.5rem", marginTop: "0.5rem" }}>
              <div style={{ fontWeight: 700, fontSize: "0.95rem", marginBottom: "0.4rem", color: C.dark }}>🔑 Change Password</div>
              <p style={{ color: C.muted, fontSize: "0.85rem", marginBottom: "1rem" }}>A password reset link will be sent to your registered email address.</p>
              <button style={{ padding: "0.75rem 1.5rem", border: `2px solid ${C.border}`, borderRadius: "12px", background: "#fff", cursor: "pointer", fontWeight: 700, fontFamily: "'Outfit', sans-serif", color: C.dark }}>Send Reset Link →</button>
            </div>
          </div>
        )}

        {/* ── SUBSCRIPTION TAB ── */}
        {tab === "subscription" && (
          <div style={{ background: "#fff", borderRadius: "24px", padding: "2rem", border: `1px solid ${C.border}`, boxShadow: "0 2px 12px rgba(0,0,0,0.05)" }}>
            <h3 style={{ fontWeight: 800, fontSize: "1.15rem", marginBottom: "0.5rem", color: C.dark }}>Subscription & Billing</h3>
            <p style={{ color: C.muted, fontSize: "0.88rem", marginBottom: "2rem" }}>Your current plan and billing information.</p>

            {currentPlan ? (
              <div>
                <div style={{ background: `linear-gradient(135deg, ${currentPlan.color}, #fff)`, border: `2px solid ${currentPlan.accent}`, borderRadius: "20px", padding: "1.75rem 2rem", marginBottom: "1.5rem", display: "flex", alignItems: "center", justifyContent: "space-between", gap: "1rem", flexWrap: "wrap" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
                    <div style={{ width: "52px", height: "52px", borderRadius: "14px", background: currentPlan.accent, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.5rem" }}>⭐</div>
                    <div>
                      <div style={{ fontWeight: 800, fontSize: "1.2rem", color: C.dark }}>{currentPlan.name} Plan</div>
                      <div style={{ color: C.muted, fontSize: "0.88rem" }}>{INR(currentPlan.price)}/month · Active</div>
                    </div>
                  </div>
                  <div style={{ background: "#fff", borderRadius: "12px", padding: "0.5rem 1.25rem", border: `1px solid ${C.border}` }}>
                    <div style={{ fontSize: "0.72rem", color: C.muted, textTransform: "uppercase", letterSpacing: "0.05em" }}>Renews</div>
                    <div style={{ fontWeight: 700, color: C.dark, fontSize: "0.9rem" }}>Auto renewal</div>
                  </div>
                </div>
                <div style={{ display: "flex", gap: "0.75rem" }}>
                  <button onClick={() => navigate("plans")} style={{ flex: 1, padding: "0.9rem", border: `2px solid ${C.border}`, borderRadius: "12px", background: "#fff", cursor: "pointer", fontWeight: 700, fontFamily: "'Outfit', sans-serif", color: C.dark }}>Upgrade Plan</button>
                  <button onClick={() => navigate("my-listings")} style={{ flex: 2, padding: "0.9rem", border: "none", borderRadius: "12px", background: currentPlan.accent, color: "#fff", cursor: "pointer", fontWeight: 800, fontFamily: "'Outfit', sans-serif" }}>Manage Listings →</button>
                </div>
              </div>
            ) : (
              <div style={{ textAlign: "center", padding: "3rem 2rem", background: "#faf5ff", borderRadius: "20px", border: "2px dashed rgba(124,58,237,0.3)" }}>
                <div style={{ fontSize: "3.5rem", marginBottom: "1rem" }}>🔒</div>
                <h4 style={{ fontWeight: 800, fontSize: "1.2rem", marginBottom: "0.5rem", color: C.dark }}>No Active Subscription</h4>
                <p style={{ color: C.muted, fontSize: "0.9rem", marginBottom: "1.5rem", maxWidth: "380px", margin: "0 auto 1.5rem" }}>Subscribe to a plan to start listing your products and earning on RentCircle.</p>
                <button onClick={() => onUpgrade()} style={{ background: C.dark, color: "#fff", border: "none", borderRadius: "12px", padding: "0.9rem 2.5rem", fontWeight: 800, fontFamily: "'Outfit', sans-serif", cursor: "pointer" }}>View Plans →</button>
              </div>
            )}
          </div>
        )}
      </div>
      <style>{`.rc-profile-grid { display: grid; grid-template-columns: 280px 1fr; gap: 2rem; } @media (max-width: 768px) { .rc-profile-grid { grid-template-columns: 1fr !important; } }`}</style>
    </>
  );
}

/* ─── Main App ─── */
export default function RentCircle() {
  const [activeTab, setActiveTab] = useState("home");
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [allProducts, setAllProducts] = useState(() => readCache()?.data || defaultProducts);
  const [cart, setCart] = useState([]);
  const [cartOpen, setCartOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [rentDays, setRentDays] = useState(1);
  const [rentPeriod, setRentPeriod] = useState("day");
  const [rentStartDate, setRentStartDate] = useState("");
  const [rentEndDate, setRentEndDate] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [notif, setNotif] = useState(null);
  const [authOpen, setAuthOpen] = useState(false);
  const [user, setUser] = useState(null);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [deliveryAddr, setDeliveryAddr] = useState({ name: "", phone: "", address: "", city: "", pincode: "" });
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [addrErrors, setAddrErrors] = useState({});
  const userMenuRef = useRef(null);
  useEffect(() => {
    if (!userMenuOpen) return;
    const handleClickOutside = (e) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target)) setUserMenuOpen(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [userMenuOpen]);
  const [subGateOpen, setSubGateOpen] = useState(false);
  const [addProductOpen, setAddProductOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [sortBy, setSortBy] = useState("popular");
  const [priceMin, setPriceMin] = useState(""); const [priceMax, setPriceMax] = useState("");
  const [filterTag, setFilterTag] = useState(""); const [showFilters, setShowFilters] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);
  const [selectedCity, setSelectedCity] = useState("");
  const [availableCities, setAvailableCities] = useState(() => {
    try { const s = localStorage.getItem('rc_cities'); return s ? JSON.parse(s) : []; } catch { return []; }
  });

  // Load from Supabase (falls back to defaults if unavailable)
  const [flags, setFlags] = useState({ subscriptionPlans: true, tagging: true, smartSearch: true, phoneVerification: true, emailVerification: true, customFields: true });
  const [adminTags, setAdminTags] = useState([]);
  const [adminCategories, setAdminCategories] = useState([]);
  const [customFields, setCustomFields] = useState([]);
  const [plans, setPlans] = useState(DEFAULT_PLANS);

  useEffect(() => {
    // ── Initial load ──────────────────────────────────────
    const _cached = readCache();
    // Helper to sync cities from admin localStorage, fallback to product locations
    const syncCities = (rows) => {
      try {
        const s = localStorage.getItem('rc_cities');
        if (s) {
          const adminCities = JSON.parse(s);
          if (adminCities.length > 0) { setAvailableCities(adminCities); return; }
        }
      } catch {}
      // Fallback: derive from product locations
      if (rows) {
        const cities = [...new Set(rows.map(p => p.location).filter(Boolean).map(c => c.trim()).filter(c => c.length > 0))].sort();
        setAvailableCities(cities);
      }
    };

    if (!_cached || _cached.stale) {
      fetchProducts()
        .then(rows => { setAllProducts(rows); writeCache(rows); syncCities(rows); })
        .catch(() => {})
    } else {
      syncCities(_cached.data || []);
    }
    fetchTags()
      .then(rows => setAdminTags(rows.filter(t => t.active)))
      .catch(() => {})
    fetchCategories()
      .then(rows => setAdminCategories(rows))
      .catch(() => {})
    fetchFlags()
      .then(dbFlags => setFlags(f => ({ ...f, ...dbFlags })))
      .catch(() => {})
    fetchCustomFields()
      .then(rows => setCustomFields(rows.filter(f => f.active)))
      .catch(() => {})
    fetchPlans()
      .then(rows => {
        const mapped = rows.filter(p => p.active !== false).map(dbPlanToFrontend)
        if (mapped.length) setPlans(mapped)
      })
      .catch(() => {})

    // ── Restore master user session on page load ──────────
    try {
      const savedMaster = sessionStorage.getItem('rc_master_session');
      if (savedMaster) {
        setUser(JSON.parse(savedMaster));
      }
    } catch (_) {}

    // ── Auth session: handles page refresh + OAuth + sign-in ──
    const { data: { subscription: authSub } } = onAuthChange((event, session) => {
      console.log('🔐 Auth event:', event, session?.user?.email)

      // Skip Supabase session restore if master user is active
      try {
        if (sessionStorage.getItem('rc_master_session')) return;
      } catch (_) {}

      if ((event === 'INITIAL_SESSION' || event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') && session?.user) {
        const u = session.user
        const displayName = u.user_metadata?.full_name || u.user_metadata?.name || u.email.split('@')[0]
        setUser({
          name: displayName,
          email: u.email,
          avatar: displayName[0].toUpperCase(),
          subscription: null,
          emailVerified: !!u.email_confirmed_at,
          phoneVerified: false,
          supabaseId: u.id,
        })
        setAuthOpen(false)
      }
      if (event === 'INITIAL_SESSION' && !session) {
        // No session on load — ensure user is null
        setUser(null)
      }
      if (event === 'SIGNED_OUT') {
        setUser(null)
      }
    })

    // ── Realtime: re-fetch full list on any change ────────
    const unsubs = [
      subscribeTo('plans', () =>
        fetchPlans()
          .then(rows => {
            const mapped = rows.filter(p => p.active !== false).map(dbPlanToFrontend)
            if (mapped.length) setPlans(mapped)
          })
          .catch(() => {})
      ),
      subscribeTo('products', () =>
        fetchProducts()
          .then(rows => { setAllProducts(rows); writeCache(rows); })
          .catch(() => {})
      ),
      subscribeTo('tags', () =>
        fetchTags()
          .then(rows => setAdminTags(rows.filter(t => t.active)))
          .catch(() => {})
      ),
      subscribeTo('categories', () =>
        fetchCategories()
          .then(rows => setAdminCategories(rows))
          .catch(() => {})
      ),
      subscribeTo('feature_flags', () =>
        fetchFlags()
          .then(dbFlags => setFlags(f => ({ ...f, ...dbFlags })))
          .catch(() => {})
      ),
    ]

    // Cleanup on unmount
    return () => {
      authSub?.unsubscribe()
      unsubs.forEach(fn => fn())
    }
  }, []);

  const showNotif = (msg, type = "success") => { setNotif({ msg, type }); setTimeout(() => setNotif(null), 3000); };
  const handleLogin = (u) => {
    setUser(u);
    setAuthOpen(false);
    // Persist master user across page refreshes
    if (u.isMaster) {
      try { sessionStorage.setItem('rc_master_session', JSON.stringify(u)); } catch (_) {}
    }
    showNotif(`Welcome, ${u.name}! 🎉`);
  };
  const handleLogout = () => {
    setUser(null);
    setUserMenuOpen(false);
    // Clear master session
    try { sessionStorage.removeItem('rc_master_session'); } catch (_) {}
    // Sign out from Supabase too
    supabase.auth.signOut().catch(() => {});
    showNotif("Signed out", "info");
  };
  const navigate = (tab) => { setActiveTab(tab); setUserMenuOpen(false); window.scrollTo({ top: 0, behavior: "smooth" }); };

  const handleSubscribe = (plan) => {
    setUser(u => ({ ...u, subscription: plan.id }));
    setSubGateOpen(false);
    showNotif(`🎉 ${plan.name} plan activated! You can now list your products.`);
    navigate("my-listings");
  };

  const handleListProduct = () => {
    if (!user) { setAuthOpen(true); return; }
    if (!user.subscription && !user.isMaster) { setSubGateOpen(true); return; }
    // Enforce plan max rental (listing) limit
    if (!user.isMaster && user.subscription) {
      const activePlan = plans.find(p => p.id === user.subscription);
      const limit = activePlan ? (activePlan.listingLimit ?? activePlan.rentals ?? Infinity) : Infinity;
      const myCount = allProducts.filter(p => p.ownerEmail === user.email).length;
      if (limit !== Infinity && limit >= 0 && myCount >= limit) {
        showNotif(`⚠️ Your ${activePlan?.name || ""} plan allows max ${limit} listing${limit !== 1 ? "s" : ""}. Upgrade to add more.`, "error");
        return;
      }
    }
    setAddProductOpen(true);
  };

  const handleSaveProduct = async (product) => {
    try {
      // Build DB-compatible object (matches Admin's saveProduct shape)
      const dbData = {
        name: product.name,
        category: product.category,
        price: product.priceDay,
        priceDay: product.priceDay,
        priceMonth: product.priceMonth,
        priceYear: product.priceYear,
        description: product.description || "",
        image: product.image || "📦",
        condition: product.condition || "Good",
        location: product.location || "",
        tags: product.tags || [],
        photos: product.photos || [],
        stock: product.stock ?? 1,
        rentals: product.rentals ?? 0,
        rating: product.rating ?? 5.0,
        reviews: product.reviews ?? 0,
        owner: product.owner,
        ownerEmail: product.ownerEmail,
        status: "active",
        badge: "Pending Review",
      };

      if (editingProduct) {
        await updateProductInDb(editingProduct.id, dbData);
        setAllProducts(prev => { const next = prev.map(p => p.id === editingProduct.id ? { ...p, ...product } : p); writeCache(next); return next; });
        showNotif("Product updated successfully! ✓");
      } else {
        const inserted = await insertProduct(dbData);
        const newProduct = inserted ? fromDbProduct(inserted) : { ...product, id: Date.now() };
        setAllProducts(prev => { const next = [...prev, newProduct]; writeCache(next); return next; });
        showNotif("Product submitted for review! ⏳ Admin will approve it shortly.");
      }
    } catch (e) {
      console.error("Save product error:", e);
      showNotif("Failed to save product: " + (e.message || "Unknown error"), "error");
    }
    setAddProductOpen(false);
    setEditingProduct(null);
    navigate("my-listings");
  };

  const handleDeleteProduct = async (id) => {
    try {
      await deleteProductInDb(id);
    } catch (e) {
      console.error("Delete product error:", e);
    }
    setAllProducts(prev => { const next = prev.filter(p => p.id !== id); writeCache(next); return next; });
    showNotif("Listing removed", "info");
  };

  const handlePlanSubscribe = (plan) => {
    // Called from plans section directly
    if (!user) { setAuthOpen(true); return; }
    setSubGateOpen(true);
  };

  const addToCart = (product, days = 1) => {
    if (!user) { setAuthOpen(true); return; }
    // Master user can order without a subscription plan
    setCart(prev => { const ex = prev.find(i => i.id === product.id); if (ex) return prev.map(i => i.id === product.id ? { ...i, days: i.days + days } : i); return [...prev, { ...product, days }]; });
    showNotif(`${product.name} added to cart!`);
    setSelectedProduct(null);
  };

  // Keep availableCities in sync with admin localStorage settings
  useEffect(() => {
    const handleStorage = (e) => {
      if (e && e.key !== 'rc_cities') return;
      try {
        const s = localStorage.getItem('rc_cities');
        if (s) {
          const adminCities = JSON.parse(s);
          if (adminCities.length > 0) { setAvailableCities(adminCities); return; }
        }
      } catch {}
      // Fallback to product-based cities
      const cities = [...new Set(allProducts.map(p => p.location).filter(Boolean).map(c => c.trim()).filter(c => c.length > 0))].sort();
      setAvailableCities(cities);
    };
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, [allProducts]);

  const filteredProducts = useMemo(() => {
    let result = allProducts.filter(p => {
      // Never show products pending admin approval in the public browse grid
      if (p.badge === "Pending Review") return false;
      // Never show expired/inactive products in the public catalogue
      if (p.status === "inactive") return false;
      const matchCity = !selectedCity || (p.location || "").trim().toLowerCase() === selectedCity.toLowerCase();
      const matchCat = selectedCategory === "All" || p.category === selectedCategory;
      const matchSearch = !searchQuery || p.name.toLowerCase().includes(searchQuery.toLowerCase()) || p.category.toLowerCase().includes(searchQuery.toLowerCase()) || (p.description || "").toLowerCase().includes(searchQuery.toLowerCase());
      const matchMin = !priceMin || (p.priceDay || p.price) >= Number(priceMin);
      const matchMax = !priceMax || (p.priceDay || p.price) <= Number(priceMax);
      const matchTag = !filterTag || (p.tags || []).includes(Number(filterTag)) || (p.badge && p.badge.toLowerCase().includes(filterTag.toLowerCase()));
      return matchCity && matchCat && matchSearch && matchMin && matchMax && matchTag;
    });
    switch (sortBy) {
      case "price_asc": result = [...result].sort((a,b) => (a.priceDay||a.price||0) - (b.priceDay||b.price||0)); break;
      case "price_desc": result = [...result].sort((a,b) => (b.priceDay||b.price||0) - (a.priceDay||a.price||0)); break;
      case "rating": result = [...result].sort((a,b) => (b.rating||0) - (a.rating||0)); break;
      case "newest": result = [...result].sort((a,b) => b.id - a.id); break;
      default: result = [...result].sort((a,b) => (b.reviews||0) - (a.reviews||0)); break;
    }
    return result;
  }, [allProducts, selectedCity, selectedCategory, searchQuery, priceMin, priceMax, filterTag, sortBy]);
  const cartTotal = cart.reduce((s, i) => s + (i.priceDay || i.price || 0) * i.days, 0);
  const currentPlan = plans.find(p => p.id === user?.subscription);
  const navStyle = (tab) => ({ cursor: "pointer", opacity: activeTab === tab ? 1 : 0.65, fontSize: "0.88rem", fontWeight: activeTab === tab ? 700 : 500, color: "#fff", paddingBottom: "2px", borderBottom: activeTab === tab ? `2px solid ${C.gold}` : "2px solid transparent", transition: "all 0.2s", whiteSpace: "nowrap" });

  /* Footer */
  const Footer = () => (
    <footer style={{ background: C.dark, color: "#fff", padding: "4rem 2rem 2rem" }}>
      <div style={{ maxWidth: "1200px", margin: "0 auto" }}>
        <div className="rc-footer-grid">
          <div>
            <div style={{ background: "#fff", borderRadius: "10px", padding: "6px 12px", display: "inline-block", marginBottom: "1rem" }}>
              <img src={LOGO_SRC} alt="RentCircle" style={{ height: "38px", display: "block" }} />
            </div>
            <p style={{ opacity: 0.55, fontSize: "0.88rem", lineHeight: 1.7, maxWidth: "260px" }}>India's most trusted product rental platform. Delivering premium products pan-India since 2025.</p>
            <div style={{ display: "flex", gap: "0.6rem", marginTop: "1.25rem" }}>
              {["𝕏", "📸", "💼", "▶️"].map((icon, i) => <div key={i} style={{ width: "34px", height: "34px", background: "rgba(255,255,255,0.08)", borderRadius: "8px", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", fontSize: "0.9rem" }}>{icon}</div>)}
              <a href="https://wa.me/919169168009" target="_blank" rel="noreferrer"
                style={{ width: "34px", height: "34px", background: "#25D366", borderRadius: "8px", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", textDecoration: "none", flexShrink: 0 }}
                title="WhatsApp Us">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="white"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
              </a>
            </div>
          </div>
          <div>
            <div style={{ fontWeight: 800, marginBottom: "1.25rem", fontSize: "0.9rem", textTransform: "uppercase", letterSpacing: "0.08em", color: C.gold }}>Company</div>
            {[["about","About Us"],["contact","Contact Us"]].map(([tab, label]) => <div key={label} onClick={() => navigate(tab)} style={{ color: "rgba(255,255,255,0.55)", fontSize: "0.88rem", marginBottom: "0.7rem", cursor: "pointer" }} onMouseEnter={e => e.currentTarget.style.color="#fff"} onMouseLeave={e => e.currentTarget.style.color="rgba(255,255,255,0.55)"}>{label}</div>)}
          </div>
          <div>
            <div style={{ fontWeight: 800, marginBottom: "1.25rem", fontSize: "0.9rem", textTransform: "uppercase", letterSpacing: "0.08em", color: C.gold }}>For Owners</div>
            {[["my-listings","List Your Product"],["plans","View Plans"],["my-listings","My Listings"],["contact","Seller Support"]].map(([tab, label]) => <div key={label} onClick={() => navigate(tab)} style={{ color: "rgba(255,255,255,0.55)", fontSize: "0.88rem", marginBottom: "0.7rem", cursor: "pointer" }} onMouseEnter={e => e.currentTarget.style.color="#fff"} onMouseLeave={e => e.currentTarget.style.color="rgba(255,255,255,0.55)"}>{label}</div>)}
          </div>
          <div>
            <div style={{ fontWeight: 800, marginBottom: "1.25rem", fontSize: "0.9rem", textTransform: "uppercase", letterSpacing: "0.08em", color: C.gold }}>Legal</div>
            {[["privacy","Privacy Policy"],["terms","Terms & Conditions"],["refund","Refund Policy"],["contact","Contact"]].map(([tab, label]) => <div key={label} onClick={() => navigate(tab)} style={{ color: "rgba(255,255,255,0.55)", fontSize: "0.88rem", marginBottom: "0.7rem", cursor: "pointer" }} onMouseEnter={e => e.currentTarget.style.color="#fff"} onMouseLeave={e => e.currentTarget.style.color="rgba(255,255,255,0.55)"}>{label}</div>)}
          </div>
        </div>
        <div style={{ borderTop: "1px solid rgba(255,255,255,0.1)", paddingTop: "1.5rem", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "1rem" }}>
          <div style={{ opacity: 0.4, fontSize: "0.82rem" }}>© 2025 RentCircle Pvt. Ltd. · Made with ❤️ in India 🇮🇳</div>
          <div style={{ display: "flex", gap: "1.5rem" }}>
            {[["privacy","Privacy"],["terms","Terms"],["refund","Refunds"],["contact","Contact"]].map(([tab, label]) => <span key={label} onClick={() => navigate(tab)} style={{ opacity: 0.4, fontSize: "0.82rem", cursor: "pointer" }} onMouseEnter={e => e.currentTarget.style.opacity=1} onMouseLeave={e => e.currentTarget.style.opacity=0.4}>{label}</span>)}
          </div>
          <div style={{ fontSize: "0.82rem", opacity: 0.55 }}>
            Powered by{" "}
            <a href="https://www.matrixtechnolabs.com" target="_blank" rel="noreferrer" style={{ color: C.gold, fontWeight: 700, textDecoration: "none", opacity: 1 }}
              onMouseEnter={e => e.currentTarget.style.textDecoration = "underline"}
              onMouseLeave={e => e.currentTarget.style.textDecoration = "none"}>
              Matrix Technolabs
            </a>
          </div>
        </div>
      </div>

      {/* Floating WhatsApp button */}
      <a href="https://wa.me/919169168009" target="_blank" rel="noreferrer"
        style={{ position: "fixed", bottom: "1.75rem", right: "1.75rem", width: "58px", height: "58px", borderRadius: "50%", background: "#25D366", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 6px 24px rgba(37,211,102,0.5)", zIndex: 999, textDecoration: "none", transition: "transform 0.2s, box-shadow 0.2s" }}
        title="WhatsApp Us: +91 91691 68009"
        onMouseEnter={e => { e.currentTarget.style.transform = "scale(1.12)"; e.currentTarget.style.boxShadow = "0 10px 32px rgba(37,211,102,0.65)"; }}
        onMouseLeave={e => { e.currentTarget.style.transform = ""; e.currentTarget.style.boxShadow = "0 6px 24px rgba(37,211,102,0.5)"; }}>
        <svg width="28" height="28" viewBox="0 0 24 24" fill="white"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
      </a>
    </footer>
  );

  const renderPage = () => {
    if (activeTab === "contact") return <ContactPage />;
    if (activeTab === "about") return <AboutPage onAuth={() => setAuthOpen(true)} />;
    if (activeTab === "privacy") return <PrivacyPage />;
    if (activeTab === "refund") return <RefundPage />;
    if (activeTab === "terms") return <TermsPage />;
    if (activeTab === "profile") {
      if (!user) { navigate("home"); return null; }
      return <ProfilePage user={user} onUpdate={(u) => { setUser(u); showNotif("Profile updated! ✓"); }} onUpgrade={() => setSubGateOpen(true)} currentPlan={currentPlan} navigate={navigate} availableCities={availableCities} />;
    }
    if (activeTab === "my-orders") {
      if (!user) { navigate("home"); return null; }
      return <MyOrdersPage user={user} allProducts={allProducts} />;
    }
    if (activeTab === "my-listings") {
      if (!user) { return (
        <div style={{ padding: "6rem 2rem", textAlign: "center" }}>
          <div style={{ fontSize: "4rem", marginBottom: "1rem" }}>🔐</div>
          <h2 style={{ fontWeight: 900, fontSize: "1.75rem", marginBottom: "0.75rem" }}>Sign in to manage listings</h2>
          <p style={{ color: C.muted, marginBottom: "1.5rem" }}>You need to be signed in to view your listings.</p>
          <button onClick={() => setAuthOpen(true)} style={{ background: C.dark, color: "#fff", border: "none", borderRadius: "14px", padding: "1rem 2.5rem", fontWeight: 800, fontFamily: "'Outfit', sans-serif", cursor: "pointer" }}>Sign In / Sign Up</button>
        </div>
      ); }
      return <MyListingsPage user={user} allProducts={allProducts} plans={plans} onAddProduct={() => setAddProductOpen(true)} onEditProduct={(p) => { setEditingProduct(p); setAddProductOpen(true); }} onDeleteProduct={handleDeleteProduct} onUpgrade={() => setSubGateOpen(true)} navigate={navigate} />;
    }

    return (
      <>
        {/* HERO */}
        {(activeTab === "home" || activeTab === "products") && (
          <>
            {/* Hero - cinematic split layout */}
            <div style={{ background: `linear-gradient(135deg, #0d0d1a 0%, #1a0a3e 40%, #0f3460 100%)`, color: "#fff", padding: "0", position: "relative", overflow: "hidden", minHeight: "520px", display: "flex", alignItems: "center" }}>
              {/* Animated background blobs */}
              <div style={{ position: "absolute", inset: 0, overflow: "hidden", pointerEvents: "none" }}>
                <div style={{ position: "absolute", width: "600px", height: "600px", borderRadius: "50%", background: "radial-gradient(circle, rgba(245,158,11,0.12) 0%, transparent 70%)", top: "-150px", right: "-100px" }} />
                <div style={{ position: "absolute", width: "400px", height: "400px", borderRadius: "50%", background: "radial-gradient(circle, rgba(124,58,237,0.15) 0%, transparent 70%)", bottom: "-100px", left: "10%" }} />
                <div style={{ position: "absolute", width: "300px", height: "300px", borderRadius: "50%", background: "radial-gradient(circle, rgba(16,185,129,0.08) 0%, transparent 70%)", top: "30%", left: "40%" }} />
                {/* Grid overlay */}
                <div style={{ position: "absolute", inset: 0, backgroundImage: "linear-gradient(rgba(255,255,255,0.02) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.02) 1px, transparent 1px)", backgroundSize: "60px 60px" }} />
              </div>

              <div className="rc-hero-inner" style={{ maxWidth: "1200px", margin: "0 auto", padding: "5rem 2rem 5rem", width: "100%", alignItems: "center", position: "relative", zIndex: 1 }}>
                {/* Left: Text Content */}
                <div>
                  <div style={{ display: "inline-flex", alignItems: "center", gap: "0.5rem", background: "rgba(245,158,11,0.12)", color: C.gold, borderRadius: "50px", padding: "0.4rem 1rem", fontSize: "0.82rem", fontWeight: 700, marginBottom: "1.75rem", border: "1px solid rgba(245,158,11,0.25)" }}>
                    <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: C.gold, display: "inline-block", animation: "rc-pulse 2s infinite" }} />
                    India's #1 Rental Platform · 5,510+ Happy Renters
                  </div>
                  <h1 style={{ fontSize: "clamp(2.6rem, 5vw, 4.2rem)", fontWeight: 900, letterSpacing: "-0.04em", lineHeight: 1.05, marginBottom: "1.5rem" }}>
                    Rent Premium<br />
                    <span style={{ background: `linear-gradient(135deg, ${C.gold}, #fbbf24)`, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>Products</span><br />
                    Delivered Fast
                  </h1>
                  <p style={{ fontSize: "1.1rem", color: "rgba(255,255,255,0.65)", maxWidth: "420px", lineHeight: 1.75, marginBottom: "2.25rem" }}>
                    Cameras, bikes, gadgets, gear — access anything you need without the ownership burden. Delivered pan-India.
                  </p>
                  {/* CTA row */}
                  <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap", marginBottom: "2.5rem" }}>
                    <button onClick={() => navigate("products")} style={{ background: C.gold, color: C.dark, border: "none", borderRadius: "14px", padding: "0.9rem 2rem", cursor: "pointer", fontWeight: 800, fontSize: "1rem", fontFamily: "'Outfit', sans-serif", boxShadow: "0 8px 25px rgba(245,158,11,0.4)", transition: "all 0.2s" }}
                      onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-2px)"; e.currentTarget.style.boxShadow = "0 12px 35px rgba(245,158,11,0.5)"; }}
                      onMouseLeave={e => { e.currentTarget.style.transform = ""; e.currentTarget.style.boxShadow = "0 8px 25px rgba(245,158,11,0.4)"; }}>
                      Browse Products →
                    </button>
                    <button onClick={handleListProduct} style={{ background: "rgba(255,255,255,0.08)", color: "#fff", border: "1.5px solid rgba(255,255,255,0.2)", borderRadius: "14px", padding: "0.9rem 1.75rem", cursor: "pointer", fontWeight: 700, fontSize: "1rem", fontFamily: "'Outfit', sans-serif", backdropFilter: "blur(6px)", transition: "all 0.2s" }}
                      onMouseEnter={e => e.currentTarget.style.background = "rgba(255,255,255,0.14)"}
                      onMouseLeave={e => e.currentTarget.style.background = "rgba(255,255,255,0.08)"}>
                      🏪 List & Earn
                    </button>
                  </div>
                  {/* Trust badges */}
                  <div style={{ display: "flex", gap: "1.5rem", flexWrap: "wrap" }}>
                    {[["🔒","Secure Payments"],["🚚","Same-day Delivery"],["⭐","4.9★ Rated"]].map(([icon, label]) => (
                      <div key={label} style={{ display: "flex", alignItems: "center", gap: "0.4rem", color: "rgba(255,255,255,0.5)", fontSize: "0.8rem" }}>
                        <span>{icon}</span><span>{label}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Right: Visual showcase */}
                <div style={{ display: "flex", flexDirection: "column", gap: "1rem", position: "relative" }} className="rc-hero-right">
                  {/* Search bar floating */}
                  <div style={{ background: "rgba(255,255,255,0.95)", borderRadius: "16px", padding: "0.6rem 1rem", display: "flex", alignItems: "center", gap: "0.75rem", boxShadow: "0 20px 60px rgba(0,0,0,0.4)", backdropFilter: "blur(12px)" }}>
                    <span style={{ fontSize: "1.1rem" }}>🔍</span>
                    <input style={{ flex: 1, border: "none", outline: "none", fontSize: "0.95rem", background: "transparent", color: C.dark, fontFamily: "'Outfit', sans-serif" }} placeholder="Search cameras, bikes, laptops..." value={searchQuery} onChange={e => { setSearchQuery(e.target.value); setActiveTab("products"); }} />
                    <button style={{ background: C.dark, color: "#fff", border: "none", borderRadius: "10px", padding: "0.55rem 1.25rem", cursor: "pointer", fontWeight: 700, fontFamily: "'Outfit', sans-serif", fontSize: "0.88rem", whiteSpace: "nowrap" }}>Search</button>
                  </div>
                  {/* Product cards grid */}
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
                    {[
                      { emoji: "📷", name: "Sony A7 III", price: "₹2,099", label: "Popular", bg: "linear-gradient(135deg, #1e1b4b, #312e81)" },
                      { emoji: "🚁", name: "DJI Mavic 3", price: "₹3,799", label: "Hot", bg: "linear-gradient(135deg, #1c1917, #292524)" },
                      { emoji: "💻", name: "MacBook Pro", price: "₹2,899", label: "Top Rated", bg: "linear-gradient(135deg, #0c4a6e, #075985)" },
                      { emoji: "🎮", name: "PS5 Console", price: "₹999", label: "Popular", bg: "linear-gradient(135deg, #14532d, #166534)" },
                    ].map(card => (
                      <div key={card.name} onClick={() => navigate("products")} style={{ background: card.bg, borderRadius: "14px", padding: "1rem", cursor: "pointer", transition: "transform 0.2s", border: "1px solid rgba(255,255,255,0.08)" }}
                        onMouseEnter={e => e.currentTarget.style.transform = "translateY(-3px)"}
                        onMouseLeave={e => e.currentTarget.style.transform = ""}>
                        <div style={{ fontSize: "2rem", marginBottom: "0.5rem" }}>{card.emoji}</div>
                        <div style={{ fontWeight: 700, fontSize: "0.85rem", marginBottom: "0.15rem" }}>{card.name}</div>
                        <div style={{ color: C.gold, fontWeight: 800, fontSize: "0.9rem" }}>{card.price}<span style={{ color: "rgba(255,255,255,0.45)", fontSize: "0.72rem", fontWeight: 400 }}>/day</span></div>
                        <div style={{ marginTop: "0.4rem", background: "rgba(255,255,255,0.1)", display: "inline-block", borderRadius: "4px", padding: "0.1rem 0.4rem", fontSize: "0.65rem", fontWeight: 700, color: C.gold }}>{card.label}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Bottom wave */}
              <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: "40px", background: C.bg, clipPath: "ellipse(55% 100% at 50% 100%)" }} />
            </div>

            {/* Stats bar */}
            <div style={{ background: "#fff", display: "flex", justifyContent: "center", gap: "0", borderBottom: `1px solid ${C.border}`, flexWrap: "wrap" }}>
              {[["9","Products Available","📦"],["5,510","Happy Renters","😊"],["4.9★","Average Rating","⭐"],["2hr","Avg Delivery","🚚"],["₹999","Starting Price","💰"]].map(([n,l,icon], i) => (
                <div key={l} className="rc-stat-item" style={{ textAlign: "center", padding: "1.25rem 2.5rem", borderRight: i < 4 ? `1px solid ${C.border}` : "none", minWidth: "160px" }}>
                  <div style={{ fontSize: "0.9rem", marginBottom: "0.2rem" }}>{icon}</div>
                  <div style={{ fontSize: "1.5rem", fontWeight: 800, color: C.dark }}>{n}</div>
                  <div style={{ fontSize: "0.75rem", color: C.muted, marginTop: "0.1rem" }}>{l}</div>
                </div>
              ))}
            </div>
          </>
        )}

        {/* ── FEATURED BANNER ── */}
        {activeTab === "home" && (() => {
          const featTag = adminTags.find(t => t.isBannerTag && t.active);
          if (!featTag) return null;
          const featuredProducts = allProducts.filter(p =>
            (p.tags || []).map(Number).includes(Number(featTag.id))
          ).slice(0, featTag.maxProducts || 4);
          if (!featuredProducts.length) return null;
          const tag = featTag;
          return (
            <div style={{ background: `linear-gradient(135deg, #1a0a3e 0%, #0f172a 60%, #1a1a2e 100%)`, padding: "4rem 2rem", position: "relative", overflow: "hidden" }}>
              {/* Background glows */}
              <div style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
                <div style={{ position: "absolute", width: "500px", height: "500px", borderRadius: "50%", background: "radial-gradient(circle, rgba(245,158,11,0.08) 0%, transparent 70%)", top: "-150px", right: "-100px" }} />
                <div style={{ position: "absolute", width: "300px", height: "300px", borderRadius: "50%", background: "radial-gradient(circle, rgba(124,58,237,0.1) 0%, transparent 70%)", bottom: "-80px", left: "5%" }} />
              </div>
              <div style={{ maxWidth: "1200px", margin: "0 auto", position: "relative", zIndex: 1 }}>
                {/* Header */}
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "2rem", flexWrap: "wrap", gap: "1rem" }}>
                  <div>
                    <div style={{ display: "inline-flex", alignItems: "center", gap: "0.5rem", background: "rgba(245,158,11,0.15)", color: C.gold, borderRadius: "50px", padding: "0.35rem 1rem", fontSize: "0.78rem", fontWeight: 700, marginBottom: "0.75rem", border: "1px solid rgba(245,158,11,0.3)" }}>
                      <span>{tag.emoji}</span> {tag.name} Picks
                    </div>
                    <h2 style={{ fontSize: "clamp(1.6rem, 3vw, 2.2rem)", fontWeight: 900, color: "#fff", letterSpacing: "-0.03em", margin: 0 }}>Handpicked Just for You</h2>
                    <p style={{ color: "rgba(255,255,255,0.5)", marginTop: "0.4rem", fontSize: "0.92rem" }}>Our top {featuredProducts.length} admin-curated products this season</p>
                  </div>
                  <button onClick={() => setActiveTab("products")} style={{ background: "rgba(255,255,255,0.08)", color: "#fff", border: "1.5px solid rgba(255,255,255,0.2)", borderRadius: "12px", padding: "0.65rem 1.4rem", cursor: "pointer", fontWeight: 700, fontSize: "0.88rem", fontFamily: "'Outfit', sans-serif", backdropFilter: "blur(6px)", transition: "all 0.2s", whiteSpace: "nowrap" }}
                    onMouseEnter={e => e.currentTarget.style.background = "rgba(255,255,255,0.15)"}
                    onMouseLeave={e => e.currentTarget.style.background = "rgba(255,255,255,0.08)"}>
                    View All →
                  </button>
                </div>
                {/* Cards grid */}
                <div style={{ display: "flex", flexWrap: "wrap", gap: "1.25rem", justifyContent: "center" }}>
                  {featuredProducts.map((p, idx) => (
                    <div key={p.id}
                      onClick={() => { setSelectedProduct(p); setRentPeriod("day"); setRentDays(1); setRentStartDate(""); setRentEndDate(""); }}
                      style={{ background: "rgba(255,255,255,0.06)", borderRadius: "20px", border: "1.5px solid rgba(255,255,255,0.1)", padding: "1.5rem", cursor: "pointer", transition: "all 0.25s", backdropFilter: "blur(8px)", position: "relative", overflow: "hidden", width: "280px", flexShrink: 0 }}
                      onMouseEnter={e => { e.currentTarget.style.background = "rgba(255,255,255,0.11)"; e.currentTarget.style.transform = "translateY(-4px)"; e.currentTarget.style.borderColor = "rgba(245,158,11,0.5)"; }}
                      onMouseLeave={e => { e.currentTarget.style.background = "rgba(255,255,255,0.06)"; e.currentTarget.style.transform = ""; e.currentTarget.style.borderColor = "rgba(255,255,255,0.1)"; }}>
                      {/* Rank badge */}
                      <div style={{ position: "absolute", top: "1rem", right: "1rem", width: "28px", height: "28px", background: idx === 0 ? C.gold : "rgba(255,255,255,0.12)", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.72rem", fontWeight: 800, color: idx === 0 ? C.dark : "rgba(255,255,255,0.6)" }}>#{idx + 1}</div>
                      {/* Photo or emoji */}
                      <div style={{ width: "60px", height: "60px", background: "rgba(255,255,255,0.08)", borderRadius: "16px", overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "2rem", marginBottom: "1rem", border: "1px solid rgba(255,255,255,0.1)", flexShrink: 0 }}>
                        {p.photos?.length > 0 ? <img src={p.photos[0].url} alt={p.name} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} /> : p.image}
                      </div>
                      {/* Name & category */}
                      <div style={{ color: "rgba(255,255,255,0.5)", fontSize: "0.72rem", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "0.3rem" }}>{p.category}</div>
                      <div style={{ color: "#fff", fontWeight: 800, fontSize: "1rem", marginBottom: "0.4rem", lineHeight: 1.3, paddingRight: "2rem" }}>{p.name}</div>
                      {/* Rating */}
                      <div style={{ color: C.gold, fontSize: "0.78rem", fontWeight: 600, marginBottom: "1rem" }}>⭐ {p.rating} · {p.reviews} reviews</div>
                      {/* Price + CTA */}
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                        <div>
                          <div style={{ color: C.gold, fontWeight: 900, fontSize: "1.15rem" }}>{INR(p.priceDay)}</div>
                          <div style={{ color: "rgba(255,255,255,0.4)", fontSize: "0.72rem" }}>per day</div>
                        </div>
                        <div style={{ background: C.gold, color: C.dark, borderRadius: "10px", padding: "0.45rem 0.9rem", fontSize: "0.82rem", fontWeight: 800 }}>Rent Now</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          );
        })()}

        {/* PRODUCTS */}
        {(activeTab === "home" || activeTab === "products") && (
          <div style={{ padding: "4rem 2rem", maxWidth: "1200px", margin: "0 auto" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "0.5rem", flexWrap: "wrap", gap: "1rem" }}>
              <div>
                <h2 style={{ fontSize: "2rem", fontWeight: 800, marginBottom: "0.25rem" }}>Browse Products</h2>
                <p style={{ color: C.muted }}>
                  {filteredProducts.length} products {searchQuery || selectedCategory !== "All" || priceMin || priceMax || filterTag || selectedCity ? "found" : "available"}{selectedCity ? ` in ${selectedCity}` : ""}
                </p>
              </div>
              {/* List Your Product CTA */}
              <button onClick={handleListProduct} style={{ background: `linear-gradient(135deg, ${C.purple}, #a855f7)`, color: "#fff", border: "none", borderRadius: "12px", padding: "0.75rem 1.5rem", cursor: "pointer", fontWeight: 700, fontFamily: "'Outfit', sans-serif", display: "flex", alignItems: "center", gap: "0.6rem", boxShadow: "0 4px 15px rgba(124,58,237,0.4)", transition: "all 0.2s" }} onMouseEnter={e => e.currentTarget.style.transform="translateY(-2px)"} onMouseLeave={e => e.currentTarget.style.transform=""}>
                🏪 List Your Product {(!user?.subscription && !user?.isMaster) && <span style={{ background: "rgba(255,255,255,0.2)", borderRadius: "6px", padding: "0.1rem 0.5rem", fontSize: "0.72rem" }}>Needs Plan</span>}
              </button>
            </div>

            {/* ─── Smart Search & Filter Panel ─── */}
            {flags.smartSearch && (
              <div style={{ background: "#fff", borderRadius: "20px", border: `1px solid ${C.border}`, padding: "1.25rem 1.5rem", marginBottom: "1.5rem", boxShadow: "0 2px 8px rgba(0,0,0,0.04)" }}>
                <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap", alignItems: "center" }}>
                  {/* Search */}
                  <div style={{ flex: "1 1 220px", display: "flex", alignItems: "center", gap: "0.6rem", background: C.bg, borderRadius: "12px", padding: "0.6rem 1rem", border: `1.5px solid ${searchQuery ? C.dark : C.border}`, minWidth: 0 }}>
                    <span style={{ color: C.muted, flexShrink: 0 }}>🔍</span>
                    <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Search products, categories..."
                      style={{ border: "none", outline: "none", background: "transparent", fontFamily: "'Outfit', sans-serif", fontSize: "0.9rem", color: C.dark, width: "100%", minWidth: 0 }} />
                    {searchQuery && <button onClick={() => setSearchQuery("")} style={{ border: "none", background: "none", cursor: "pointer", color: C.muted, fontSize: "0.8rem", flexShrink: 0 }}>✕</button>}
                  </div>
                  {/* Sort */}
                  <select value={sortBy} onChange={e => setSortBy(e.target.value)}
                    style={{ padding: "0.6rem 0.9rem", border: `1.5px solid ${C.border}`, borderRadius: "12px", background: "#fff", fontFamily: "'Outfit', sans-serif", fontSize: "0.88rem", outline: "none", cursor: "pointer", color: C.dark }}>
                    <option value="popular">🔥 Most Popular</option>
                    <option value="price_asc">💰 Price: Low → High</option>
                    <option value="price_desc">💎 Price: High → Low</option>
                    <option value="rating">⭐ Highest Rated</option>
                    <option value="newest">🆕 Newest First</option>
                  </select>
                  {/* Filter toggle */}
                  <button onClick={() => setFilterOpen(o => !o)}
                    style={{ padding: "0.6rem 1.1rem", border: `1.5px solid ${filterOpen || priceMin || priceMax || filterTag ? C.dark : C.border}`, borderRadius: "12px", background: filterOpen || priceMin || priceMax || filterTag ? C.dark : "#fff", color: filterOpen || priceMin || priceMax || filterTag ? "#fff" : C.dark, fontFamily: "'Outfit', sans-serif", fontWeight: 600, fontSize: "0.88rem", cursor: "pointer", display: "flex", alignItems: "center", gap: "0.4rem" }}>
                    ⚙ Filters {(priceMin || priceMax || filterTag) ? <span style={{ background: C.gold, color: C.dark, borderRadius: "50%", width: "18px", height: "18px", fontSize: "0.68rem", display: "inline-flex", alignItems: "center", justifyContent: "center", fontWeight: 800 }}>{[priceMin,priceMax,filterTag].filter(Boolean).length}</span> : ""}
                  </button>
                  {/* Quick clear */}
                  {(searchQuery || selectedCategory !== "All" || priceMin || priceMax || filterTag || selectedCity) && (
                    <button onClick={() => { setSearchQuery(""); setSelectedCategory("All"); setPriceMin(""); setPriceMax(""); setFilterTag(""); setSortBy("popular"); setSelectedCity(""); }}
                      style={{ padding: "0.6rem 0.9rem", border: "none", borderRadius: "12px", background: "rgba(239,68,68,0.08)", color: C.red, fontFamily: "'Outfit', sans-serif", fontWeight: 600, fontSize: "0.82rem", cursor: "pointer" }}>
                      ✕ Clear All
                    </button>
                  )}
                </div>

                {/* Expanded filter panel */}
                {filterOpen && (
                  <div style={{ marginTop: "1rem", paddingTop: "1rem", borderTop: `1px solid ${C.border}`, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "1rem" }}>
                    {/* Price range */}
                    <div>
                      <div style={{ fontSize: "0.75rem", fontWeight: 700, color: C.muted, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "0.5rem" }}>Price Range (₹/day)</div>
                      <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
                        <input value={priceMin} onChange={e => setPriceMin(e.target.value)} placeholder="Min" type="number"
                          style={{ flex: 1, padding: "0.5rem 0.75rem", border: `1.5px solid ${C.border}`, borderRadius: "10px", outline: "none", fontFamily: "'Outfit', sans-serif", fontSize: "0.88rem", color: C.dark, background: "#fff" }} />
                        <span style={{ color: C.muted, fontSize: "0.8rem" }}>–</span>
                        <input value={priceMax} onChange={e => setPriceMax(e.target.value)} placeholder="Max" type="number"
                          style={{ flex: 1, padding: "0.5rem 0.75rem", border: `1.5px solid ${C.border}`, borderRadius: "10px", outline: "none", fontFamily: "'Outfit', sans-serif", fontSize: "0.88rem", color: C.dark, background: "#fff" }} />
                      </div>
                      {/* Quick presets */}
                      <div style={{ display: "flex", gap: "0.4rem", marginTop: "0.5rem", flexWrap: "wrap" }}>
                        {[["Under ₹1K","","1000"],["₹1K–₹2K","1000","2000"],["₹2K+","2000",""]].map(([l,min,max]) => (
                          <button key={l} onClick={() => { setPriceMin(min); setPriceMax(max); }}
                            style={{ padding: "0.25rem 0.6rem", border: `1px solid ${priceMin===min&&priceMax===max ? C.dark : C.border}`, borderRadius: "8px", background: priceMin===min&&priceMax===max ? C.dark : "#fff", color: priceMin===min&&priceMax===max ? "#fff" : C.muted, fontFamily: "'Outfit', sans-serif", fontSize: "0.72rem", fontWeight: 600, cursor: "pointer" }}>{l}</button>
                        ))}
                      </div>
                    </div>
                    {/* Tags filter */}
                    {flags.tagging && adminTags.length > 0 && (
                      <div>
                        <div style={{ fontSize: "0.75rem", fontWeight: 700, color: C.muted, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "0.5rem" }}>Filter by Tag</div>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: "0.4rem" }}>
                          <button onClick={() => setFilterTag("")}
                            style={{ padding: "0.3rem 0.75rem", border: `1.5px solid ${!filterTag ? C.dark : C.border}`, borderRadius: "20px", background: !filterTag ? C.dark : "#fff", color: !filterTag ? "#fff" : C.muted, fontFamily: "'Outfit', sans-serif", fontSize: "0.78rem", fontWeight: 600, cursor: "pointer" }}>
                            All
                          </button>
                          {adminTags.map(tag => (
                            <button key={tag.id} onClick={() => setFilterTag(filterTag == tag.id ? "" : String(tag.id))}
                              style={{ padding: "0.3rem 0.75rem", border: `1.5px solid ${String(filterTag) === String(tag.id) ? tag.color : C.border}`, borderRadius: "20px", background: String(filterTag) === String(tag.id) ? tag.bg : "#fff", color: String(filterTag) === String(tag.id) ? tag.color : C.muted, fontFamily: "'Outfit', sans-serif", fontSize: "0.78rem", fontWeight: 600, cursor: "pointer" }}>
                              {tag.emoji} {tag.name}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                    {/* Rating filter quick */}
                    <div>
                      <div style={{ fontSize: "0.75rem", fontWeight: 700, color: C.muted, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "0.5rem" }}>Quick Sort</div>
                      <div style={{ display: "flex", flexDirection: "column", gap: "0.35rem" }}>
                        {[["popular","🔥 Most Popular"],["rating","⭐ Top Rated"],["price_asc","💰 Cheapest First"],["newest","🆕 Newest"]].map(([v,l]) => (
                          <button key={v} onClick={() => setSortBy(v)}
                            style={{ padding: "0.35rem 0.75rem", border: `1.5px solid ${sortBy===v ? C.dark : C.border}`, borderRadius: "8px", background: sortBy===v ? C.dark : "#fff", color: sortBy===v ? "#fff" : C.dark, fontFamily: "'Outfit', sans-serif", fontSize: "0.8rem", fontWeight: sortBy===v ? 700 : 500, cursor: "pointer", textAlign: "left" }}>
                            {l}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Category pills */}
            <div style={{ display: "flex", gap: "0.75rem", margin: "0 0 1.5rem", flexWrap: "wrap" }}>
              {categories.map(cat => <button key={cat} onClick={() => setSelectedCategory(cat)} style={{ padding: "0.5rem 1.2rem", borderRadius: "50px", border: `2px solid ${selectedCategory === cat ? C.dark : C.border}`, background: selectedCategory === cat ? C.dark : "#fff", color: selectedCategory === cat ? "#fff" : "#374151", cursor: "pointer", fontWeight: 600, fontSize: "0.85rem", fontFamily: "'Outfit', sans-serif" }}>{cat}</button>)}
            </div>

            {filteredProducts.length === 0 && (
              <div style={{ textAlign: "center", padding: "5rem 2rem", background: "#fff", borderRadius: "20px", border: `2px dashed ${C.border}` }}>
                <div style={{ fontSize: "4rem", marginBottom: "1rem" }}>🔍</div>
                <h3 style={{ fontWeight: 800, marginBottom: "0.5rem" }}>No products found</h3>
                <p style={{ color: C.muted, marginBottom: "1.5rem" }}>Try adjusting your filters or search term</p>
                <button onClick={() => { setSearchQuery(""); setSelectedCategory("All"); setPriceMin(""); setPriceMax(""); setFilterTag(""); setSelectedCity(""); }} style={{ background: C.dark, color: "#fff", border: "none", borderRadius: "12px", padding: "0.8rem 2rem", cursor: "pointer", fontWeight: 700, fontFamily: "'Outfit', sans-serif" }}>Clear Filters</button>
              </div>
            )}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: "1.5rem" }}>
              {filteredProducts.map(p => (
                <div key={p.id} style={{ background: "#fff", borderRadius: "20px", overflow: "hidden", boxShadow: "0 2px 10px rgba(0,0,0,0.06)", transition: "all 0.3s", cursor: "pointer", border: "2px solid transparent" }}
                  onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-4px)"; e.currentTarget.style.borderColor = C.gold; e.currentTarget.style.boxShadow = "0 12px 30px rgba(0,0,0,0.12)"; }}
                  onMouseLeave={e => { e.currentTarget.style.transform = ""; e.currentTarget.style.borderColor = "transparent"; e.currentTarget.style.boxShadow = "0 2px 10px rgba(0,0,0,0.06)"; }}>
                  <div style={{ position: "relative", height: "180px", background: `linear-gradient(135deg, ${C.bg}, #fff)`, display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
                    {p.photos?.length > 0
                      ? <img src={p.photos[0].url} alt={p.name} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
                      : <span style={{ fontSize: "4rem" }}>{p.image}</span>}
                    {p.owner && <div style={{ position: "absolute", bottom: "0.5rem", left: "0.75rem", background: "rgba(124,58,237,0.85)", color: "#fff", borderRadius: "6px", padding: "0.2rem 0.5rem", fontSize: "0.7rem", fontWeight: 700 }}>👤 {p.owner}</div>}
                    {p.photos?.length > 1 && <div style={{ position: "absolute", bottom: "0.5rem", right: "0.75rem", background: "rgba(0,0,0,0.5)", color: "#fff", borderRadius: "6px", padding: "0.2rem 0.5rem", fontSize: "0.7rem" }}>📸 {p.photos.length}</div>}
                  </div>
                  <div style={{ padding: "1.25rem" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "0.25rem" }}>
                      <div style={{ fontWeight: 700 }}>{p.name}</div>
                      {/* Admin tags or fallback badge */}
                      {flags.tagging && adminTags.length > 0 && (p.tags || []).length > 0 ? (
                        <div style={{ display: "flex", gap: "0.25rem", flexWrap: "wrap", justifyContent: "flex-end" }}>
                          {(p.tags || []).slice(0,2).map(tid => {
                            const tag = adminTags.find(t => t.id === tid);
                            return tag ? <TagBadge key={tid} tag={tag} /> : null;
                          })}
                        </div>
                      ) : p.badge ? (
                        <span style={{ background: p.badge === "New" ? "#dcfce7" : p.badge === "Hot" ? "#fee2e2" : "#fef3c7", color: p.badge === "New" ? "#166534" : p.badge === "Hot" ? "#991b1b" : "#92400e", padding: "0.2rem 0.6rem", borderRadius: "20px", fontSize: "0.7rem", fontWeight: 700 }}>{p.badge}</span>
                      ) : null}
                    </div>
                    <div style={{ color: "#9ca3af", fontSize: "0.8rem", marginBottom: "0.75rem" }}>{p.category} · ⭐ {p.rating} ({p.reviews}){p.location ? ` · 📍${p.location}` : ""}</div>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                      <PriceDisplay p={p} />
                      <button onClick={() => { setSelectedProduct(p); setRentDays(1); }} style={{ background: C.dark, color: "#fff", border: "none", borderRadius: "10px", padding: "0.5rem 1.2rem", cursor: "pointer", fontWeight: 700, fontSize: "0.85rem", fontFamily: "'Outfit', sans-serif" }}>Rent Now</button>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {!(user?.subscription || user?.isMaster) && <div style={{ marginTop: "3rem", background: `linear-gradient(135deg, #faf5ff, #f0f9ff)`, border: "2px solid #a855f7", borderRadius: "24px", padding: "2.5rem", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "1.5rem" }}>
              <div>
                <div style={{ display: "inline-block", background: "#7c3aed", color: "#fff", borderRadius: "50px", padding: "0.3rem 0.9rem", fontSize: "0.78rem", fontWeight: 700, marginBottom: "0.75rem" }}>💡 FOR SUBSCRIBERS</div>
                <h3 style={{ fontWeight: 900, fontSize: "1.4rem", marginBottom: "0.5rem" }}>Have something to rent out?</h3>
                <p style={{ color: C.muted, maxWidth: "420px", lineHeight: 1.6 }}>Subscribers can list their own products and earn money. Plans start at just {INR(749)}/month.</p>
              </div>
              <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap" }}>
                <button onClick={() => navigate("plans")} style={{ background: "#fff", color: C.dark, border: `2px solid ${C.border}`, borderRadius: "12px", padding: "0.9rem 1.5rem", cursor: "pointer", fontWeight: 700, fontFamily: "'Outfit', sans-serif" }}>View Plans</button>
                <button onClick={handleListProduct} style={{ background: "#7c3aed", color: "#fff", border: "none", borderRadius: "12px", padding: "0.9rem 1.5rem", cursor: "pointer", fontWeight: 800, fontFamily: "'Outfit', sans-serif" }}>Start Listing →</button>
              </div>
            </div>}
          </div>
        )}

        {/* PLANS */}
        {(activeTab === "home" || activeTab === "plans") && flags.subscriptionPlans && (
          <div style={{ background: "#fff", padding: "4rem 2rem" }}>
            <div style={{ maxWidth: "1200px", margin: "0 auto" }}>
              <h2 style={{ fontSize: "2rem", fontWeight: 800, marginBottom: "0.5rem" }}>Subscription Plans</h2>
              <p style={{ color: C.muted, marginBottom: "2.5rem" }}>Rent more, save more — and list your own products to earn</p>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: "1.5rem" }}>
                {plans.map(plan => (
                  <div key={plan.name} style={{ background: plan.color, borderRadius: "20px", padding: "2rem", border: plan.popular ? `3px solid ${plan.accent}` : `3px solid ${user?.subscription === plan.id ? plan.accent : "transparent"}`, position: "relative" }}>
                    {plan.popular && !user?.subscription && <div style={{ position: "absolute", top: "-14px", left: "50%", transform: "translateX(-50%)", background: plan.accent, color: "#fff", borderRadius: "50px", padding: "0.3rem 1rem", fontSize: "0.75rem", fontWeight: 700, whiteSpace: "nowrap" }}>MOST POPULAR</div>}
                    {user?.subscription === plan.id && <div style={{ position: "absolute", top: "-14px", left: "50%", transform: "translateX(-50%)", background: plan.accent, color: "#fff", borderRadius: "50px", padding: "0.3rem 1rem", fontSize: "0.75rem", fontWeight: 700, whiteSpace: "nowrap" }}>✓ YOUR PLAN</div>}
                    <div style={{ fontWeight: 800, fontSize: "1.2rem" }}>{plan.name}</div>
                    <div style={{ color: C.muted, fontSize: "0.85rem", margin: "0.25rem 0 1rem" }}>For {plan.name === "Starter" ? "occasional" : plan.name === "Pro" ? "regular" : "business"} renters</div>
                    <div><span style={{ fontSize: "2.2rem", fontWeight: 900 }}>{INR(plan.price)}</span><span style={{ color: C.muted }}>/month</span></div>
                    <div style={{ background: "rgba(0,0,0,0.06)", borderRadius: "8px", padding: "0.5rem 0.75rem", margin: "0.75rem 0", fontSize: "0.82rem", fontWeight: 700, color: plan.accent }}>
                      📦 List up to {plan.listingLimit >= 999 ? "unlimited" : plan.listingLimit} products
                    </div>
                    {plan.productExpiry && (
                      <div style={{ background: "rgba(0,0,0,0.04)", borderRadius: "8px", padding: "0.4rem 0.75rem", marginBottom: "0.75rem", fontSize: "0.8rem", fontWeight: 600, color: "#6b7280", display: "flex", alignItems: "center", gap: "0.4rem" }}>
                        ⏳ Listings expire after {plan.productExpiry} days
                      </div>
                    )}
                    <ul style={{ listStyle: "none", padding: 0, margin: "0 0 1.5rem", display: "flex", flexDirection: "column", gap: "0.6rem" }}>
                      {plan.features.map(f => <li key={f} style={{ display: "flex", gap: "0.5rem", fontSize: "0.9rem" }}><span style={{ color: plan.accent }}>✓</span>{f}</li>)}
                    </ul>
                    {user?.subscription === plan.id ? (
                      <button onClick={() => navigate("my-listings")} style={{ width: "100%", background: plan.accent, color: "#fff", border: "none", borderRadius: "12px", padding: "0.9rem", cursor: "pointer", fontWeight: 700, fontFamily: "'Outfit', sans-serif" }}>Go to My Listings →</button>
                    ) : (
                      <button onClick={handlePlanSubscribe} style={{ width: "100%", background: plan.accent, color: "#fff", border: "none", borderRadius: "12px", padding: "0.9rem", cursor: "pointer", fontWeight: 700, fontFamily: "'Outfit', sans-serif" }}>{user ? "Subscribe Now" : "Sign In to Subscribe"}</button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* HOW IT WORKS */}
        {(activeTab === "home" || activeTab === "how it works") && (
          <div style={{ padding: "4rem 2rem", maxWidth: "1200px", margin: "0 auto" }}>
            <h2 style={{ fontSize: "2rem", fontWeight: 800, marginBottom: "0.5rem" }}>How It Works</h2>
            <p style={{ color: C.muted, marginBottom: "2.5rem" }}>Rent in 3 steps — or earn by listing yours</p>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "2rem" }}>
              {[{ num: "01", icon: "🔍", title: "Browse & Choose", desc: "Explore thousands of premium products." }, { num: "02", icon: "💳", title: "Book & Pay", desc: "Pay via UPI, card, or net banking." }, { num: "03", icon: "🚚", title: "Delivered to You", desc: "Pan-India delivery. We pick up when done." }, { num: "💡", icon: "🏪", title: "Or List & Earn", desc: "Subscribe and list your own items to earn." }].map(s => (
                <div key={s.num} style={{ background: s.num === "💡" ? "linear-gradient(135deg, #faf5ff, #f5f3ff)" : "#fff", borderRadius: "20px", padding: "2rem", position: "relative", overflow: "hidden", boxShadow: "0 2px 10px rgba(0,0,0,0.06)", border: s.num === "💡" ? "2px solid #a855f7" : "none" }}>
                  <div style={{ position: "absolute", top: "-10px", right: "1rem", fontSize: "4rem", fontWeight: 900, color: s.num === "💡" ? "rgba(168,85,247,0.1)" : C.bg, lineHeight: 1 }}>{s.num}</div>
                  <div style={{ fontSize: "2.5rem", marginBottom: "1rem" }}>{s.icon}</div>
                  <div style={{ fontWeight: 800, fontSize: "1.1rem", marginBottom: "0.5rem" }}>{s.title}</div>
                  <div style={{ color: C.muted, lineHeight: 1.6 }}>{s.desc}</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </>
    );
  };

  return (
    <>
      <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700;800;900&display=swap" rel="stylesheet" />
      <style>{`
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        body { overflow-x: hidden; }
        .rc-nav-links { display: flex; gap: 2.25rem; align-items: center; }
        .rc-hamburger { display: none !important; }
        .rc-hide-sm { display: flex !important; }
        .rc-hero-right { display: flex !important; }
        .rc-stat-item { display: block; }
        .rc-footer-grid { display: grid; grid-template-columns: 2fr 1fr 1fr 1fr; gap: 3rem; margin-bottom: 3rem; }
        .rc-contact-grid { display: grid; grid-template-columns: 1fr 1.6fr; gap: 3rem; align-items: start; }
        .rc-about-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 3rem; align-items: center; }
        /* Hero layout */
        .rc-hero-inner { display: grid; grid-template-columns: 1fr 1fr; gap: 3rem; align-items: center; }
        /* Animations */
        @keyframes rc-pulse { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:0.5;transform:scale(0.8)} }
        @keyframes rc-spin { to { transform: rotate(360deg); } }
        @keyframes rc-fadein { from{opacity:0;transform:translateY(16px)} to{opacity:1;transform:none} }
        /* Tablet */
        @media (max-width: 1024px) {
          .rc-footer-grid { grid-template-columns: 1fr 1fr !important; gap: 2rem !important; }
        }
        /* Mobile */
        @media (max-width: 900px) {
          .rc-nav-links { display: none !important; }
          .rc-hamburger { display: flex !important; }
          .rc-hide-sm { display: none !important; }
          .rc-hero-inner { grid-template-columns: 1fr !important; text-align: center; gap: 2rem; }
          .rc-hero-right { display: none !important; }
          .rc-footer-grid { grid-template-columns: 1fr 1fr !important; gap: 1.5rem !important; }
          .rc-contact-grid { grid-template-columns: 1fr !important; }
          .rc-about-grid { grid-template-columns: 1fr !important; }
          .rc-stat-item { border-right: none !important; }
        }
        @media (max-width: 640px) {
          .rc-footer-grid { grid-template-columns: 1fr !important; gap: 1.25rem !important; }
          .rc-stat-item { padding: 0.9rem 1.2rem !important; min-width: 100px !important; }
          input, select, textarea, button { font-size: 16px !important; } /* Prevent iOS zoom */
        }
        /* Hover effects */
        .rc-product-card:hover { transform: translateY(-5px); }
        .rc-plan-card:hover { transform: translateY(-3px); box-shadow: 0 12px 40px rgba(0,0,0,0.12); }
        /* Scrollbar */
        ::-webkit-scrollbar { width: 6px; } ::-webkit-scrollbar-track { background: #f1f1f1; } ::-webkit-scrollbar-thumb { background: #c1c1c1; border-radius: 3px; }
      `}</style>
      <div style={{ fontFamily: "'Outfit', sans-serif", minHeight: "100vh", background: C.bg, color: C.dark }}>

        {notif && <div style={{ position: "fixed", bottom: "2rem", left: "50%", transform: "translateX(-50%)", background: C.dark, color: "#fff", padding: "0.9rem 1.8rem", borderRadius: "50px", fontWeight: 600, zIndex: 999, boxShadow: "0 10px 30px rgba(0,0,0,0.2)", whiteSpace: "nowrap" }}>✓ {notif.msg}</div>}
        {authOpen && <AuthModal onClose={() => setAuthOpen(false)} onLogin={handleLogin} flags={flags} customFields={flags.customFields ? customFields : []} />}
        {subGateOpen && <SubscriptionGate onClose={() => setSubGateOpen(false)} onSubscribe={handleSubscribe} user={user} />}
        {addProductOpen && <AddProductModal onClose={() => { setAddProductOpen(false); setEditingProduct(null); }} onSave={handleSaveProduct} editProduct={editingProduct} user={user} adminTags={adminTags} categories={adminCategories} availableCities={availableCities} />}

        {/* NAV */}
        <nav style={{ background: "#fff", color: C.dark, padding: "0 2rem", display: "flex", alignItems: "center", justifyContent: "space-between", height: "72px", position: "sticky", top: 0, zIndex: 100, boxShadow: "0 2px 16px rgba(0,0,0,0.08)", borderBottom: `1px solid ${C.border}`, gap: "1rem" }}>
          <img src={LOGO_SRC} alt="RentCircle" style={{ height: "40px", cursor: "pointer", flexShrink: 0 }} onClick={() => navigate("home")} />
          {/* Desktop nav links */}
          <div className="rc-nav-links" style={{ display: "flex", gap: "2.25rem", alignItems: "center" }}>
            {[["home","Home"],["products","Products"],["plans","Plans"],["about","About"],["contact","Contact"]].map(([key,label]) => (
              <span key={key} style={{ cursor: "pointer", fontSize: "1.05rem", fontWeight: activeTab === key ? 700 : 500, color: activeTab === key ? C.dark : C.muted, paddingBottom: "3px", borderBottom: activeTab === key ? `2.5px solid ${C.gold}` : "2.5px solid transparent", transition: "all 0.2s", whiteSpace: "nowrap", letterSpacing: "-0.01em" }} onClick={() => navigate(key)}
                onMouseEnter={e => { e.currentTarget.style.color = C.dark; }}
                onMouseLeave={e => { if (activeTab !== key) e.currentTarget.style.color = C.muted; }}>{label}</span>
            ))}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", flexShrink: 0 }}>
            {/* City selector */}
            {availableCities.length > 0 && (
              <div className="rc-hide-sm" style={{ position: "relative", display: "flex", alignItems: "center" }}>
                <span style={{ position: "absolute", left: "0.65rem", fontSize: "0.9rem", pointerEvents: "none", zIndex: 1 }}>📍</span>
                <select
                  value={selectedCity}
                  onChange={e => setSelectedCity(e.target.value)}
                  style={{ paddingLeft: "2rem", paddingRight: "1.5rem", paddingTop: "0.5rem", paddingBottom: "0.5rem", border: `1.5px solid ${selectedCity ? C.dark : C.border}`, borderRadius: "10px", background: selectedCity ? C.dark : "#fff", color: selectedCity ? "#fff" : C.dark, fontFamily: "'Outfit', sans-serif", fontWeight: selectedCity ? 700 : 500, fontSize: "0.88rem", cursor: "pointer", outline: "none", appearance: "none", WebkitAppearance: "none", transition: "all 0.2s", minWidth: "130px" }}
                >
                  <option value="">All Cities</option>
                  {availableCities.map(city => <option key={city} value={city}>{city}</option>)}
                </select>
                {selectedCity && (
                  <button onClick={() => setSelectedCity("")} style={{ position: "absolute", right: "0.4rem", background: "rgba(255,255,255,0.25)", border: "none", borderRadius: "50%", width: "18px", height: "18px", cursor: "pointer", color: "#fff", fontSize: "0.6rem", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, padding: 0 }}>✕</button>
                )}
              </div>
            )}
            {user && (
              <button onClick={handleListProduct} className="rc-hide-sm" style={{ background: "rgba(124,58,237,0.08)", border: "1.5px solid rgba(124,58,237,0.3)", borderRadius: "10px", padding: "0.5rem 1rem", cursor: "pointer", fontWeight: 700, fontSize: "0.95rem", color: "#7c3aed", fontFamily: "'Outfit', sans-serif", display: "flex", alignItems: "center", gap: "0.4rem" }}>
                🏪 {(user.subscription || user.isMaster) ? "List Product" : "List 🔒"}
              </button>
            )}
            <button onClick={() => user ? setCartOpen(true) : setAuthOpen(true)} style={{ background: C.gold, border: "none", borderRadius: "10px", padding: "0.55rem 1.1rem", cursor: "pointer", fontWeight: 700, display: "flex", alignItems: "center", gap: "0.4rem", fontSize: "1rem", color: C.dark, fontFamily: "'Outfit', sans-serif" }}>
              🛒 {cart.length > 0 && <span style={{ background: C.red, color: "#fff", borderRadius: "50%", width: "20px", height: "20px", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.72rem" }}>{cart.length}</span>}
            </button>
            {user ? (
              <div ref={userMenuRef} style={{ position: "relative" }}>
                <div onClick={() => setUserMenuOpen(o => !o)} style={{ display: "flex", alignItems: "center", gap: "0.5rem", cursor: "pointer", background: C.bg, borderRadius: "10px", padding: "0.45rem 0.85rem", border: `1px solid ${C.border}` }}>
                  <div style={{ width: "32px", height: "32px", borderRadius: "50%", background: user.isMaster ? "#7c3aed" : currentPlan ? currentPlan.accent : C.gold, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: "0.95rem" }}>{user.avatar}</div>
                  <span className="rc-hide-sm" style={{ fontSize: "0.82rem", color: user.isMaster ? "#7c3aed" : currentPlan ? currentPlan.accent : C.dark, fontWeight: 700 }}>{user.isMaster ? "👑 Master" : currentPlan ? `⭐ ${currentPlan.name}` : user.name.split(" ")[0]}</span>
                </div>
                {userMenuOpen && (
                  <div style={{ position: "absolute", top: "52px", right: 0, background: "#fff", borderRadius: "16px", boxShadow: "0 20px 60px rgba(0,0,0,0.15)", border: `1px solid ${C.border}`, padding: "0.75rem", minWidth: "230px", zIndex: 200 }}>
                    <div style={{ padding: "0.5rem 0.75rem", borderBottom: `1px solid ${C.border}`, marginBottom: "0.5rem" }}>
                      <div style={{ fontWeight: 700, fontSize: "0.95rem", color: C.dark }}>{user.name}</div>
                      <div style={{ color: C.muted, fontSize: "0.8rem" }}>{user.email}</div>
                      {user.isMaster
                        ? <div style={{ marginTop: "0.3rem", background: "#f5f3ff", color: "#7c3aed", borderRadius: "6px", padding: "0.2rem 0.5rem", fontSize: "0.75rem", fontWeight: 700, display: "inline-block" }}>👑 Master User · Full Access</div>
                        : currentPlan
                          ? <div style={{ marginTop: "0.3rem", background: currentPlan.color, color: currentPlan.accent, borderRadius: "6px", padding: "0.2rem 0.5rem", fontSize: "0.75rem", fontWeight: 700, display: "inline-block" }}>⭐ {currentPlan.name} Plan</div>
                          : <div style={{ marginTop: "0.3rem", background: "#faf5ff", color: "#7c3aed", borderRadius: "6px", padding: "0.2rem 0.5rem", fontSize: "0.75rem", fontWeight: 700, display: "inline-block", cursor: "pointer" }} onClick={() => { setUserMenuOpen(false); setSubGateOpen(true); }}>🔒 No Plan — Subscribe</div>
                      }
                    </div>
                    {[["My Rentals","home"],["My Orders","my-orders"],["My Listings","my-listings"],["Profile","profile"],["Settings","profile"]].map(([label, tab]) => (
                      <div key={label} onClick={() => navigate(tab)} style={{ padding: "0.6rem 0.75rem", borderRadius: "8px", cursor: "pointer", fontSize: "0.92rem", color: C.dark, display: "flex", alignItems: "center", gap: "0.5rem" }} onMouseEnter={e => e.currentTarget.style.background = C.bg} onMouseLeave={e => e.currentTarget.style.background = ""}>
                        {label === "My Listings" ? "🏪" : label === "My Rentals" ? "📦" : label === "My Orders" ? "📋" : label === "Profile" ? "👤" : "⚙️"} {label}
                      </div>
                    ))}
                    {!currentPlan && !user.isMaster && <div onClick={() => { setUserMenuOpen(false); setSubGateOpen(true); }} style={{ padding: "0.6rem 0.75rem", borderRadius: "8px", cursor: "pointer", fontSize: "0.92rem", background: "#faf5ff", color: "#7c3aed", fontWeight: 700, marginTop: "0.25rem" }}>⭐ Buy Subscription</div>}
                    <button onClick={handleLogout} style={{ width: "100%", marginTop: "0.5rem", padding: "0.6rem 0.75rem", border: "none", borderRadius: "8px", background: "rgba(239,68,68,0.08)", color: C.red, cursor: "pointer", fontWeight: 700, fontFamily: "'Outfit', sans-serif", fontSize: "0.92rem", textAlign: "left" }}>Sign Out</button>
                  </div>
                )}
              </div>
            ) : (
              <button onClick={() => setAuthOpen(true)} style={{ background: C.dark, border: "none", borderRadius: "10px", padding: "0.55rem 1.25rem", cursor: "pointer", fontWeight: 700, fontSize: "1rem", color: "#fff", fontFamily: "'Outfit', sans-serif" }}>Sign In</button>
            )}
            {/* Mobile hamburger */}
            <button className="rc-hamburger" onClick={() => setMobileMenuOpen(o => !o)} style={{ display: "none", background: C.bg, border: `1px solid ${C.border}`, borderRadius: "8px", padding: "0.5rem 0.65rem", cursor: "pointer", color: C.dark, fontSize: "1.3rem" }}>☰</button>
          </div>
        </nav>
        {/* Mobile menu overlay */}
        {mobileMenuOpen && (
          <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 99 }} onClick={() => setMobileMenuOpen(false)}>
            <div onClick={e => e.stopPropagation()} style={{ position: "absolute", top: "68px", left: 0, right: 0, background: C.dark, padding: "1rem 1.5rem 1.5rem", display: "flex", flexDirection: "column", gap: "0.25rem" }}>
              {[["home","🏠 Home"],["products","📦 Products"],["plans","💎 Plans"],["how it works","❓ How It Works"],["about","🏢 About"],["contact","📬 Contact"]].map(([key,label]) => (
                <div key={key} onClick={() => { navigate(key); setMobileMenuOpen(false); }} style={{ padding: "0.9rem 1rem", borderRadius: "10px", color: activeTab === key ? C.gold : "rgba(255,255,255,0.8)", fontWeight: activeTab === key ? 700 : 500, fontSize: "1rem", cursor: "pointer", background: activeTab === key ? "rgba(245,158,11,0.1)" : "transparent" }}>{label}</div>
              ))}
              {user && <div onClick={() => { handleListProduct(); setMobileMenuOpen(false); }} style={{ padding: "0.9rem 1rem", borderRadius: "10px", color: "#c4b5fd", fontWeight: 600, fontSize: "1rem", cursor: "pointer" }}>🏪 {(user.subscription || user.isMaster) ? "List Product" : "List Product 🔒"}</div>}
            </div>
          </div>
        )}

        {renderPage()}
        <Footer />

        {/* RENT MODAL */}
        {selectedProduct && (() => {
          const photos = selectedProduct.photos || [];
          const unitPrice = rentPeriod === "day" ? selectedProduct.priceDay : rentPeriod === "month" ? selectedProduct.priceMonth : selectedProduct.priceYear;
          const totalPrice = unitPrice * rentDays;
          const today = new Date().toISOString().split("T")[0];

          const handleStartDate = (val) => {
            setRentStartDate(val);
            if (!val) { setRentEndDate(""); return; }
            const start = new Date(val);
            let end = new Date(start);
            if (rentPeriod === "day") end.setDate(end.getDate() + rentDays - 1);
            else if (rentPeriod === "month") end.setMonth(end.getMonth() + rentDays);
            else end.setFullYear(end.getFullYear() + rentDays);
            setRentEndDate(end.toISOString().split("T")[0]);
          };

          const handleEndDate = (val) => {
            setRentEndDate(val);
            if (!val || !rentStartDate) return;
            const start = new Date(rentStartDate);
            const end = new Date(val);
            if (end <= start) return;
            let diff = 1;
            if (rentPeriod === "day") {
              diff = Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + 1;
            } else if (rentPeriod === "month") {
              diff = Math.max(1, (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth()));
            } else {
              diff = Math.max(1, end.getFullYear() - start.getFullYear());
            }
            setRentDays(diff);
          };

          const handleDurationChange = (newDays) => {
            const d = Math.max(1, newDays);
            setRentDays(d);
            if (rentStartDate) {
              const start = new Date(rentStartDate);
              let end = new Date(start);
              if (rentPeriod === "day") end.setDate(end.getDate() + d - 1);
              else if (rentPeriod === "month") end.setMonth(end.getMonth() + d);
              else end.setFullYear(end.getFullYear() + d);
              setRentEndDate(end.toISOString().split("T")[0]);
            }
          };

          const handlePeriodChange = (p) => {
            setRentPeriod(p);
            setRentDays(1);
            setRentStartDate("");
            setRentEndDate("");
          };

          const durationLabel = rentPeriod === "day" ? `${rentDays} day${rentDays > 1 ? "s" : ""}` : rentPeriod === "month" ? `${rentDays} month${rentDays > 1 ? "s" : ""}` : `${rentDays} year${rentDays > 1 ? "s" : ""}`;

          return (
            <div onClick={() => setSelectedProduct(null)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 200, padding: "1rem", backdropFilter: "blur(4px)" }}>
              <div onClick={e => e.stopPropagation()} style={{ background: "#fff", borderRadius: "24px", maxWidth: "500px", width: "100%", boxShadow: "0 30px 80px rgba(0,0,0,0.25)", overflow: "hidden", maxHeight: "92vh", display: "flex", flexDirection: "column" }}>
                <RentPhotoCarousel photos={photos} fallback={selectedProduct.image} />
                <div style={{ padding: "1.75rem", overflowY: "auto" }}>
                  <button onClick={() => setSelectedProduct(null)} style={{ float: "right", border: "none", background: "#f3f4f6", borderRadius: "50%", width: "32px", height: "32px", cursor: "pointer", fontSize: "0.9rem" }}>✕</button>
                  <h3 style={{ fontSize: "1.4rem", fontWeight: 800, marginBottom: "0.2rem", paddingRight: "2.5rem" }}>{selectedProduct.name}</h3>
                  {selectedProduct.owner && <div style={{ color: C.purple, fontSize: "0.82rem", fontWeight: 600, marginBottom: "0.2rem" }}>👤 Listed by {selectedProduct.owner}</div>}
                  <div style={{ color: "#9ca3af", fontSize: "0.85rem", marginBottom: "1.25rem" }}>⭐ {selectedProduct.rating} · {selectedProduct.reviews} reviews{selectedProduct.condition ? ` · ${selectedProduct.condition}` : ""}{selectedProduct.location ? ` · 📍${selectedProduct.location}` : ""}</div>

                  {/* Period selector tabs */}
                  <div style={{ display: "flex", background: "#f3f4f6", borderRadius: "12px", padding: "4px", marginBottom: "1.25rem", gap: "4px" }}>
                    {[["day","Per Day"],["month","Per Month"],["year","Per Year"]].map(([k, label]) => (
                      <button key={k} onClick={() => handlePeriodChange(k)} style={{ flex: 1, border: "none", borderRadius: "10px", padding: "0.55rem", background: rentPeriod === k ? "#fff" : "transparent", color: rentPeriod === k ? C.dark : C.muted, cursor: "pointer", fontWeight: rentPeriod === k ? 700 : 500, fontSize: "0.82rem", fontFamily: "'Outfit', sans-serif", boxShadow: rentPeriod === k ? "0 1px 4px rgba(0,0,0,0.1)" : "none", transition: "all 0.2s" }}>
                        {label}
                      </button>
                    ))}
                  </div>

                  {/* Duration stepper */}
                  <div style={{ background: C.bg, borderRadius: "14px", padding: "1.25rem", marginBottom: "1.25rem" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
                      <span style={{ fontWeight: 700, fontSize: "0.92rem" }}>Duration</span>
                      <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                        <button onClick={() => handleDurationChange(rentDays - 1)} style={{ width: "32px", height: "32px", borderRadius: "50%", border: `2px solid ${C.border}`, background: "#fff", cursor: "pointer", fontWeight: 800, fontSize: "1rem", display: "flex", alignItems: "center", justifyContent: "center" }}>−</button>
                        <span style={{ fontWeight: 800, fontSize: "1.1rem", minWidth: "80px", textAlign: "center" }}>{durationLabel}</span>
                        <button onClick={() => handleDurationChange(rentDays + 1)} style={{ width: "32px", height: "32px", borderRadius: "50%", border: `2px solid ${C.border}`, background: "#fff", cursor: "pointer", fontWeight: 800, fontSize: "1rem", display: "flex", alignItems: "center", justifyContent: "center" }}>+</button>
                      </div>
                    </div>

                    {/* Date range */}
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem", marginBottom: "1rem" }}>
                      <div>
                        <label style={{ display: "block", fontSize: "0.72rem", fontWeight: 700, color: C.muted, marginBottom: "0.35rem", textTransform: "uppercase", letterSpacing: "0.05em" }}>Start Date</label>
                        <input type="date" min={today} value={rentStartDate}
                          onChange={e => handleStartDate(e.target.value)}
                          style={{ width: "100%", border: `1.5px solid ${rentStartDate ? C.dark : C.border}`, borderRadius: "10px", padding: "0.6rem 0.75rem", fontSize: "0.88rem", fontFamily: "'Outfit', sans-serif", outline: "none", background: "#fff", color: C.dark, boxSizing: "border-box", cursor: "pointer" }} />
                      </div>
                      <div>
                        <label style={{ display: "block", fontSize: "0.72rem", fontWeight: 700, color: C.muted, marginBottom: "0.35rem", textTransform: "uppercase", letterSpacing: "0.05em" }}>End Date <span style={{ color: C.muted, fontWeight: 400, fontSize: "0.68rem", textTransform: "none" }}>(auto)</span></label>
                        <input type="date" value={rentEndDate} readOnly disabled
                          style={{ width: "100%", border: `1.5px solid ${C.border}`, borderRadius: "10px", padding: "0.6rem 0.75rem", fontSize: "0.88rem", fontFamily: "'Outfit', sans-serif", outline: "none", background: "#f3f4f6", color: rentEndDate ? C.muted : "#bbb", boxSizing: "border-box", cursor: "not-allowed", pointerEvents: "none" }} />
                      </div>
                    </div>

                    {/* Price summary */}
                    <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: "1rem" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
                        <div>
                          <div style={{ fontSize: "0.78rem", color: C.muted, marginBottom: "0.2rem" }}>{INR(unitPrice)}/{rentPeriod} × {durationLabel}</div>
                          <div style={{ fontSize: "1.75rem", fontWeight: 900, color: C.dark, letterSpacing: "-0.03em" }}>{INR(totalPrice)}</div>
                        </div>
                        {rentStartDate && rentEndDate && (
                          <div style={{ background: "rgba(16,185,129,0.1)", color: "#059669", borderRadius: "8px", padding: "0.5rem 1rem", fontSize: "0.82rem", fontWeight: 700, textAlign: "center", display: "inline-block", marginTop: "0.75rem" }}>
                            📅 {rentStartDate.split("-").reverse().join("-")} &nbsp;→&nbsp; {rentEndDate.split("-").reverse().join("-")}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  <div style={{ display: "flex", gap: "1rem" }}>
                    <button onClick={() => setSelectedProduct(null)} style={{ flex: 1, padding: "0.9rem", border: `2px solid ${C.border}`, borderRadius: "12px", background: "#fff", cursor: "pointer", fontWeight: 700, fontFamily: "'Outfit', sans-serif" }}>Cancel</button>
                    <button onClick={() => addToCart(selectedProduct, rentDays)} style={{ flex: 2, padding: "0.9rem", border: "none", borderRadius: "12px", background: C.dark, color: "#fff", cursor: "pointer", fontWeight: 700, fontFamily: "'Outfit', sans-serif" }}>{user ? "Add to Cart 🛒" : "Sign In to Rent"}</button>
                  </div>
                </div>
              </div>
            </div>
          );
        })()}

        {/* CART */}
        {/* ── CART SIDEBAR ── */}
        {cartOpen && (
          <div onClick={() => setCartOpen(false)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 140 }}>
            <div onClick={e => e.stopPropagation()} style={{ position: "fixed", right: 0, top: 0, bottom: 0, width: "400px", background: "#fff", boxShadow: "-10px 0 40px rgba(0,0,0,0.1)", padding: "2rem", display: "flex", flexDirection: "column", fontFamily: "'Outfit', sans-serif" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem" }}>
                <h3 style={{ fontWeight: 800, fontSize: "1.3rem" }}>🛒 Your Cart ({cart.length})</h3>
                <button onClick={() => setCartOpen(false)} style={{ border: "none", background: "#f3f4f6", borderRadius: "50%", width: "36px", height: "36px", cursor: "pointer", fontSize: "1rem" }}>✕</button>
              </div>
              {cart.length === 0
                ? <div style={{ textAlign: "center", padding: "3rem 0", color: "#9ca3af" }}><div style={{ fontSize: "3rem", marginBottom: "1rem" }}>🛒</div>Your cart is empty</div>
                : (
                <>
                  {/* Cart items */}
                  <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: "0.75rem", marginBottom: "1rem" }}>
                    {cart.map(item => (
                      <div key={item.id} style={{ display: "flex", alignItems: "center", gap: "0.85rem", background: C.bg, borderRadius: "12px", padding: "0.85rem" }}>
                        <div style={{ fontSize: "1.8rem", flexShrink: 0 }}>{item.photos?.length > 0 ? <img src={item.photos[0].url} alt={item.name} style={{ width: "40px", height: "40px", borderRadius: "8px", objectFit: "cover" }} /> : item.image}</div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontWeight: 700, fontSize: "0.88rem", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.name}</div>
                          <div style={{ color: C.muted, fontSize: "0.78rem" }}>{item.days}d · {INR((item.priceDay || item.price || 0) * item.days)}</div>
                        </div>
                        <button onClick={() => setCart(p => p.filter(i => i.id !== item.id))} style={{ border: "none", background: "none", cursor: "pointer", color: C.red, fontSize: "1rem", flexShrink: 0 }}>✕</button>
                      </div>
                    ))}
                  </div>

                  {/* Total + proceed button */}
                  <div style={{ borderTop: `2px solid ${C.border}`, paddingTop: "1.25rem" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 800, fontSize: "1.15rem", marginBottom: "1rem" }}><span>Total</span><span style={{ color: C.dark }}>{INR(cartTotal)}</span></div>
                    <button
                      onClick={() => { setCheckoutOpen(true); setCartOpen(false); setTermsAccepted(false); setAddrErrors({}); }}
                      style={{ width: "100%", background: C.dark, border: "none", borderRadius: "12px", padding: "1rem", cursor: "pointer", fontWeight: 800, fontSize: "1rem", fontFamily: "'Outfit', sans-serif", color: "#fff" }}>
                      Proceed to Checkout →
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {/* ── CHECKOUT MODAL ── */}
        {checkoutOpen && (
          <div onClick={() => setCheckoutOpen(false)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", zIndex: 145, display: "flex", alignItems: "center", justifyContent: "center", padding: "1rem" }}>
            <div onClick={e => e.stopPropagation()} style={{ background: "#fff", borderRadius: "24px", width: "100%", maxWidth: "520px", maxHeight: "90vh", overflowY: "auto", boxShadow: "0 30px 80px rgba(0,0,0,0.25)", fontFamily: "'Outfit', sans-serif" }}>
              {/* Header */}
              <div style={{ padding: "1.5rem 1.75rem", borderBottom: `1px solid ${C.border}`, display: "flex", justifyContent: "space-between", alignItems: "center", position: "sticky", top: 0, background: "#fff", borderRadius: "24px 24px 0 0", zIndex: 1 }}>
                <div>
                  <h2 style={{ fontWeight: 900, fontSize: "1.3rem", margin: 0, color: C.dark }}>📦 Confirm Order</h2>
                  <p style={{ margin: 0, color: C.muted, fontSize: "0.82rem", marginTop: "0.2rem" }}>{cart.length} item{cart.length !== 1 ? "s" : ""} · {INR(cartTotal)}</p>
                </div>
                <button onClick={() => setCheckoutOpen(false)} style={{ border: "none", background: "#f3f4f6", borderRadius: "50%", width: "36px", height: "36px", cursor: "pointer", fontSize: "1rem" }}>✕</button>
              </div>

              <div style={{ padding: "1.5rem 1.75rem", display: "flex", flexDirection: "column", gap: "1.5rem" }}>
                {/* Order summary */}
                <div style={{ background: C.bg, borderRadius: "16px", padding: "1rem" }}>
                  <div style={{ fontWeight: 700, fontSize: "0.82rem", color: C.muted, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "0.75rem" }}>Order Summary</div>
                  {cart.map(item => (
                    <div key={item.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0.4rem 0", borderBottom: `1px solid ${C.border}` }}>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: "0.88rem" }}>{item.name}</div>
                        <div style={{ color: C.muted, fontSize: "0.75rem" }}>{item.days} day{item.days !== 1 ? "s" : ""}</div>
                      </div>
                      <div style={{ fontWeight: 700, color: C.dark }}>{INR((item.priceDay || item.price || 0) * item.days)}</div>
                    </div>
                  ))}
                  <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 900, fontSize: "1rem", marginTop: "0.75rem", color: C.dark }}>
                    <span>Total</span><span>{INR(cartTotal)}</span>
                  </div>
                </div>

                {/* Payment method */}
                <div>
                  <div style={{ fontWeight: 700, fontSize: "0.95rem", marginBottom: "0.6rem", color: C.dark }}>💳 Payment Method</div>
                  <div style={{ background: "#f0fdf4", border: "2px solid #10b981", borderRadius: "12px", padding: "0.9rem 1.1rem", display: "flex", alignItems: "center", gap: "0.75rem" }}>
                    <span style={{ fontSize: "1.5rem" }}>💵</span>
                    <div>
                      <div style={{ fontWeight: 800, fontSize: "0.95rem", color: "#065f46" }}>Cash on Delivery</div>
                      <div style={{ fontSize: "0.78rem", color: "#059669" }}>Pay when your order is delivered</div>
                    </div>
                    <div style={{ marginLeft: "auto", width: "20px", height: "20px", borderRadius: "50%", background: "#10b981", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <span style={{ color: "#fff", fontSize: "0.7rem", fontWeight: 900 }}>✓</span>
                    </div>
                  </div>
                </div>

                {/* Delivery address */}
                <div>
                  <div style={{ fontWeight: 700, fontSize: "0.95rem", marginBottom: "0.75rem", color: C.dark }}>🏠 Delivery Address</div>
                  <div style={{ display: "flex", flexDirection: "column", gap: "0.65rem" }}>
                    {[
                      { key: "name",    label: "Full Name",       placeholder: "Enter your full name",        type: "text" },
                      { key: "phone",   label: "Phone Number",    placeholder: "+91 XXXXX XXXXX",             type: "tel"  },
                      { key: "address", label: "Street Address",  placeholder: "House no., Street, Area",     type: "text" },
                      { key: "city",    label: "City",            placeholder: "City",                        type: "text" },
                      { key: "pincode", label: "PIN Code",        placeholder: "6-digit PIN code",            type: "text" },
                    ].map(f => (
                      <div key={f.key}>
                        <label style={{ display: "block", fontSize: "0.78rem", fontWeight: 600, color: C.muted, marginBottom: "0.3rem" }}>{f.label}{" "}<span style={{ color: C.red }}>*</span></label>
                        <input
                          type={f.type}
                          placeholder={f.placeholder}
                          value={deliveryAddr[f.key]}
                          onChange={e => { setDeliveryAddr(p => ({ ...p, [f.key]: e.target.value })); setAddrErrors(p => ({ ...p, [f.key]: "" })); }}
                          style={{ width: "100%", boxSizing: "border-box", padding: "0.7rem 0.9rem", borderRadius: "10px", border: `1.5px solid ${addrErrors[f.key] ? C.red : C.border}`, outline: "none", fontFamily: "'Outfit', sans-serif", fontSize: "0.9rem", color: C.dark, background: addrErrors[f.key] ? "#fff5f5" : "#fff", transition: "border 0.15s" }}
                          onFocus={e => e.target.style.borderColor = C.dark}
                          onBlur={e => e.target.style.borderColor = addrErrors[f.key] ? C.red : C.border}
                        />
                        {addrErrors[f.key] && <div style={{ color: C.red, fontSize: "0.75rem", marginTop: "0.2rem" }}>{addrErrors[f.key]}</div>}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Terms & conditions */}
                <div style={{ background: "#fafafa", border: `1.5px solid ${termsAccepted ? C.green : C.border}`, borderRadius: "12px", padding: "1rem 1.1rem", transition: "border 0.15s" }}>
                  <label style={{ display: "flex", gap: "0.75rem", alignItems: "flex-start", cursor: "pointer" }}>
                    <input
                      type="checkbox"
                      checked={termsAccepted}
                      onChange={e => setTermsAccepted(e.target.checked)}
                      style={{ width: "18px", height: "18px", marginTop: "1px", accentColor: C.green, cursor: "pointer", flexShrink: 0 }}
                    />
                    <span style={{ fontSize: "0.82rem", color: C.dark, lineHeight: 1.55 }}>
                      I agree to the{" "}
                      <span onClick={() => { setCheckoutOpen(false); navigate("terms"); }} style={{ color: "#7c3aed", fontWeight: 700, cursor: "pointer", textDecoration: "underline" }}>Terms & Conditions</span>
                      {" "}and{" "}
                      <span onClick={() => { setCheckoutOpen(false); navigate("refund"); }} style={{ color: "#7c3aed", fontWeight: 700, cursor: "pointer", textDecoration: "underline" }}>Refund Policy</span>.
                      I understand this is a Cash on Delivery order and I must pay on delivery.
                    </span>
                  </label>
                </div>

                {/* Place order button */}
                <button
                  disabled={checkoutLoading}
                  onClick={async () => {
                    // Validate address
                    const errs = {};
                    if (!deliveryAddr.name.trim())    errs.name    = "Full name is required";
                    if (!deliveryAddr.phone.trim())   errs.phone   = "Phone number is required";
                    if (!deliveryAddr.address.trim()) errs.address = "Street address is required";
                    if (!deliveryAddr.city.trim())    errs.city    = "City is required";
                    if (!/^\d{6}$/.test(deliveryAddr.pincode.trim())) errs.pincode = "Enter a valid 6-digit PIN code";
                    if (Object.keys(errs).length) { setAddrErrors(errs); return; }
                    if (!termsAccepted) { showNotif("Please accept the Terms & Conditions to proceed.", "error"); return; }

                    setCheckoutLoading(true);
                    try {
                      const today = new Date();
                      const fmt = d => d.toISOString().split("T")[0];
                      const fullAddr = `${deliveryAddr.address}, ${deliveryAddr.city} - ${deliveryAddr.pincode}`;
                      await Promise.all(cart.map(item => {
                        const days = item.days || 1;
                        const end = new Date(today); end.setDate(end.getDate() + days);
                        return insertOrder({
                          product_id:       item.id,
                          product:          item.name,
                          user_id:          user?.supabaseId || null,
                          user_name:        deliveryAddr.name || user?.name,
                          user_email:       user?.email,
                          days,
                          start_date:       fmt(today),
                          end_date:         fmt(end),
                          amount:           (item.priceDay || item.price || 0) * days,
                          status:           "active",
                          delivery_address: fullAddr,
                          delivery_phone:   deliveryAddr.phone,
                          payment_method:   "cod",
                        });
                      }));
                      setCart([]);
                      setCheckoutOpen(false);
                      setDeliveryAddr({ name: "", phone: "", address: "", city: "", pincode: "" });
                      setTermsAccepted(false);
                      showNotif("🎉 Order placed! Pay cash on delivery.");
                    } catch (err) {
                      showNotif("Failed to place order: " + (err.message || "Unknown error"), "error");
                    } finally {
                      setCheckoutLoading(false);
                    }
                  }}
                  style={{ width: "100%", background: checkoutLoading ? "#9ca3af" : C.green, border: "none", borderRadius: "14px", padding: "1.1rem", cursor: checkoutLoading ? "not-allowed" : "pointer", fontWeight: 900, fontSize: "1.05rem", fontFamily: "'Outfit', sans-serif", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", gap: "0.5rem", transition: "background 0.2s" }}>
                  {checkoutLoading ? "⏳ Placing Order..." : "✅ Confirm Order — Cash on Delivery"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
