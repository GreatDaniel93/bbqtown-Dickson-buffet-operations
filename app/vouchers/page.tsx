"use client";

import { useState } from "react";

export default function VouchersPage() {
  const [code, setCode] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  async function redeem(event: React.FormEvent) {
    event.preventDefault(); setBusy(true); setMessage("");
    const res = await fetch("/api/vouchers/redeem", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ code }) });
    const body = await res.json(); setBusy(false);
    setMessage(res.ok ? `✓ Redeemed ${body.code} · $10 discount approved` : `✕ ${body.error || "Unable to redeem"}`);
    if (res.ok) setCode("");
  }
  return <main style={{ minHeight: "100vh", background: "#f5f4ef", color: "#172018", padding: 32, fontFamily: "Arial, sans-serif" }}><section style={{ maxWidth: 620, margin: "50px auto", background: "white", borderRadius: 16, padding: 30 }}><button onClick={() => window.history.back()} style={{ minHeight: 42, border: "1px solid #ccd4cd", borderRadius: 8, background: "white", color: "#172018", fontWeight: 800, padding: "0 14px" }}>← BACK TO MANAGER</button><p style={{ letterSpacing: 1, fontWeight: 800 }}>BBQ TOWN DICKSON · STAFF ONLY</p><h1>Redeem street voucher</h1><p>Enter the customer’s voucher code once they are ready to pay. A successful redemption cannot be undone.</p><form onSubmit={redeem}><input autoFocus value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="BT10-1234ABCD" style={{ width: "100%", minHeight: 58, fontSize: 22, fontWeight: 800, padding: "0 15px", border: "1px solid #ccd4cd", borderRadius: 9, boxSizing: "border-box" }} /><button disabled={busy} style={{ marginTop: 12, width: "100%", minHeight: 58, border: 0, borderRadius: 9, background: "#318a5b", color: "white", fontWeight: 900, fontSize: 17 }}>{busy ? "CHECKING…" : "REDEEM $10 VOUCHER"}</button></form>{message && <p style={{ marginTop: 18, color: message.startsWith("✓") ? "#318a5b" : "#d64545", fontWeight: 800 }}>{message}</p>}<hr style={{ border: 0, borderTop: "1px solid #e2e7e2", margin: "28px 0" }} /><p><strong>Employee QR link:</strong><br />https://bbqtowndickson.vercel.app/voucher</p></section></main>;
}
