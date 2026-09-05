"use client";

import { useState } from "react";

export default function VoucherPage() {
  const [loading, setLoading] = useState(false);
  const [voucher, setVoucher] = useState<{ code: string; date: string; amount: number } | null>(null);
  const [error, setError] = useState("");
  async function claim() {
    setLoading(true); setError("");
    const res = await fetch("/api/vouchers/claim", { method: "POST" });
    const body = await res.json(); setLoading(false);
    if (!res.ok) { setError(body.error || "Please try again."); return; }
    setVoucher(body);
  }
  return <main style={{ minHeight: "100vh", display: "grid", placeItems: "center", background: "#172018", padding: 20, fontFamily: "Arial, sans-serif" }}><section style={{ width: "min(460px, 100%)", background: "#f5f4ef", borderRadius: 20, padding: 30, textAlign: "center", color: "#172018" }}><p style={{ letterSpacing: 2, fontWeight: 800, margin: 0 }}>BBQ TOWN DICKSON</p><h1 style={{ fontSize: 42, margin: "18px 0 8px" }}>$10 OFF</h1><p style={{ color: "#566058", lineHeight: 1.5 }}>Show this voucher at BBQ Town Dickson today to receive $10 off your bill.</p>{voucher ? <div style={{ marginTop: 24, border: "2px dashed #c58213", borderRadius: 14, padding: 20, background: "white" }}><div style={{ fontSize: 12, fontWeight: 800, letterSpacing: 1 }}>YOUR ONE-TIME VOUCHER</div><div style={{ fontSize: 28, fontWeight: 900, letterSpacing: 2, margin: "12px 0" }}>{voucher.code}</div><div style={{ color: "#d64545", fontWeight: 800 }}>Valid today only · single use</div></div> : <button onClick={claim} disabled={loading} style={{ marginTop: 20, width: "100%", minHeight: 60, border: 0, borderRadius: 10, background: "#318a5b", color: "white", fontSize: 18, fontWeight: 900 }}>{loading ? "ISSUING…" : "CLAIM MY $10 VOUCHER"}</button>}{error && <p style={{ color: "#d64545", fontWeight: 700 }}>{error}</p>}<p style={{ color: "#69736c", fontSize: 12, marginTop: 22 }}>One voucher per device per day. Cannot be combined with other offers.</p></section></main>;
}
