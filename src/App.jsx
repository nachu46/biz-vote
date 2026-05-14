/*
╔══════════════════════════════════════════════════════════════╗
║         SUPABASE SQL SCHEMA — Run in SQL Editor first        ║
╚══════════════════════════════════════════════════════════════╝

-- STEP 1: Create candidates table
create table candidates (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  bio text,
  photo_url text,
  category text not null check (category in ('boys','girls')),
  created_at timestamptz default now()
);

-- STEP 2: Create votes table (unique email blocks double voting at DB level)
create table votes (
  id uuid primary key default gen_random_uuid(),
  voter_email text not null unique,
  boys_candidate_id uuid references candidates(id),
  girls_candidate_id uuid references candidates(id),
  voted_at timestamptz default now()
);

-- STEP 3: Enable Row Level Security
alter table candidates enable row level security;
alter table votes enable row level security;

-- STEP 4: RLS Policies
create policy "Public read candidates" on candidates for select using (true);
create policy "Admin insert candidates" on candidates for insert with check (true);
create policy "Admin delete candidates" on candidates for delete using (true);
create policy "Anyone can vote" on votes for insert with check (true);
create policy "Anyone can read votes" on votes for select using (true);

-- STEP 5: In Supabase dashboard:
--   Storage > New Bucket > Name: candidate-photos > Toggle Public ON
*/

// ╔══════════════════════════════════════════════════════════════╗
// ║  CONFIG — Replace these values before deploying             ║
// ╚══════════════════════════════════════════════════════════════╝
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;
const COMPANY_DOMAIN = import.meta.env.VITE_COMPANY_DOMAIN;
const ADMIN_EMAIL = import.meta.env.VITE_ADMIN_EMAIL;
const APP_TITLE = import.meta.env.VITE_APP_TITLE;

import { useState, useEffect, useRef, useCallback } from "react";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ─── Global CSS ───────────────────────────────────────────────────────────────
const GLOBAL_CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Sora:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;600&display=swap');
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  html { scroll-behavior: smooth; }
  body { background: #07080f; color: #e8e8f0; font-family: 'Sora', sans-serif; min-height: 100vh; }
  ::-webkit-scrollbar { width: 5px; }
  ::-webkit-scrollbar-track { background: transparent; }
  ::-webkit-scrollbar-thumb { background: #2a2b3d; border-radius: 3px; }

  @keyframes fadeUp { from { opacity:0; transform:translateY(20px); } to { opacity:1; transform:translateY(0); } }
  @keyframes spin { from { transform:rotate(0deg); } to { transform:rotate(360deg); } }
  @keyframes float { 0%,100% { transform:translateY(0); } 50% { transform:translateY(-8px); } }
  @keyframes glow { 0%,100% { box-shadow:0 0 20px rgba(99,102,241,0.25); } 50% { box-shadow:0 0 40px rgba(99,102,241,0.5); } }
  @keyframes barGrow { from { width:0; } to { } }

  .fu { animation: fadeUp 0.45s ease both; }
  .fu1 { animation: fadeUp 0.45s 0.08s ease both; }
  .fu2 { animation: fadeUp 0.45s 0.16s ease both; }
  .fu3 { animation: fadeUp 0.45s 0.24s ease both; }
  .fu4 { animation: fadeUp 0.45s 0.32s ease both; }
  .spin { animation: spin 0.9s linear infinite; }
  .float { animation: float 3s ease-in-out infinite; }
  .glow-anim { animation: glow 2.5s ease-in-out infinite; }

  input, select, button, textarea { font-family: 'Sora', sans-serif; outline: none; }

  .glass { background: rgba(255,255,255,0.035); border: 1px solid rgba(255,255,255,0.07); }
  .glass-md { background: rgba(255,255,255,0.055); border: 1px solid rgba(255,255,255,0.1); }

  .btn-pri {
    background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);
    color: #fff; border: none; border-radius: 14px;
    padding: 0.85rem 1.6rem; font-size: 15px; font-weight: 600;
    cursor: pointer; transition: all 0.2s; letter-spacing: 0.01em;
  }
  .btn-pri:hover:not(:disabled) { transform: translateY(-1px); box-shadow: 0 8px 28px rgba(99,102,241,0.45); }
  .btn-pri:active:not(:disabled) { transform: scale(0.985); }
  .btn-pri:disabled { opacity: 0.45; cursor: not-allowed; }

  .btn-ghost {
    background: transparent; color: #8a8aaa;
    border: 1px solid rgba(255,255,255,0.1); border-radius: 12px;
    padding: 0.65rem 1.2rem; font-size: 14px; font-weight: 500;
    cursor: pointer; transition: all 0.2s;
  }
  .btn-ghost:hover { background: rgba(255,255,255,0.06); color: #e0e0f0; border-color: rgba(255,255,255,0.18); }

  .btn-del {
    background: rgba(239,68,68,0.12); color: #f87171;
    border: 1px solid rgba(239,68,68,0.25); border-radius: 10px;
    padding: 0.45rem 0.85rem; font-size: 13px; font-weight: 500;
    cursor: pointer; transition: all 0.2s;
  }
  .btn-del:hover { background: rgba(239,68,68,0.22); }

  .inp {
    width: 100%; background: rgba(255,255,255,0.045);
    border: 1px solid rgba(255,255,255,0.09); border-radius: 13px;
    padding: 0.875rem 1.1rem; font-size: 15px; color: #e8e8f0;
    transition: border 0.2s, background 0.2s;
  }
  .inp:focus { border-color: rgba(99,102,241,0.55); background: rgba(99,102,241,0.05); }
  .inp::placeholder { color: #3e3e5a; }

  .c-card {
    border-radius: 18px; padding: 1.1rem 1.2rem; cursor: pointer;
    transition: all 0.22s; border: 2px solid rgba(255,255,255,0.06);
    background: rgba(255,255,255,0.025); display: flex; align-items: center; gap: 14px;
  }
  .c-card:hover { transform: translateY(-2px); border-color: rgba(255,255,255,0.13); background: rgba(255,255,255,0.045); }
  .c-card.sel-b { border-color: #6366f1; background: rgba(99,102,241,0.09); box-shadow: 0 0 0 1px rgba(99,102,241,0.25), 0 6px 28px rgba(99,102,241,0.18); }
  .c-card.sel-g { border-color: #ec4899; background: rgba(236,72,153,0.09); box-shadow: 0 0 0 1px rgba(236,72,153,0.25), 0 6px 28px rgba(236,72,153,0.18); }

  .otp-in {
    width: 52px; height: 62px; text-align: center; font-size: 24px; font-weight: 700;
    background: rgba(255,255,255,0.05); border: 2px solid rgba(255,255,255,0.1);
    border-radius: 14px; color: #e8e8f0; font-family: 'JetBrains Mono', monospace;
    transition: all 0.2s;
  }
  .otp-in:focus { border-color: #6366f1; background: rgba(99,102,241,0.09); box-shadow: 0 0 0 3px rgba(99,102,241,0.18); }

  .tab-btn {
    padding: 0.55rem 1.05rem; border-radius: 10px; border: none;
    font-size: 14px; font-weight: 500; transition: all 0.2s;
    background: transparent; color: #5a5a7a; cursor: pointer;
  }
  .tab-btn.on { background: rgba(99,102,241,0.18); color: #a5b4fc; }
  .tab-btn:hover:not(.on) { background: rgba(255,255,255,0.05); color: #b0b0d0; }

  .bar-track { background: rgba(255,255,255,0.07); border-radius: 999px; overflow: hidden; height: 9px; }
  .bar-fill { height: 100%; border-radius: 999px; transition: width 0.9s cubic-bezier(0.16,1,0.3,1); }

  .toast {
    position: fixed; bottom: 24px; right: 24px; z-index: 9999;
    padding: 0.9rem 1.4rem; border-radius: 16px; font-size: 14px; font-weight: 500;
    animation: fadeUp 0.3s ease; max-width: 300px; backdrop-filter: blur(12px);
  }
  .t-ok  { background: rgba(16,185,129,0.14); border: 1px solid rgba(16,185,129,0.28); color: #6ee7b7; }
  .t-err { background: rgba(239,68,68,0.14); border: 1px solid rgba(239,68,68,0.28); color: #fca5a5; }
  .t-inf { background: rgba(99,102,241,0.14); border: 1px solid rgba(99,102,241,0.28); color: #a5b4fc; }

  .divider { height: 1px; background: linear-gradient(90deg, transparent, rgba(255,255,255,0.07), transparent); margin: 2rem 0; }

  .upload-area {
    border: 2px dashed rgba(255,255,255,0.1); border-radius: 14px;
    padding: 1.75rem; text-align: center; cursor: pointer; transition: all 0.2s;
  }
  .upload-area:hover { border-color: rgba(99,102,241,0.4); background: rgba(99,102,241,0.04); }

  .err-box { color: #f87171; font-size: 13px; padding: 0.7rem 1rem; background: rgba(239,68,68,0.08); border-radius: 10px; border: 1px solid rgba(239,68,68,0.18); }
  .timer-d { background: rgba(255,255,255,0.045); border: 1px solid rgba(255,255,255,0.08); border-radius: 13px; padding: 0.7rem 0.55rem; min-width: 62px; text-align: center; }
`;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function useCountdown(deadlineDate) {
  const calc = () => {
    if (!deadlineDate) return null;
    const d = deadlineDate - Date.now();
    if (d <= 0) return null;
    return { days: Math.floor(d/86400000), hours: Math.floor((d%86400000)/3600000), minutes: Math.floor((d%3600000)/60000), seconds: Math.floor((d%60000)/1000) };
  };
  const [t, setT] = useState(calc);
  useEffect(() => { const i = setInterval(() => setT(calc()), 1000); return () => clearInterval(i); }, [deadlineDate]);
  return t;
}

function genOTP() { return Math.floor(100000 + Math.random() * 900000).toString(); }

function Toast({ msg, type, onDone }) {
  useEffect(() => { const t = setTimeout(onDone, 3500); return () => clearTimeout(t); }, []);
  const cls = type === "success" ? "t-ok" : type === "error" ? "t-err" : "t-inf";
  return <div className={`toast ${cls}`}>{msg}</div>;
}

function Spinner() {
  return <div style={{ display:"flex", justifyContent:"center", padding:"3rem" }}><div style={{ width:34, height:34, border:"3px solid rgba(99,102,241,0.2)", borderTopColor:"#6366f1", borderRadius:"50%" }} className="spin" /></div>;
}

function TimerBox({ v, label }) {
  return (
    <div className="timer-d">
      <div style={{ fontSize:26, fontWeight:700, lineHeight:1, fontVariantNumeric:"tabular-nums" }}>{String(v).padStart(2,"0")}</div>
      <div style={{ fontSize:10, color:"#5a5a7a", marginTop:5, letterSpacing:"0.08em", textTransform:"uppercase" }}>{label}</div>
    </div>
  );
}

function Countdown({ deadlineDate }) {
  const t = useCountdown(deadlineDate);
  if (!t) return (
    <div style={{ display:"inline-flex", alignItems:"center", gap:8, padding:"0.65rem 1.1rem", borderRadius:12, background:"rgba(239,68,68,0.1)", border:"1px solid rgba(239,68,68,0.2)", color:"#f87171", fontSize:13, fontWeight:500 }}>
      ⏰ Voting closed
    </div>
  );
  return (
    <div>
      <div style={{ fontSize:11, color:"#5a5a7a", marginBottom:9, letterSpacing:"0.08em", textTransform:"uppercase", fontWeight:600 }}>Closes in</div>
      <div style={{ display:"flex", gap:7 }}>
        <TimerBox v={t.days} label="Days" />
        <TimerBox v={t.hours} label="Hrs" />
        <TimerBox v={t.minutes} label="Min" />
        <TimerBox v={t.seconds} label="Sec" />
      </div>
    </div>
  );
}

// ─── Login ────────────────────────────────────────────────────────────────────

function Login({ onLogin }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [otp, setOtp] = useState(["","","","","",""]);
  const [step, setStep] = useState("email");
  const [realOTP, setRealOTP] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const refs = useRef([]);

  const submitEmail = async () => {
    setErr("");
    const e = email.trim().toLowerCase();
    if (!e) return setErr("Please enter your email.");
    if (e === ADMIN_EMAIL.toLowerCase()) {
      setStep("password");
      return;
    }
    if (!e.endsWith(COMPANY_DOMAIN.toLowerCase())) return setErr(`Only ${COMPANY_DOMAIN} emails are allowed.`);
    setLoading(true);
    try {
      const { data } = await supabase.from("votes").select("voter_email").eq("voter_email", e).maybeSingle();
      if (data) { onLogin(e, true); return; }
      const code = genOTP();
      setRealOTP(code);
      
      const res = await fetch("/api/send-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: e, otp: code })
      });
      if (!res.ok) throw new Error("Failed to send email");

      setStep("otp");
    } catch { setErr("Connection error or failed to send email. Please try again."); }
    setLoading(false);
  };

  const submitPassword = () => {
    if (password === "12345") {
      onLogin(email.trim().toLowerCase(), false);
    } else {
      setErr("Incorrect password.");
    }
  };

  const changeOtp = (i, v) => {
    if (!/^\d?$/.test(v)) return;
    const n = [...otp]; n[i] = v; setOtp(n);
    if (v && i < 5) refs.current[i+1]?.focus();
  };

  const keyOtp = (i, e) => { if (e.key === "Backspace" && !otp[i] && i > 0) refs.current[i-1]?.focus(); };

  const pasteOtp = (e) => {
    const p = e.clipboardData.getData("text").replace(/\D/g,"").slice(0,6);
    if (p.length === 6) { setOtp(p.split("")); refs.current[5]?.focus(); }
  };

  const submitOtp = () => {
    const entered = otp.join("");
    if (entered.length < 6) return setErr("Enter all 6 digits.");
    if (entered !== realOTP) return setErr("Incorrect code. Try again.");
    onLogin(email.trim().toLowerCase(), false);
  };

  return (
    <div style={{ minHeight:"100vh", display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", padding:"1.5rem", position:"relative", overflow:"hidden" }}>
      <div style={{ position:"absolute", top:"-20%", right:"-10%", width:550, height:550, borderRadius:"50%", background:"radial-gradient(circle, rgba(99,102,241,0.1) 0%, transparent 65%)", pointerEvents:"none" }} />
      <div style={{ position:"absolute", bottom:"-15%", left:"-8%", width:450, height:450, borderRadius:"50%", background:"radial-gradient(circle, rgba(236,72,153,0.07) 0%, transparent 65%)", pointerEvents:"none" }} />

      <div style={{ width:"100%", maxWidth:420 }}>
        <div className="fu" style={{ textAlign:"center", marginBottom:"2.5rem" }}>
          <div style={{ display:"inline-flex", alignItems:"center", justifyContent:"center", width:68, height:68, borderRadius:20, background:"linear-gradient(135deg, #6366f1, #8b5cf6)", marginBottom:18, boxShadow:"0 10px 36px rgba(99,102,241,0.45)" }} className="float">
            <span style={{ fontSize:30 }}>🗳️</span>
          </div>
          <h1 style={{ fontSize:28, fontWeight:700, marginBottom:8 }}>{APP_TITLE}</h1>
          <p style={{ color:"#5a5a7a", fontSize:15 }}>Sign in with your company email</p>
        </div>

        <div className="glass-md fu1" style={{ borderRadius:24, padding:"2rem" }}>
          {step === "email" ? (
            <>
              <label style={{ display:"block", fontSize:12, fontWeight:600, color:"#7a7a9a", marginBottom:8, letterSpacing:"0.06em", textTransform:"uppercase" }}>Company Email</label>
              <input
                className="inp"
                type="email"
                placeholder={`you${COMPANY_DOMAIN}`}
                value={email}
                onChange={e => { setEmail(e.target.value); setErr(""); }}
                onKeyDown={e => e.key === "Enter" && submitEmail()}
                style={{ marginBottom: err ? 12 : 20 }}
              />
              {err && <div className="err-box" style={{ marginBottom:16 }}>{err}</div>}
              <button className="btn-pri" style={{ width:"100%" }} onClick={submitEmail} disabled={loading}>
                {loading
                  ? <span className="spin" style={{ display:"inline-block", width:18, height:18, border:"2px solid rgba(255,255,255,0.3)", borderTopColor:"#fff", borderRadius:"50%", verticalAlign:"middle" }} />
                  : "Continue →"}
              </button>
            </>
          ) : step === "password" ? (
            <>
              <button onClick={() => { setStep("email"); setErr(""); setPassword(""); }} style={{ background:"none", border:"none", color:"#5a5a7a", fontSize:13, marginBottom:20, cursor:"pointer" }}>← Back</button>
              <div style={{ textAlign:"center", marginBottom:24 }}>
                <p style={{ color:"#b0b0d0", fontSize:14, marginBottom:6 }}>Admin Login</p>
                <p style={{ color:"#a5b4fc", fontWeight:600, marginBottom:14 }}>{email}</p>
              </div>
              <input
                className="inp"
                type="password"
                placeholder="Enter password"
                value={password}
                onChange={e => { setPassword(e.target.value); setErr(""); }}
                onKeyDown={e => e.key === "Enter" && submitPassword()}
                style={{ marginBottom: err ? 12 : 20 }}
              />
              {err && <div className="err-box" style={{ marginBottom:16, textAlign:"center" }}>{err}</div>}
              <button className="btn-pri" style={{ width:"100%" }} onClick={submitPassword}>Login as Admin →</button>
            </>
          ) : (
            <>
              <button onClick={() => { setStep("email"); setErr(""); }} style={{ background:"none", border:"none", color:"#5a5a7a", fontSize:13, marginBottom:20, cursor:"pointer" }}>← Back</button>
              <div style={{ textAlign:"center", marginBottom:24 }}>
                <p style={{ color:"#b0b0d0", fontSize:14, marginBottom:6 }}>Enter the 6-digit code sent to</p>
                <p style={{ color:"#a5b4fc", fontWeight:600, marginBottom:14 }}>{email}</p>
              </div>
              <div style={{ display:"flex", gap:8, justifyContent:"center", marginBottom:20 }} onPaste={pasteOtp}>
                {otp.map((d, i) => (
                  <input key={i} ref={el => refs.current[i] = el} className="otp-in" maxLength={1} value={d}
                    onChange={e => changeOtp(i, e.target.value)} onKeyDown={e => keyOtp(i, e)} inputMode="numeric" />
                ))}
              </div>
              {err && <div className="err-box" style={{ marginBottom:16, textAlign:"center" }}>{err}</div>}
              <button className="btn-pri" style={{ width:"100%" }} onClick={submitOtp}>Verify & Enter →</button>
            </>
          )}
        </div>

        <p className="fu2" style={{ textAlign:"center", marginTop:18, fontSize:12, color:"#3e3e5a" }}>
          Voting App 2026
        </p>
      </div>
    </div>
  );
}

// ─── Candidate Card ────────────────────────────────────────────────────────────

function CCard({ c, selected, onSelect, cat }) {
  const color = cat === "boys" ? "#6366f1" : "#ec4899";
  return (
    <div 
      className={`poster-card ${selected ? (cat==="boys"?"sel-b":"sel-g") : ""}`} 
      onClick={onSelect}
      style={{
        position: "relative",
        borderRadius: 24,
        overflow: "hidden",
        background: "#121225",
        border: `2px solid ${selected ? color : "rgba(255,255,255,0.05)"}`,
        transition: "all 0.4s cubic-bezier(0.4, 0, 0.2, 1)",
        cursor: "pointer",
        display: "flex",
        flexDirection: "column",
        aspectRatio: "4/5",
        boxShadow: selected ? `0 20px 40px ${color}33` : "0 10px 30px rgba(0,0,0,0.3)"
      }}
    >
      {/* Background Poster Effect */}
      <div style={{ position:"absolute", inset:0, opacity:0.1, background: `linear-gradient(45deg, ${color}, transparent)` }} />
      
      {/* Image Area */}
      <div style={{ position:"relative", flex: 1, overflow:"hidden" }}>
        {c.photo_url ? (
          <img src={c.photo_url} alt={c.name} style={{ width:"100%", height:"100%", objectFit:"cover", transition:"transform 0.5s" }} />
        ) : (
          <div style={{ width:"100%", height:"100%", display:"flex", alignItems:"center", justifyContent:"center", background:"#1a1a35" }}>
            <span style={{ fontSize:60 }}>👤</span>
          </div>
        )}
        
        {/* Selection Checkmark */}
        <div style={{ 
          position: "absolute", top: 16, right: 16, 
          width: 32, height: 32, borderRadius: "50%", 
          background: selected ? color : "rgba(0,0,0,0.4)",
          backdropFilter: "blur(8px)",
          border: "2px solid rgba(255,255,255,0.2)",
          display: "flex", alignItems: "center", justifyContent: "center",
          zIndex: 10
        }}>
          {selected && <span style={{ color:"#fff", fontSize:18, fontWeight:900 }}>✓</span>}
        </div>
      </div>

      {/* Info Area */}
      <div style={{ 
        padding: "1.5rem", 
        background: "linear-gradient(to top, #0a0a1a 80%, transparent)",
        position: "relative",
        textAlign: "center"
      }}>
        <div style={{ fontSize:10, fontWeight:800, color: color, letterSpacing:"0.2em", marginBottom:6, textTransform:"uppercase" }}>
          VOTE FOR
        </div>
        <div style={{ 
          fontWeight: 800, 
          fontSize: 22, 
          color: "#fff", 
          marginBottom: 4,
          lineHeight: 1.1,
          textTransform: "uppercase"
        }}>
          {c.name}
        </div>
        <div style={{ 
          fontSize: 12, 
          color: "rgba(255,255,255,0.5)", 
          fontWeight: 500,
          fontStyle: "italic"
        }}>
          {c.bio || (cat === "boys" ? "Candidate for Boys" : "Candidate for Girls")}
        </div>
      </div>
    </div>
  );
}

// ─── Vote Screen ──────────────────────────────────────────────────────────────

function VoteScreen({ email, candidates, onVoted, onLogout }) {
  const [bVote, setBVote] = useState(null);
  const [gVote, setGVote] = useState(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const deadline = useCountdown();

  const boys = candidates.filter(c => c.category === "boys");
  const girls = candidates.filter(c => c.category === "girls");

  const submit = async () => {
    if (!bVote && !gVote) return setErr("Please select at least one candidate.");
    setLoading(true); setErr("");
    const { error } = await supabase.from("votes").insert({ voter_email: email, boys_candidate_id: bVote || null, girls_candidate_id: gVote || null });
    if (error) {
      if (error.code === "23505") { onVoted(); return; }
      setErr("Submit failed: " + error.message);
    } else { onVoted(); }
    setLoading(false);
  };

  if (!deadline) {
    return (
      <div style={{ minHeight:"100vh", display:"flex", alignItems:"center", justifyContent:"center", textAlign:"center", padding:"2rem" }}>
        <div>
          <div style={{ fontSize:56, marginBottom:20 }}>🏁</div>
          <h2 style={{ fontSize:24, fontWeight:700, marginBottom:10 }}>Voting has closed</h2>
          <p style={{ color:"#5a5a7a", marginBottom:24 }}>The deadline has passed. See the results below.</p>
          <button className="btn-pri" onClick={onLogout}>Logout</button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ maxWidth:800, margin:"0 auto", padding:"2rem 1.25rem" }}>
      <div className="fu" style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:"2.5rem", flexWrap:"wrap", gap:16 }}>
        <div>
          <h1 style={{ fontSize:26, fontWeight:700, marginBottom:6 }}>Cast Your Vote</h1>
          <div style={{ fontSize:13, color:"#5a5a7a" }}>As <span style={{ color:"#a5b4fc" }}>{email}</span></div>
        </div>
        <div style={{ display:"flex", alignItems:"flex-start", gap:14, flexWrap:"wrap" }}>
          <Countdown deadlineDate={deadlineDate} />
          <button className="btn-ghost" onClick={onLogout} style={{ marginTop:4 }}>↩ Logout</button>
        </div>
      </div>

      {/* Boys */}
      <div className="fu1" style={{ marginBottom:"2rem" }}>
        <div style={{ display:"flex", alignItems:"center", gap:9, marginBottom:14 }}>
          <div style={{ width:9, height:9, borderRadius:"50%", background:"#6366f1" }} />
          <h2 style={{ fontSize:17, fontWeight:600 }}>Boys Category</h2>
          <span style={{ fontSize:11, color:"#6366f1", background:"rgba(99,102,241,0.12)", padding:"3px 10px", borderRadius:999, border:"1px solid rgba(99,102,241,0.2)" }}>Pick one</span>
        </div>
        {boys.length === 0
          ? <div style={{ padding:"1.25rem", textAlign:"center", color:"#3e3e5a", fontSize:13, borderRadius:14, border:"1px dashed rgba(255,255,255,0.07)" }}>No candidates yet</div>
          : <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill, minmax(180px, 1fr))", gap:16 }}>{boys.map(c => <CCard key={c.id} c={c} selected={bVote===c.id} onSelect={() => setBVote(bVote===c.id?null:c.id)} cat="boys" />)}</div>
        }
      </div>

      <div className="divider" />

      {/* Girls */}
      <div className="fu2" style={{ marginBottom:"2rem" }}>
        <div style={{ display:"flex", alignItems:"center", gap:9, marginBottom:14 }}>
          <div style={{ width:9, height:9, borderRadius:"50%", background:"#ec4899" }} />
          <h2 style={{ fontSize:17, fontWeight:600 }}>Girls Category</h2>
          <span style={{ fontSize:11, color:"#ec4899", background:"rgba(236,72,153,0.12)", padding:"3px 10px", borderRadius:999, border:"1px solid rgba(236,72,153,0.2)" }}>Pick one</span>
        </div>
        {girls.length === 0
          ? <div style={{ padding:"1.25rem", textAlign:"center", color:"#3e3e5a", fontSize:13, borderRadius:14, border:"1px dashed rgba(255,255,255,0.07)" }}>No candidates yet</div>
          : <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill, minmax(180px, 1fr))", gap:16 }}>{girls.map(c => <CCard key={c.id} c={c} selected={gVote===c.id} onSelect={() => setGVote(gVote===c.id?null:c.id)} cat="girls" />)}</div>
        }
      </div>

      {err && <div className="err-box" style={{ marginBottom:16 }}>{err}</div>}
      <button className="btn-pri fu3" style={{ width:"100%", fontSize:16, padding:"1rem" }} onClick={submit} disabled={loading}>
        {loading ? "Submitting…" : "Submit Vote ✓"}
      </button>
      <p style={{ textAlign:"center", fontSize:12, color:"#3e3e5a", marginTop:10 }}>You can only vote once. This cannot be undone.</p>
    </div>
  );
}

// ─── Thank You ────────────────────────────────────────────────────────────────

function ThankYou({ onResults, onLogout }) {
  return (
    <div style={{ minHeight:"100vh", display:"flex", alignItems:"center", justifyContent:"center", padding:"2rem" }}>
      <div style={{ textAlign:"center", maxWidth:400 }}>
        <div style={{ fontSize:72, marginBottom:24 }} className="float">🎉</div>
        <h1 style={{ fontSize:30, fontWeight:700, marginBottom:12 }}>Vote Submitted!</h1>
        <p style={{ color:"#5a5a7a", fontSize:15, lineHeight:1.7, marginBottom:32 }}>
          Your vote is securely saved. Results will show after the deadline on {VOTING_DEADLINE.toLocaleDateString("en-IN", { day:"numeric", month:"long" })}.
        </p>
        <div style={{ display:"flex", gap:12, justifyContent:"center" }}>
          <button className="btn-pri" onClick={onResults}>View Results</button>
          <button className="btn-ghost" onClick={onLogout}>Logout</button>
        </div>
      </div>
    </div>
  );
}

// ─── Results ──────────────────────────────────────────────────────────────────

function Results({ candidates, votes, onLogout, deadlineDate }) {
  const total = votes.length;
  const closed = !useCountdown(deadlineDate);

  const getCount = (id) => votes.filter(v => v.boys_candidate_id === id || v.girls_candidate_id === id).length;

  const renderCat = (cat) => {
    const color = cat === "boys" ? "#6366f1" : "#ec4899";
    const gradient = cat === "boys" ? "linear-gradient(90deg,#6366f1,#8b5cf6)" : "linear-gradient(90deg,#ec4899,#f97316)";
    const list = candidates.filter(c => c.category === cat).map(c => ({ ...c, count: getCount(c.id) })).sort((a,b) => b.count-a.count);
    const max = Math.max(...list.map(c => c.count), 1);

    return (
      <div style={{ marginBottom:"2.5rem" }}>
        <div style={{ display:"flex", alignItems:"center", gap:9, marginBottom:18 }}>
          <div style={{ width:9, height:9, borderRadius:"50%", background:color }} />
          <h2 style={{ fontSize:18, fontWeight:600 }}>{cat === "boys" ? "Boys" : "Girls"} Category</h2>
        </div>
        <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
          {list.map((c, i) => (
            <div key={c.id} className={`glass ${i===0&&c.count>0?"glow-anim":""}`} style={{ borderRadius:18, padding:"1.2rem 1.35rem", position:"relative" }}>
              {i===0&&c.count>0&&(
                <div style={{ position:"absolute", top:-11, right:14, fontSize:11, fontWeight:700, padding:"3px 11px", borderRadius:999, background:gradient, color:"#fff", letterSpacing:"0.04em" }}>
                  🏆 WINNER
                </div>
              )}
              <div style={{ display:"flex", alignItems:"center", gap:12, marginBottom:12 }}>
                <div style={{ width:46, height:46, borderRadius:12, overflow:"hidden", background:"rgba(255,255,255,0.06)", flexShrink:0, display:"flex", alignItems:"center", justifyContent:"center" }}>
                  {c.photo_url ? <img src={c.photo_url} alt={c.name} style={{ width:"100%", height:"100%", objectFit:"cover" }} /> : <span>👤</span>}
                </div>
                <div style={{ flex:1 }}>
                  <div style={{ fontWeight:600, fontSize:15 }}>{c.name}</div>
                  <div style={{ fontSize:12, color:"#5a5a7a" }}>{c.count} vote{c.count!==1?"s":""}</div>
                </div>
                <div style={{ fontSize:22, fontWeight:700, color }}>{total>0?Math.round(c.count/total*100):0}%</div>
              </div>
              <div className="bar-track">
                <div className="bar-fill" style={{ width:`${(c.count/max)*100}%`, background:gradient }} />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div style={{ maxWidth:660, margin:"0 auto", padding:"2rem 1.25rem" }}>
      <div className="fu" style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:"2.5rem", flexWrap:"wrap", gap:12 }}>
        <div>
          <h1 style={{ fontSize:26, fontWeight:700, marginBottom:6 }}>Results</h1>
          <div style={{ fontSize:13, color:"#5a5a7a" }}>{total} total vote{total!==1?"s":""}</div>
        </div>
        <button className="btn-ghost" onClick={onLogout}>↩ Logout</button>
      </div>

      {closed && (
        <div className="fu1" style={{ padding:"0.75rem 1.1rem", borderRadius:12, background:"rgba(16,185,129,0.08)", border:"1px solid rgba(16,185,129,0.2)", color:"#6ee7b7", fontSize:13, marginBottom:24 }}>
          ✅ Voting closed — these are the final results
        </div>
      )}

      {renderCat("boys")}
      <div className="divider" />
      {renderCat("girls")}
    </div>
  );
}

// ─── Admin ────────────────────────────────────────────────────────────────────

function Admin({ candidates, votes, refresh, onLogout, deadlineDate }) {
  const [tab, setTab] = useState("candidates");
  const [toast, setToast] = useState(null);
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ name:"", bio:"", category:"boys", file:null, preview:"" });
  const [busy, setBusy] = useState(false);
  const [showRes, setShowRes] = useState(() => localStorage.getItem("showResults")==="true");
  const [newDeadline, setNewDeadline] = useState("");
  const [isEditingDeadline, setIsEditingDeadline] = useState(false);
  const fileRef = useRef();
  const deadline = useCountdown(deadlineDate);

  useEffect(() => {
    if (deadlineDate) {
      setNewDeadline(new Date(deadlineDate.getTime() - deadlineDate.getTimezoneOffset() * 60000).toISOString().slice(0, 16));
    }
  }, [deadlineDate]);

  const showT = (msg, type="success") => setToast({ msg, type });

  const pickFile = (e) => {
    const f = e.target.files[0]; if (!f) return;
    setForm(p => ({ ...p, file:f, preview:URL.createObjectURL(f) }));
  };

  const addCandidate = async () => {
    if (!form.name.trim()) return showT("Name required","error");
    setBusy(true);
    let photo_url = "";
    if (form.file) {
      const ext = form.file.name.split(".").pop();
      const fname = `${Date.now()}.${ext}`;
      const { error:ue } = await supabase.storage.from("candidate-photos").upload(fname, form.file);
      if (ue) { showT("Photo upload failed","error"); setBusy(false); return; }
      const { data:ud } = supabase.storage.from("candidate-photos").getPublicUrl(fname);
      photo_url = ud.publicUrl;
    }
    const { error } = await supabase.from("candidates").insert({ name:form.name.trim(), bio:form.bio.trim(), category:form.category, photo_url });
    if (error) showT("Failed: "+error.message,"error");
    else { showT("Candidate added!"); setAdding(false); setForm({ name:"", bio:"", category:"boys", file:null, preview:"" }); refresh(); }
    setBusy(false);
  };

  const delCand = async (id) => {
    if (!confirm("Delete this candidate? All votes for them will be removed. Continue?")) return;
    try {
      // Clear references in votes table to avoid foreign key errors
      await supabase.from("votes").update({ boys_candidate_id: null }).eq("boys_candidate_id", id);
      await supabase.from("votes").update({ girls_candidate_id: null }).eq("girls_candidate_id", id);
      
      const { error } = await supabase.from("candidates").delete().eq("id", id);
      if (error) throw error;
      
      showT("Deleted");
      refresh();
    } catch (err) {
      showT("Delete failed: " + err.message, "error");
    }
  };

  const toggleShow = () => {
    const n = !showRes; setShowRes(n);
    localStorage.setItem("showResults", String(n));
    showT(n ? "Results now visible to voters" : "Results hidden");
  };

  const dlCSV = () => {
    const rows = [["Email","Boys","Girls","Time"]];
    votes.forEach(v => {
      rows.push([v.voter_email, candidates.find(c=>c.id===v.boys_candidate_id)?.name||"—", candidates.find(c=>c.id===v.girls_candidate_id)?.name||"—", new Date(v.voted_at).toLocaleString()]);
    });
    const a = document.createElement("a");
    a.href = "data:text/csv;charset=utf-8,"+encodeURIComponent(rows.map(r=>r.join(",")).join("\n"));
    a.download = "votes.csv"; a.click();
    showT("CSV downloaded");
  };

  const resetVotes = async () => {
    if (!confirm("CRITICAL ACTION: This will completely delete ALL votes and reset the count to 0. This cannot be undone. Proceed?")) return;
    try {
      const { error } = await supabase.from("votes").delete().neq("id", "00000000-0000-0000-0000-000000000000"); // Delete all
      if (error) throw error;
      showT("All votes have been reset to 0");
      refresh();
    } catch (err) {
      showT("Reset failed: " + err.message, "error");
    }
  };

  const getCount = (id) => votes.filter(v=>v.boys_candidate_id===id||v.girls_candidate_id===id).length;

  return (
    <div style={{ maxWidth:700, margin:"0 auto", padding:"2rem 1.25rem" }}>
      {toast && <Toast msg={toast.msg} type={toast.type} onDone={()=>setToast(null)} />}

      <div className="fu" style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:"2rem", flexWrap:"wrap", gap:12 }}>
        <div>
          <div style={{ fontSize:11, color:"#6366f1", fontWeight:700, letterSpacing:"0.12em", textTransform:"uppercase", marginBottom:5 }}>Admin Dashboard</div>
          <h1 style={{ fontSize:24, fontWeight:700 }}>Manage Voting</h1>
        </div>
        <button className="btn-ghost" onClick={onLogout}>↩ Logout</button>
      </div>

      {/* Stats */}
      <div className="fu1" style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit, minmax(130px, 1fr))", gap:10, marginBottom:22 }}>
        {[{label:"Total Votes",val:votes.length,icon:"🗳️"},{label:"Candidates",val:candidates.length,icon:"👥"},{label:"Time Left",val:deadline?`${deadline.days}d ${deadline.hours}h`:"Closed",icon:"⏰"}].map(s=>(
          <div key={s.label} className="glass" style={{ borderRadius:15, padding:"1rem 1.15rem" }}>
            <div style={{ fontSize:20, marginBottom:5 }}>{s.icon}</div>
            <div style={{ fontSize:21, fontWeight:700, marginBottom:2 }}>{s.val}</div>
            <div style={{ fontSize:11, color:"#5a5a7a" }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="fu2" style={{ display:"flex", gap:5, marginBottom:22, background:"rgba(255,255,255,0.03)", borderRadius:13, padding:5, width:"fit-content" }}>
        {["candidates","results","settings"].map(t=>(
          <button key={t} className={`tab-btn ${tab===t?"on":""}`} onClick={()=>setTab(t)} style={{ textTransform:"capitalize" }}>{t}</button>
        ))}
      </div>

      {/* Candidates tab */}
      {tab==="candidates"&&(
        <div>
          <div style={{ display:"flex", justifyContent:"flex-end", marginBottom:14 }}>
            <button className="btn-pri" style={{ width:"auto", padding:"0.6rem 1.2rem", fontSize:14 }} onClick={()=>setAdding(!adding)}>
              {adding ? "✕ Cancel" : "+ Add Candidate"}
            </button>
          </div>

          {adding&&(
            <div className="glass-md" style={{ borderRadius:18, padding:"1.4rem", marginBottom:18 }}>
              <h3 style={{ fontWeight:600, marginBottom:14 }}>New Candidate</h3>
              <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
                <input className="inp" placeholder="Full name *" value={form.name} onChange={e=>setForm(p=>({...p,name:e.target.value}))} />
                <input className="inp" placeholder="Short bio (optional)" value={form.bio} onChange={e=>setForm(p=>({...p,bio:e.target.value}))} />
                <select className="inp" value={form.category} onChange={e=>setForm(p=>({...p,category:e.target.value}))}>
                  <option value="boys">Boys Category</option>
                  <option value="girls">Girls Category</option>
                </select>
                <div className="upload-area" onClick={()=>fileRef.current.click()}>
                  {form.preview
                    ? <img src={form.preview} alt="preview" style={{ maxHeight:110, borderRadius:10 }} />
                    : <><div style={{ fontSize:28, marginBottom:6 }}>📷</div><div style={{ color:"#5a5a7a", fontSize:13 }}>Click to upload photo</div></>
                  }
                  <input ref={fileRef} type="file" accept="image/*" style={{ display:"none" }} onChange={pickFile} />
                </div>
                <button className="btn-pri" onClick={addCandidate} disabled={busy} style={{ width:"auto", alignSelf:"flex-end", padding:"0.65rem 1.4rem", fontSize:14 }}>
                  {busy ? "Saving…" : "Save Candidate"}
                </button>
              </div>
            </div>
          )}

          {["boys","girls"].map(cat=>(
            <div key={cat} style={{ marginBottom:22 }}>
              <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:11 }}>
                <div style={{ width:8, height:8, borderRadius:"50%", background: cat==="boys"?"#6366f1":"#ec4899" }} />
                <h3 style={{ fontWeight:600, fontSize:15 }}>{cat === "boys" ? "Boys" : "Girls"} Candidates</h3>
              </div>
              {candidates.filter(c=>c.category===cat).length===0
                ? <div style={{ padding:"1.1rem", textAlign:"center", color:"#3e3e5a", fontSize:13, borderRadius:13, border:"1px dashed rgba(255,255,255,0.06)" }}>No candidates yet</div>
                : candidates.filter(c=>c.category===cat).map(c=>(
                  <div key={c.id} className="glass" style={{ borderRadius:13, padding:"0.9rem 1.1rem", display:"flex", alignItems:"center", gap:12, marginBottom:8 }}>
                    <div style={{ width:42, height:42, borderRadius:10, overflow:"hidden", background:"rgba(255,255,255,0.06)", flexShrink:0, display:"flex", alignItems:"center", justifyContent:"center" }}>
                      {c.photo_url ? <img src={c.photo_url} alt={c.name} style={{ width:"100%", height:"100%", objectFit:"cover" }} /> : <span>👤</span>}
                    </div>
                    <div style={{ flex:1 }}>
                      <div style={{ fontWeight:500, fontSize:14 }}>{c.name}</div>
                      {c.bio&&<div style={{ fontSize:12, color:"#5a5a7a" }}>{c.bio}</div>}
                    </div>
                    <div style={{ fontSize:13, color:"#5a5a7a", marginRight:10 }}>{getCount(c.id)} votes</div>
                    <button className="btn-del" onClick={()=>delCand(c.id)}>Delete</button>
                  </div>
                ))
              }
            </div>
          ))}
        </div>
      )}

      {/* Results tab */}
      {tab==="results"&&(
        <div>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:18, flexWrap:"wrap", gap:10 }}>
            <h3 style={{ fontWeight:600 }}>Live Vote Counts</h3>
            <button className="btn-ghost" style={{ fontSize:13, padding:"0.5rem 0.9rem" }} onClick={dlCSV}>⬇ Download CSV</button>
          </div>
          {["boys","girls"].map(cat=>{
            const gradient = cat==="boys"?"linear-gradient(90deg,#6366f1,#8b5cf6)":"linear-gradient(90deg,#ec4899,#f97316)";
            const list = candidates.filter(c=>c.category===cat).map(c=>({...c,count:getCount(c.id)})).sort((a,b)=>b.count-a.count);
            const max = Math.max(...list.map(c=>c.count),1);
            return (
              <div key={cat} style={{ marginBottom:26 }}>
                <h4 style={{ fontWeight:600, marginBottom:12, fontSize:14, color: cat==="boys"?"#a5b4fc":"#f9a8d4", textTransform:"uppercase", letterSpacing:"0.06em" }}>{cat}</h4>
                {list.map((c,i)=>(
                  <div key={c.id} style={{ marginBottom:12 }}>
                    <div style={{ display:"flex", justifyContent:"space-between", fontSize:13, marginBottom:6 }}>
                      <span style={{ fontWeight: i===0?600:400 }}>{i===0&&c.count>0?"🏆 ":""}{c.name}</span>
                      <span style={{ color:"#5a5a7a" }}>{c.count} ({votes.length>0?Math.round(c.count/votes.length*100):0}%)</span>
                    </div>
                    <div className="bar-track"><div className="bar-fill" style={{ width:`${(c.count/max)*100}%`, background:gradient }} /></div>
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      )}

      {/* Settings tab */}
      {tab==="settings"&&(
        <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
          <div className="glass" style={{ borderRadius:15, padding:"1.1rem 1.25rem", display:"flex", justifyContent:"space-between", alignItems:"center", flexWrap:"wrap", gap:12 }}>
            <div>
              <div style={{ fontWeight:600, marginBottom:3, fontSize:15 }}>Show results to voters</div>
              <div style={{ fontSize:12, color:"#5a5a7a" }}>Allow all logged-in voters to see live results</div>
            </div>
            <div onClick={toggleShow} style={{ width:50, height:27, borderRadius:999, background: showRes?"linear-gradient(135deg,#6366f1,#8b5cf6)":"rgba(255,255,255,0.09)", cursor:"pointer", position:"relative", transition:"background 0.3s", flexShrink:0 }}>
              <div style={{ position:"absolute", top:3, left: showRes?26:3, width:21, height:21, borderRadius:"50%", background:"#fff", transition:"left 0.3s", boxShadow:"0 2px 6px rgba(0,0,0,0.4)" }} />
            </div>
          </div>

          <div className="glass" style={{ borderRadius:15, padding:"1.1rem 1.25rem" }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:12 }}>
              <div style={{ fontWeight:600, fontSize:15 }}>Voting Deadline</div>
              {!isEditingDeadline && (
                <button 
                  className="tab-btn on" 
                  style={{ fontSize:12, padding:"4px 12px" }}
                  onClick={() => setIsEditingDeadline(true)}
                >
                  Edit
                </button>
              )}
            </div>

            {isEditingDeadline ? (
              <div style={{ display:"flex", gap:10, flexWrap:"wrap" }}>
                <input 
                  type="datetime-local" 
                  className="inp" 
                  style={{ width:"auto", flex:1, minWidth:200 }} 
                  value={newDeadline} 
                  onChange={e=>setNewDeadline(e.target.value)} 
                />
                <div style={{ display:"flex", gap:8 }}>
                  <button 
                    className="btn-pri" 
                    style={{ width:"auto", padding:"0 1.2rem", fontSize:13 }}
                    onClick={async () => {
                      setBusy(true);
                      const { error } = await supabase.from("settings").upsert({ key:"voting_deadline", value:new Date(newDeadline).toISOString() });
                      if (error) showT("Failed: "+error.message, "error");
                      else { showT("Deadline updated!"); refresh(); setIsEditingDeadline(false); }
                      setBusy(false);
                    }}
                    disabled={busy}
                  >
                    {busy ? "..." : "Save"}
                  </button>
                  <button 
                    className="btn-ghost" 
                    style={{ padding:"0 1rem", fontSize:13 }}
                    onClick={() => setIsEditingDeadline(false)}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <div style={{ color:"#a5b4fc", fontFamily:"'JetBrains Mono', monospace", fontSize:15, background:"rgba(255,255,255,0.03)", padding:"10px 14px", borderRadius:10, border:"1px solid rgba(255,255,255,0.05)" }}>
                {deadlineDate ? deadlineDate.toLocaleString("en-IN", { day:"numeric", month:"long", year:"numeric", hour:"2-digit", minute:"2-digit" }) : "Not set"}
              </div>
            )}
          </div>

          <button className="btn-ghost" style={{ width:"fit-content", fontSize:14 }} onClick={()=>showT("📧 Results email simulated!","info")}>
            📤 Simulate Send Results Email
          </button>
          
          <div style={{ marginTop:20, paddingTop:20, borderTop:"1px solid rgba(255,255,255,0.06)" }}>
            <button 
              className="btn-del" 
              style={{ width:"100%", padding:"1rem", fontSize:15, fontWeight:600 }} 
              onClick={resetVotes}
            >
              ⚠️ Reset All Votes to 0
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── App Root ─────────────────────────────────────────────────────────────────

export default function App() {
  const [session, setSession] = useState(() => {
    try { return JSON.parse(localStorage.getItem("vs26")) || null; } catch { return null; }
  });
  const [screen, setScreen] = useState("vote");
  const [deadlineDate, setDeadlineDate] = useState(null);
  const [candidates, setCandidates] = useState([]);
  const [votes, setVotes] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!document.getElementById("va-css")) {
      const s = document.createElement("style"); s.id = "va-css"; s.textContent = GLOBAL_CSS;
      document.head.appendChild(s);
    }
  }, []);

  const fetchAll = useCallback(async () => {
    const [c, v, s] = await Promise.all([
      supabase.from("candidates").select("*").order("created_at"),
      supabase.from("votes").select("*"),
      supabase.from("settings").select("*").eq("key", "voting_deadline").maybeSingle(),
    ]);
    setCandidates(c.data || []);
    setVotes(v.data || []);
    if (s.data) setDeadlineDate(new Date(s.data.value));
    else setDeadlineDate(new Date(import.meta.env.VITE_VOTING_DEADLINE));
  }, []);

  useEffect(() => { fetchAll().finally(() => setLoading(false)); }, []);

  useEffect(() => {
    if (!session || !deadlineDate) return;
    const closed = Date.now() > deadlineDate;
    const showRes = localStorage.getItem("showResults") === "true";
    if (session.hasVoted || closed || showRes) setScreen("results");
    else setScreen("vote");
  }, [session, deadlineDate]);

  const doLogin = (email, hasVoted) => {
    const s = { email, hasVoted };
    setSession(s); localStorage.setItem("vs26", JSON.stringify(s));
    const closed = deadlineDate && Date.now() > deadlineDate;
    const showRes = localStorage.getItem("showResults") === "true";
    if (hasVoted || closed || showRes) setScreen("results");
    else setScreen("vote");
  };

  const doLogout = () => {
    setSession(null); localStorage.removeItem("vs26"); setScreen("vote");
  };

  const doVoted = () => {
    const s = { ...session, hasVoted:true };
    setSession(s); localStorage.setItem("vs26", JSON.stringify(s));
    fetchAll(); setScreen("thankyou");
  };

  // Background orbs
  const orbs = (
    <div style={{ position:"fixed", inset:0, pointerEvents:"none", zIndex:0, overflow:"hidden" }}>
      <div style={{ position:"absolute", top:"-18%", right:"-8%", width:560, height:560, borderRadius:"50%", background:"radial-gradient(circle, rgba(99,102,241,0.07) 0%, transparent 65%)" }} />
      <div style={{ position:"absolute", bottom:"-12%", left:"-6%", width:480, height:480, borderRadius:"50%", background:"radial-gradient(circle, rgba(236,72,153,0.05) 0%, transparent 65%)" }} />
    </div>
  );

  if (!session) return <div style={{ background:"#07080f", minHeight:"100vh" }}>{orbs}<Login onLogin={doLogin} /></div>;
  if (loading) return <div style={{ background:"#07080f", minHeight:"100vh", display:"flex", alignItems:"center", justifyContent:"center" }}><Spinner /></div>;

  const isAdmin = session.email === ADMIN_EMAIL.toLowerCase();

  return (
    <div style={{ background:"#07080f", minHeight:"100vh" }}>
      {orbs}
      <div style={{ position:"relative", zIndex:1 }}>
        {isAdmin
          ? <Admin candidates={candidates} votes={votes} refresh={fetchAll} onLogout={doLogout} deadlineDate={deadlineDate} />
          : screen==="thankyou"
            ? <ThankYou onResults={()=>setScreen("results")} onLogout={doLogout} />
            : screen==="results"
              ? <Results candidates={candidates} votes={votes} onLogout={doLogout} deadlineDate={deadlineDate} />
              : <VoteScreen email={session.email} candidates={candidates} onVoted={doVoted} onLogout={doLogout} deadlineDate={deadlineDate} />
        }
      </div>
    </div>
  );
}
