import { useState, useMemo, useEffect } from "react";
import {
  useProducts, useCategories, useTags, usePlans,
  useProfiles, useOrders, useFeatureFlags, useCustomFields
} from "../hooks/useSupabase";
import {
  insertProduct, updateProduct, deleteProduct,
  upsertCategory, deleteCategory,
  upsertTag, deleteTag,
  upsertPlan,
  upsertProfile,
  updateFlag as dbUpdateFlag,
  upsertCustomField, deleteCustomField,
} from "../lib/supabase";

const INR = (n) => `₹${Number(n).toLocaleString("en-IN")}`;


/* ─── Initial Data ─── */
const initialTags = [
  { id: 1, name: "Hot", color: "#ef4444", bg: "rgba(239,68,68,0.12)", emoji: "🔥", active: true },
  { id: 2, name: "Top Selling", color: "#f59e0b", bg: "rgba(245,158,11,0.12)", emoji: "⭐", active: true },
  { id: 3, name: "New Arrival", color: "#10b981", bg: "rgba(16,185,129,0.12)", emoji: "✨", active: true },
  { id: 4, name: "Limited Stock", color: "#7c3aed", bg: "rgba(124,58,237,0.12)", emoji: "⚡", active: true },
  { id: 5, name: "Best Value", color: "#2563eb", bg: "rgba(37,99,235,0.12)", emoji: "💎", active: true },
  { id: 6, name: "Popular", color: "#ec4899", bg: "rgba(236,72,153,0.12)", emoji: "❤️", active: true },
  { id: 7, name: "Featured", color: "#b45309", bg: "rgba(245,158,11,0.18)", emoji: "🌟", active: true, isBannerTag: true, maxProducts: 4 },
];

const defaultFlags = {
  subscriptionPlans: true, tagging: true, smartSearch: true, phoneVerification: true,
  emailVerification: true, customFields: true, ratingsReviews: true, productBadges: true,
  guestBrowsing: true, deliveryTracking: false, wishlist: true, compareTool: false,
};

const initialCustomFields = [
  { id: 1, key: "city", label: "City", type: "text", required: true, showInList: true, active: true },
  { id: 2, key: "phone", label: "Phone Number", type: "tel", required: true, showInList: true, active: true },
  { id: 3, key: "dob", label: "Date of Birth", type: "date", required: false, showInList: false, active: true },
  { id: 4, key: "referral", label: "Referral Code", type: "text", required: false, showInList: false, active: false },
];


const initialCategories = [
  { id: 1, name: "Electronics", icon: "📱", products: 1240, active: true },
  { id: 2, name: "Sports", icon: "⚽", products: 865, active: true },
  { id: 3, name: "Outdoor", icon: "🏕️", products: 430, active: true },
  { id: 4, name: "Gaming", icon: "🎮", products: 290, active: true },
  { id: 5, name: "Tools", icon: "🔧", products: 540, active: false },
  { id: 6, name: "Fashion", icon: "👗", products: 780, active: true },
];

const initialProducts = [
  { id: 1, name: "Sony A7 III Camera", category: "Electronics", price: 2099, priceMonth: 45000, priceYear: 420000, stock: 12, status: "active", rentals: 342, tags: [1, 2, 7], owner: "Priya Sharma", ownerEmail: "priya@email.com" },
  { id: 2, name: "DJI Mavic 3 Drone", category: "Electronics", price: 3799, priceMonth: 75000, priceYear: 720000, stock: 5, status: "active", rentals: 189, tags: [1, 7], owner: "Ananya Iyer", ownerEmail: "ananya@email.com" },
  { id: 3, name: "Trek Mountain Bike", category: "Sports", price: 1249, priceMonth: 22000, priceYear: 199000, stock: 20, status: "active", rentals: 520, tags: [2, 6, 7], owner: "Rahul Mehta", ownerEmail: "rahul@email.com" },
  { id: 4, name: "Camping Tent 6p", category: "Outdoor", price: 1649, priceMonth: 28000, priceYear: 260000, stock: 8, status: "active", rentals: 278, tags: [3, 7], owner: "Sneha Patel", ownerEmail: "sneha@email.com" },
  { id: 5, name: 'MacBook Pro 16"', category: "Electronics", price: 2899, priceMonth: 58000, priceYear: 550000, stock: 3, status: "low_stock", rentals: 645, tags: [2, 4], owner: "Priya Sharma", ownerEmail: "priya@email.com" },
  { id: 6, name: "PS5 Console", category: "Gaming", price: 999, priceMonth: 18000, priceYear: 170000, stock: 0, status: "out_of_stock", rentals: 891, tags: [1, 6], owner: "Karan Verma", ownerEmail: "karan@email.com" },
  { id: 7, name: "Surfboard", category: "Sports", price: 1849, priceMonth: 32000, priceYear: 300000, stock: 14, status: "active", rentals: 167, tags: [3, 5], owner: "Ananya Iyer", ownerEmail: "ananya@email.com" },
];

const initialPlans = [
  { name: "Starter",  price: 749,  subscribers: 1240, revenue: 928600,   rentals: 5,  features: ["5 rentals/month", "Standard delivery", "Email support", "Basic insurance"], active: true },
  { name: "Pro",      price: 2399, subscribers: 3850, revenue: 9236150,  rentals: -1, features: ["Unlimited rentals", "Priority delivery", "24/7 support", "Full insurance"], active: true },
  { name: "Business", price: 6599, subscribers: 420,  revenue: 2771580,  rentals: -1, features: ["Team accounts (5)", "Same-day delivery", "Dedicated manager", "API access"], active: true },
];

const initialUsers = [
  { id: 1, name: "Priya Sharma", email: "priya@email.com", plan: "Pro", status: "active", rentals: 24, joined: "Jan 2024", city: "Mumbai", phone: "+91 98765 43210", emailVerified: true, phoneVerified: true },
  { id: 2, name: "Rahul Mehta", email: "rahul@email.com", plan: "Starter", status: "active", rentals: 8, joined: "Mar 2024", city: "Delhi", phone: "+91 87654 32109", emailVerified: true, phoneVerified: false },
  { id: 3, name: "Ananya Iyer", email: "ananya@email.com", plan: "Business", status: "active", rentals: 67, joined: "Nov 2023", city: "Bangalore", phone: "+91 76543 21098", emailVerified: true, phoneVerified: true },
  { id: 4, name: "Karan Verma", email: "karan@email.com", plan: "Pro", status: "suspended", rentals: 3, joined: "Jun 2024", city: "Pune", phone: "+91 65432 10987", emailVerified: false, phoneVerified: false },
  { id: 5, name: "Sneha Patel", email: "sneha@email.com", plan: "Starter", status: "active", rentals: 12, joined: "Feb 2024", city: "Ahmedabad", phone: "+91 54321 09876", emailVerified: true, phoneVerified: true },
];

const initialOrders = Array.from({ length: 12 }, (_, i) => ({
  id: `RC${10045 + i}`,
  product: initialProducts[i % initialProducts.length].name,
  productId: initialProducts[i % initialProducts.length].id,
  user: initialUsers[i % initialUsers.length].name,
  userEmail: initialUsers[i % initialUsers.length].email,
  amount: initialProducts[i % initialProducts.length].price * ((i % 7) + 1),
  days: (i % 7) + 1,
  status: ["active", "active", "active", "pending", "completed"][i % 5],
  date: `${["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"][i % 12]} ${2024 + (i % 2)}`,
}));


const COLORS = {
  bg: "#fff8f3", surface: "#ffffff", surfaceHover: "#fff3ea",
  border: "#ffe0c8", accent: "#f97316", accentLight: "rgba(249,115,22,0.12)",
  gold: "#f59e0b", green: "#10b981", red: "#ef4444", blue: "#3b82f6",
  text: "#1a1a2e", muted: "#6b7280",
};

/* ─── Shared Sort/Search/Filter Toolbar ─── */
function GridToolbar({ search, onSearch, searchPlaceholder = "Search...", sortField, sortDir, onSort, sortOptions = [], filterSlots, onClear, activeFiltersCount = 0 }) {
  return (
    <div style={{ padding: "0.85rem 1.5rem", borderBottom: `1px solid ${COLORS.border}`, display: "flex", gap: "0.75rem", alignItems: "center", flexWrap: "wrap", background: COLORS.bg }}>
      {/* Search */}
      <div style={{ display: "flex", alignItems: "center", background: "#fff", border: `1px solid ${COLORS.border}`, borderRadius: "10px", padding: "0.45rem 0.9rem", gap: "0.5rem", flex: "1 1 200px", minWidth: 0 }}>
        <span style={{ color: COLORS.muted, flexShrink: 0 }}>🔍</span>
        <input value={search} onChange={e => onSearch(e.target.value)} placeholder={searchPlaceholder}
          style={{ border: "none", outline: "none", background: "transparent", color: COLORS.text, fontFamily: "'DM Sans', sans-serif", fontSize: "0.88rem", width: "100%", minWidth: 0 }} />
        {search && <button onClick={() => onSearch("")} style={{ border: "none", background: "none", cursor: "pointer", color: COLORS.muted, fontSize: "0.8rem", flexShrink: 0 }}>✕</button>}
      </div>
      {/* Sort */}
      {sortOptions.length > 0 && (
        <div style={{ display: "flex", gap: "0.4rem", alignItems: "center" }}>
          <select value={sortField} onChange={e => onSort(e.target.value, sortDir)}
            style={{ background: "#fff", border: `1px solid ${COLORS.border}`, borderRadius: "10px", padding: "0.45rem 0.75rem", color: COLORS.text, fontFamily: "'DM Sans', sans-serif", fontSize: "0.85rem", outline: "none", cursor: "pointer" }}>
            <option value="">Sort by...</option>
            {sortOptions.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
          <button onClick={() => onSort(sortField, sortDir === "asc" ? "desc" : "asc")}
            style={{ background: "#fff", border: `1px solid ${COLORS.border}`, borderRadius: "8px", padding: "0.45rem 0.6rem", cursor: "pointer", fontSize: "0.9rem", color: COLORS.text }}>
            {sortDir === "asc" ? "↑" : "↓"}
          </button>
        </div>
      )}
      {/* Filter slots */}
      {filterSlots}
      {/* Clear */}
      {(search || activeFiltersCount > 0) && (
        <button onClick={onClear} style={{ background: "rgba(239,68,68,0.1)", border: "none", borderRadius: "8px", padding: "0.45rem 0.85rem", cursor: "pointer", color: COLORS.red, fontFamily: "'DM Sans', sans-serif", fontSize: "0.82rem", fontWeight: 600, whiteSpace: "nowrap" }}>
          ✕ Clear {activeFiltersCount > 0 ? `(${activeFiltersCount})` : ""}
        </button>
      )}
    </div>
  );
}

/* ─── Sortable Column Header ─── */
function SortableCol({ label, field, sortField, sortDir, onSort, style = {} }) {
  const active = sortField === field;
  return (
    <span onClick={() => onSort(field, active && sortDir === "asc" ? "desc" : "asc")}
      style={{ cursor: "pointer", userSelect: "none", display: "inline-flex", alignItems: "center", gap: "0.25rem", ...style }}>
      {label} <span style={{ opacity: active ? 1 : 0.3, fontSize: "0.7rem" }}>{active ? (sortDir === "asc" ? "↑" : "↓") : "↕"}</span>
    </span>
  );
}

/* ─── Pagination Component ─── */
function Pagination({ total, page, perPage, onPage, onPerPage }) {
  const totalPages = Math.max(1, Math.ceil(total / perPage));
  const pages = [];
  for (let i = 1; i <= totalPages; i++) {
    if (i === 1 || i === totalPages || (i >= page - 1 && i <= page + 1)) pages.push(i);
    else if (pages[pages.length - 1] !== "...") pages.push("...");
  }
  const btnBase = { border: "none", borderRadius: "8px", padding: "0.4rem 0.75rem", cursor: "pointer", fontFamily: "'DM Sans', sans-serif", fontSize: "0.82rem", fontWeight: 600, transition: "all 0.15s" };
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0.85rem 1.5rem", borderTop: `1px solid ${COLORS.border}`, background: COLORS.bg, flexWrap: "wrap", gap: "0.75rem" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
        <span style={{ color: COLORS.muted, fontSize: "0.82rem" }}>Rows per page:</span>
        <select value={perPage} onChange={e => { onPerPage(+e.target.value); onPage(1); }}
          style={{ background: "#fff", border: `1px solid ${COLORS.border}`, borderRadius: "8px", padding: "0.3rem 0.6rem", color: COLORS.text, fontFamily: "'DM Sans', sans-serif", fontSize: "0.82rem", outline: "none", cursor: "pointer" }}>
          {[5, 10, 20, 50].map(n => <option key={n} value={n}>{n}</option>)}
        </select>
        <span style={{ color: COLORS.muted, fontSize: "0.82rem" }}>
          {Math.min((page - 1) * perPage + 1, total)}–{Math.min(page * perPage, total)} of {total}
        </span>
      </div>
      <div style={{ display: "flex", gap: "0.3rem", alignItems: "center" }}>
        <button onClick={() => onPage(1)} disabled={page === 1} style={{ ...btnBase, background: page === 1 ? COLORS.bg : "#fff", color: page === 1 ? COLORS.muted : COLORS.text, border: `1px solid ${COLORS.border}` }}>«</button>
        <button onClick={() => onPage(page - 1)} disabled={page === 1} style={{ ...btnBase, background: page === 1 ? COLORS.bg : "#fff", color: page === 1 ? COLORS.muted : COLORS.text, border: `1px solid ${COLORS.border}` }}>‹</button>
        {pages.map((p, i) => p === "..." ? (
          <span key={`e${i}`} style={{ padding: "0.4rem 0.4rem", color: COLORS.muted, fontSize: "0.82rem" }}>…</span>
        ) : (
          <button key={p} onClick={() => onPage(p)}
            style={{ ...btnBase, background: p === page ? COLORS.accent : "#fff", color: p === page ? "#fff" : COLORS.text, border: `1px solid ${p === page ? COLORS.accent : COLORS.border}`, minWidth: "32px" }}>{p}</button>
        ))}
        <button onClick={() => onPage(page + 1)} disabled={page === totalPages} style={{ ...btnBase, background: page === totalPages ? COLORS.bg : "#fff", color: page === totalPages ? COLORS.muted : COLORS.text, border: `1px solid ${COLORS.border}` }}>›</button>
        <button onClick={() => onPage(totalPages)} disabled={page === totalPages} style={{ ...btnBase, background: page === totalPages ? COLORS.bg : "#fff", color: page === totalPages ? COLORS.muted : COLORS.text, border: `1px solid ${COLORS.border}` }}>»</button>
      </div>
    </div>
  );
}

/* ─── Admin Login ─── */
function AdminLogin({ onLogin }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPass, setShowPass] = useState(false);
  const [focused, setFocused] = useState(null);

  const ADMIN_EMAIL    = import.meta.env.VITE_ADMIN_EMAIL
  const ADMIN_PASSWORD = import.meta.env.VITE_ADMIN_PASSWORD

  const handleLogin = () => {
    setError("");
    if (!email || !password) { setError("Please fill in all fields."); return; }
    if (!ADMIN_EMAIL || !ADMIN_PASSWORD) {
      setError("Admin credentials not configured. Add VITE_ADMIN_EMAIL and VITE_ADMIN_PASSWORD to your environment variables.");
      return;
    }
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      if (email === ADMIN_EMAIL && password === ADMIN_PASSWORD) {
        onLogin({ name: "Admin", email });
      } else {
        setError("Invalid email or password.");
      }
    }, 1200);
  };

  const inp = (id) => ({
    width: "100%", background: "#fff", border: `1.5px solid ${focused === id ? COLORS.accent : COLORS.border}`,
    borderRadius: "12px", padding: "0.9rem 1rem", color: COLORS.text, outline: "none",
    fontSize: "0.95rem", fontFamily: "'DM Sans', sans-serif", boxSizing: "border-box", transition: "border-color 0.2s"
  });

  return (
    <div style={{ minHeight: "100vh", background: COLORS.bg, display: "flex", fontFamily: "'DM Sans', sans-serif" }}>
      <div style={{ flex: 1, background: "linear-gradient(135deg, #fff4ec 0%, #ffe8d6 50%, #fff8f3 100%)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "3rem", position: "relative", overflow: "hidden" }}>
        {[{ size: 400, x: -100, y: -100 }, { size: 300, x: "60%", y: "60%" }, { size: 200, x: "30%", y: "80%" }].map((c, i) => (
          <div key={i} style={{ position: "absolute", width: c.size, height: c.size, left: c.x, top: c.y, borderRadius: "50%", border: "2px solid rgba(249,115,22,0.15)", background: "radial-gradient(circle, rgba(249,115,22,0.05) 0%, transparent 70%)" }} />
        ))}
        <div style={{ position: "relative", zIndex: 1, textAlign: "center", maxWidth: "400px" }}>
          <div style={{ fontSize: "3rem", marginBottom: "1rem" }}>🏪</div>
          <h2 style={{ fontWeight: 900, fontSize: "2rem", color: COLORS.text, marginBottom: "0.5rem" }}>RentCircle</h2>
          <div style={{ color: "rgba(100,60,20,0.6)", fontSize: "0.9rem", marginBottom: "3rem", letterSpacing: "0.1em", textTransform: "uppercase" }}>Admin Portal</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", marginBottom: "2rem" }}>
            {[{ label: "Total Revenue", val: "₹1.29 Cr", icon: "💰" }, { label: "Active Users", val: "5,510", icon: "👥" }, { label: "Rentals Today", val: "8", icon: "📦" }, { label: "New Orders", val: "12", icon: "🛒" }].map(s => (
              <div key={s.label} style={{ background: "rgba(249,115,22,0.08)", borderRadius: "14px", padding: "1rem", border: "1px solid rgba(249,115,22,0.15)", textAlign: "left" }}>
                <div style={{ fontSize: "1.4rem", marginBottom: "0.4rem" }}>{s.icon}</div>
                <div style={{ color: COLORS.gold, fontSize: "1.3rem", fontWeight: 800 }}>{s.val}</div>
                <div style={{ color: "rgba(120,60,10,0.6)", fontSize: "0.75rem" }}>{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
      <div style={{ width: "460px", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", padding: "2rem" }}>
        <div style={{ width: "100%", maxWidth: "380px" }}>
          <div style={{ width: "60px", height: "60px", borderRadius: "18px", background: COLORS.accentLight, border: `2px solid ${COLORS.accent}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.7rem", marginBottom: "1.5rem" }}>🔐</div>
          <h1 style={{ fontSize: "1.9rem", fontWeight: 900, color: COLORS.text, marginBottom: "0.4rem" }}>Admin Sign In</h1>
          <p style={{ color: COLORS.muted, marginBottom: "2rem", fontSize: "0.9rem" }}>Enter your credentials to access the dashboard</p>
          {error && <div style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", borderRadius: "10px", padding: "0.75rem 1rem", marginBottom: "1rem", color: COLORS.red, fontSize: "0.85rem" }}>⚠ {error}</div>}
          <div style={{ marginBottom: "1rem" }}>
            <label style={{ display: "block", color: COLORS.muted, fontSize: "0.78rem", fontWeight: 700, marginBottom: "0.4rem", textTransform: "uppercase", letterSpacing: "0.06em" }}>Email</label>
            <input style={inp("email")} type="email" placeholder="Enter admin email" value={email} onChange={e => setEmail(e.target.value)} onFocus={() => setFocused("email")} onBlur={() => setFocused(null)} onKeyDown={e => e.key === "Enter" && handleLogin()} />
          </div>
          <div style={{ marginBottom: "1.5rem" }}>
            <label style={{ display: "block", color: COLORS.muted, fontSize: "0.78rem", fontWeight: 700, marginBottom: "0.4rem", textTransform: "uppercase", letterSpacing: "0.06em" }}>Password</label>
            <div style={{ position: "relative" }}>
              <input style={{ ...inp("pass"), paddingRight: "3rem" }} type={showPass ? "text" : "password"} placeholder="••••••••" value={password} onChange={e => setPassword(e.target.value)} onFocus={() => setFocused("pass")} onBlur={() => setFocused(null)} onKeyDown={e => e.key === "Enter" && handleLogin()} />
              <button onClick={() => setShowPass(s => !s)} style={{ position: "absolute", right: "0.75rem", top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: COLORS.muted, fontSize: "1rem" }}>{showPass ? "🙈" : "👁"}</button>
            </div>
          </div>
          <button onClick={handleLogin} disabled={loading} style={{ width: "100%", background: loading ? "rgba(249,115,22,0.5)" : COLORS.accent, border: "none", borderRadius: "12px", padding: "1rem", color: "#fff", cursor: loading ? "not-allowed" : "pointer", fontWeight: 800, fontSize: "1rem", fontFamily: "'DM Sans', sans-serif", display: "flex", alignItems: "center", justifyContent: "center", gap: "0.75rem" }}>
            {loading ? <><span style={{ animation: "spin 0.8s linear infinite", display: "inline-block" }}>⏳</span> Authenticating...</> : "Sign In to Dashboard →"}
          </button>
        </div>
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

/* ─── Tag Badge ─── */
function TagBadge({ tag, small }) {
  if (!tag) return null;
  return (
    <span style={{ background: tag.bg, color: tag.color, borderRadius: "6px", padding: small ? "0.15rem 0.4rem" : "0.2rem 0.55rem", fontSize: small ? "0.68rem" : "0.75rem", fontWeight: 700, display: "inline-flex", alignItems: "center", gap: "0.2rem", whiteSpace: "nowrap" }}>
      {tag.emoji} {tag.name}
    </span>
  );
}

/* ─── Admin Dashboard ─── */
export default function AdminPortal() {
  const [adminUser, setAdminUser] = useState(null);
  const [activeSection, setActiveSection] = useState("dashboard");
  const { categories, save: saveCategory, remove: removeCategory } = useCategories(initialCategories);
  const { products, setProducts, add: addProduct, update: updateProductDb, remove: removeProduct } = useProducts(initialProducts);
  const { plans, save: savePlanDb } = usePlans(initialPlans);
  const { users, save: saveUserDb } = useProfiles(initialUsers);
  const { tags, setTags, save: saveTagDb, remove: removeTagDb } = useTags(initialTags);
  const { flags: featureFlags, toggle: toggleFlag } = useFeatureFlags(defaultFlags);
  const { customFields, save: saveCustomFieldDb, remove: removeCustomFieldDb } = useCustomFields(initialCustomFields);
  const { orders } = useOrders(initialOrders);
  const [modal, setModal] = useState(null);
  const [formData, setFormData] = useState({});
  const [modalErrors, setModalErrors] = useState({});
  const [notification, setNotification] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  // Per-section search/sort/filter state
  const [pSearch, setPSearch] = useState(""); const [pSort, setPSort] = useState(""); const [pDir, setPDir] = useState("asc"); const [pCatFilter, setPCatFilter] = useState(""); const [pStatusFilter, setPStatusFilter] = useState(""); const [pUserFilter, setPUserFilter] = useState("");
  const [uSearch, setUSearch] = useState(""); const [uSort, setUSort] = useState(""); const [uDir, setUDir] = useState("asc"); const [uPlanFilter, setUPlanFilter] = useState(""); const [uStatusFilter, setUStatusFilter] = useState("");
  const [oSearch, setOSearch] = useState(""); const [oSort, setOSort] = useState(""); const [oDir, setODir] = useState("asc"); const [oStatusFilter, setOStatusFilter] = useState("");
  const [cSearch, setCSearch] = useState(""); const [tSearch, setTSearch] = useState("");
  // Pagination state: [page, perPage] for each grid
  const [pPage, setPPage] = useState(1); const [pPerPage, setPPerPage] = useState(10);
  const [uPage, setUPage] = useState(1); const [uPerPage, setUPerPage] = useState(10);
  const [oPage, setOPage] = useState(1); const [oPerPage, setOPerPage] = useState(10);
  const [cPage, setCPage] = useState(1); const [cPerPage, setCPerPage] = useState(10);
  const [tPage, setTPage] = useState(1); const [tPerPage, setTPerPage] = useState(10);

  /* ─── Data Processing (hooks must be before any early return) ─── */
  const sortAndFilter = (arr, search, searchKeys, sortField, sortDir, extraFilters = []) => {
    let result = arr.filter(item => {
      const matchSearch = !search || searchKeys.some(k => String(item[k] || "").toLowerCase().includes(search.toLowerCase()));
      const matchExtra = extraFilters.every(([val, fn]) => !val || fn(item, val));
      return matchSearch && matchExtra;
    });
    if (sortField) result = [...result].sort((a, b) => {
      const av = a[sortField], bv = b[sortField];
      if (typeof av === "number") return sortDir === "asc" ? av - bv : bv - av;
      return sortDir === "asc" ? String(av).localeCompare(String(bv)) : String(bv).localeCompare(String(av));
    });
    return result;
  };

  const filteredProducts = useMemo(() => sortAndFilter(products, pSearch, ["name", "category", "owner"], pSort, pDir, [
    [pCatFilter, (p, v) => p.category === v],
    [pStatusFilter, (p, v) => p.status === v],
    [pUserFilter, (p, v) => p.ownerEmail === v],
  ]), [products, pSearch, pSort, pDir, pCatFilter, pStatusFilter, pUserFilter]);

  const filteredUsers = useMemo(() => sortAndFilter(users, uSearch, ["name", "email", "city"], uSort, uDir, [
    [uPlanFilter, (u, v) => u.plan === v],
    [uStatusFilter, (u, v) => u.status === v],
  ]), [users, uSearch, uSort, uDir, uPlanFilter, uStatusFilter]);

  const filteredCategories = useMemo(() => categories.filter(c => !cSearch || c.name.toLowerCase().includes(cSearch.toLowerCase())), [categories, cSearch]);
  const filteredTags = useMemo(() => tags.filter(t => !tSearch || t.name.toLowerCase().includes(tSearch.toLowerCase())), [tags, tSearch]);

  const filteredOrders = useMemo(() => sortAndFilter(orders, oSearch, ["id", "product", "user"], oSort, oDir, [
    [oStatusFilter, (o, v) => o.status === v],
  ]), [orders, oSearch, oSort, oDir, oStatusFilter]);

  /* ─── Early return after all hooks ─── */
  if (!adminUser) return <AdminLogin onLogin={u => setAdminUser(u)} />;

  const showNotif = (msg, type = "success") => { setNotification({ msg, type }); setTimeout(() => setNotification(null), 3500); };
  const openModal = (type, data = {}) => { setModal(type); setFormData({ ...data }); };
  const closeModal = () => { setModal(null); setFormData({}); setModalErrors({}); };

  const updateFlag = async (key, val) => {
    await toggleFlag(key, val);
    showNotif(`${key} ${val ? "enabled" : "disabled"}`);
  };

  const saveCategoryFn = async () => {
    try {
      await saveCategory({ ...formData, ...(formData.id ? {} : { products: 0, active: true }) });
      showNotif(formData.id ? "Category updated!" : "Category created!"); closeModal();
    } catch (e) { showNotif("Failed: " + e.message, "error"); }
  };
  const saveProduct = async () => {
    const priceDay = formData.priceDay || formData.price || 0;
    const errs = {};
    if (!formData.name?.trim()) errs.name = "Product name is required";
    if (!priceDay || Number(priceDay) <= 0) errs.priceDay = "Price per day is required";
    if (formData.stock === "" || formData.stock === undefined || formData.stock === null) errs.stock = "Stock is required";
    if (Object.keys(errs).length) { setModalErrors(errs); return; }
    setModalErrors({});
    const data = { ...formData, priceDay, price: priceDay, priceMonth: formData.priceMonth || Math.round(priceDay * 25), priceYear: formData.priceYear || Math.round(priceDay * 280), tags: formData.tags || [] };
    try {
      if (data.id) await updateProductDb(data.id, data);
      else await addProduct(data);
      showNotif(data.id ? "Product updated!" : "Product added!"); closeModal();
    } catch (e) { showNotif("Save failed: " + e.message, "error"); }
  };
  const savePlan = async () => {
    try {
      await savePlanDb({ ...formData, ...(formData.id ? {} : { subscribers: 0, revenue: 0, active: true }) });
      showNotif(formData.id ? "Plan updated!" : "Plan created!"); closeModal();
    } catch (e) { showNotif("Failed: " + e.message, "error"); }
  };
  const saveUser = async () => {
    if (!formData.name || !formData.email) return;
    try {
      await saveUserDb({ ...formData, ...(formData.id ? {} : { rentals: 0, joined: new Date().toLocaleDateString("en-IN", { month: "short", year: "numeric" }), status: formData.status || "active", emailVerified: false, phoneVerified: false }) });
      showNotif(formData.id ? "User updated!" : "User added!"); closeModal();
    } catch (e) { showNotif("Failed: " + e.message, "error"); }
  };
  const saveTag = async () => {
    if (!formData.name) return;
    try {
      await saveTagDb({ ...formData, ...(formData.id ? {} : { active: true }) });
      showNotif(formData.id ? "Tag updated!" : "Tag created!"); closeModal();
    } catch (e) { showNotif("Failed: " + e.message, "error"); }
  };
  const saveCustomField = async () => {
    if (!formData.key || !formData.label) return;
    try {
      await saveCustomFieldDb({ ...formData, ...(formData.id ? {} : { active: true }) });
      showNotif(formData.id ? "Field updated!" : "Field created!"); closeModal();
    } catch (e) { showNotif("Failed: " + e.message, "error"); }
  };

  /* ─── Styles ─── */
  const navItems = [
    { id: "dashboard", icon: "⊞", label: "Dashboard" },
    { id: "categories", icon: "◫", label: "Categories" },
    { id: "products", icon: "◈", label: "Products" },
    { id: "tags", icon: "🏷", label: "Tags" },
    { id: "plans", icon: "◉", label: "Plans" },
    { id: "users", icon: "◎", label: "Users" },
    { id: "orders", icon: "◻", label: "Orders" },
    { id: "analytics", icon: "◬", label: "Analytics" },
    { id: "settings", icon: "⚙", label: "Settings" },
  ];

  const s = {
    app: { display: "flex", minHeight: "100vh", background: COLORS.bg, color: COLORS.text, fontFamily: "'DM Sans', sans-serif" },
    sidebar: { width: sidebarOpen ? "240px" : "72px", background: COLORS.surface, borderRight: `1px solid ${COLORS.border}`, transition: "width 0.3s", flexShrink: 0, display: "flex", flexDirection: "column" },
    navItem: (active) => ({ display: "flex", alignItems: "center", gap: "0.75rem", padding: "0.7rem 1.2rem", cursor: "pointer", borderRadius: "10px", margin: "0.1rem 0.7rem", background: active ? COLORS.accentLight : "transparent", color: active ? COLORS.accent : COLORS.muted, borderLeft: active ? `3px solid ${COLORS.accent}` : "3px solid transparent", transition: "all 0.2s", whiteSpace: "nowrap", overflow: "hidden", fontSize: "0.88rem", fontWeight: active ? 600 : 400 }),
    main: { flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" },
    topbar: { background: COLORS.surface, borderBottom: `1px solid ${COLORS.border}`, padding: "0.9rem 2rem", display: "flex", alignItems: "center", justifyContent: "space-between" },
    content: { flex: 1, overflowY: "auto", padding: "1.75rem" },
    card: { background: COLORS.surface, borderRadius: "16px", border: `1px solid ${COLORS.border}`, overflow: "hidden" },
    th: (cols) => ({ display: "grid", gridTemplateColumns: cols, padding: "0.85rem 1.5rem", color: COLORS.muted, fontSize: "0.78rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", borderBottom: `1px solid ${COLORS.border}`, background: COLORS.bg }),
    tr: (cols) => ({ display: "grid", gridTemplateColumns: cols, padding: "0.9rem 1.5rem", alignItems: "center", borderBottom: `1px solid ${COLORS.border}`, transition: "background 0.15s", cursor: "default" }),
    badge: (st) => {
      const m = { active: [COLORS.green, "rgba(16,185,129,0.1)"], suspended: [COLORS.red, "rgba(239,68,68,0.1)"], out_of_stock: [COLORS.red, "rgba(239,68,68,0.1)"], low_stock: [COLORS.gold, "rgba(245,158,11,0.1)"], inactive: [COLORS.muted, "rgba(107,114,128,0.1)"], completed: [COLORS.blue, "rgba(59,130,246,0.1)"], pending: [COLORS.gold, "rgba(245,158,11,0.1)"], cancelled: [COLORS.muted, "rgba(107,114,128,0.1)"] };
      const [color, bg] = m[st] || [COLORS.muted, "rgba(107,114,128,0.1)"];
      return { background: bg, color, borderRadius: "6px", padding: "0.2rem 0.55rem", fontSize: "0.72rem", fontWeight: 700, display: "inline-block" };
    },
    btn: (v = "primary") => ({ border: "none", borderRadius: "9px", padding: "0.55rem 1.1rem", cursor: "pointer", fontFamily: "'DM Sans', sans-serif", fontWeight: 600, fontSize: "0.83rem", background: v === "primary" ? COLORS.accent : v === "danger" ? "rgba(239,68,68,0.1)" : v === "success" ? "rgba(16,185,129,0.12)" : COLORS.surfaceHover, color: v === "danger" ? COLORS.red : v === "success" ? COLORS.green : v === "primary" ? "#fff" : COLORS.text }),
    inp: { width: "100%", background: COLORS.bg, border: `1px solid ${COLORS.border}`, borderRadius: "10px", padding: "0.65rem 1rem", color: COLORS.text, outline: "none", fontFamily: "'DM Sans', sans-serif", fontSize: "0.9rem", boxSizing: "border-box", marginBottom: "0.9rem" },
    lbl: { display: "block", color: COLORS.muted, fontSize: "0.75rem", fontWeight: 700, marginBottom: "0.35rem", textTransform: "uppercase", letterSpacing: "0.05em" },
    modal: { position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 300, padding: "1rem" },
    mbox: { background: COLORS.surface, borderRadius: "20px", padding: "2rem", width: "100%", maxWidth: "520px", border: `1px solid ${COLORS.border}`, maxHeight: "90vh", overflowY: "auto" },
  };

  const selectStyle = { ...s.inp, cursor: "pointer" };
  const filterSelect = (value, onChange, options, placeholder) => (
    <select value={value} onChange={e => onChange(e.target.value)}
      style={{ background: "#fff", border: `1px solid ${COLORS.border}`, borderRadius: "10px", padding: "0.45rem 0.75rem", color: value ? COLORS.text : COLORS.muted, fontFamily: "'DM Sans', sans-serif", fontSize: "0.85rem", outline: "none", cursor: "pointer" }}>
      <option value="">{placeholder}</option>
      {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
    </select>
  );

  /* ─── Stat Card ─── */
  const statCard = (label, value, change, pos, icon) => (
    <div style={{ background: COLORS.surface, borderRadius: "16px", padding: "1.4rem", border: `1px solid ${COLORS.border}`, position: "relative", overflow: "hidden" }}>
      <div style={{ position: "absolute", top: 0, right: 0, width: "70px", height: "70px", background: `radial-gradient(circle, ${COLORS.accentLight} 0%, transparent 70%)` }} />
      <div style={{ fontSize: "1.4rem", marginBottom: "0.6rem" }}>{icon}</div>
      <div style={{ color: COLORS.muted, fontSize: "0.82rem", marginBottom: "0.3rem" }}>{label}</div>
      <div style={{ fontSize: "1.7rem", fontWeight: 800, letterSpacing: "-0.03em" }}>{value}</div>
      <div style={{ fontSize: "0.78rem", color: pos ? COLORS.green : COLORS.red, fontWeight: 600, marginTop: "0.3rem" }}>{pos ? "↑" : "↓"} {change} vs last month</div>
    </div>
  );

  /* ─── DASHBOARD ─── */
  const renderDashboard = () => (
    <>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem" }}>
        <div><h2 style={{ fontSize: "1.4rem", fontWeight: 800 }}>Dashboard</h2><p style={{ color: COLORS.muted, fontSize: "0.88rem" }}>Welcome back, {adminUser.name} 👋</p></div>
        <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
          {Object.entries(featureFlags).slice(0, 3).map(([k, v]) => (
            <div key={k} style={{ background: v ? "rgba(16,185,129,0.1)" : "rgba(107,114,128,0.08)", borderRadius: "8px", padding: "0.3rem 0.7rem", fontSize: "0.72rem", fontWeight: 600, color: v ? COLORS.green : COLORS.muted }}>
              {v ? "✓" : "✗"} {k.replace(/([A-Z])/g, " $1").replace(/^./, s => s.toUpperCase())}
            </div>
          ))}
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: "1.1rem", marginBottom: "1.75rem" }}>
        {statCard("Total Revenue", "₹1.29 Cr", "+12.5%", true, "💰")}
        {statCard("Active Rentals", "3,032", "+8.3%", true, "📦")}
        {statCard("Total Users", plans.reduce((s,p) => s+p.subscribers, 0).toLocaleString("en-IN"), "+23.1%", true, "👥")}
        {statCard("Products", products.length.toString(), "+2", true, "🏷️")}
        {statCard("Tags Active", tags.filter(t => t.active).length, "+1", true, "🔖")}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: "1.5rem" }}>
        <div style={s.card}>
          <div style={{ padding: "1.25rem 1.5rem 0", fontWeight: 700, fontSize: "0.95rem" }}>Recent Orders</div>
          <div style={s.th("2fr 1fr 1fr 1fr")}><span>Product</span><span>User</span><span>Amount</span><span>Status</span></div>
          {filteredOrders.slice(0, 5).map((o, i) => (
            <div key={i} style={s.tr("2fr 1fr 1fr 1fr")} onMouseEnter={e => e.currentTarget.style.background = COLORS.surfaceHover} onMouseLeave={e => e.currentTarget.style.background = ""}>
              <span style={{ fontWeight: 600, fontSize: "0.88rem" }}>{o.product}</span>
              <span style={{ color: COLORS.muted, fontSize: "0.82rem" }}>{o.user.split(" ")[0]}</span>
              <span style={{ color: COLORS.green, fontWeight: 700, fontSize: "0.88rem" }}>{INR(o.amount)}</span>
              <span style={s.badge(o.status)}>{o.status}</span>
            </div>
          ))}
        </div>
        <div style={s.card}>
          <div style={{ padding: "1.25rem 1.5rem", fontWeight: 700, borderBottom: `1px solid ${COLORS.border}`, fontSize: "0.95rem" }}>Plan Distribution</div>
          {plans.map(plan => (
            <div key={plan.id} style={{ padding: "0.9rem 1.5rem", borderBottom: `1px solid ${COLORS.border}` }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.4rem" }}>
                <span style={{ fontWeight: 600, fontSize: "0.88rem" }}>{plan.name}</span>
                <span style={{ color: COLORS.muted, fontSize: "0.82rem" }}>{plan.subscribers.toLocaleString("en-IN")}</span>
              </div>
              <div style={{ background: COLORS.bg, borderRadius: "4px", height: "6px", overflow: "hidden" }}>
                <div style={{ height: "100%", borderRadius: "4px", background: COLORS.accent, width: `${(plan.subscribers / plans.reduce((s,p) => s+p.subscribers, 0) * 100).toFixed(0)}%`, transition: "width 0.5s" }} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  );

  /* ─── CATEGORIES ─── */
  const renderCategories = () => (
    <>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.25rem" }}>
        <div><h2 style={{ fontSize: "1.4rem", fontWeight: 800 }}>Categories</h2><p style={{ color: COLORS.muted, fontSize: "0.85rem" }}>{filteredCategories.length} of {categories.length} shown</p></div>
        <button style={s.btn("primary")} onClick={() => openModal("category", { icon: "📦" })}>+ Add Category</button>
      </div>
      {/* Search */}
      <div style={{ marginBottom: "1rem" }}>
        <GridToolbar search={cSearch} onSearch={setCSearch} searchPlaceholder="Search categories..." sortOptions={[]} onSort={() => {}} sortField="" sortDir="asc" onClear={() => setCSearch("")} />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: "1.1rem" }}>
        {filteredCategories.slice((cPage-1)*cPerPage, cPage*cPerPage).map(cat => (
          <div key={cat.id} style={{ ...s.card, padding: "1.4rem" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.9rem", marginBottom: "0.9rem" }}>
              <div style={{ width: "44px", height: "44px", background: COLORS.accentLight, borderRadius: "12px", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.4rem", flexShrink: 0 }}>{cat.icon}</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700 }}>{cat.name}</div>
                <div style={{ color: COLORS.muted, fontSize: "0.78rem" }}>{cat.products.toLocaleString("en-IN")} products</div>
              </div>
              <span style={s.badge(cat.active ? "active" : "inactive")}>{cat.active ? "Active" : "Off"}</span>
            </div>
            <div style={{ display: "flex", gap: "0.5rem" }}>
              <button style={{ ...s.btn("secondary"), flex: 1 }} onClick={() => openModal("category", { ...cat })}>Edit</button>
              <button style={s.btn("danger")} onClick={async () => {
                if (!window.confirm(`Delete "${cat.name}"? Products in this category will remain but lose their category link.`)) return;
                try {
                  await removeCategory(cat.id);
                  showNotif("Category deleted", "error");
                } catch (e) {
                  const msg = e.message?.includes("foreign key") || e.message?.includes("violates")
                    ? "Cannot delete — products still use this category. Reassign them first."
                    : e.message?.includes("permission") || e.message?.includes("policy")
                    ? "Permission denied — run supabase/admin-write-policies.sql in Supabase SQL Editor."
                    : "Delete failed: " + e.message;
                  showNotif(msg, "error");
                }
              }}>Delete</button>
            </div>
          </div>
        ))}
      </div>
      <div style={{ marginTop: "1rem", background: COLORS.surface, borderRadius: "12px", border: `1px solid ${COLORS.border}` }}>
        <Pagination total={filteredCategories.length} page={cPage} perPage={cPerPage} onPage={setCPage} onPerPage={(n) => { setCPerPage(n); setCPage(1); }} />
      </div>
    </>
  );

  /* ─── PRODUCTS ─── */
  const renderProducts = () => {
    const pSortOpts = [["name","Name"],["price","Price/Day"],["stock","Stock"],["rentals","Rentals"],["category","Category"],["owner","Owner"]];
    const ownerOptions = [...new Map(products.filter(p => p.owner).map(p => [p.ownerEmail, p.owner])).entries()].map(([email, name]) => [email, name]);
    return (
      <>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.25rem" }}>
          <div><h2 style={{ fontSize: "1.4rem", fontWeight: 800 }}>Products</h2><p style={{ color: COLORS.muted, fontSize: "0.85rem" }}>{filteredProducts.length} of {products.length} products</p></div>
          <button style={s.btn("primary")} onClick={() => openModal("product", { price: 999, stock: 1, category: "Electronics", tags: [] })}>+ Add Product</button>
        </div>
        <div style={s.card}>
          <GridToolbar
            search={pSearch} onSearch={setPSearch} searchPlaceholder="Search products, owner..."
            sortField={pSort} sortDir={pDir} onSort={(f, d) => { setPSort(f); setPDir(d); }} sortOptions={pSortOpts}
            filterSlots={<>
              {filterSelect(pCatFilter, setPCatFilter, [...new Set(products.map(p => p.category))].map(c => [c, c]), "All Categories")}
              {filterSelect(pStatusFilter, setPStatusFilter, [["active","Active"],["low_stock","Low Stock"],["out_of_stock","Out of Stock"]], "All Status")}
              {filterSelect(pUserFilter, setPUserFilter, ownerOptions, "All Owners")}
            </>}
            onClear={() => { setPSearch(""); setPSort(""); setPCatFilter(""); setPStatusFilter(""); setPUserFilter(""); setPPage(1); }}
            activeFiltersCount={[pCatFilter, pStatusFilter, pUserFilter].filter(Boolean).length}
          />
          <div style={s.th("2fr 1fr 0.9fr 0.7fr 0.7fr 1.5fr 1.2fr 1.4fr")}>
            <SortableCol label="Product" field="name" sortField={pSort} sortDir={pDir} onSort={(f,d) => { setPSort(f); setPDir(d); }} />
            <SortableCol label="Category" field="category" sortField={pSort} sortDir={pDir} onSort={(f,d) => { setPSort(f); setPDir(d); }} />
            <SortableCol label="Price/Day" field="price" sortField={pSort} sortDir={pDir} onSort={(f,d) => { setPSort(f); setPDir(d); }} />
            <SortableCol label="Stock" field="stock" sortField={pSort} sortDir={pDir} onSort={(f,d) => { setPSort(f); setPDir(d); }} />
            <SortableCol label="Rentals" field="rentals" sortField={pSort} sortDir={pDir} onSort={(f,d) => { setPSort(f); setPDir(d); }} />
            <SortableCol label="Owner" field="owner" sortField={pSort} sortDir={pDir} onSort={(f,d) => { setPSort(f); setPDir(d); }} />
            <span>Tags</span>
            <span>Actions</span>
          </div>
          {filteredProducts.length === 0 && <div style={{ padding: "3rem", textAlign: "center", color: COLORS.muted }}>No products match your filters</div>}
          {filteredProducts.slice((pPage-1)*pPerPage, pPage*pPerPage).map(p => {
            const ownerUser = users.find(u => u.email === p.ownerEmail);
            return (
            <div key={p.id} style={s.tr("2fr 1fr 0.9fr 0.7fr 0.7fr 1.5fr 1.2fr 1.4fr")} onMouseEnter={e => e.currentTarget.style.background = COLORS.surfaceHover} onMouseLeave={e => e.currentTarget.style.background = ""}>
              <div>
                <div style={{ fontWeight: 600, fontSize: "0.88rem" }}>{p.name}</div>
                <div style={{ fontSize: "0.72rem", color: COLORS.muted }}>{p.status.replace("_"," ")}</div>
              </div>
              <span style={{ color: COLORS.muted, fontSize: "0.85rem" }}>{p.category}</span>
              <span style={{ color: COLORS.gold, fontWeight: 700 }}>{INR(p.price)}</span>
              <span style={{ color: p.stock === 0 ? COLORS.red : p.stock < 5 ? COLORS.gold : COLORS.green, fontWeight: 600 }}>{p.stock}</span>
              <span style={{ fontWeight: 600 }}>{p.rentals}</span>
              {/* Owner cell */}
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", minWidth: 0 }}>
                <div style={{ width: "26px", height: "26px", borderRadius: "50%", background: COLORS.accentLight, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.72rem", fontWeight: 700, color: COLORS.accent, flexShrink: 0 }}>
                  {(p.owner || "?")[0]}
                </div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: "0.82rem", fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.owner || "—"}</div>
                  {ownerUser && <div style={{ fontSize: "0.68rem", color: COLORS.accent }}>{ownerUser.plan}</div>}
                </div>
              </div>
              <div style={{ display: "flex", gap: "0.25rem", flexWrap: "wrap" }}>
                {featureFlags.tagging && (p.tags || []).map(tid => {
                  const tag = tags.find(t => t.id === tid);
                  return tag ? <TagBadge key={tid} tag={tag} small /> : null;
                })}
                {(!featureFlags.tagging || !(p.tags || []).length) && <span style={{ color: COLORS.muted, fontSize: "0.72rem" }}>—</span>}
              </div>
              <div style={{ display: "flex", gap: "0.4rem" }}>
                <button style={{ ...s.btn("secondary"), padding: "0.35rem 0.7rem", fontSize: "0.78rem" }} onClick={() => openModal("product", { ...p, tags: p.tags || [] })}>Edit</button>
                <button style={{ ...s.btn("danger"), padding: "0.35rem 0.7rem", fontSize: "0.78rem" }} onClick={async () => {
                  if (!window.confirm(`Delete "${p.name}"?`)) return;
                  try {
                    await removeProduct(p.id);
                    showNotif("Product deleted", "error");
                  } catch (e) {
                    const msg = e.message?.includes("permission") || e.message?.includes("policy")
                      ? "Permission denied — run supabase/admin-write-policies.sql"
                      : "Delete failed: " + e.message;
                    showNotif(msg, "error");
                  }
                }}>Del</button>
              </div>
            </div>
            );
          })}
          <Pagination total={filteredProducts.length} page={pPage} perPage={pPerPage} onPage={setPPage} onPerPage={(n) => { setPPerPage(n); setPPage(1); }} />
        </div>
      </>
    );
  };

  /* ─── TAGS ─── */
  const renderTags = () => (
    <>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.25rem" }}>
        <div>
          <h2 style={{ fontSize: "1.4rem", fontWeight: 800 }}>Product Tags</h2>
          <p style={{ color: COLORS.muted, fontSize: "0.85rem" }}>Custom labels displayed on product cards in the storefront</p>
        </div>
        <div style={{ display: "flex", gap: "0.75rem", alignItems: "center" }}>
          <div style={{ background: featureFlags.tagging ? "rgba(16,185,129,0.1)" : "rgba(239,68,68,0.1)", borderRadius: "10px", padding: "0.4rem 0.9rem", fontSize: "0.82rem", fontWeight: 600, color: featureFlags.tagging ? COLORS.green : COLORS.red }}>
            Tagging: {featureFlags.tagging ? "✓ Enabled" : "✗ Disabled"}
          </div>
          <button style={s.btn("primary")} onClick={() => openModal("tag", { color: "#f97316", bg: "rgba(249,115,22,0.12)", emoji: "🏷" })}>+ New Tag</button>
        </div>
      </div>
      {/* Search */}
      <div style={{ marginBottom: "1rem" }}>
        <GridToolbar search={tSearch} onSearch={setTSearch} searchPlaceholder="Search tags..." sortOptions={[]} onSort={() => {}} sortField="" sortDir="asc" onClear={() => setTSearch("")} />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: "1rem" }}>
        {filteredTags.slice((tPage-1)*tPerPage, tPage*tPerPage).map(tag => {
          const usedBy = products.filter(p => (p.tags || []).includes(tag.id)).length;
          const isBanner = tag.isBannerTag;
          return (
            <div key={tag.id} style={{ ...s.card, padding: "1.25rem", ...(isBanner ? { border: `2px solid ${tag.color}60`, background: `linear-gradient(135deg, #fff, rgba(245,158,11,0.04))` } : {}) }}>
              {isBanner && (
                <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", background: "rgba(245,158,11,0.12)", borderRadius: "8px", padding: "0.3rem 0.7rem", fontSize: "0.72rem", fontWeight: 700, color: "#b45309", marginBottom: "0.75rem" }}>
                  🏠 Homepage Banner Tag &nbsp;·&nbsp; Max {tag.maxProducts || 4} products &nbsp;·&nbsp; <span style={{ color: usedBy >= (tag.maxProducts || 4) ? COLORS.red : COLORS.green }}>{usedBy}/{tag.maxProducts || 4} used</span>
                </div>
              )}
              <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "0.9rem" }}>
                <div style={{ width: "44px", height: "44px", background: tag.bg, borderRadius: "12px", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.4rem", border: `2px solid ${tag.color}40`, flexShrink: 0 }}>{tag.emoji}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                    <span style={{ fontWeight: 700 }}>{tag.name}</span>
                    <TagBadge tag={tag} small />
                  </div>
                  <div style={{ color: COLORS.muted, fontSize: "0.75rem", marginTop: "0.2rem" }}>Used on {usedBy} product{usedBy !== 1 ? "s" : ""}</div>
                </div>
                <span style={s.badge(tag.active ? "active" : "inactive")}>{tag.active ? "On" : "Off"}</span>
              </div>
              {isBanner && (
                <div style={{ background: COLORS.bg, borderRadius: "8px", padding: "0.5rem 0.75rem", marginBottom: "0.75rem" }}>
                  <div style={{ fontSize: "0.72rem", color: COLORS.muted, marginBottom: "0.35rem", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em" }}>Featured Products</div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "0.3rem" }}>
                    {products.filter(p => (p.tags || []).includes(tag.id)).map(p => (
                      <span key={p.id} style={{ background: tag.bg, color: tag.color, borderRadius: "6px", padding: "0.15rem 0.5rem", fontSize: "0.72rem", fontWeight: 600 }}>{p.name}</span>
                    ))}
                    {usedBy === 0 && <span style={{ color: COLORS.muted, fontSize: "0.72rem" }}>No products assigned yet</span>}
                  </div>
                </div>
              )}
              <div style={{ display: "flex", gap: "0.5rem", marginBottom: "0.5rem" }}>
                <div style={{ flex: 1, display: "flex", alignItems: "center", gap: "0.4rem" }}>
                  <div style={{ width: "14px", height: "14px", borderRadius: "4px", background: tag.color }} />
                  <span style={{ fontSize: "0.75rem", color: COLORS.muted, fontFamily: "monospace" }}>{tag.color}</span>
                </div>
                <button style={{ ...s.btn("secondary") }} onClick={() => openModal("tag", { ...tag })}>Edit</button>
                {!isBanner && <button style={s.btn("danger")} onClick={async () => {
                  if (!window.confirm(`Delete tag "${tag.name}"?`)) return;
                  try {
                    await removeTagDb(tag.id);
                    showNotif("Tag deleted", "error");
                  } catch (e) {
                    const msg = e.message?.includes("permission") || e.message?.includes("policy")
                      ? "Permission denied — run supabase/admin-write-policies.sql"
                      : "Delete failed: " + e.message;
                    showNotif(msg, "error");
                  }
                }}>Delete</button>}
                {isBanner && <button style={{ ...s.btn("secondary"), color: COLORS.muted, cursor: "not-allowed", opacity: 0.5 }} title="Featured banner tag cannot be deleted">🔒 Protected</button>}
              </div>
            </div>
          );
        })}
        {filteredTags.length === 0 && <div style={{ padding: "3rem", textAlign: "center", color: COLORS.muted, gridColumn: "1/-1" }}>No tags found</div>}
      </div>
      <div style={{ marginTop: "1rem", background: COLORS.surface, borderRadius: "12px", border: `1px solid ${COLORS.border}` }}>
        <Pagination total={filteredTags.length} page={tPage} perPage={tPerPage} onPage={setTPage} onPerPage={(n) => { setTPerPage(n); setTPage(1); }} />
      </div>
    </>
  );

  /* ─── PLANS ─── */
  const renderPlans = () => (
    <>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.25rem" }}>
        <div>
          <h2 style={{ fontSize: "1.4rem", fontWeight: 800 }}>Subscription Plans</h2>
          <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", marginTop: "0.3rem" }}>
            <p style={{ color: COLORS.muted, fontSize: "0.85rem" }}>Manage pricing tiers</p>
            <span style={{ background: featureFlags.subscriptionPlans ? "rgba(16,185,129,0.1)" : "rgba(239,68,68,0.1)", borderRadius: "8px", padding: "0.2rem 0.6rem", fontSize: "0.72rem", fontWeight: 600, color: featureFlags.subscriptionPlans ? COLORS.green : COLORS.red }}>
              {featureFlags.subscriptionPlans ? "✓ Plans Enabled" : "✗ Plans Disabled"}
            </span>
          </div>
        </div>
        <button style={s.btn("primary")} onClick={() => openModal("plan", { price: 0, rentals: 5, features: [] })}>+ Add Plan</button>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "1.4rem" }}>
        {plans.map(plan => (
          <div key={plan.id} style={{ ...s.card, padding: "1.6rem" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "1rem" }}>
              <div>
                <div style={{ fontWeight: 800, fontSize: "1.2rem" }}>{plan.name}</div>
                <div style={{ color: COLORS.muted, fontSize: "0.82rem" }}>{plan.subscribers.toLocaleString("en-IN")} subscribers</div>
              </div>
              <span style={s.badge(plan.active ? "active" : "inactive")}>{plan.active ? "Active" : "Off"}</span>
            </div>
            <div style={{ marginBottom: "0.25rem" }}><span style={{ fontSize: "2rem", fontWeight: 900 }}>{INR(plan.price)}</span><span style={{ color: COLORS.muted }}>/mo</span></div>
            <div style={{ color: COLORS.green, fontWeight: 700, marginBottom: "1rem", fontSize: "0.88rem" }}>MRR: {INR(plan.revenue)}</div>
            <div style={{ marginBottom: "1.1rem" }}>
              {plan.features.map(f => <div key={f} style={{ display: "flex", gap: "0.5rem", padding: "0.25rem 0", fontSize: "0.83rem", color: COLORS.muted }}><span style={{ color: COLORS.green }}>✓</span>{f}</div>)}
            </div>
            <button style={{ ...s.btn("secondary"), width: "100%" }} onClick={() => openModal("plan", { ...plan, features: [...plan.features] })}>Edit Plan</button>
          </div>
        ))}
      </div>
    </>
  );

  /* ─── USERS ─── */
  const renderUsers = () => {
    const uSortOpts = [["name","Name"],["email","Email"],["plan","Plan"],["rentals","Rentals"],["joined","Joined"],["city","City"]];
    return (
      <>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.25rem" }}>
          <div><h2 style={{ fontSize: "1.4rem", fontWeight: 800 }}>Users</h2><p style={{ color: COLORS.muted, fontSize: "0.85rem" }}>{filteredUsers.length} of {users.length} users</p></div>
          <button style={s.btn("primary")} onClick={() => openModal("user", { plan: "Starter", status: "active" })}>+ Add User</button>
        </div>
        <div style={s.card}>
          <GridToolbar
            search={uSearch} onSearch={setUSearch} searchPlaceholder="Search name, email, city..."
            sortField={uSort} sortDir={uDir} onSort={(f, d) => { setUSort(f); setUDir(d); }} sortOptions={uSortOpts}
            filterSlots={<>
              {filterSelect(uPlanFilter, setUPlanFilter, [["Starter","Starter"],["Pro","Pro"],["Business","Business"]], "All Plans")}
              {filterSelect(uStatusFilter, setUStatusFilter, [["active","Active"],["suspended","Suspended"]], "All Status")}
            </>}
            onClear={() => { setUSearch(""); setUSort(""); setUPlanFilter(""); setUStatusFilter(""); setUPage(1); }}
            activeFiltersCount={[uPlanFilter, uStatusFilter].filter(Boolean).length}
          />
          <div style={s.th("2fr 1.8fr 0.8fr 0.7fr 1fr 0.8fr 1.5fr")}>
            <SortableCol label="Name" field="name" sortField={uSort} sortDir={uDir} onSort={(f,d) => { setUSort(f); setUDir(d); }} />
            <SortableCol label="Email" field="email" sortField={uSort} sortDir={uDir} onSort={(f,d) => { setUSort(f); setUDir(d); }} />
            <SortableCol label="Plan" field="plan" sortField={uSort} sortDir={uDir} onSort={(f,d) => { setUSort(f); setUDir(d); }} />
            <SortableCol label="Rentals" field="rentals" sortField={uSort} sortDir={uDir} onSort={(f,d) => { setUSort(f); setUDir(d); }} />
            <span>City</span>
            <span>Status</span>
            <span>Actions</span>
          </div>
          {filteredUsers.length === 0 && <div style={{ padding: "3rem", textAlign: "center", color: COLORS.muted }}>No users match your filters</div>}
          {filteredUsers.slice((uPage-1)*uPerPage, uPage*uPerPage).map(u => (
            <div key={u.id} style={s.tr("2fr 1.8fr 0.8fr 0.7fr 1fr 0.8fr 1.5fr")} onMouseEnter={e => e.currentTarget.style.background = COLORS.surfaceHover} onMouseLeave={e => e.currentTarget.style.background = ""}>
              <div style={{ display: "flex", alignItems: "center", gap: "0.65rem" }}>
                <div style={{ width: "30px", height: "30px", borderRadius: "50%", background: COLORS.accentLight, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.82rem", flexShrink: 0, fontWeight: 700, color: COLORS.accent }}>{u.name[0]}</div>
                <div>
                  <div style={{ fontWeight: 600, fontSize: "0.88rem" }}>{u.name}</div>
                  <div style={{ display: "flex", gap: "0.3rem" }}>
                    <span style={{ fontSize: "0.65rem", color: u.emailVerified ? COLORS.green : COLORS.red }}>📧{u.emailVerified ? "✓" : "✗"}</span>
                    <span style={{ fontSize: "0.65rem", color: u.phoneVerified ? COLORS.green : COLORS.red }}>📱{u.phoneVerified ? "✓" : "✗"}</span>
                  </div>
                </div>
              </div>
              <span style={{ color: COLORS.muted, fontSize: "0.82rem", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{u.email}</span>
              <span style={{ color: COLORS.accent, fontWeight: 600, fontSize: "0.85rem" }}>{u.plan}</span>
              <span style={{ color: COLORS.gold, fontWeight: 600 }}>{u.rentals}</span>
              <span style={{ fontSize: "0.82rem" }}>{u.city || "—"}</span>
              <span style={s.badge(u.status)}>{u.status}</span>
              <div style={{ display: "flex", gap: "0.35rem" }}>
                <button style={{ ...s.btn("secondary"), padding: "0.3rem 0.6rem", fontSize: "0.76rem" }} onClick={() => openModal("user", { ...u })}>Edit</button>
                <button style={{ ...s.btn("danger"), padding: "0.3rem 0.6rem", fontSize: "0.76rem" }}
                  onClick={() => { setUsers(prev => prev.map(x => x.id === u.id ? { ...x, status: x.status === "active" ? "suspended" : "active" } : x)); showNotif(u.status === "active" ? "User suspended" : "User reactivated"); }}>
                  {u.status === "active" ? "Suspend" : "Activate"}
                </button>
              </div>
            </div>
          ))}
          <Pagination total={filteredUsers.length} page={uPage} perPage={uPerPage} onPage={setUPage} onPerPage={(n) => { setUPerPage(n); setUPage(1); }} />
        </div>
      </>
    );
  };

  /* ─── ORDERS ─── */
  const renderOrders = () => {
    const oSortOpts = [["id","Order ID"],["product","Product"],["user","User"],["amount","Amount"],["days","Days"],["date","Date"]];
    const ORDER_STATUSES = ["active","pending","completed","suspended","cancelled"];
    const statusColors = { active: COLORS.green, pending: COLORS.gold, completed: COLORS.blue, suspended: COLORS.red, cancelled: COLORS.muted };
    return (
      <>
        <div style={{ marginBottom: "1.25rem" }}><h2 style={{ fontSize: "1.4rem", fontWeight: 800 }}>Orders</h2><p style={{ color: COLORS.muted, fontSize: "0.85rem" }}>{filteredOrders.length} rental transactions</p></div>
        <div style={s.card}>
          <GridToolbar
            search={oSearch} onSearch={setOSearch} searchPlaceholder="Search order, product, user..."
            sortField={oSort} sortDir={oDir} onSort={(f, d) => { setOSort(f); setODir(d); }} sortOptions={oSortOpts}
            filterSlots={filterSelect(oStatusFilter, setOStatusFilter, [["active","Active"],["pending","Pending"],["completed","Completed"],["suspended","Suspended"],["cancelled","Cancelled"]], "All Status")}
            onClear={() => { setOSearch(""); setOSort(""); setOStatusFilter(""); setOPage(1); }}
            activeFiltersCount={oStatusFilter ? 1 : 0}
          />
          <div style={s.th("0.9fr 2fr 1.8fr 0.6fr 1.1fr 0.7fr 1.5fr")}>
            <SortableCol label="Order ID" field="id" sortField={oSort} sortDir={oDir} onSort={(f,d) => { setOSort(f); setODir(d); }} />
            <SortableCol label="Product" field="product" sortField={oSort} sortDir={oDir} onSort={(f,d) => { setOSort(f); setODir(d); }} />
            <SortableCol label="User" field="user" sortField={oSort} sortDir={oDir} onSort={(f,d) => { setOSort(f); setODir(d); }} />
            <span>Days</span>
            <SortableCol label="Amount" field="amount" sortField={oSort} sortDir={oDir} onSort={(f,d) => { setOSort(f); setODir(d); }} />
            <SortableCol label="Date" field="date" sortField={oSort} sortDir={oDir} onSort={(f,d) => { setOSort(f); setODir(d); }} />
            <span>Status</span>
          </div>
          {filteredOrders.length === 0 && <div style={{ padding: "3rem", textAlign: "center", color: COLORS.muted }}>No orders match your search</div>}
          {filteredOrders.slice((oPage-1)*oPerPage, oPage*oPerPage).map(order => {
            const orderUser = users.find(u => u.email === order.userEmail);
            return (
              <div key={order.id} style={s.tr("0.9fr 2fr 1.8fr 0.6fr 1.1fr 0.7fr 1.5fr")} onMouseEnter={e => e.currentTarget.style.background = COLORS.surfaceHover} onMouseLeave={e => e.currentTarget.style.background = ""}>
                <span style={{ color: COLORS.accent, fontWeight: 700, fontSize: "0.82rem" }}>{order.id}</span>
                <div>
                  <div style={{ fontWeight: 600, fontSize: "0.88rem", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{order.product}</div>
                </div>
                {/* User cell with avatar + plan badge */}
                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", minWidth: 0 }}>
                  <div style={{ width: "26px", height: "26px", borderRadius: "50%", background: COLORS.accentLight, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.72rem", fontWeight: 700, color: COLORS.accent, flexShrink: 0 }}>
                    {order.user[0]}
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: "0.82rem", fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{order.user}</div>
                    {orderUser && <div style={{ fontSize: "0.68rem", color: COLORS.accent }}>{orderUser.plan} · {order.userEmail}</div>}
                  </div>
                </div>
                <span style={{ fontSize: "0.85rem" }}>{order.days}d</span>
                <span style={{ color: COLORS.green, fontWeight: 700 }}>{INR(order.amount)}</span>
                <span style={{ fontSize: "0.78rem", color: COLORS.muted }}>{order.date}</span>
                {/* Inline status changer */}
                <div style={{ position: "relative" }}>
                  <select
                    value={order.status}
                    onChange={e => {
                      const newStatus = e.target.value;
                      setOrders(prev => prev.map(o => o.id === order.id ? { ...o, status: newStatus } : o));
                      showNotif(`Order ${order.id} → ${newStatus}`);
                    }}
                    style={{
                      background: `${statusColors[order.status]}18`,
                      color: statusColors[order.status] || COLORS.muted,
                      border: `1.5px solid ${statusColors[order.status] || COLORS.border}`,
                      borderRadius: "8px", padding: "0.28rem 0.55rem", fontSize: "0.75rem", fontWeight: 700,
                      fontFamily: "'DM Sans', sans-serif", outline: "none", cursor: "pointer", width: "100%",
                      appearance: "none", textAlign: "center",
                    }}>
                    {ORDER_STATUSES.map(st => <option key={st} value={st}>{st.charAt(0).toUpperCase() + st.slice(1)}</option>)}
                  </select>
                </div>
              </div>
            );
          })}
          <Pagination total={filteredOrders.length} page={oPage} perPage={oPerPage} onPage={setOPage} onPerPage={(n) => { setOPerPage(n); setOPage(1); }} />
        </div>
      </>
    );
  };

  /* ─── ANALYTICS ─── */
  const renderAnalytics = () => (
    <>
      <div style={{ marginBottom: "1.25rem" }}><h2 style={{ fontSize: "1.4rem", fontWeight: 800 }}>Analytics</h2></div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: "1.1rem", marginBottom: "1.75rem" }}>
        {[{ label: "Total MRR", value: "₹1.29 Cr", sub: "Monthly recurring" }, { label: "Avg Rental Value", value: "₹7,334", sub: "Per transaction" }, { label: "Churn Rate", value: "2.4%", sub: "This month" }, { label: "LTV", value: "₹88,000", sub: "Customer lifetime" }].map(m => (
          <div key={m.label} style={{ ...s.card, padding: "1.4rem" }}>
            <div style={{ color: COLORS.muted, fontSize: "0.82rem", marginBottom: "0.3rem" }}>{m.label}</div>
            <div style={{ fontSize: "1.55rem", fontWeight: 800 }}>{m.value}</div>
            <div style={{ color: COLORS.muted, fontSize: "0.78rem", marginTop: "0.2rem" }}>{m.sub}</div>
          </div>
        ))}
      </div>
      <div style={s.card}>
        <div style={{ padding: "1.25rem 1.5rem", fontWeight: 700, borderBottom: `1px solid ${COLORS.border}`, fontSize: "0.95rem" }}>Revenue by Category</div>
        {categories.filter(c => c.active).map((cat, idx) => {
          const amounts = [5800000, 2300000, 1400000, 860000, 1576330];
          const amt = amounts[idx % amounts.length];
          const maxAmt = 5800000;
          return (
            <div key={cat.id} style={{ padding: "0.9rem 1.5rem", borderBottom: `1px solid ${COLORS.border}` }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.4rem" }}>
                <span style={{ fontSize: "0.88rem" }}>{cat.icon} {cat.name}</span>
                <span style={{ color: COLORS.gold, fontWeight: 700, fontSize: "0.88rem" }}>{INR(amt)}</span>
              </div>
              <div style={{ background: COLORS.bg, borderRadius: "4px", height: "7px", overflow: "hidden" }}>
                <div style={{ height: "100%", width: `${(amt / maxAmt * 100).toFixed(0)}%`, borderRadius: "4px", background: `linear-gradient(90deg, ${COLORS.accent}, ${COLORS.gold})`, transition: "width 0.5s" }} />
              </div>
            </div>
          );
        })}
      </div>
    </>
  );

  /* ─── SETTINGS ─── */
  const renderSettings = () => {
    const flagGroups = [
      { label: "Commerce", flags: [["subscriptionPlans","Subscription Plans","Enables subscription gating for listing products"],["tagging","Product Tagging","Show custom tags (Hot, New, etc.) on product cards"],["productBadges","Product Badges","Show badges like Popular, Top Rated on listings"]] },
      { label: "Search & Discovery", flags: [["smartSearch","Smart Search & Filters","Advanced filtering in the frontend product listing"],["ratingsReviews","Ratings & Reviews","Display star ratings and review counts"],["wishlist","Wishlist","Allow users to save products to a wishlist"],["compareTool","Compare Tool","Side-by-side product comparison (beta)"]] },
      { label: "Auth & Verification", flags: [["emailVerification","Email Verification","Require users to verify email after signup"],["phoneVerification","Phone Verification","Require SMS OTP to verify phone number"],["customFields","Custom Registration Fields","Show extra fields (city, DOB, etc.) during signup"]] },
      { label: "Delivery", flags: [["guestBrowsing","Guest Browsing","Allow non-logged-in users to browse products"],["deliveryTracking","Delivery Tracking","Real-time delivery status (requires integration)"]] },
    ];
    return (
      <>
        <div style={{ marginBottom: "1.5rem" }}>
          <h2 style={{ fontSize: "1.4rem", fontWeight: 800 }}>Settings & Feature Flags</h2>
          <p style={{ color: COLORS.muted, fontSize: "0.85rem" }}>Toggle features on/off. Changes are saved to the database and apply to the frontend in real time.</p>
        </div>
        {/* Feature Flags */}
        {flagGroups.map(group => (
          <div key={group.label} style={{ ...s.card, marginBottom: "1.25rem" }}>
            <div style={{ padding: "1rem 1.5rem", fontWeight: 700, borderBottom: `1px solid ${COLORS.border}`, fontSize: "0.95rem", color: COLORS.accent }}>⚙ {group.label}</div>
            {group.flags.map(([key, label, desc]) => (
              <div key={key} style={{ padding: "0.9rem 1.5rem", borderBottom: `1px solid ${COLORS.border}`, display: "flex", justifyContent: "space-between", alignItems: "center", gap: "1rem" }}>
                <div>
                  <div style={{ fontWeight: 600, fontSize: "0.9rem" }}>{label}</div>
                  <div style={{ color: COLORS.muted, fontSize: "0.78rem", marginTop: "0.15rem" }}>{desc}</div>
                </div>
                <div onClick={() => updateFlag(key, !featureFlags[key])}
                  style={{ width: "46px", height: "26px", borderRadius: "13px", background: featureFlags[key] ? COLORS.green : COLORS.border, cursor: "pointer", position: "relative", transition: "background 0.2s", flexShrink: 0 }}>
                  <div style={{ width: "20px", height: "20px", borderRadius: "50%", background: "#fff", position: "absolute", top: "3px", left: featureFlags[key] ? "23px" : "3px", transition: "left 0.2s", boxShadow: "0 1px 4px rgba(0,0,0,0.2)" }} />
                </div>
              </div>
            ))}
          </div>
        ))}
        {/* Custom Fields */}
        <div style={s.card}>
          <div style={{ padding: "1rem 1.5rem", fontWeight: 700, borderBottom: `1px solid ${COLORS.border}`, fontSize: "0.95rem", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ color: COLORS.accent }}>📋 Custom Registration Fields</span>
            <button style={s.btn("primary")} onClick={() => openModal("customField", { type: "text", required: false, showInList: false, active: true })}>+ Add Field</button>
          </div>
          <div style={s.th("1.5fr 1fr 0.8fr 0.8fr 0.8fr 1fr 1.2fr")}>
            <span>Field Label</span><span>Key</span><span>Type</span><span>Required</span><span>In List</span><span>Status</span><span>Actions</span>
          </div>
          {customFields.map(cf => (
            <div key={cf.id} style={s.tr("1.5fr 1fr 0.8fr 0.8fr 0.8fr 1fr 1.2fr")} onMouseEnter={e => e.currentTarget.style.background = COLORS.surfaceHover} onMouseLeave={e => e.currentTarget.style.background = ""}>
              <span style={{ fontWeight: 600, fontSize: "0.88rem" }}>{cf.label}</span>
              <span style={{ color: COLORS.muted, fontFamily: "monospace", fontSize: "0.82rem" }}>{cf.key}</span>
              <span style={{ fontSize: "0.82rem" }}>{cf.type}</span>
              <span style={{ color: cf.required ? COLORS.green : COLORS.muted, fontSize: "0.82rem" }}>{cf.required ? "✓ Yes" : "No"}</span>
              <span style={{ color: cf.showInList ? COLORS.green : COLORS.muted, fontSize: "0.82rem" }}>{cf.showInList ? "✓ Yes" : "No"}</span>
              <span style={s.badge(cf.active ? "active" : "inactive")}>{cf.active ? "Active" : "Off"}</span>
              <div style={{ display: "flex", gap: "0.4rem" }}>
                <button style={{ ...s.btn("secondary"), padding: "0.3rem 0.6rem", fontSize: "0.76rem" }} onClick={() => openModal("customField", { ...cf })}>Edit</button>
                <button style={{ ...s.btn("danger"), padding: "0.3rem 0.6rem", fontSize: "0.76rem" }} onClick={async () => {
                  try {
                    await removeCustomFieldDb(cf.id); showNotif("Field deleted", "error");
                  } catch (e) {
                    showNotif(e.message?.includes("permission") ? "Permission denied — run admin-write-policies.sql" : "Delete failed: " + e.message, "error");
                  }
                }}>Del</button>
              </div>
            </div>
          ))}
        </div>
      </>
    );
  };

  const renderContent = () => {
    switch (activeSection) {
      case "dashboard": return renderDashboard();
      case "categories": return renderCategories();
      case "products": return renderProducts();
      case "tags": return renderTags();
      case "plans": return renderPlans();
      case "users": return renderUsers();
      case "orders": return renderOrders();
      case "analytics": return renderAnalytics();
      case "settings": return renderSettings();
      default: return renderDashboard();
    }
  };

  /* ─── TAG COLOR PRESETS ─── */
  const tagColorPresets = [
    { color: "#ef4444", bg: "rgba(239,68,68,0.12)" },{ color: "#f59e0b", bg: "rgba(245,158,11,0.12)" },
    { color: "#10b981", bg: "rgba(16,185,129,0.12)" },{ color: "#7c3aed", bg: "rgba(124,58,237,0.12)" },
    { color: "#2563eb", bg: "rgba(37,99,235,0.12)" },{ color: "#ec4899", bg: "rgba(236,72,153,0.12)" },
    { color: "#f97316", bg: "rgba(249,115,22,0.12)" },{ color: "#06b6d4", bg: "rgba(6,182,212,0.12)" },
  ];

  return (
    <>
      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800;900&display=swap" rel="stylesheet" />
      <div style={s.app}>
        {notification && (
          <div style={{ position: "fixed", bottom: "2rem", right: "2rem", background: notification.type === "error" ? COLORS.red : COLORS.green, color: "#fff", padding: "0.9rem 1.4rem", borderRadius: "12px", fontWeight: 600, zIndex: 999, boxShadow: "0 10px 30px rgba(0,0,0,0.2)", fontSize: "0.9rem", animation: "slideIn 0.3s ease" }}>
            {notification.type === "error" ? "✕" : "✓"} {notification.msg}
          </div>
        )}

        {/* Sidebar */}
        <div style={s.sidebar}>
          <div style={{ padding: "1.25rem", borderBottom: `1px solid ${COLORS.border}`, display: "flex", alignItems: "center", gap: "0.7rem" }}>
            <div style={{ width: "32px", height: "32px", background: COLORS.accent, borderRadius: "10px", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, cursor: "pointer", color: "#fff", fontWeight: 900, fontSize: "0.75rem" }} onClick={() => setSidebarOpen(o => !o)}>RC</div>
            {sidebarOpen && <span style={{ fontWeight: 700, fontSize: "0.9rem", color: COLORS.text }}>RentCircle <span style={{ color: COLORS.muted, fontWeight: 400, fontSize: "0.75rem" }}>Admin</span></span>}
          </div>
          <nav style={{ padding: "0.75rem 0", flex: 1, overflowY: "auto" }}>
            {navItems.map(item => (
              <div key={item.id} style={s.navItem(activeSection === item.id)} onClick={() => setActiveSection(item.id)}>
                <span style={{ fontSize: "1.05rem", flexShrink: 0 }}>{item.icon}</span>
                {sidebarOpen && <span>{item.label}</span>}
                {sidebarOpen && item.id === "tags" && featureFlags.tagging && <span style={{ marginLeft: "auto", background: COLORS.accentLight, color: COLORS.accent, borderRadius: "4px", padding: "0.1rem 0.4rem", fontSize: "0.65rem", fontWeight: 700 }}>{tags.filter(t => t.active).length}</span>}
                {sidebarOpen && item.id === "settings" && <span style={{ marginLeft: "auto", background: "rgba(239,68,68,0.1)", color: COLORS.red, borderRadius: "4px", padding: "0.1rem 0.4rem", fontSize: "0.65rem", fontWeight: 700 }}>{Object.values(featureFlags).filter(v => !v).length} off</span>}
              </div>
            ))}
          </nav>
          <div style={{ padding: "0.9rem", borderTop: `1px solid ${COLORS.border}` }}>
            {sidebarOpen && (
              <div style={{ padding: "0.65rem 0.9rem", background: COLORS.accentLight, borderRadius: "10px", marginBottom: "0.5rem" }}>
                <div style={{ fontSize: "0.72rem", color: COLORS.muted }}>Logged in</div>
                <div style={{ fontWeight: 700, fontSize: "0.88rem" }}>{adminUser.name}</div>
                <div style={{ fontSize: "0.72rem", color: COLORS.muted }}>{adminUser.email}</div>
              </div>
            )}
            <button onClick={() => setAdminUser(null)} style={{ ...s.btn("danger"), width: "100%", justifyContent: "center", display: "flex", alignItems: "center", gap: "0.4rem" }}>
              {sidebarOpen ? "⏻ Sign Out" : "⏻"}
            </button>
          </div>
        </div>

        {/* Main */}
        <div style={s.main}>
          <div style={s.topbar}>
            <div>
              <div style={{ fontWeight: 700, fontSize: "1rem" }}>{navItems.find(n => n.id === activeSection)?.label || "Dashboard"}</div>
              <div style={{ fontSize: "0.75rem", color: COLORS.muted }}>RentCircle Admin Panel</div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
              <div style={{ background: COLORS.bg, borderRadius: "10px", padding: "0.4rem 0.9rem", fontSize: "0.82rem", color: COLORS.muted }}>🟢 Systems normal</div>
              <div style={{ background: "rgba(16,185,129,0.12)", color: COLORS.green, borderRadius: "10px", padding: "0.4rem 0.9rem", fontSize: "0.82rem", fontWeight: 600 }}>₹ INR</div>
              <div style={{ display: "flex", gap: "0.3rem" }}>
                {Object.entries(featureFlags).slice(0, 4).map(([k, v]) => (
                  <div key={k} title={k} style={{ width: "8px", height: "8px", borderRadius: "50%", background: v ? COLORS.green : COLORS.red }} />
                ))}
              </div>
              <div style={{ width: "34px", height: "34px", background: COLORS.accent, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, color: "#fff", cursor: "pointer", fontSize: "0.9rem" }}>A</div>
            </div>
          </div>
          <div style={s.content}>{renderContent()}</div>
        </div>

        {/* ═══ MODALS ═══ */}

        {/* Category Modal */}
        {modal === "category" && (
          <div style={s.modal} onClick={closeModal}>
            <div style={s.mbox} onClick={e => e.stopPropagation()}>
              <h3 style={{ fontWeight: 800, fontSize: "1.15rem", marginBottom: "1.5rem" }}>{formData.id ? "✏️ Edit" : "➕ Add"} Category</h3>
              <label style={s.lbl}>Name</label>
              <input style={s.inp} value={formData.name || ""} onChange={e => setFormData(d => ({ ...d, name: e.target.value }))} placeholder="Category name" />
              <label style={s.lbl}>Icon (emoji)</label>
              <input style={s.inp} value={formData.icon || ""} onChange={e => setFormData(d => ({ ...d, icon: e.target.value }))} placeholder="📦" />
              <label style={s.lbl}>Status</label>
              <select style={selectStyle} value={formData.active ?? true} onChange={e => setFormData(d => ({ ...d, active: e.target.value === "true" }))}>
                <option value="true">Active</option><option value="false">Inactive</option>
              </select>
              <div style={{ display: "flex", gap: "0.75rem", marginTop: "0.5rem" }}>
                <button style={{ ...s.btn("secondary"), flex: 1 }} onClick={closeModal}>Cancel</button>
                <button style={{ ...s.btn("primary"), flex: 1 }} onClick={saveCategoryFn}>Save</button>
              </div>
            </div>
          </div>
        )}

        {/* Product Modal */}
        {modal === "product" && (
          <div style={s.modal} onClick={closeModal}>
            <div style={{ ...s.mbox, maxWidth: "580px" }} onClick={e => e.stopPropagation()}>
              <h3 style={{ fontWeight: 800, fontSize: "1.15rem", marginBottom: "1.5rem" }}>{formData.id ? "✏️ Edit" : "➕ Add"} Product</h3>
              <label style={s.lbl}>Product Name *</label>
              <input
                style={{ ...s.inp, ...(modalErrors.name ? { border: `1.5px solid ${COLORS.red}`, background: "rgba(239,68,68,0.05)" } : {}) }}
                value={formData.name || ""}
                onChange={e => { setFormData(d => ({ ...d, name: e.target.value })); if (modalErrors.name) setModalErrors(me => ({ ...me, name: "" })); }}
                placeholder="e.g. Sony A7 III Camera"
              />
              {modalErrors.name && <div style={{ color: COLORS.red, fontSize: "0.75rem", marginTop: "-0.6rem", marginBottom: "0.8rem", fontWeight: 600 }}>⚠ {modalErrors.name}</div>}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
                <div><label style={s.lbl}>Category</label>
                  <select style={selectStyle} value={formData.category || ""} onChange={e => setFormData(d => ({ ...d, category: e.target.value }))}>
                    {categories.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                  </select>
                </div>
                <div>
                  <label style={s.lbl}>Stock *</label>
                  <input
                    style={{ ...s.inp, ...(modalErrors.stock ? { border: `1.5px solid ${COLORS.red}`, background: "rgba(239,68,68,0.05)" } : {}) }}
                    type="number" min="0"
                    value={formData.stock ?? ""}
                    onChange={e => { setFormData(d => ({ ...d, stock: +e.target.value })); if (modalErrors.stock) setModalErrors(me => ({ ...me, stock: "" })); }}
                    placeholder="e.g. 10"
                  />
                  {modalErrors.stock && <div style={{ color: COLORS.red, fontSize: "0.75rem", marginTop: "-0.6rem", marginBottom: "0.8rem", fontWeight: 600 }}>⚠ {modalErrors.stock}</div>}
                </div>
              </div>
              <div style={{ background: COLORS.bg, border: `1px solid ${modalErrors.priceDay ? COLORS.red : COLORS.border}`, borderRadius: "12px", padding: "1rem 1.1rem", marginBottom: "1rem", transition: "border-color 0.2s" }}>
                <div style={{ fontSize: "0.75rem", fontWeight: 700, color: COLORS.accent, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "0.7rem" }}>💰 Pricing (INR)</div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "0.6rem" }}>
                  <div>
                    <label style={s.lbl}>Per Day *</label>
                    <input
                      style={{ ...s.inp, marginBottom: 0, ...(modalErrors.priceDay ? { border: `1.5px solid ${COLORS.red}`, background: "rgba(239,68,68,0.05)" } : {}) }}
                      type="number" min="1" placeholder="999"
                      value={formData.priceDay || formData.price || ""}
                      onChange={e => { setFormData(d => ({ ...d, priceDay: +e.target.value, price: +e.target.value })); if (modalErrors.priceDay) setModalErrors(me => ({ ...me, priceDay: "" })); }}
                    />
                  </div>
                  <div><label style={s.lbl}>Per Month</label><input style={{ ...s.inp, marginBottom: 0 }} type="number" placeholder="auto" value={formData.priceMonth || ""} onChange={e => setFormData(d => ({ ...d, priceMonth: +e.target.value }))} /></div>
                  <div><label style={s.lbl}>Per Year</label><input style={{ ...s.inp, marginBottom: 0 }} type="number" placeholder="auto" value={formData.priceYear || ""} onChange={e => setFormData(d => ({ ...d, priceYear: +e.target.value }))} /></div>
                </div>
                {modalErrors.priceDay && <div style={{ color: COLORS.red, fontSize: "0.75rem", marginTop: "0.5rem", fontWeight: 600 }}>⚠ {modalErrors.priceDay}</div>}
                <div style={{ fontSize: "0.72rem", color: COLORS.muted, marginTop: "0.5rem" }}>Month = ×25, Year = ×280 of daily if left blank</div>
              </div>
              {/* Tags assignment */}
              {featureFlags.tagging && (
                <div style={{ marginBottom: "1rem" }}>
                  <label style={s.lbl}>Assign Tags</label>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
                    {tags.filter(t => t.active).map(tag => {
                      const selected = (formData.tags || []).includes(tag.id);
                      const isBanner = tag.isBannerTag;
                      const bannerCount = isBanner ? products.filter(p => p.id !== formData.id && (p.tags || []).includes(tag.id)).length : 0;
                      const limitReached = isBanner && !selected && bannerCount >= (tag.maxProducts || 4);
                      return (
                        <div key={tag.id}
                          onClick={() => !limitReached && setFormData(d => ({ ...d, tags: selected ? (d.tags || []).filter(x => x !== tag.id) : [...(d.tags || []), tag.id] }))}
                          title={limitReached ? `Max ${tag.maxProducts || 4} products allowed for "${tag.name}" banner tag` : ""}
                          style={{ background: selected ? tag.bg : limitReached ? "#f3f4f6" : COLORS.bg, color: selected ? tag.color : limitReached ? "#9ca3af" : COLORS.muted, border: `2px solid ${selected ? tag.color : limitReached ? "#e5e7eb" : COLORS.border}`, borderRadius: "8px", padding: "0.3rem 0.7rem", cursor: limitReached ? "not-allowed" : "pointer", fontSize: "0.82rem", fontWeight: 600, display: "flex", alignItems: "center", gap: "0.25rem", transition: "all 0.15s", opacity: limitReached ? 0.55 : 1, position: "relative" }}>
                          {tag.emoji} {tag.name}
                          {isBanner && <span style={{ background: selected ? tag.color : "#e5e7eb", color: selected ? "#fff" : "#6b7280", borderRadius: "10px", padding: "0 0.4rem", fontSize: "0.68rem", fontWeight: 800, marginLeft: "0.2rem" }}>{bannerCount + (selected ? 1 : 0)}/{tag.maxProducts || 4}</span>}
                          {selected && " ✓"}
                          {limitReached && <span style={{ fontSize: "0.72rem", marginLeft: "0.2rem" }}>🔒</span>}
                        </div>
                      );
                    })}
                  </div>
                  {(formData.tags || []).some(tid => { const t = tags.find(x => x.id === tid); return t?.isBannerTag; }) && (
                    <div style={{ marginTop: "0.5rem", background: "rgba(245,158,11,0.1)", border: "1px solid rgba(245,158,11,0.3)", borderRadius: "8px", padding: "0.45rem 0.75rem", fontSize: "0.78rem", color: "#b45309", fontWeight: 600 }}>
                      🌟 This product will appear in the Featured banner on the homepage
                    </div>
                  )}
                </div>
              )}
              <div style={{ display: "flex", gap: "0.75rem" }}>
                <button style={{ ...s.btn("secondary"), flex: 1 }} onClick={closeModal}>Cancel</button>
                <button style={{ ...s.btn("primary"), flex: 2 }} onClick={saveProduct}>{formData.id ? "Save Changes ✓" : "Add Product →"}</button>
              </div>
            </div>
          </div>
        )}

        {/* Tag Modal */}
        {modal === "tag" && (
          <div style={s.modal} onClick={closeModal}>
            <div style={s.mbox} onClick={e => e.stopPropagation()}>
              <h3 style={{ fontWeight: 800, fontSize: "1.15rem", marginBottom: "1.5rem" }}>{formData.id ? "✏️ Edit" : "🏷 Create"} Tag</h3>
              <label style={s.lbl}>Tag Name *</label>
              <input style={s.inp} value={formData.name || ""} onChange={e => setFormData(d => ({ ...d, name: e.target.value }))} placeholder="e.g. Hot, New Arrival, Best Value" />
              <label style={s.lbl}>Emoji Icon</label>
              <input style={s.inp} value={formData.emoji || ""} onChange={e => setFormData(d => ({ ...d, emoji: e.target.value }))} placeholder="🔥" />
              <label style={s.lbl}>Color Preset</label>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "0.6rem", marginBottom: "1rem" }}>
                {tagColorPresets.map((p, i) => (
                  <div key={i} onClick={() => setFormData(d => ({ ...d, color: p.color, bg: p.bg }))}
                    style={{ width: "32px", height: "32px", borderRadius: "8px", background: p.color, cursor: "pointer", border: formData.color === p.color ? "3px solid #000" : "3px solid transparent", transition: "border-color 0.15s" }} />
                ))}
              </div>
              <label style={s.lbl}>Custom Color (hex)</label>
              <div style={{ display: "flex", gap: "0.75rem", alignItems: "center", marginBottom: "1rem" }}>
                <input style={{ ...s.inp, marginBottom: 0, flex: 1 }} value={formData.color || ""} onChange={e => setFormData(d => ({ ...d, color: e.target.value }))} placeholder="#ef4444" />
                <div style={{ width: "40px", height: "40px", borderRadius: "8px", background: formData.color || "#ccc", border: `1px solid ${COLORS.border}`, flexShrink: 0 }} />
              </div>
              {/* Preview */}
              {formData.name && (
                <div style={{ marginBottom: "1rem", padding: "0.75rem 1rem", background: COLORS.bg, borderRadius: "10px", border: `1px solid ${COLORS.border}` }}>
                  <div style={{ fontSize: "0.75rem", color: COLORS.muted, marginBottom: "0.4rem" }}>Preview</div>
                  <TagBadge tag={{ ...formData }} />
                </div>
              )}
              <label style={s.lbl}>Status</label>
              <select style={selectStyle} value={formData.active ?? true} onChange={e => setFormData(d => ({ ...d, active: e.target.value === "true" }))}>
                <option value="true">Active</option><option value="false">Inactive</option>
              </select>
              <div style={{ display: "flex", gap: "0.75rem", marginTop: "0.5rem" }}>
                <button style={{ ...s.btn("secondary"), flex: 1 }} onClick={closeModal}>Cancel</button>
                <button style={{ ...s.btn("primary"), flex: 1 }} onClick={saveTag}>Save Tag</button>
              </div>
            </div>
          </div>
        )}

        {/* Plan Modal */}
        {modal === "plan" && (
          <div style={s.modal} onClick={closeModal}>
            <div style={s.mbox} onClick={e => e.stopPropagation()}>
              <h3 style={{ fontWeight: 800, fontSize: "1.15rem", marginBottom: "1.5rem" }}>{formData.id ? "✏️ Edit" : "➕ Add"} Plan</h3>
              <label style={s.lbl}>Plan Name</label>
              <input style={s.inp} value={formData.name || ""} onChange={e => setFormData(d => ({ ...d, name: e.target.value }))} placeholder="Plan name" />
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
                <div><label style={s.lbl}>Price/month (₹)</label><input style={s.inp} type="number" value={formData.price || ""} onChange={e => setFormData(d => ({ ...d, price: +e.target.value }))} /></div>
                <div><label style={s.lbl}>Max Rentals (-1=∞)</label><input style={s.inp} type="number" value={formData.rentals ?? ""} onChange={e => setFormData(d => ({ ...d, rentals: +e.target.value }))} /></div>
              </div>
              <label style={s.lbl}>Features (one per line)</label>
              <textarea style={{ ...s.inp, height: "90px", resize: "vertical" }} value={(formData.features || []).join("\n")} onChange={e => setFormData(d => ({ ...d, features: e.target.value.split("\n").filter(Boolean) }))} />
              <div style={{ display: "flex", gap: "0.75rem" }}>
                <button style={{ ...s.btn("secondary"), flex: 1 }} onClick={closeModal}>Cancel</button>
                <button style={{ ...s.btn("primary"), flex: 1 }} onClick={savePlan}>Save</button>
              </div>
            </div>
          </div>
        )}

        {/* User Modal */}
        {modal === "user" && (
          <div style={s.modal} onClick={closeModal}>
            <div style={{ ...s.mbox, maxWidth: "560px" }} onClick={e => e.stopPropagation()}>
              <div style={{ background: `linear-gradient(135deg, #1a1a2e, #16213e)`, borderRadius: "14px 14px 0 0", padding: "1.1rem 1.4rem", color: "#fff", margin: "-2rem -2rem 1.5rem" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div><div style={{ fontWeight: 800, fontSize: "1.05rem" }}>{formData.id ? "✏️ Edit User" : "👤 Add User"}</div><div style={{ opacity: 0.65, fontSize: "0.78rem" }}>Manage platform user</div></div>
                  <button onClick={closeModal} style={{ background: "rgba(255,255,255,0.15)", border: "none", borderRadius: "50%", width: "28px", height: "28px", cursor: "pointer", color: "#fff", fontSize: "0.85rem" }}>✕</button>
                </div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
                <div><label style={s.lbl}>Full Name *</label><input style={s.inp} value={formData.name || ""} onChange={e => setFormData(d => ({ ...d, name: e.target.value }))} placeholder="Full name" /></div>
                <div><label style={s.lbl}>Email *</label><input style={s.inp} type="email" value={formData.email || ""} onChange={e => setFormData(d => ({ ...d, email: e.target.value }))} placeholder="user@email.com" /></div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
                <div><label style={s.lbl}>Phone</label><input style={s.inp} type="tel" value={formData.phone || ""} onChange={e => setFormData(d => ({ ...d, phone: e.target.value }))} placeholder="+91 98765 43210" /></div>
                <div><label style={s.lbl}>City</label><input style={s.inp} value={formData.city || ""} onChange={e => setFormData(d => ({ ...d, city: e.target.value }))} placeholder="Mumbai" /></div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
                <div><label style={s.lbl}>Plan</label>
                  <select style={selectStyle} value={formData.plan || "Starter"} onChange={e => setFormData(d => ({ ...d, plan: e.target.value }))}>
                    {["Starter","Pro","Business","None"].map(p => <option key={p}>{p}</option>)}
                  </select>
                </div>
                <div><label style={s.lbl}>Status</label>
                  <select style={selectStyle} value={formData.status || "active"} onChange={e => setFormData(d => ({ ...d, status: e.target.value }))}>
                    <option value="active">Active</option><option value="suspended">Suspended</option>
                  </select>
                </div>
              </div>
              {/* Custom fields */}
              {featureFlags.customFields && customFields.filter(cf => cf.active).map(cf => (
                <div key={cf.id}>
                  <label style={s.lbl}>{cf.label}{cf.required && " *"}</label>
                  <input style={s.inp} type={cf.type} value={formData[cf.key] || ""} onChange={e => setFormData(d => ({ ...d, [cf.key]: e.target.value }))} placeholder={`Enter ${cf.label.toLowerCase()}`} />
                </div>
              ))}
              {/* Verification badges */}
              {formData.id && (
                <div style={{ background: COLORS.bg, borderRadius: "10px", padding: "0.75rem 1rem", marginBottom: "1rem", display: "flex", gap: "1rem", flexWrap: "wrap" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                    <span style={{ fontSize: "0.82rem", fontWeight: 600 }}>📧 Email:</span>
                    <span style={{ color: formData.emailVerified ? COLORS.green : COLORS.red, fontWeight: 600, fontSize: "0.82rem" }}>{formData.emailVerified ? "✓ Verified" : "✗ Unverified"}</span>
                    {!formData.emailVerified && <button onClick={() => setFormData(d => ({ ...d, emailVerified: true }))} style={{ ...s.btn("success"), padding: "0.2rem 0.55rem", fontSize: "0.72rem" }}>Mark Verified</button>}
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                    <span style={{ fontSize: "0.82rem", fontWeight: 600 }}>📱 Phone:</span>
                    <span style={{ color: formData.phoneVerified ? COLORS.green : COLORS.red, fontWeight: 600, fontSize: "0.82rem" }}>{formData.phoneVerified ? "✓ Verified" : "✗ Unverified"}</span>
                    {!formData.phoneVerified && <button onClick={() => setFormData(d => ({ ...d, phoneVerified: true }))} style={{ ...s.btn("success"), padding: "0.2rem 0.55rem", fontSize: "0.72rem" }}>Mark Verified</button>}
                  </div>
                </div>
              )}
              {!formData.id && <div style={{ background: "rgba(249,115,22,0.08)", border: `1px solid ${COLORS.border}`, borderRadius: "10px", padding: "0.7rem 1rem", marginBottom: "1rem", fontSize: "0.8rem", color: COLORS.muted }}>📧 Invitation email will be sent to verify account.</div>}
              <div style={{ display: "flex", gap: "0.75rem" }}>
                <button style={{ ...s.btn("secondary"), flex: 1 }} onClick={closeModal}>Cancel</button>
                <button style={{ ...s.btn("primary"), flex: 2 }} onClick={saveUser}>{formData.id ? "Save Changes ✓" : "Create User →"}</button>
              </div>
            </div>
          </div>
        )}

        {/* Custom Field Modal */}
        {modal === "customField" && (
          <div style={s.modal} onClick={closeModal}>
            <div style={s.mbox} onClick={e => e.stopPropagation()}>
              <h3 style={{ fontWeight: 800, fontSize: "1.15rem", marginBottom: "1.5rem" }}>{formData.id ? "✏️ Edit" : "➕ Add"} Custom Field</h3>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
                <div><label style={s.lbl}>Field Label *</label><input style={s.inp} value={formData.label || ""} onChange={e => setFormData(d => ({ ...d, label: e.target.value }))} placeholder="e.g. City" /></div>
                <div><label style={s.lbl}>Field Key *</label><input style={s.inp} value={formData.key || ""} onChange={e => setFormData(d => ({ ...d, key: e.target.value.toLowerCase().replace(/\s+/g,"_") }))} placeholder="e.g. city" /></div>
              </div>
              <label style={s.lbl}>Field Type</label>
              <select style={selectStyle} value={formData.type || "text"} onChange={e => setFormData(d => ({ ...d, type: e.target.value }))}>
                {["text","email","tel","number","date","url","textarea","select"].map(t => <option key={t}>{t}</option>)}
              </select>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "0.75rem", marginBottom: "1rem" }}>
                {[["required","Required","Mandatory in signup"],["showInList","Show in list","Show in user table"],["active","Active","Display to users"]].map(([k, label, desc]) => (
                  <div key={k} onClick={() => setFormData(d => ({ ...d, [k]: !d[k] }))}
                    style={{ background: formData[k] ? COLORS.accentLight : COLORS.bg, border: `2px solid ${formData[k] ? COLORS.accent : COLORS.border}`, borderRadius: "10px", padding: "0.7rem", cursor: "pointer", textAlign: "center", transition: "all 0.15s" }}>
                    <div style={{ fontSize: "1.1rem", marginBottom: "0.2rem" }}>{formData[k] ? "✓" : "○"}</div>
                    <div style={{ fontWeight: 600, fontSize: "0.8rem" }}>{label}</div>
                    <div style={{ color: COLORS.muted, fontSize: "0.7rem" }}>{desc}</div>
                  </div>
                ))}
              </div>
              <div style={{ display: "flex", gap: "0.75rem" }}>
                <button style={{ ...s.btn("secondary"), flex: 1 }} onClick={closeModal}>Cancel</button>
                <button style={{ ...s.btn("primary"), flex: 1 }} onClick={saveCustomField}>Save Field</button>
              </div>
            </div>
          </div>
        )}

        <style>{`
          @keyframes spin { to { transform: rotate(360deg); } }
          @keyframes slideIn { from { opacity:0; transform:translateY(10px); } to { opacity:1; transform:none; } }
        `}</style>
      </div>
    </>
  );
}
