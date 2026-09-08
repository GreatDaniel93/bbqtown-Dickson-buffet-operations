"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";
import BBQTownLogo from "../../components/BBQTownLogo";

type Voucher = {
  code: string;
  issuedAt: string;
  validFrom: string;
  expiresAt: string;
  discountPercent: number;
};

const dayFormatter = new Intl.DateTimeFormat("en-AU", {
  timeZone: "Australia/Sydney",
  day: "numeric",
  month: "short",
  year: "numeric",
});

const lastValidDay = (expiresAt: string) => new Date(new Date(expiresAt).getTime() - 1000);

export default function VoucherClaimPage() {
  const [voucher, setVoucher] = useState<Voucher | null>(null);
  const [qrUrl, setQrUrl] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  async function loadVoucher() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/vouchers/claim", { method: "POST", cache: "no-store" });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || "Unable to create voucher. Please try again.");
      setVoucher(body);
      try {
        localStorage.setItem("bbqtown_active_voucher", JSON.stringify(body));
      } catch {}
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to create voucher. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadVoucher();
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
      <section style={{ width: "min(480px, 100%)", background: "#f7f4ec", borderRadius: 24, padding: "24px 26px 30px", textAlign: "center", color: "#172018", boxShadow: "0 24px 70px rgba(0,0,0,.28)" }}>
        <BBQTownLogo width={220} />
        <div style={{ letterSpacing: 3, fontWeight: 900, fontSize: 12, color: "#c58213", marginTop: 4 }}>DICKSON</div>

        {loading && (
          <div style={{ padding: "48px 10px" }}>
            <h1 style={{ fontSize: 30, margin: "0 0 12px" }}>CREATING YOUR VOUCHER…</h1>
            <p style={{ color: "#69736c", lineHeight: 1.5 }}>Please keep this page open for a moment.</p>
          </div>
        )}

        {!loading && error && (
          <div style={{ marginTop: 24, padding: 20, borderRadius: 16, background: "white" }}>
            <h1 style={{ fontSize: 28, margin: "0 0 10px" }}>We couldn&apos;t create your voucher</h1>
            <p style={{ color: "#c64036", fontWeight: 800, lineHeight: 1.5 }}>{error}</p>
            <button
              onClick={() => void loadVoucher()}
              style={{ width: "100%", minHeight: 58, border: 0, borderRadius: 12, background: "#c58213", color: "white", fontSize: 17, fontWeight: 900, cursor: "pointer" }}
            >
              TRY AGAIN
            </button>
            <a href="/voucher" style={{ display: "block", marginTop: 16, color: "#2f7e54", fontWeight: 900 }}>← BACK</a>
          </div>
        )}

        {!loading && voucher && (
          <div style={{ marginTop: 24, border: "2px dashed #c58213", borderRadius: 16, padding: 20, background: "white" }}>
            <div style={{ fontSize: 12, fontWeight: 900, letterSpacing: 1.2 }}>YOUR ONE-TIME VOUCHER</div>
            <div style={{ color: "#c58213", fontWeight: 900, fontSize: 20, marginTop: 8 }}>10% OFF — ONE PERSON ONLY</div>

            {qrUrl ? (
              <img src={qrUrl} alt={`QR code for voucher ${voucher.code}`} width={230} height={230} style={{ display: "block", width: "min(230px, 100%)", height: "auto", margin: "16px auto 10px" }} />
            ) : (
              <div style={{ height: 230, display: "grid", placeItems: "center", color: "#69736c", fontWeight: 800 }}>GENERATING QR…</div>
            )}

            <div style={{ fontSize: 28, fontWeight: 900, letterSpacing: 2, overflowWrap: "anywhere" }}>{voucher.code}</div>
            <div style={{ color: "#c64036", fontWeight: 900, marginTop: 12 }}>NOT VALID TODAY</div>
            <div style={{ color: "#2f7e54", fontWeight: 900, marginTop: 7 }}>Valid from {dayFormatter.format(new Date(voucher.validFrom))}</div>
            <div style={{ color: "#566058", fontWeight: 800, marginTop: 5 }}>Valid through {dayFormatter.format(lastValidDay(voucher.expiresAt))}</div>

            <p style={{ fontSize: 13, lineHeight: 1.5, color: "#566058", margin: "12px 0 0" }}>
              This 10% discount applies to ONE guest&apos;s buffet price only, not the whole table or bill. If 5 people dine together and only one person has this voucher, only that person receives 10% off.
            </p>
            <p style={{ fontSize: 13, lineHeight: 1.5, color: "#566058", margin: "8px 0 0" }}>
              Show this voucher to staff before payment. Staff will verify the Google review and voucher code before applying the discount.
            </p>
          </div>
        )}
      </section>
    </main>
  );
}
