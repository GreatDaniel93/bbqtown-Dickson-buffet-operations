"use client";

import BBQTownLogo from "../components/BBQTownLogo";

const REVIEW_URL = "https://g.page/r/CUEVJmvZGEyeEAE/review";

export default function VoucherPage() {
  function markReviewStarted() {
    try {
      localStorage.setItem("bbqtown_review_started", "1");
    } catch {}
  }

  return (
    <main style={{ minHeight: "100vh", display: "grid", placeItems: "center", background: "#111a13", padding: 20, fontFamily: "Arial, sans-serif" }}>
      <section style={{ width: "min(480px, 100%)", background: "#f7f4ec", borderRadius: 24, padding: "24px 26px 30px", textAlign: "center", color: "#172018", boxShadow: "0 24px 70px rgba(0,0,0,.28)" }}>
        <BBQTownLogo width={220} />
        <div style={{ letterSpacing: 3, fontWeight: 900, fontSize: 12, color: "#c58213", marginTop: 4 }}>DICKSON</div>

        <h1 style={{ fontSize: 44, lineHeight: 1, margin: "16px 0 8px" }}>GET 10% OFF</h1>
        <p style={{ color: "#566058", lineHeight: 1.55, margin: "0 auto", maxWidth: 380 }}>
          Share your experience on Google, then come back here to claim 10% off one guest&apos;s buffet price on your next visit.
        </p>

        <div style={{ marginTop: 24, padding: 20, borderRadius: 16, background: "white" }}>
          <div style={{ fontSize: 13, fontWeight: 900, letterSpacing: 1 }}>STEP 1</div>
          <h2 style={{ margin: "8px 0", fontSize: 23 }}>Share your experience</h2>
          <p style={{ color: "#69736c", fontSize: 14, lineHeight: 1.5 }}>
            Tap below to open BBQTOWN Dickson&apos;s Google review page. When you&apos;re finished, use your browser&apos;s Back button to return here.
          </p>
          <a
            href={REVIEW_URL}
            onClick={markReviewStarted}
            style={{ display: "grid", placeItems: "center", width: "100%", minHeight: 58, borderRadius: 12, background: "#2f7e54", color: "white", fontSize: 17, fontWeight: 900, textDecoration: "none" }}
          >
            LEAVE A GOOGLE REVIEW
          </a>

          <div style={{ marginTop: 22, paddingTop: 20, borderTop: "1px solid #e2ded4" }}>
            <div style={{ fontSize: 13, fontWeight: 900, letterSpacing: 1 }}>STEP 2</div>
            <h2 style={{ margin: "8px 0", fontSize: 23 }}>Claim your reward</h2>
            <p style={{ color: "#69736c", fontSize: 14, lineHeight: 1.5 }}>
              Finished your Google review? Tap below. You will be taken to your voucher page and your code will be generated there.
            </p>
            <a
              href="/voucher/claim"
              style={{ display: "grid", placeItems: "center", width: "100%", minHeight: 58, borderRadius: 12, background: "#c58213", color: "white", fontSize: 17, fontWeight: 900, textDecoration: "none" }}
            >
              GET MY 10% OFF CODE
            </a>
          </div>
        </div>

        <p style={{ color: "#69736c", fontSize: 12, lineHeight: 1.5, margin: "22px 0 0" }}>
          Reward is for sharing your honest experience; no particular star rating is required. Voucher is valid at BBQTOWN Dickson only, from the day after issue for 14 full calendar days. 10% off applies to one person&apos;s buffet price only. One active voucher per device. One use only. Cannot be combined with other offers.
        </p>
      </section>
    </main>
  );
}
