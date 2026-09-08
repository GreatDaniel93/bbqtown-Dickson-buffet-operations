type SearchParams = Promise<{ next?: string; error?: string }>;

function safeNext(value?: string) {
  if (!value || value === "/") return "/ops.html";
  return value.startsWith("/") && !value.startsWith("//") ? value : "/ops.html";
}

export default async function StaffLoginPage({ searchParams }: { searchParams: SearchParams }) {
  const { next, error } = await searchParams;
  const destination = safeNext(next);
  return (
    <main style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 20, background: "#f4f6f2", fontFamily: "Inter, system-ui, sans-serif" }}>
      <form action="/staff-login/submit" method="post" style={{ width: "min(420px, 100%)", background: "white", borderRadius: 22, padding: 28, boxShadow: "0 16px 45px #17201820" }}>
        <img src="/bbqtown-logo.jpg?v=20260908-8" alt="BBQTOWN Korean BBQ Buffet" width={440} height={181} style={{ display: "block", width: "min(300px, 88%)", height: "auto", margin: "0 auto 8px" }} />
        <p style={{ margin: "0 0 8px", textAlign: "center", color: "#178447", fontWeight: 900, letterSpacing: ".12em", fontSize: 12 }}>DICKSON · STAFF</p>
        <h1 style={{ margin: "10px 0 8px", fontSize: 30 }}>Staff access</h1>
        <p style={{ margin: "0 0 22px", color: "#647067", lineHeight: 1.5 }}>店内系统仅供员工使用。请输入 Manager PIN。</p>
        <label style={{ display: "grid", gap: 7, fontWeight: 800 }}>PIN<input name="pin" type="password" inputMode="numeric" autoComplete="current-password" autoFocus required style={{ minHeight: 56, border: "1px solid #dce3dc", borderRadius: 12, padding: "0 14px", fontSize: 20 }} /></label>
        <input type="hidden" name="next" value={destination} />
        <p aria-live="polite" style={{ minHeight: 22, color: "#c52f2f", margin: "12px 0 4px" }}>{error ? "Incorrect PIN. Please try again." : ""}</p>
        <button type="submit" style={{ width: "100%", minHeight: 56, border: 0, borderRadius: 12, background: "#142219", color: "white", fontSize: 17, fontWeight: 900 }}>ENTER STAFF AREA</button>
        <a href="/book.html" style={{ display: "block", textAlign: "center", marginTop: 18, color: "#155eef", fontWeight: 800 }}>Guest booking page</a>
      </form>
    </main>
  );
}
