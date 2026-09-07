"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";

type Voucher = {
  code: string;
  issuedAt: string;
  validFrom: string;
  expiresAt: string;
  discountPercent: number;
};

const dateFormatter = new Intl.DateTimeFormat("en-AU", {
  timeZone: "Australia/Sydney",
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

const dayFormatter = new Intl.DateTimeFormat("en-AU", {
  timeZone: "Australia/Sydney",
  day: "numeric",
  month: "short",
  year: "numeric",
});

export default function VoucherPage() {
  const [loading, setLoading] = useState(true);
  const [voucher, setVoucher] = useState<Voucher | null>(null);
  const [qrUrl, setQrUrl] = useState("");
  const [error, setError] = useState("");

  async function claim() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/vouchers/claim", { method: "POST" });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || "Please try again.");
      setVoucher(body);
    } catch (claimError) {
      setError(claimError instanceof Error ? claimError.message : "Please try again.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void claim();
  }, []);

  useEffect(() => {
    if (!voucher) return;
    let active = true;
    void QRCode.toDataURL(`BBQTOWN Dickson voucher: ${voucher.code}`, {
      width: 520,
      margin: 2,
      errorCorrectionLevel: "M",
    }).then((url) => {
      if (active) setQrUrl(url);
    });
    return () => {
      active = false;
    };
  }, [voucher]);

  return (
    <main style={{ minHeight: "100vh", display: "grid", placeItems: "center", background: "#111a13", padding: 20, fontFamily: "Arial, sans-serif" }}>
      <section style={{ width: "min(480px, 100%)", background: "#f7f4ec", borderRadius: 24, padding: "30px 26px", textAlign: "center", color: "#172018", boxShadow: "0 24px 70px rgba(0,0,0,.28)" }}>
        <p style={{ letterSpacing: 2.5, fontWeight: 900, margin: 0, color: "#2f7e54" }}>BBQTOWN DICKSON</p>
        <h1 style={{ fontSize: 52, lineHeight: 1, margin: "18px 0 8px" }}>10% OFF</h1>
        <p style={{ color: "#566058", lineHeight: 1.55, margin: "0 auto", maxWidth: 360 }}>Your one-time street promotion voucher. It cannot be used on the day it is issued and expires 14 days after issue.</p>

        {loading && (
          <div style={{ marginTop: 28, padding: 28, borderRadius: 16, background: "white", fontWeight: 900, color: "#2f7e54" }}>CREATING YOUR VOUCHER…</div>
        )}

        {voucher && !loading && (
          <div style={{ marginTop: 24, border: "2px dashed #c58213", borderRadius: 16, padding: 20, background: "white" }}>
            <div style={{ fontSize: 12, fontWeight: 900, letterSpacing: 1.2 }}>YOUR ONE-TIME VOUCHER</div>
            {qrUrl ? <img src={qrUrl} alt={`QR code for voucher ${voucher.code}`} width={230} height={230} style={{ display: "block", width: "min(230px, 100%)", height: "auto", margin: "16px auto 10px" }} /> : <div style={{ height: 230, display: "grid", placeItems: "center", color: "#69736c", fontWeight: 800 }}>GENERATING QR…</div>}
            <div style={{ fontSize: 27, fontWeight: 900, letterSpacing: 2, overflowWrap: "anywhere" }}>{voucher.code}</div>
            <div style={{ color: "#c64036", fontWeight: 900, marginTop: 12 }}>NOT VALID TODAY</div>
            <div style={{ color: "#2f7e54", fontWeight: 900, marginTop: 7 }}>Valid from {dayFormatter.format(new Date(voucher.validFrom))}</div>
            <div style={{ color: "#566058", fontWeight: 800, marginTop: 5 }}>Expires {dateFormatter.format(new Date(voucher.expiresAt))}</div>
            <p style={{ fontSize: 13, lineHeight: 1.45, color: "#566058", margin: "10px 0 0" }}>Show this screen to staff before payment. Staff will verify the code in the system.</p>
          </div>
        )}

        {error && !loading && (
          <div style={{ marginTop: 24 }}>
            <p style={{ color: "#c64036", fontWeight: 800 }}>{error}</p>
            <button onClick={claim} style={{ width: "100%", minHeight: 56, border: 0, borderRadius: 11, background: "#2f7e54", color: "white", fontSize: 17, fontWeight: 900 }}>TRY AGAIN</button>
          </div>
        )}

        <p style={{ color: "#69736c", fontSize: 12, lineHeight: 1.5, margin: "22px 0 0" }}>Valid at BBQTOWN Dickson only. Not valid on the day of issue. One active voucher per device. One use only. Cannot be combined with other offers.</p>
      </section>
    </main>
  );
}
