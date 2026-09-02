"use client";

import { FormEvent, useState } from "react";

export default function StaffLoginPage() {
  const [pin, setPin] = useState("");
  const [message, setMessage] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    const response = await fetch("/api/admin/auth", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ pin }),
    });
    const data = await response.json();
    if (!response.ok) {
      setMessage(data.error || "Incorrect PIN.");
      return;
    }
    const requested = new URLSearchParams(window.location.search).get("next") || "/";
    window.location.assign(requested.startsWith("/") && !requested.startsWith("//") ? requested : "/");
  }

  return (
    <main style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 20, background: "#f4f6f2", fontFamily: "Inter, system-ui, sans-serif" }}>
      <form onSubmit={submit} style={{ width: "min(420px, 100%)", background: "white", borderRadius: 22, padding: 28, boxShadow: "0 16px 45px #17201820" }}>
        <p style={{ margin: 0, color: "#178447", fontWeight: 900, letterSpacing: ".08em" }}>BBQ TOWN DICKSON</p>
        <h1 style={{ margin: "10px 0 8px", fontSize: 30 }}>Staff access</h1>
        <p style={{ margin: "0 0 22px", color: "#647067", lineHeight: 1.5 }}>店内系统仅供员工使用。请输入 Manager PIN。</p>
        <label style={{ display: "grid", gap: 7, fontWeight: 800 }}>
          PIN
          <input value={pin} onChange={(event) => setPin(event.target.value)} type="password" inputMode="numeric" autoComplete="current-password" autoFocus required style={{ minHeight: 56, border: "1px solid #dce3dc", borderRadius: 12, padding: "0 14px", fontSize: 20 }} />
        </label>
        <p aria-live="polite" style={{ minHeight: 22, color: "#c52f2f", margin: "12px 0 4px" }}>{message}</p>
        <button type="submit" style={{ width: "100%", minHeight: 56, border: 0, borderRadius: 12, background: "#142219", color: "white", fontSize: 17, fontWeight: 900 }}>ENTER STAFF AREA</button>
        <a href="/book.html" style={{ display: "block", textAlign: "center", marginTop: 18, color: "#155eef", fontWeight: 800 }}>Guest booking page</a>
      </form>
    </main>
  );
}
