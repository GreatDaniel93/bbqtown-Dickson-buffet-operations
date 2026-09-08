"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";

type Voucher = { code: string; issuedAt: string; validFrom: string; expiresAt: string; discountPercent: number };

const REVIEW_URL = "https://www.google.com/maps/search/?api=1&query=BBQTOWN%20Dickson%206%2F28%20Challis%20St%20Dickson%20ACT%202602";
const WAIT_SECONDS = 20;
const dayFormatter = new Intl.DateTimeFormat("en-AU", { timeZone: "Australia/Sydney", day: "numeric", month: "short", year: "numeric" });
const lastValidDay = (expiresAt: string) => new Date(new Date(expiresAt).getTime() - 1000);

export default function VoucherPage() {
  const [voucher, setVoucher] = useState<Voucher | null>(null);
  const [qrUrl, setQrUrl] = useState("");
  const [error, setError] = useState("");
  const [claiming, setClaiming] = useState(false);
  const [reviewStartedAt, setReviewStartedAt] = useState<number | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(WAIT_SECONDS);

  useEffect(() => { const stored = Number(localStorage.getItem("bbqtown_review_started_at") || 0); if (stored > 0) setReviewStartedAt(stored); }, []);
  useEffect(() => {
    if (!reviewStartedAt) return;
    const tick = () => setSecondsLeft(Math.max(0, WAIT_SECONDS - Math.floor((Date.now() - reviewStartedAt) / 1000)));
    tick(); const timer = window.setInterval(tick, 1000); return () => window.clearInterval(timer);
  }, [reviewStartedAt]);

  function markReviewStarted() {
    const started = Date.now();
    localStorage.setItem("bbqtown_review_started_at", String(started));
    setReviewStartedAt(started); setSecondsLeft(WAIT_SECONDS);
  }

  async function claim() {
    if (!reviewStartedAt || secondsLeft > 0) return;
    setClaiming(true); setError("");
    try {
      const res = await fetch("/api/vouchers/claim", { method: "POST" });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || "Please try again.");
      setVoucher(body);
    } catch (e) { setError(e instanceof Error ? e.message : "Please try again."); }
    finally { setClaiming(false); }
  }

  useEffect(() => {
    if (!voucher) return; let active = true;
    void QRCode.toDataURL(`BBQTOWN Dickson voucher: ${voucher.code}`, { width: 520, margin: 2, errorCorrectionLevel: "M" }).then(url => { if (active) setQrUrl(url); });
    return () => { active = false; };
  }, [voucher]);

  return <main style={{minHeight:"100vh",display:"grid",placeItems:"center",background:"#111a13",padding:20,fontFamily:"Arial, sans-serif"}}>
    <section style={{width:"min(480px, 100%)",background:"#f7f4ec",borderRadius:24,padding:"28px 26px 30px",textAlign:"center",color:"#172018",boxShadow:"0 24px 70px rgba(0,0,0,.28)"}}>
      <img src="/bbqtown-logo.png" alt="BBQTOWN Korean BBQ Buffet" style={{display:"block",width:"min(330px, 88%)",height:"auto",margin:"0 auto 4px",objectFit:"contain"}} />
      <div style={{letterSpacing:3,fontWeight:900,fontSize:12,color:"#c58213",marginTop:4}}>DICKSON</div>
      <h1 style={{fontSize:46,lineHeight:1,margin:"16px 0 8px"}}>GET 10% OFF</h1>
      <p style={{color:"#566058",lineHeight:1.55,margin:"0 auto",maxWidth:380}}>Share your experience on Google, then come back here to claim 10% off your next visit.</p>
      {!voucher && <div style={{marginTop:24,padding:20,borderRadius:16,background:"white"}}>
        <div style={{fontSize:13,fontWeight:900,letterSpacing:1}}>STEP 1</div><h2 style={{margin:"8px 0",fontSize:23}}>Share your experience</h2>
        <p style={{color:"#69736c",fontSize:14,lineHeight:1.5}}>Tap below to open BBQTOWN Dickson on Google. After posting your review, return to this page.</p>
        <a href={REVIEW_URL} target="_blank" rel="noopener noreferrer" onClick={markReviewStarted} style={{display:"grid",placeItems:"center",width:"100%",minHeight:58,borderRadius:12,background:"#2f7e54",color:"white",fontSize:17,fontWeight:900,textDecoration:"none"}}>LEAVE A GOOGLE REVIEW</a>
        {reviewStartedAt && <div style={{marginTop:22,paddingTop:20,borderTop:"1px solid #e2ded4"}}>
          <div style={{fontSize:13,fontWeight:900,letterSpacing:1}}>STEP 2</div><h2 style={{margin:"8px 0",fontSize:23}}>Claim your reward</h2>
          <p style={{color:"#69736c",fontSize:14,lineHeight:1.5}}>Once you've finished your Google review, come back and claim your voucher.</p>
          <button disabled={secondsLeft>0||claiming} onClick={claim} style={{width:"100%",minHeight:58,border:0,borderRadius:12,background:secondsLeft>0?"#aeb5af":"#c58213",color:"white",fontSize:17,fontWeight:900,cursor:secondsLeft>0?"not-allowed":"pointer"}}>{claiming?"CREATING VOUCHER…":secondsLeft>0?`RETURN AFTER YOUR REVIEW (${secondsLeft}s)`:"I'VE LEFT MY REVIEW — CLAIM 10% OFF"}</button>
        </div>}
      </div>}
      {voucher && <div style={{marginTop:24,border:"2px dashed #c58213",borderRadius:16,padding:20,background:"white"}}>
        <div style={{fontSize:12,fontWeight:900,letterSpacing:1.2}}>YOUR ONE-TIME VOUCHER</div>
        {qrUrl?<img src={qrUrl} alt={`QR code for voucher ${voucher.code}`} width={230} height={230} style={{display:"block",width:"min(230px, 100%)",height:"auto",margin:"16px auto 10px"}}/>:<div style={{height:230,display:"grid",placeItems:"center",color:"#69736c",fontWeight:800}}>GENERATING QR…</div>}
        <div style={{fontSize:27,fontWeight:900,letterSpacing:2,overflowWrap:"anywhere"}}>{voucher.code}</div><div style={{color:"#c64036",fontWeight:900,marginTop:12}}>NOT VALID TODAY</div>
        <div style={{color:"#2f7e54",fontWeight:900,marginTop:7}}>Valid from {dayFormatter.format(new Date(voucher.validFrom))}</div><div style={{color:"#566058",fontWeight:800,marginTop:5}}>Valid through {dayFormatter.format(lastValidDay(voucher.expiresAt))}</div>
        <p style={{fontSize:13,lineHeight:1.45,color:"#566058",margin:"10px 0 0"}}>Show this screen to staff before payment. Staff will verify the code in the system.</p>
      </div>}
      {error&&<p style={{color:"#c64036",fontWeight:800,marginTop:18}}>{error}</p>}
      <p style={{color:"#69736c",fontSize:12,lineHeight:1.5,margin:"22px 0 0"}}>Reward is for sharing your honest experience; no particular star rating is required. Voucher is valid at BBQTOWN Dickson only, from the day after issue for 14 full calendar days. One active voucher per device. One use only. Cannot be combined with other offers.</p>
    </section>
  </main>;
}
