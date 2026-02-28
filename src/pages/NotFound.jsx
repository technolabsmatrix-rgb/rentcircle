export default function NotFound() {
  return (
    <div style={{
      minHeight: "100vh", display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center",
      background: "#f8f7f4", fontFamily: "'Outfit', sans-serif", textAlign: "center",
      padding: "2rem"
    }}>
      <div style={{ fontSize: "5rem", marginBottom: "1rem" }}>📦</div>
      <h1 style={{ fontSize: "3rem", fontWeight: 900, color: "#1a1a2e", marginBottom: "0.5rem" }}>404</h1>
      <p style={{ color: "#6b7280", fontSize: "1.1rem", marginBottom: "2rem" }}>
        Oops! This page doesn't exist.
      </p>
      <a href="/"
        style={{
          background: "#f59e0b", color: "#1a1a2e", padding: "0.85rem 2rem",
          borderRadius: "12px", fontWeight: 800, fontSize: "1rem", textDecoration: "none"
        }}>
        ← Back to RentCircle
      </a>
    </div>
  )
}
