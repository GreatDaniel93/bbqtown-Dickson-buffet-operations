"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";

type Voucher = { code: string; issuedAt: string; validFrom: string; expiresAt: string; discountPercent: number };
const REVIEW_URL = "https://g.page/r/CUEVJmvZGEyeEAE/review";
const dayFormatter = new Intl.DateTimeFormat("en-AU", { timeZone: "Australia/Sydney", day: "numeric", month: "short", year: "numeric" });
const lastValidDay = (expiresAt: string) => new Date(new Date(expiresAt).getTime() - 1000);

export default function VoucherPage() {
  const [voucher, setVoucher] = useState<Voucher | null>(null);
  const [qrUrl, setQrUrl] = useState("");
  const [error, setError] = useState("");
  const [claiming, setClaiming] = useState(false);
  const [reviewStarted, setReviewStarted] = useState(false);

  useEffect(() => {
    const started = localStorage.getItem("bbqtown_review_started") === "1";
    setReviewStarted(started);
    const saved = localStorage.getItem("bbqtown_active_voucher");
    if (saved) { try { const parsed = JSON.parse(saved) as Voucher; if (parsed.expiresAt && new Date(parsed.expiresAt).getTime() > Date.now()) setVoucher(parsed); else localStorage.removeItem("bbqtown_active_voucher"); } catch { localStorage.removeItem("bbqtown_active_voucher"); } }
  }, []);

  useEffect(() => {
    const onReturn = () => { if (localStorage.getItem("bbqtown_review_started") === "1") setReviewStarted(true); };
    window.addEventListener("focus", onReturn); document.addEventListener("visibilitychange", onReturn);
    return () => { window.removeEventListener("focus", onReturn); document.removeEventListener("visibilitychange", onReturn); };
  }, []);

  function markReviewStarted() { localStorage.setItem("bbqtown_review_started", "1"); setReviewStarted(true); }

  async function claim() {
    if (!reviewStarted) return; setClaiming(true); setError("");
    try { const res = await fetch("/api/vouchers/claim", { method: "POST" }); const body = await res.json(); if (!res.ok) throw new Error(body.error || "Please try again."); setVoucher(body); localStorage.setItem("bbqtown_active_voucher", JSON.stringify(body)); }
    catch (e) { setError(e instanceof Error ? e.message : "Please try again."); } finally { setClaiming(false); }
  }

  useEffect(() => { if (!voucher) return; let active = true; void QRCode.toDataURL(`BBQTOWN Dickson voucher: ${voucher.code}`, { width: 520, margin: 2, errorCorrectionLevel: "M" }).then(url => { if (active) setQrUrl(url); }); return () => { active = false; }; }, [voucher]);

  return <main style={{minHeight:"100vh",display:"grid",placeItems:"center",background:"#111a13",padding:20,fontFamily:"Arial, sans-serif"}}><section style={{width:"min(480px, 100%)",background:"#f7f4ec",borderRadius:24,padding:"28px 26px 30px",textAlign:"center",color:"#172018",boxShadow:"0 24px 70px rgba(0,0,0,.28)"}}>
    <img src="/bbqtown-logo.jpg?v=20260908" alt="BBQTOWN Korean BBQ Buffet" style={{display:"block",width:"min(380px, 94%)",height:"auto",margin:"0 auto 4px",objectFit:"contain"}} />
    <div style={{letterSpacing:3,fontWeight:900,fontSize:12,color:"#c58213",marginTop:4}}>DICKSON</div><h1 style={{fontSize:46,lineHeight:1,margin:"16px 0 8px"}}>GET 10% OFF</h1><p style={{color:"#566058",lineHeight:1.55,margin:"0 auto",maxWidth:380}}>Share your experience on Google, then come back here to claim 10% off your next visit.</p>
    {!voucher && <div style={{marginTop:24,padding:20,borderRadius:16,background:"white"}}><div style={{fontSize:13,fontWeight:900,letterSpacing:1}}>STEP 1</div><h2 style={{margin:"8px 0",fontSize:23}}>Share your experience</h2><p style={{color:"#69736c",fontSize:14,lineHeight:1.5}}>Tap below to open BBQTOWN Dickson&apos;s Google review page. After posting your review, return to this page.</p><a href={REVIEW_URL} target="_blank" rel="noopener noreferrer" onClick={markReviewStarted} style={{display:"grid",placeItems:"center",width:"100%",minHeight:58,borderRadius:12,background:"#2f7e54",color:"white",fontSize:17,fontWeight:900,textDecoration:"none"}}>LEAVE A GOOGLE REVIEW</a>
    {reviewStarted && <div style={{marginTop:22,paddingTop:20,borderTop:"1px solid #e2ded4"}}><div style={{fontSize:13,fontWeight:900,letterSpacing:1}}>STEP 2</div><h2 style={{margin:"8px 0",fontSize:23}}>Welcome back!</h2><p style={{color:"#69736c",fontSize:14,lineHeight:1.5}}>Finished your Google review? Tap below to generate your voucher. Staff will verify your review when you use it.</p><button disabled={claiming} onClick={claim} style={{width:"100%",minHeight:58,border:0,borderRadius:12,background:"#c58213",color:"white",fontSize:17,fontWeight:900,cursor:claiming?"wait":"pointer"}}>{claiming?"CREATING VOUCHER…":"GET MY 10% OFF CODE"}</button></div>}</div>}
    {voucher && <div style={{marginTop:24,border:"2px dashed #c58213",borderRadius:16,padding:20,background:"white"}}><div style={{fontSize:12,fontWeight:900,letterSpacing:1.2}}>YOUR ONE-TIME VOUCHER</div>{qrUrl?<img src={qrUrl} alt={`QR code for voucher ${voucher.code}`} width={230} height={230} style={{display:"block",width:"min(230px, 100%)",height:"auto",margin:"16px auto 10px"}}/>:<div style={{height:230,display:"grid",placeItems:"center",color:"#69736c",fontWeight:800}}>GENERATING QR…</div>}<div style={{fontSize:27,fontWeight:900,letterSpacing:2,overflowWrap:"anywhere"}}>{voucher.code}</div><div style={{color:"#c64036",fontWeight:900,marginTop:12}}>NOT VALID TODAY</div><div style={{color:"#2f7e54",fontWeight:900,marginTop:7}}>Valid from {dayFormatter.format(new Date(voucher.validFrom))}</div><div style={{color:"#566058",fontWeight:800,marginTop:5}}>Valid through {dayFormatter.format(lastValidDay(voucher.expiresAt))}</div><p style={{fontSize:13,lineHeight:1.45,color:"#566058",margin:"10px 0 0"}}>Keep this voucher on your phone. Show it to staff before payment. Staff will verify the review and voucher code before applying the discount.</p></div>}
    {error&&<p style={{color:"#c64036",fontWeight:800,marginTop:18}}>{error}</p>}<p style={{color:"#69736c",fontSize:12,lineHeight:1.5,margin:"22px 0 0"}}>Reward is for sharing your honest experience; no particular star rating is required. Voucher is valid at BBQTOWN Dickson only, from the day after issue for 14 full calendar days. One active voucher per device. One use only. Cannot be combined with other offers.</p>
  </section></main>;
}
