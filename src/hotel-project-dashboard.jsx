import { useState, useMemo, useEffect, useCallback, useRef } from "react";
import { createClient } from "@supabase/supabase-js";

// ─── Supabase ─────────────────────────────────────────────────
const sb = createClient(
  "https://yqoingcpcryrcpnhkjzu.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inlxb2luZ2NwY3J5cmNwbmhranp1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzcyNTg5NTMsImV4cCI6MjA5MjgzNDk1M30.mDbv7McB9urXXYoqm795dnNj2SHUDal_L0Y1_klFy4Y"
);

// ─── Constants ────────────────────────────────────────────────
const PRODUCTS     = ["AVA", "AVT", "ACA", "TMSP", "GW", "KMS"];
const INTEGRATIONS = ["PBX", "PMS", "TMS", "RCU", "POS", "IPTV"];
const COUNTRIES    = ["台灣", "日本", "新加坡", "印尼", "馬來西亞", "澳洲", "美國", "其他"];
const PRODUCT_COLORS = { AVA:"#1e6fb5", AVT:"#0891b2", ACA:"#0e7a5a", TMSP:"#7c3aed", GW:"#b45309", KMS:"#be185d" };

const BASIC_ITEMS  = ["房型及機台擺放位置圖片","需申請後台權限的 email 帳號","樓層房號表及 WiFi 資訊","機台重啟（Check out）方式","是否需開啟打掃 & 勿擾功能","通話快捷鍵設定 & 分機提供","歡迎畫面背景","歡迎詞填寫","後台服務功能設定 & 送物 / 修繕項目清單","TMS Pro 設定"];
const FAQ_TV_ITEM  = "電視頻道設定（若串接項目不含 IPTV 則不用填寫）";
const FAQ_ITEMS    = ["飯店基本資訊","飯店內設施","飯店提供之服務","入住規則","備品清單",FAQ_TV_ITEM,"特別推薦美食景點"];
const ACA_ITEM     = "轉接情境與歡迎詞設定";
const ACA_LINK_KEY = "acaScenario";
const BATCH2_ITEMS     = ["機台 Showcase 設定","廣告設定","Pop-up QR code 內容設定"];
const BATCH2_LINK_KEYS = ["showcase","ad","popupQR"];
const GW_ITEM     = "GuestWeb 內容建置";
const GW_LINK_KEY = "guestWeb";

// Calendar event type colours
const CAL_COLORS = {
  launch:    { bg:"#dbeafe", text:"#1e40af", border:"#93c5fd" },
  batch1:    { bg:"#dcfce7", text:"#166534", border:"#86efac" },
  batch2:    { bg:"#f3e8ff", text:"#6b21a8", border:"#d8b4fe" },
  taskDL:    { bg:"#fef3c7", text:"#92400e", border:"#fcd34d" },
  taskPeriod:{ bg:"#ffe4e6", text:"#9f1239", border:"#fca5a5" },
};

// ─── Theme ────────────────────────────────────────────────────
const C = {
  bg:"#f4f6f9", white:"#ffffff", border:"#e2e8f0", borderMid:"#cbd5e1",
  text:"#1e293b", textMid:"#475569", textLight:"#94a3b8",
  blue:"#1d4ed8", blueLight:"#eff6ff", blueBorder:"#bfdbfe",
  green:"#059669", greenLight:"#ecfdf5",
  amber:"#d97706", amberLight:"#fffbeb",
  purple:"#7c3aed", purpleLight:"#f5f3ff",
  red:"#dc2626",
};

const baseInput = {
  width:"100%", background:C.white, border:`1.5px solid ${C.border}`,
  borderRadius:10, color:C.text, padding:"10px 14px", fontSize:14,
  outline:"none", fontFamily:"inherit", boxSizing:"border-box", transition:"border-color 0.2s",
};

const GLOBAL_CSS = `
  @import url('https://fonts.googleapis.com/css2?family=DM+Mono:wght@400;500&family=Noto+Sans+TC:wght@400;500;700&display=swap');
  *, *::before, *::after { box-sizing: border-box; }
  body { margin: 0; }
  ::-webkit-scrollbar { width: 6px; }
  ::-webkit-scrollbar-track { background: #f1f5f9; }
  ::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 3px; }
  input[type="date"]::-webkit-calendar-picker-indicator { cursor: pointer; }
  @keyframes fadeUp { from { opacity:0; transform:translateY(12px); } to { opacity:1; transform:none; } }
  @keyframes fadeIn { from { opacity:0; transform:translateY(8px);  } to { opacity:1; transform:none; } }
  @keyframes spin   { to { transform: rotate(360deg); } }
`;

// ─── Helpers ──────────────────────────────────────────────────
const daysUntil = (d) => d ? Math.ceil((new Date(d) - new Date()) / 86400000) : null;
const fmtDate   = (d) => d ? new Date(d).toLocaleDateString("zh-TW") : "—";

const getFlags = (products, integrations) => ({
  hasAva:  products.includes("AVA"),
  hasAca:  products.includes("ACA"),
  hasGw:   products.includes("GW"),
  hasIptv: integrations.includes("IPTV"),
});

const calcTotal = (products, integrations) => {
  const { hasAva, hasAca, hasGw, hasIptv } = getFlags(products, integrations);
  return (hasAva ? BASIC_ITEMS.length : 0) + (hasAca ? 1 : 0)
    + (hasAva ? (hasIptv ? FAQ_ITEMS.length : FAQ_ITEMS.length - 1) : 0)
    + (hasAva ? BATCH2_ITEMS.length : 0) + (hasGw ? 1 : 0);
};

const calcPct = (proj) => {
  const { products, integrations } = proj.info;
  const { hasAva, hasAca, hasGw, hasIptv } = getFlags(products, integrations);
  if (!hasAva && !hasAca && !hasGw) return 0;
  const total = calcTotal(products, integrations);
  if (!total) return 0;
  const done =
    (hasAva ? Object.values(proj.basicChecked).filter(Boolean).length : 0)
    + (hasAca && proj.basicChecked[ACA_ITEM] ? 1 : 0)
    + (hasAva ? Object.entries(proj.faqChecked).filter(([k,v]) => v && (k !== FAQ_TV_ITEM || hasIptv)).length : 0)
    + (hasAva ? BATCH2_ITEMS.filter(i => proj.batch2Checked[i]).length : 0)
    + (hasGw  && proj.batch2Checked[GW_ITEM] ? 1 : 0);
  return Math.round((done / total) * 100);
};

const newTask = () => ({
  id: crypto.randomUUID(), project_id: null,
  name:"", description:"", type:"deadline",
  deadline:"", period_start:"", period_end:"", url:"",
});

// ─── DB ↔ UI ──────────────────────────────────────────────────
const dbToUi = (row, prog) => ({
  id: row.id,
  updatedAt: prog?.updated_at ?? row.updated_at ?? null,
  info: {
    name: row.name ?? "", hotelId: row.hotel_id ?? "",
    address: row.address ?? "", region: row.region ?? "", regionOther: row.region_other ?? "",
    products: row.products ?? [], avaUnits: row.ava_units ?? "", avaSpare: row.ava_spare ?? "",
    integrations: row.integrations ?? [], integrationNotes: row.integration_notes ?? {},
    launchDate: row.launch_date ?? "", batch1Deadline: row.batch1_deadline ?? "",
    batch2Deadline: row.batch2_deadline ?? "", notes: row.notes ?? "",
    pic: row.pic ?? "", jiraEpic: row.jira_epic ?? "",
  },
  basicChecked: prog?.basic_checked ?? {}, basicNotes: prog?.basic_notes ?? {},
  faqChecked:   prog?.faq_checked   ?? {}, faqNotes:   prog?.faq_notes   ?? {},
  batch2Checked: prog?.batch2_checked ?? {}, batch2Notes: prog?.batch2_notes ?? {},
  sheetLinks: {
    basic: prog?.sheet_links?.basic ?? "", faq: prog?.sheet_links?.faq ?? "",
    showcase: prog?.sheet_links?.showcase ?? "", ad: prog?.sheet_links?.ad ?? "",
    popupQR: prog?.sheet_links?.popupQR ?? "", guestWeb: prog?.sheet_links?.guestWeb ?? "",
    acaScenario: prog?.sheet_links?.acaScenario ?? "",
  },
  tasks: [],
});

const uiToDb = (p) => ({
  project: {
    id: p.id, name: p.info.name, hotel_id: p.info.hotelId,
    address: p.info.address, region: p.info.region, region_other: p.info.regionOther,
    products: p.info.products, ava_units: p.info.avaUnits, ava_spare: p.info.avaSpare,
    integrations: p.info.integrations, integration_notes: p.info.integrationNotes,
    launch_date: p.info.launchDate || null, batch1_deadline: p.info.batch1Deadline || null,
    batch2_deadline: p.info.batch2Deadline || null, notes: p.info.notes,
    pic: p.info.pic, jira_epic: p.info.jiraEpic,
  },
  progress: {
    project_id: p.id, basic_checked: p.basicChecked, basic_notes: p.basicNotes,
    faq_checked: p.faqChecked, faq_notes: p.faqNotes,
    batch2_checked: p.batch2Checked, batch2_notes: p.batch2Notes, sheet_links: p.sheetLinks,
  },
});

const newProject = () => ({
  id: crypto.randomUUID(),
  info: {
    name:"", hotelId:"", address:"", region:"", regionOther:"",
    products:[], avaUnits:"", avaSpare:"", integrations:[], integrationNotes:{},
    launchDate:"", batch1Deadline:"", batch2Deadline:"", notes:"", pic:"", jiraEpic:"",
  },
  basicChecked:{}, basicNotes:{}, faqChecked:{}, faqNotes:{},
  batch2Checked:{}, batch2Notes:{},
  sheetLinks:{ basic:"", faq:"", showcase:"", ad:"", popupQR:"", guestWeb:"", acaScenario:"" },
  tasks:[],
});

// ─── Shared UI components ─────────────────────────────────────

const Ring = ({ pct, size=80, stroke=7, color }) => {
  const r = (size-stroke)/2, circ = 2*Math.PI*r;
  return (
    <svg width={size} height={size} style={{ transform:"rotate(-90deg)" }}>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={C.border} strokeWidth={stroke}/>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={stroke}
        strokeDasharray={`${(pct/100)*circ} ${circ}`} strokeLinecap="round"
        style={{ transition:"stroke-dasharray 0.6s cubic-bezier(.4,2,.6,1)" }}/>
    </svg>
  );
};

const ProgressCard = ({ label, checked, total, color }) => {
  const pct = total===0 ? 0 : Math.round((checked/total)*100);
  return (
    <div style={{ background:C.white, border:`1.5px solid ${color}33`, borderRadius:16, padding:"18px 22px",
      display:"flex", alignItems:"center", gap:18, flex:1, minWidth:160, boxShadow:`0 2px 12px ${color}15` }}>
      <div style={{ position:"relative", flexShrink:0 }}>
        <Ring pct={pct} color={color}/>
        <div style={{ position:"absolute", inset:0, display:"flex", alignItems:"center", justifyContent:"center",
          fontSize:14, fontWeight:700, color, fontFamily:"'DM Mono',monospace" }}>{pct}%</div>
      </div>
      <div>
        <div style={{ fontSize:11, letterSpacing:1.5, color:C.textMid, textTransform:"uppercase", marginBottom:4, fontWeight:600 }}>{label}</div>
        <div style={{ fontSize:20, fontWeight:700, color:C.text, fontFamily:"'DM Mono',monospace" }}>
          {checked}<span style={{ color:C.textLight, fontSize:14 }}>/{total}</span>
        </div>
        <div style={{ fontSize:12, color, marginTop:2, fontWeight:500 }}>
          {total-checked===0 ? "✓ 全部完成" : `還剩 ${total-checked} 項`}
        </div>
      </div>
    </div>
  );
};

const MiniBar = ({ pct, color }) => (
  <div style={{ height:5, background:C.border, borderRadius:3, overflow:"hidden", flex:1 }}>
    <div style={{ height:"100%", borderRadius:3, background:color, width:`${pct}%`, transition:"width 0.6s ease" }}/>
  </div>
);

const Card = ({ children, style={} }) => (
  <div style={{ background:C.white, border:`1px solid ${C.border}`, borderRadius:16,
    padding:24, marginBottom:20, boxShadow:"0 1px 4px #0000000a", ...style }}>
    {children}
  </div>
);

const SectionLabel = ({ title, icon, color=C.blue }) => (
  <div style={{ fontSize:11, letterSpacing:2, color, textTransform:"uppercase", marginBottom:14,
    display:"flex", alignItems:"center", gap:7, fontWeight:700 }}>
    <span>{icon}</span>{title}
  </div>
);

const SectionCount = ({ title, checked, total, color }) => (
  <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:16 }}>
    <div style={{ fontSize:15, fontWeight:700, color:C.text }}>{title}</div>
    <div style={{ background:C.bg, border:`1px solid ${color}44`, borderRadius:10, padding:"6px 14px" }}>
      <span style={{ fontSize:18, fontWeight:700, color, fontFamily:"'DM Mono',monospace" }}>{checked}</span>
      <span style={{ fontSize:13, color:C.textLight }}>/{total}</span>
    </div>
  </div>
);

const RichText = ({ text, style:s={} }) => {
  if (!text) return null;
  const parts=[], re=/\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g;
  let last=0, m;
  while ((m=re.exec(text))!==null) {
    if (m.index>last) parts.push({ t:"text", v:text.slice(last,m.index) });
    parts.push({ t:"link", label:m[1], href:m[2] });
    last=m.index+m[0].length;
  }
  if (last<text.length) parts.push({ t:"text", v:text.slice(last) });
  return (
    <div style={{ whiteSpace:"pre-wrap", lineHeight:1.7, ...s }}>
      {parts.map((p,i) => p.t==="link"
        ? <a key={i} href={p.href} target="_blank" rel="noreferrer" style={{ color:C.blue, textDecoration:"underline", fontWeight:500 }}>{p.label}</a>
        : <span key={i}>{p.v}</span>
      )}
    </div>
  );
};

const FInput = ({ label, value, onChange, placeholder, type="text", focusColor=C.blue }) => (
  <div style={{ marginBottom:18 }}>
    <label style={{ display:"block", fontSize:11, letterSpacing:1.5, color:C.textMid,
      textTransform:"uppercase", marginBottom:7, fontWeight:600 }}>{label}</label>
    <input type={type} value={value} onChange={e=>onChange(e.target.value)}
      placeholder={placeholder} style={baseInput}
      onFocus={e=>(e.target.style.borderColor=focusColor)}
      onBlur={e=>(e.target.style.borderColor=C.border)}/>
  </div>
);

const Chip = ({ label, active, onClick, color=C.blue }) => (
  <button onClick={onClick} style={{ padding:"6px 14px", borderRadius:8, fontFamily:"inherit",
    border:`1.5px solid ${active?color:C.border}`, background:active?color:C.white,
    color:active?"#fff":C.textMid, cursor:"pointer", fontSize:13, fontWeight:600, transition:"all 0.15s" }}>
    {label}
  </button>
);

const CheckRow = ({ label, checked, onChange, color=C.green }) => (
  <div onClick={onChange} style={{ display:"flex", alignItems:"center", gap:12, padding:"10px 14px",
    borderRadius:10, cursor:"pointer", marginBottom:6,
    background: checked ? `${color}0d` : "#fff9f0",
    border: `1.5px solid ${checked ? color+"55" : C.amber+"66"}`,
    borderLeft: checked ? `1.5px solid ${color}55` : `4px solid ${C.amber}`,
    transition:"all 0.15s" }}>
    <div style={{ width:20, height:20, borderRadius:6, flexShrink:0,
      border:`2px solid ${checked ? color : C.amber}`,
      background: checked ? color : "#fff",
      display:"flex", alignItems:"center", justifyContent:"center" }}>
      {checked && <span style={{ color:"#fff", fontSize:12 }}>✓</span>}
    </div>
    <span style={{ fontSize:14, color: checked ? C.text : C.textMid, flex:1 }}>{label}</span>
    {!checked && <span style={{ fontSize:10, color:C.amber, fontWeight:700, letterSpacing:0.5, flexShrink:0 }}>待完成</span>}
  </div>
);

const NoteArea = ({ value, onChange, focusColor=C.green }) => (
  <textarea value={value} onChange={e=>onChange(e.target.value)}
    placeholder="補充說明進行狀況或缺少項目…" rows={2}
    style={{ ...baseInput, marginTop:4, fontSize:12, color:C.textMid,
      resize:"vertical", minHeight:56, background:"#fafbfc", borderColor:C.border }}
    onFocus={e=>(e.target.style.borderColor=focusColor)}
    onBlur={e=>(e.target.style.borderColor=C.border)}/>
);

const SheetLink = ({ value, onChange, color=C.blue }) => {
  const invalid = value.length>0 && !value.startsWith("http");
  return (
    <div style={{ marginTop:14, padding:"12px 14px", background:C.blueLight,
      border:`1px solid ${invalid?C.red+"55":C.blueBorder}`, borderRadius:12 }}>
      <label style={{ display:"flex", alignItems:"center", gap:6, fontSize:11, letterSpacing:1.5,
        color, textTransform:"uppercase", marginBottom:8, fontWeight:600 }}>🔗 資料表連結</label>
      <input type="url" value={value} onChange={e=>onChange(e.target.value)}
        placeholder="貼上 Google Sheets 或其他資料表連結"
        style={{ ...baseInput, borderColor:invalid?C.red:`${color}33` }}
        onFocus={e=>(e.target.style.borderColor=invalid?C.red:color)}
        onBlur={e=>(e.target.style.borderColor=invalid?C.red:`${color}33`)}/>
      {invalid && <div style={{ marginTop:6, fontSize:12, color:C.red }}>⚠️ 連結格式不正確，請確認是否以 http 或 https 開頭</div>}
      {!invalid && value && <a href={value} target="_blank" rel="noreferrer"
        style={{ display:"inline-flex", alignItems:"center", gap:4, marginTop:8,
          fontSize:12, color, textDecoration:"none", fontWeight:600 }}>↗ 開啟連結</a>}
    </div>
  );
};

const NavRow = ({ onBack, onNext, nextLabel, nextColor=C.blue }) => (
  <div style={{ display:"flex", justifyContent:onBack?"space-between":"flex-end" }}>
    {onBack && <button onClick={onBack} style={{ background:C.white, color:C.textMid,
      border:`1px solid ${C.border}`, borderRadius:12, padding:"11px 22px",
      fontSize:14, cursor:"pointer", fontFamily:"inherit" }}>← 返回</button>}
    {onNext && <button onClick={onNext} style={{ background:nextColor, color:"#fff", border:"none",
      borderRadius:12, padding:"11px 26px", fontSize:14, fontWeight:700,
      cursor:"pointer", fontFamily:"inherit", boxShadow:`0 2px 8px ${nextColor}40` }}>{nextLabel}</button>}
  </div>
);

// Read-only overview check row
const OvCheckRow = ({ label, checked, note, color }) => (
  <div style={{ borderBottom:`1px solid ${C.bg}` }}>
    <div style={{ display:"flex", alignItems:"flex-start", gap:8, padding:"8px 0" }}>
      <span style={{ fontSize:13, color:checked?color:C.border, flexShrink:0, marginTop:1 }}>{checked?"✓":"○"}</span>
      <div style={{ flex:1, minWidth:0 }}>
        <span style={{ fontSize:12, color:checked?C.text:C.textLight, lineHeight:1.5 }}>{label}</span>
        {note && <div style={{ marginTop:5, padding:"6px 10px", background:`${color}08`,
          border:`1px solid ${color}22`, borderRadius:7, fontSize:11, color:C.textMid,
          lineHeight:1.6, whiteSpace:"pre-wrap" }}>{note}</div>}
      </div>
    </div>
  </div>
);

const OvCard = ({ title, color, children, linkKey, sheetLinks }) => (
  <div style={{ background:C.white, border:`1px solid ${C.border}`, borderRadius:16,
    padding:18, boxShadow:"0 1px 4px #0000000a" }}>
    <div style={{ fontSize:11, letterSpacing:1.5, color, textTransform:"uppercase", marginBottom:12, fontWeight:700 }}>{title}</div>
    {children}
    {linkKey && sheetLinks[linkKey] && (
      <a href={sheetLinks[linkKey]} target="_blank" rel="noreferrer"
        style={{ display:"inline-flex", alignItems:"center", gap:5, marginTop:14,
          fontSize:12, color, textDecoration:"none", fontWeight:600,
          background:`${color}11`, border:`1px solid ${color}33`, borderRadius:7, padding:"5px 12px" }}>
        🔗 開啟資料表
      </a>
    )}
  </div>
);

const OvBatch2Row = ({ item, checked, note, linkKey, sheetLinks }) => {
  const done=!!checked, hasNote=note&&note.trim();
  return (
    <div style={{ background:done?C.purpleLight:"#fafbfc",
      border:`1px solid ${done?C.purple+"44":C.border}`, borderRadius:12, padding:"12px 14px" }}>
      <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:(hasNote||sheetLinks[linkKey])?8:0 }}>
        <span style={{ fontSize:13, color:done?C.purple:C.border }}>{done?"✓":"○"}</span>
        <span style={{ fontSize:13, color:done?C.text:C.textLight, fontWeight:done?600:400 }}>{item}</span>
      </div>
      {hasNote && <div style={{ margin:"6px 0 8px 22px", padding:"6px 10px", background:`${C.purple}08`,
        border:`1px solid ${C.purple}22`, borderRadius:7, fontSize:11, color:C.textMid,
        lineHeight:1.6, whiteSpace:"pre-wrap" }}>{note}</div>}
      {sheetLinks[linkKey] && <div style={{ marginLeft:22 }}>
        <a href={sheetLinks[linkKey]} target="_blank" rel="noreferrer"
          style={{ fontSize:11, color:C.purple, textDecoration:"none", fontWeight:600,
            background:C.purpleLight, border:`1px solid ${C.purple}33`,
            borderRadius:6, padding:"3px 10px", display:"inline-block" }}>🔗 連結</a>
      </div>}
    </div>
  );
};

// Dropdown filter
const FilterSelect = ({ label, value, onChange, options }) => (
  <div style={{ display:"flex", flexDirection:"column", gap:5 }}>
    <label style={{ fontSize:11, color:C.textLight, fontWeight:600, letterSpacing:1, textTransform:"uppercase" }}>{label}</label>
    <select value={value} onChange={e=>onChange(e.target.value)}
      style={{ ...baseInput, width:"auto", minWidth:130, padding:"8px 32px 8px 12px", fontSize:13, borderRadius:8, cursor:"pointer",
        appearance:"none", backgroundImage:`url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%2394a3b8' d='M6 8L1 3h10z'/%3E%3C/svg%3E")`,
        backgroundRepeat:"no-repeat", backgroundPosition:"right 10px center" }}
      onFocus={e=>(e.target.style.borderColor=C.blue)} onBlur={e=>(e.target.style.borderColor=C.border)}>
      {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  </div>
);

// ─── Calendar Page ─────────────────────────────────────────────
const CalendarPage = ({ projects, allTasks, onTaskAdded }) => {
  const today = new Date();
  const [year,    setYear]    = useState(today.getFullYear());
  const [month,   setMonth]   = useState(today.getMonth());
  const [filters, setFilters] = useState({ launch:true, batch:true, task:true });

  // Modal state
  const [modal, setModal] = useState(null); // null | { date: "YYYY-MM-DD" }
  const [draft, setDraft] = useState({ projectId:"", name:"", description:"", type:"deadline", deadline:"", period_start:"", period_end:"", url:"" });
  const [saving, setSaving] = useState(false);

  const openModal = (dateStr) => {
    setDraft({ projectId: projects[0]?.id || "", name:"", description:"", type:"deadline", deadline:dateStr, period_start:dateStr, period_end:"", url:"" });
    setModal({ date: dateStr });
  };
  const closeModal = () => { setModal(null); setSaving(false); };

  const saveTask = async () => {
    if (!draft.projectId || !draft.name.trim()) return;
    setSaving(true);
    const task = {
      id: crypto.randomUUID(),
      project_id: draft.projectId,
      name: draft.name.trim(),
      description: draft.description,
      type: draft.type,
      deadline: draft.type==="deadline" ? (draft.deadline||null) : null,
      period_start: draft.type==="period" ? (draft.period_start||null) : null,
      period_end:   draft.type==="period" ? (draft.period_end||null)   : null,
      url: draft.url || "",
    };
    const { error } = await sb.from("tasks").insert(task);
    if (!error) onTaskAdded(task);
    closeModal();
  };

  const toggleFilter = (k) => setFilters(f => ({ ...f, [k]:!f[k] }));

  const events = useMemo(() => {
    const list = [];
    const inMonth = (d) => { if (!d) return false; const dt=new Date(d); return dt.getFullYear()===year && dt.getMonth()===month; };
    projects.forEach(proj => {
      const name = proj.info.name || "（未命名）";
      if (filters.launch && proj.info.launchDate && inMonth(proj.info.launchDate))
        list.push({ date:proj.info.launchDate, label:name, sub:"上線日", ...CAL_COLORS.launch });
      if (filters.batch) {
        if (proj.info.batch1Deadline && inMonth(proj.info.batch1Deadline))
          list.push({ date:proj.info.batch1Deadline, label:name, sub:"第一批期限", ...CAL_COLORS.batch1 });
        if (proj.info.batch2Deadline && inMonth(proj.info.batch2Deadline))
          list.push({ date:proj.info.batch2Deadline, label:name, sub:"第二批期限", ...CAL_COLORS.batch2 });
      }
    });
    if (filters.task) {
      allTasks.forEach(task => {
        const proj = projects.find(p => p.id===task.project_id);
        const name = proj?.info.name || "（未命名）";
        if (task.type==="deadline" && task.deadline && inMonth(task.deadline))
          list.push({ date:task.deadline, label:name, sub:`任務：${task.name}`, ...CAL_COLORS.taskDL });
        if (task.type==="period") {
          if (task.period_start && inMonth(task.period_start))
            list.push({ date:task.period_start, label:name, sub:`任務開始：${task.name}`, ...CAL_COLORS.taskPeriod });
          if (task.period_end && inMonth(task.period_end))
            list.push({ date:task.period_end, label:name, sub:`任務結束：${task.name}`, ...CAL_COLORS.taskPeriod });
        }
      });
    }
    return list;
  }, [projects, allTasks, year, month, filters]);

  const firstDay    = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month+1, 0).getDate();
  const cells = [];
  for (let i=0; i<firstDay; i++) cells.push(null);
  for (let d=1; d<=daysInMonth; d++) cells.push(d);
  while (cells.length%7!==0) cells.push(null);

  const dayKey = (d) => d ? `${year}-${String(month+1).padStart(2,"0")}-${String(d).padStart(2,"0")}` : null;
  const getEventsForDay = (d) => { const k=dayKey(d); return k ? events.filter(e=>e.date===k) : []; };

  const monthNames = ["1月","2月","3月","4月","5月","6月","7月","8月","9月","10月","11月","12月"];
  const dayNames   = ["日","一","二","三","四","五","六"];
  const todayStr   = dayKey(today.getDate()).replace(`${year}-${String(month+1).padStart(2,"0")}-`,`${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,"0")}-`);
  const realTodayStr = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,"0")}-${String(today.getDate()).padStart(2,"0")}`;

  return (
    <div style={{ padding:"32px 40px 80px", maxWidth:1200, margin:"0 auto" }}>

      {/* Modal overlay */}
      {modal && (
        <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.35)", zIndex:1000,
          display:"flex", alignItems:"center", justifyContent:"center", padding:24 }}
          onClick={e=>{ if(e.target===e.currentTarget) closeModal(); }}>
          <div style={{ background:C.white, borderRadius:20, padding:32, width:"100%", maxWidth:520,
            boxShadow:"0 20px 60px rgba(0,0,0,0.2)", animation:"fadeIn 0.2s ease" }}>
            <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:24 }}>
              <div>
                <h3 style={{ fontSize:18, fontWeight:700, color:C.text, margin:"0 0 4px" }}>新增任務</h3>
                <div style={{ fontSize:12, color:C.textLight }}>{fmtDate(modal.date)}</div>
              </div>
              <button onClick={closeModal} style={{ background:"none", border:`1px solid ${C.border}`, borderRadius:8,
                padding:"4px 10px", cursor:"pointer", fontSize:16, color:C.textLight, fontFamily:"inherit" }}>✕</button>
            </div>

            {/* Project selector */}
            <div style={{ marginBottom:16 }}>
              <label style={{ display:"block", fontSize:11, letterSpacing:1.5, color:C.textMid,
                textTransform:"uppercase", marginBottom:7, fontWeight:600 }}>歸屬專案</label>
              <select value={draft.projectId} onChange={e=>setDraft(d=>({ ...d, projectId:e.target.value }))}
                style={{ ...baseInput, padding:"10px 32px 10px 14px", appearance:"none",
                  backgroundImage:`url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%2394a3b8' d='M6 8L1 3h10z'/%3E%3C/svg%3E")`,
                  backgroundRepeat:"no-repeat", backgroundPosition:"right 10px center", cursor:"pointer" }}
                onFocus={e=>(e.target.style.borderColor=C.blue)} onBlur={e=>(e.target.style.borderColor=C.border)}>
                {projects.map(p=>(
                  <option key={p.id} value={p.id}>{p.info.name||"（未命名）"}{p.info.hotelId?` #${p.info.hotelId}`:""}</option>
                ))}
              </select>
            </div>

            {/* Task name */}
            <div style={{ marginBottom:16 }}>
              <label style={{ display:"block", fontSize:11, letterSpacing:1.5, color:C.textMid,
                textTransform:"uppercase", marginBottom:7, fontWeight:600 }}>任務名稱 *</label>
              <input value={draft.name} onChange={e=>setDraft(d=>({ ...d, name:e.target.value }))}
                placeholder="輸入任務名稱" style={baseInput}
                onFocus={e=>(e.target.style.borderColor=C.blue)} onBlur={e=>(e.target.style.borderColor=C.border)}/>
            </div>

            {/* Description */}
            <div style={{ marginBottom:16 }}>
              <label style={{ display:"block", fontSize:11, letterSpacing:1.5, color:C.textMid,
                textTransform:"uppercase", marginBottom:7, fontWeight:600 }}>內容概述</label>
              <textarea value={draft.description} onChange={e=>setDraft(d=>({ ...d, description:e.target.value }))}
                placeholder="描述任務目標或相關說明…" rows={3}
                style={{ ...baseInput, resize:"vertical", minHeight:72 }}
                onFocus={e=>(e.target.style.borderColor=C.blue)} onBlur={e=>(e.target.style.borderColor=C.border)}/>
            </div>

            {/* URL */}
            <div style={{ marginBottom:16 }}>
              <label style={{ display:"block", fontSize:11, letterSpacing:1.5, color:C.textMid,
                textTransform:"uppercase", marginBottom:7, fontWeight:600 }}>相關連結（選填）</label>
              <input type="url" value={draft.url} onChange={e=>setDraft(d=>({ ...d, url:e.target.value }))}
                placeholder="https://…" style={baseInput}
                onFocus={e=>(e.target.style.borderColor=C.blue)} onBlur={e=>(e.target.style.borderColor=C.border)}/>
              {draft.url && !draft.url.startsWith("http") && <div style={{ marginTop:5, fontSize:11, color:C.red }}>⚠️ 請確認連結以 http 或 https 開頭</div>}
            </div>

            {/* Type toggle */}
            <div style={{ marginBottom:16 }}>
              <label style={{ display:"block", fontSize:11, letterSpacing:1.5, color:C.textMid,
                textTransform:"uppercase", marginBottom:8, fontWeight:600 }}>類型</label>
              <div style={{ display:"flex", gap:8 }}>
                {[{ v:"deadline", label:"📌 期限" },{ v:"period", label:"📅 週期" }].map(({ v, label })=>(
                  <button key={v} onClick={()=>setDraft(d=>({ ...d, type:v }))}
                    style={{ padding:"7px 18px", borderRadius:8, fontFamily:"inherit", fontSize:13, fontWeight:600,
                      cursor:"pointer", transition:"all 0.15s",
                      border:`1.5px solid ${draft.type===v?C.blue:C.border}`,
                      background:draft.type===v?C.blue:C.white, color:draft.type===v?"#fff":C.textMid }}>
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {/* Date fields */}
            {draft.type==="deadline" ? (
              <div style={{ marginBottom:20 }}>
                <label style={{ display:"block", fontSize:11, letterSpacing:1.5, color:C.textMid,
                  textTransform:"uppercase", marginBottom:7, fontWeight:600 }}>截止日期</label>
                <input type="date" value={draft.deadline}
                  onChange={e=>setDraft(d=>({ ...d, deadline:e.target.value }))}
                  style={{ ...baseInput, width:"auto" }}
                  onFocus={e=>(e.target.style.borderColor=C.amber)} onBlur={e=>(e.target.style.borderColor=C.border)}/>
              </div>
            ) : (
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12, marginBottom:20 }}>
                <div>
                  <label style={{ display:"block", fontSize:11, letterSpacing:1.5, color:C.green,
                    textTransform:"uppercase", marginBottom:7, fontWeight:600 }}>開始日期</label>
                  <input type="date" value={draft.period_start}
                    onChange={e=>setDraft(d=>({ ...d, period_start:e.target.value }))}
                    style={{ ...baseInput, borderColor:`${C.green}44`, background:C.greenLight }}
                    onFocus={e=>(e.target.style.borderColor=C.green)} onBlur={e=>(e.target.style.borderColor=`${C.green}44`)}/>
                </div>
                <div>
                  <label style={{ display:"block", fontSize:11, letterSpacing:1.5, color:C.purple,
                    textTransform:"uppercase", marginBottom:7, fontWeight:600 }}>結束日期</label>
                  <input type="date" value={draft.period_end}
                    onChange={e=>setDraft(d=>({ ...d, period_end:e.target.value }))}
                    style={{ ...baseInput, borderColor:`${C.purple}44`, background:C.purpleLight }}
                    onFocus={e=>(e.target.style.borderColor=C.purple)} onBlur={e=>(e.target.style.borderColor=`${C.purple}44`)}/>
                </div>
              </div>
            )}

            {/* Actions */}
            <div style={{ display:"flex", justifyContent:"flex-end", gap:10 }}>
              <button onClick={closeModal} style={{ background:C.white, color:C.textMid,
                border:`1px solid ${C.border}`, borderRadius:10, padding:"10px 20px",
                fontSize:14, cursor:"pointer", fontFamily:"inherit" }}>取消</button>
              <button onClick={saveTask} disabled={!draft.name.trim()||saving}
                style={{ background:!draft.name.trim()||saving?C.borderMid:C.blue, color:"#fff",
                  border:"none", borderRadius:10, padding:"10px 24px", fontSize:14, fontWeight:700,
                  cursor:!draft.name.trim()||saving?"not-allowed":"pointer", fontFamily:"inherit",
                  boxShadow:draft.name.trim()&&!saving?`0 2px 8px ${C.blue}40`:"none", transition:"all 0.15s" }}>
                {saving?"儲存中…":"新增任務"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:24, flexWrap:"wrap", gap:16 }}>
        <div style={{ display:"flex", alignItems:"center", gap:16 }}>
          <button onClick={()=>{ if(month===0){setMonth(11);setYear(y=>y-1);}else setMonth(m=>m-1); }}
            style={{ background:C.white, border:`1px solid ${C.border}`, borderRadius:8, padding:"6px 12px", cursor:"pointer", fontFamily:"inherit", fontSize:16 }}>‹</button>
          <h2 style={{ fontSize:20, fontWeight:700, color:C.text, margin:0 }}>{year}年 {monthNames[month]}</h2>
          <button onClick={()=>{ if(month===11){setMonth(0);setYear(y=>y+1);}else setMonth(m=>m+1); }}
            style={{ background:C.white, border:`1px solid ${C.border}`, borderRadius:8, padding:"6px 12px", cursor:"pointer", fontFamily:"inherit", fontSize:16 }}>›</button>
          <button onClick={()=>{ setYear(today.getFullYear()); setMonth(today.getMonth()); }}
            style={{ background:C.blueLight, border:`1px solid ${C.blueBorder}`, borderRadius:8, padding:"6px 14px",
              cursor:"pointer", fontFamily:"inherit", fontSize:12, color:C.blue, fontWeight:600 }}>今天</button>
        </div>
        <div style={{ display:"flex", gap:10, flexWrap:"wrap", alignItems:"center" }}>
          <span style={{ fontSize:12, color:C.textLight, marginRight:4 }}>點擊日期可新增任務</span>
          {[
            { k:"launch", label:"上線日",  ...CAL_COLORS.launch },
            { k:"batch",  label:"資料期限", ...CAL_COLORS.batch1 },
            { k:"task",   label:"任務",     ...CAL_COLORS.taskDL },
          ].map(({ k, label, bg, text, border }) => (
            <button key={k} onClick={()=>toggleFilter(k)}
              style={{ display:"flex", alignItems:"center", gap:6, padding:"5px 12px", borderRadius:8, cursor:"pointer",
                fontFamily:"inherit", fontSize:12, fontWeight:600, transition:"all 0.15s",
                background:filters[k]?bg:C.bg, border:`1.5px solid ${filters[k]?border:C.border}`,
                color:filters[k]?text:C.textLight, opacity:filters[k]?1:0.6 }}>
              <span style={{ width:8, height:8, borderRadius:"50%", background:filters[k]?text:C.borderMid, flexShrink:0 }}/>
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Calendar grid */}
      <div style={{ background:C.white, border:`1px solid ${C.border}`, borderRadius:16, overflow:"hidden", boxShadow:"0 1px 4px #0000000a" }}>
        <div style={{ display:"grid", gridTemplateColumns:"repeat(7,minmax(0,1fr))", borderBottom:`1px solid ${C.border}` }}>
          {dayNames.map(d=>(
            <div key={d} style={{ padding:"10px 0", textAlign:"center", fontSize:12, fontWeight:700,
              color:d==="日"?C.red:d==="六"?C.blue:C.textMid }}>{d}</div>
          ))}
        </div>
        {Array.from({ length:cells.length/7 }).map((_,wi)=>(
          <div key={wi} style={{ display:"grid", gridTemplateColumns:"repeat(7,minmax(0,1fr))", borderBottom:wi<cells.length/7-1?`1px solid ${C.border}`:"none" }}>
            {cells.slice(wi*7,wi*7+7).map((d,di)=>{
              const k = dayKey(d);
              const isToday = k===realTodayStr;
              const dayEvents = d ? getEventsForDay(d) : [];
              const col = di===0?C.red:di===6?C.blue:C.text;
              return (
                <div key={di}
                  onClick={()=>{ if(d && projects.length>0) openModal(k); }}
                  style={{ minHeight:110, padding:"6px 8px",
                    borderRight:di<6?`1px solid ${C.border}`:"none",
                    background:isToday?C.blueLight:d?C.white:"#fafbfc",
                    cursor:d&&projects.length>0?"pointer":"default",
                    display:"flex", flexDirection:"column",
                    overflow:"hidden", minWidth:0,
                    transition:"background 0.15s" }}
                  onMouseEnter={e=>{ if(d&&projects.length>0) e.currentTarget.style.background=isToday?"#dbeafe":"#f8fafc"; }}
                  onMouseLeave={e=>{ e.currentTarget.style.background=isToday?C.blueLight:d?C.white:"#fafbfc"; }}>
                  {d && (
                    <>
                      <div style={{ fontSize:13, fontWeight:isToday?700:400, color:isToday?C.blue:col,
                        marginBottom:4, display:"flex", alignItems:"center", justifyContent:"space-between", flexShrink:0 }}>
                        {isToday
                          ? <span style={{ background:C.blue, color:"#fff", borderRadius:"50%", width:22, height:22,
                              display:"inline-flex", alignItems:"center", justifyContent:"center", fontSize:12, fontWeight:700 }}>{d}</span>
                          : <span>{d}</span>}
                        {projects.length>0 && <span style={{ fontSize:13, color:C.borderMid, lineHeight:1 }}>+</span>}
                      </div>
                      <div style={{ display:"flex", flexDirection:"column", gap:3, flex:1 }}>
                        {dayEvents.slice(0,2).map((ev,ei)=>(
                          <div key={ei} title={`${ev.label} — ${ev.sub}`}
                            style={{ borderRadius:5, padding:"3px 6px",
                              background:ev.bg, border:`1px solid ${ev.border}` }}
                            onClick={e=>e.stopPropagation()}>
                            <div style={{ fontSize:10, fontWeight:700, color:ev.text, lineHeight:1.3,
                              overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
                              {ev.sub}
                            </div>
                            <div style={{ fontSize:10, color:ev.text, opacity:0.7, lineHeight:1.3,
                              overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
                              {ev.label}
                            </div>
                          </div>
                        ))}
                        {dayEvents.length>2 && (
                          <div style={{ fontSize:10, color:C.textLight, padding:"1px 4px" }}>+{dayEvents.length-2} 更多</div>
                        )}
                      </div>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        ))}
      </div>

      {/* Event list */}
      {events.length>0 && (
        <div style={{ marginTop:24 }}>
          <h3 style={{ fontSize:15, fontWeight:700, color:C.text, marginBottom:14 }}>本月事件</h3>
          <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
            {[...events].sort((a,b)=>a.date.localeCompare(b.date)).map((ev,i)=>(
              <div key={i} style={{ display:"flex", alignItems:"center", gap:12, padding:"10px 16px",
                background:ev.bg, border:`1px solid ${ev.border}`, borderRadius:10 }}>
                <span style={{ fontSize:12, fontWeight:700, color:ev.text, fontFamily:"'DM Mono',monospace", flexShrink:0 }}>{fmtDate(ev.date)}</span>
                <span style={{ fontSize:13, fontWeight:600, color:ev.text }}>{ev.label}</span>
                <span style={{ fontSize:12, color:ev.text, opacity:0.8 }}>— {ev.sub}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

// ─── HomePage ─────────────────────────────────────────────────
const HomePage = ({ projects, onNew, onOpen, onDelete }) => {
  const [search,        setSearch]        = useState("");
  const [regionFilter,  setRegionFilter]  = useState("all");
  const [productFilter, setProductFilter] = useState("all");
  const [picFilter,     setPicFilter]     = useState("all");
  const [sortBy,        setSortBy]        = useState("created_desc");

  const regionOptions = useMemo(() => {
    const s = new Set(projects.map(p => p.info.region==="其他"?(p.info.regionOther||"其他"):p.info.region).filter(Boolean));
    return [{ value:"all", label:"所有地區" }, ...Array.from(s).map(r=>({ value:r, label:r }))];
  }, [projects]);

  const picOptions = useMemo(() => {
    const s = new Set(projects.map(p=>p.info.pic).filter(Boolean));
    return [{ value:"all", label:"所有 PIC" }, ...Array.from(s).sort().map(p=>({ value:p, label:p }))];
  }, [projects]);

  const productOptions = [
    { value:"all", label:"所有產品" },
    ...PRODUCTS.map(p=>({ value:p, label:p })),
  ];

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    const list = projects.filter(p => {
      const rd = p.info.region==="其他"?(p.info.regionOther||"其他"):p.info.region;
      return p.info.name.toLowerCase().includes(q)
        && (regionFilter==="all"  || rd===regionFilter)
        && (productFilter==="all" || p.info.products.includes(productFilter))
        && (picFilter==="all"     || p.info.pic===picFilter);
    });
    return [...list].sort((a,b) => {
      if (sortBy==="created_desc") return b.id>a.id?1:-1;
      if (sortBy==="created_asc")  return a.id>b.id?1:-1;
      const al=a.info.launchDate, bl=b.info.launchDate;
      if (sortBy==="launch_asc")  return !al?1:!bl?-1:al.localeCompare(bl);
      if (sortBy==="launch_desc") return !al?1:!bl?-1:bl.localeCompare(al);
      return 0;
    });
  }, [projects, search, regionFilter, productFilter, picFilter, sortBy]);

  const overdueCount = projects.filter(p => {
    if (calcPct(p)===100) return false;
    const d1=daysUntil(p.info.batch1Deadline), d2=daysUntil(p.info.batch2Deadline);
    return (d1!==null&&d1<0)||(d2!==null&&d2<0);
  }).length;
  const soonCount = projects.filter(p=>{ const d=daysUntil(p.info.launchDate); return d!==null&&d>=0&&d<=30; }).length;
  const doneCount = projects.filter(p=>calcPct(p)===100).length;

  const stats = [
    { label:"專案總數",    value:projects.length, icon:"📋", color:C.blue,   bg:C.blueLight },
    { label:"逾期未完成",  value:overdueCount,    icon:"⚠️", color:overdueCount>0?C.red:C.green, bg:overdueCount>0?"#fef2f2":C.greenLight },
    { label:"即將上線（30天）", value:soonCount,  icon:"🚀", color:C.amber,  bg:C.amberLight },
    { label:"已完成資料",  value:doneCount,       icon:"✅", color:C.purple, bg:C.purpleLight },
  ];

  return (
    <div style={{ padding:"36px 40px 80px", maxWidth:1200, margin:"0 auto" }}>
      {/* Stat cards */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:16, marginBottom:40 }}>
        {stats.map(({ label, value, icon, color, bg }, i) => (
          <div key={label} style={{ background:C.white, border:`1px solid ${C.border}`, borderRadius:16,
            padding:"22px 24px", boxShadow:"0 1px 4px #0000000a", animation:`fadeUp 0.3s ease ${i*0.06}s both` }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:14 }}>
              <span style={{ fontSize:13, color:C.textMid, fontWeight:500 }}>{label}</span>
              <div style={{ width:34, height:34, borderRadius:9, background:bg,
                display:"flex", alignItems:"center", justifyContent:"center", fontSize:16 }}>{icon}</div>
            </div>
            <div style={{ fontSize:32, fontWeight:700, color:C.text, fontFamily:"'DM Mono',monospace", letterSpacing:-1 }}>{value}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div style={{ marginBottom:20 }}>
        <h2 style={{ fontSize:18, fontWeight:700, color:C.text, margin:"0 0 16px" }}>專案列表</h2>
        <div style={{ display:"flex", alignItems:"flex-end", gap:16, flexWrap:"wrap" }}>
          {/* Search */}
          <div style={{ display:"flex", flexDirection:"column", gap:5 }}>
            <label style={{ fontSize:11, color:C.textLight, fontWeight:600, letterSpacing:1, textTransform:"uppercase" }}>搜尋</label>
            <div style={{ position:"relative" }}>
              <span style={{ position:"absolute", left:12, top:"50%", transform:"translateY(-50%)",
                color:C.textLight, fontSize:14, pointerEvents:"none" }}>🔍</span>
              <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="飯店名稱…"
                style={{ ...baseInput, paddingLeft:36, width:200, fontSize:13 }}
                onFocus={e=>(e.target.style.borderColor=C.blue)}
                onBlur={e=>(e.target.style.borderColor=C.border)}/>
            </div>
          </div>
          <FilterSelect label="地區" value={regionFilter}  onChange={setRegionFilter}  options={regionOptions}/>
          <FilterSelect label="產品" value={productFilter} onChange={setProductFilter} options={productOptions}/>
          <FilterSelect label="PIC"  value={picFilter}     onChange={setPicFilter}     options={picOptions}/>
          {/* Sort */}
          <div style={{ marginLeft:"auto" }}>
            <FilterSelect label="排序" value={sortBy} onChange={setSortBy} options={[
              { value:"created_desc", label:"新增時間（最新）" },
              { value:"created_asc",  label:"新增時間（最舊）" },
              { value:"launch_asc",   label:"上線日期（最近）" },
              { value:"launch_desc",  label:"上線日期（最遠）" },
            ]}/>
          </div>
        </div>
      </div>

      {/* Project grid */}
      {filtered.length===0 ? (
        <div style={{ textAlign:"center", padding:"60px 0", color:C.textLight }}>
          <div style={{ fontSize:40, marginBottom:12 }}>🏨</div>
          <div style={{ fontSize:15, fontWeight:500 }}>
            {projects.length===0 ? "尚無專案，點擊右上角「新增專案」開始" : "找不到符合條件的專案"}
          </div>
        </div>
      ) : (
        <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(500px,1fr))", gap:20 }}>
          {filtered.map((proj,i) => {
            const pct = calcPct(proj);
            const { hasAva, hasAca, hasGw, hasIptv } = getFlags(proj.info.products, proj.info.integrations);
            const rd = proj.info.region==="其他"?(proj.info.regionOther||"其他"):proj.info.region;
            const d  = daysUntil(proj.info.launchDate);
            const isComplete = pct===100, isSoon = d!==null&&d>=0&&d<=30;
            const nd = [
              { label:"第一批期限", date:proj.info.batch1Deadline },
              { label:"第二批期限", date:proj.info.batch2Deadline },
            ].filter(x=>x.date).map(x=>({ ...x, days:daysUntil(x.date) }))
             .filter(x=>x.days!==null&&x.days>=0).sort((a,b)=>a.days-b.days)[0]??null;

            const basicDone = hasAva ? Object.values(proj.basicChecked).filter(Boolean).length : 0;
            const acaDone   = hasAca && proj.basicChecked[ACA_ITEM] ? 1 : 0;
            const faqDone   = hasAva ? Object.entries(proj.faqChecked).filter(([k,v])=>v&&(k!==FAQ_TV_ITEM||hasIptv)).length : 0;
            const b2done    = (hasAva?BATCH2_ITEMS.filter(it=>proj.batch2Checked[it]).length:0)+(hasGw&&proj.batch2Checked[GW_ITEM]?1:0);
            const b2total   = (hasAva?BATCH2_ITEMS.length:0)+(hasGw?1:0);

            return (
              <div key={proj.id}
                style={{ background:C.white, border:`1px solid ${C.border}`, borderRadius:16,
                  padding:22, cursor:"pointer", transition:"all 0.18s",
                  boxShadow:"0 1px 4px #0000000a", animation:`fadeUp 0.3s ease ${i*0.05}s both` }}
                onClick={()=>onOpen(proj.id)}
                onMouseEnter={e=>{ e.currentTarget.style.boxShadow="0 8px 24px #1d4ed820"; e.currentTarget.style.borderColor=C.blueBorder; e.currentTarget.style.transform="translateY(-2px)"; }}
                onMouseLeave={e=>{ e.currentTarget.style.boxShadow="0 1px 4px #0000000a"; e.currentTarget.style.borderColor=C.border; e.currentTarget.style.transform="none"; }}>

                {/* Row 1 */}
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:10 }}>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ display:"flex", alignItems:"center", gap:8, flexWrap:"wrap", marginBottom:3 }}>
                      <span style={{ fontSize:16, fontWeight:700, color:C.text }}>{proj.info.name||"（未命名）"}</span>
                      {proj.info.hotelId && <span style={{ fontSize:11, color:C.textLight, fontFamily:"'DM Mono',monospace", background:C.bg, padding:"2px 7px", borderRadius:5 }}>#{proj.info.hotelId}</span>}
                      {rd && <span style={{ fontSize:11, background:C.blueLight, color:C.blue, border:`1px solid ${C.blueBorder}`, borderRadius:6, padding:"2px 9px", fontWeight:600 }}>{rd}</span>}
                      {isComplete  && <span style={{ fontSize:11, background:C.greenLight, color:C.green, border:`1px solid ${C.green}33`, borderRadius:6, padding:"2px 9px", fontWeight:700 }}>✓ 完成</span>}
                      {!isComplete && isSoon && <span style={{ fontSize:11, background:C.amberLight, color:C.amber, border:`1px solid ${C.amber}33`, borderRadius:6, padding:"2px 9px", fontWeight:700 }}>🚀 即將上線</span>}
                    </div>
                    {proj.info.address && <div style={{ fontSize:12, color:C.textLight, marginTop:2 }}>📍 {proj.info.address}</div>}
                  </div>
                  <button onClick={e=>{ e.stopPropagation(); if(window.confirm(`確定要移除「${proj.info.name||"此專案"}」嗎？`)) onDelete(proj.id); }}
                    style={{ background:"none", border:`1px solid ${C.border}`, borderRadius:7, padding:"4px 9px",
                      cursor:"pointer", fontSize:13, color:C.textLight, lineHeight:1,
                      transition:"all 0.15s", fontFamily:"inherit", flexShrink:0, marginLeft:8 }}
                    onMouseEnter={e=>{ e.currentTarget.style.background="#fef2f2"; e.currentTarget.style.borderColor=C.red; e.currentTarget.style.color=C.red; }}
                    onMouseLeave={e=>{ e.currentTarget.style.background="none"; e.currentTarget.style.borderColor=C.border; e.currentTarget.style.color=C.textLight; }}
                    title="移除專案">🗑</button>
                </div>

                {/* Row 2a: Products + PIC */}
                {(proj.info.products.length>0||proj.info.pic) && (
                  <div style={{ display:"flex", alignItems:"center", gap:6, marginBottom:6, flexWrap:"wrap" }}>
                    {proj.info.products.map(p=>(
                      <span key={p} style={{ fontSize:12, fontWeight:700, color:"#fff", background:PRODUCT_COLORS[p]||C.blue, borderRadius:7, padding:"3px 11px" }}>{p}</span>
                    ))}
                    {proj.info.pic && <span style={{ marginLeft:"auto", fontSize:11, background:C.greenLight, color:C.green, border:`1px solid ${C.green}33`, borderRadius:6, padding:"2px 9px", fontWeight:600 }}>👤 {proj.info.pic}</span>}
                  </div>
                )}

                {/* Row 2b: Integrations + Jira */}
                {(proj.info.integrations.length>0||proj.info.jiraEpic) && (
                  <div style={{ display:"flex", alignItems:"center", gap:6, marginBottom:12, flexWrap:"wrap" }}>
                    {proj.info.integrations.map(intg=>(
                      <span key={intg} style={{ fontSize:11, fontWeight:500, color:C.textMid, background:C.white, border:`1.5px solid ${C.border}`, borderRadius:7, padding:"2px 10px" }}>{intg}</span>
                    ))}
                    {proj.info.jiraEpic && (
                      <a href={proj.info.jiraEpic} target="_blank" rel="noreferrer" onClick={e=>e.stopPropagation()}
                        style={{ marginLeft:"auto", display:"inline-flex", alignItems:"center", gap:4, fontSize:11,
                          color:"#0052cc", textDecoration:"none", fontWeight:600, background:"#e9f0ff",
                          border:"1px solid #b3c7f7", borderRadius:6, padding:"3px 9px", whiteSpace:"nowrap", flexShrink:0 }}>
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="#0052cc"><path d="M11.571 11.429L6.857 6.714A6 6 0 0 1 17.143 17l-5.572-5.571zm.858.857L17.143 17A6 6 0 0 1 6.857 6.714l5.572 5.572z"/></svg>
                        Jira Epic
                      </a>
                    )}
                  </div>
                )}

                {/* Row 3: Dates */}
                {(proj.info.launchDate||nd) && (
                  <div style={{ display:"grid", gridTemplateColumns:nd&&proj.info.launchDate?"1fr 1fr":"1fr", gap:8, marginBottom:14 }}>
                    {proj.info.launchDate && (
                      <div style={{ display:"flex", alignItems:"center", gap:6, background:C.bg, borderRadius:9, padding:"7px 12px" }}>
                        <span style={{ fontSize:12 }}>📅</span>
                        <span style={{ fontSize:12, color:C.textMid }}>上線日</span>
                        <span style={{ fontSize:12, color:C.text, fontWeight:700, fontFamily:"'DM Mono',monospace" }}>{proj.info.launchDate}</span>
                        {d!==null&&d>=0 && <span style={{ marginLeft:"auto", fontSize:11, fontWeight:600, color:d<=7?C.red:d<=30?C.amber:C.textLight }}>{d===0?"今天":`${d}天後`}</span>}
                      </div>
                    )}
                    {nd && (
                      <div style={{ display:"flex", alignItems:"center", gap:6,
                        background:nd.days<=7?"#fef2f2":C.greenLight,
                        border:`1px solid ${nd.days<=7?C.red+"33":C.green+"33"}`,
                        borderRadius:9, padding:"7px 12px" }}>
                        <span style={{ fontSize:12 }}>🗓️</span>
                        <span style={{ fontSize:12, color:nd.days<=7?C.red:C.green }}>{nd.label}</span>
                        <span style={{ fontSize:11, color:C.text, fontWeight:700, fontFamily:"'DM Mono',monospace", marginLeft:2 }}>{nd.date}</span>
                        <span style={{ marginLeft:"auto", fontSize:11, fontWeight:600, color:nd.days<=7?C.red:C.green }}>{nd.days===0?"今天":`${nd.days}天`}</span>
                      </div>
                    )}
                  </div>
                )}

                {/* Row 4: Progress */}
                <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:10 }}>
                  <span style={{ fontSize:12, color:C.textMid, whiteSpace:"nowrap" }}>完成度</span>
                  <MiniBar pct={pct} color={isComplete?C.green:C.blue}/>
                  <span style={{ fontSize:13, fontWeight:700, fontFamily:"'DM Mono',monospace", whiteSpace:"nowrap", color:isComplete?C.green:C.blue }}>{pct}%</span>
                </div>

                {/* Row 5: Sub-counts */}
                {(hasAva||hasAca||hasGw) ? (
                  <div style={{ display:"flex", gap:14, flexWrap:"wrap" }}>
                    {hasAva && <>
                      <div style={{ display:"flex", alignItems:"center", gap:5 }}>
                        <span style={{ width:7,height:7,borderRadius:"50%",background:C.green,flexShrink:0 }}/>
                        <span style={{ fontSize:11,color:C.textLight }}>基礎設定</span>
                        <span style={{ fontSize:11,color:C.green,fontWeight:600,fontFamily:"'DM Mono',monospace" }}>{basicDone}/{BASIC_ITEMS.length}</span>
                      </div>
                      <div style={{ display:"flex", alignItems:"center", gap:5 }}>
                        <span style={{ width:7,height:7,borderRadius:"50%",background:C.amber,flexShrink:0 }}/>
                        <span style={{ fontSize:11,color:C.textLight }}>FAQ</span>
                        <span style={{ fontSize:11,color:C.amber,fontWeight:600,fontFamily:"'DM Mono',monospace" }}>{faqDone}/{hasIptv?FAQ_ITEMS.length:FAQ_ITEMS.length-1}</span>
                      </div>
                    </>}
                    {hasAca && <div style={{ display:"flex", alignItems:"center", gap:5 }}>
                      <span style={{ width:7,height:7,borderRadius:"50%",background:PRODUCT_COLORS.ACA,flexShrink:0 }}/>
                      <span style={{ fontSize:11,color:C.textLight }}>ACA</span>
                      <span style={{ fontSize:11,color:PRODUCT_COLORS.ACA,fontWeight:600,fontFamily:"'DM Mono',monospace" }}>{acaDone}/1</span>
                    </div>}
                    {(hasAva||hasGw) && <div style={{ display:"flex", alignItems:"center", gap:5 }}>
                      <span style={{ width:7,height:7,borderRadius:"50%",background:C.purple,flexShrink:0 }}/>
                      <span style={{ fontSize:11,color:C.textLight }}>第二批</span>
                      <span style={{ fontSize:11,color:C.purple,fontWeight:600,fontFamily:"'DM Mono',monospace" }}>{b2done}/{b2total}</span>
                    </div>}
                  </div>
                ) : (
                  <div style={{ fontSize:11, color:C.textLight, fontStyle:"italic" }}>未選購 AVA、ACA 或 GW，無進度追蹤</div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

// ─── TasksTab ─────────────────────────────────────────────────
const TasksTab = ({ projectId, tasks, onTasksChange }) => {
  const taskTimer = useRef({});

  const addTask = () => {
    const t = { ...newTask(), project_id:projectId };
    onTasksChange([...tasks, t]);
    // Insert to DB
    sb.from("tasks").insert({
      id:t.id, project_id:projectId, name:"", description:"",
      type:"deadline", deadline:null, period_start:null, period_end:null,
    }).then(({ error:e }) => { if(e) console.error(e); });
  };

  const removeTask = async (id) => {
    onTasksChange(tasks.filter(t=>t.id!==id));
    await sb.from("tasks").delete().eq("id", id);
  };

  const updateTask = (id, field, value) => {
    const updated = tasks.map(t => t.id===id ? { ...t, [field]:value } : t);
    onTasksChange(updated);
    // Debounce save
    if (taskTimer.current[id]) clearTimeout(taskTimer.current[id]);
    taskTimer.current[id] = setTimeout(async () => {
      const t = updated.find(x=>x.id===id);
      if (!t) return;
      await sb.from("tasks").upsert({
        id:t.id, project_id:t.project_id, name:t.name, description:t.description,
        type:t.type, deadline:t.deadline||null, period_start:t.period_start||null, period_end:t.period_end||null,
        url:t.url||"",
      });
    }, 800);
  };

  return (
    <div style={{ animation:"fadeIn 0.25s ease" }}>
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:24 }}>
        <div>
          <h2 style={{ fontSize:20, fontWeight:700, color:C.text, margin:"0 0 4px" }}>任務紀錄</h2>
          <p style={{ fontSize:13, color:C.textMid, margin:0 }}>記錄與此專案相關的任務與期限</p>
        </div>
        <button onClick={addTask} style={{ background:C.blue, color:"#fff", border:"none",
          borderRadius:10, padding:"9px 18px", fontSize:13, fontWeight:700,
          cursor:"pointer", fontFamily:"inherit", boxShadow:`0 2px 8px ${C.blue}40` }}>+ 新增任務</button>
      </div>

      {tasks.length===0 ? (
        <div style={{ textAlign:"center", padding:"50px 0", color:C.textLight }}>
          <div style={{ fontSize:32, marginBottom:10 }}>📋</div>
          <div style={{ fontSize:14, fontWeight:500 }}>尚無任務，點擊右上角「新增任務」開始</div>
        </div>
      ) : (
        <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
          {tasks.map((task, idx) => (
            <Card key={task.id} style={{ padding:20 }}>
              <div style={{ display:"flex", alignItems:"flex-start", justifyContent:"space-between", gap:12, marginBottom:16 }}>
                <div style={{ display:"flex", alignItems:"center", gap:10, flex:1 }}>
                  <span style={{ fontSize:11, fontWeight:700, color:C.textLight, minWidth:24 }}>#{idx+1}</span>
                  <input value={task.name} onChange={e=>updateTask(task.id,"name",e.target.value)}
                    placeholder="任務名稱" style={{ ...baseInput, fontSize:15, fontWeight:600, padding:"8px 12px" }}
                    onFocus={e=>(e.target.style.borderColor=C.blue)} onBlur={e=>(e.target.style.borderColor=C.border)}/>
                </div>
                <button onClick={()=>removeTask(task.id)}
                  style={{ background:"none", border:`1px solid ${C.border}`, borderRadius:7, padding:"5px 10px",
                    cursor:"pointer", fontSize:13, color:C.textLight, transition:"all 0.15s", fontFamily:"inherit", flexShrink:0 }}
                  onMouseEnter={e=>{ e.currentTarget.style.background="#fef2f2"; e.currentTarget.style.borderColor=C.red; e.currentTarget.style.color=C.red; }}
                  onMouseLeave={e=>{ e.currentTarget.style.background="none"; e.currentTarget.style.borderColor=C.border; e.currentTarget.style.color=C.textLight; }}>🗑</button>
              </div>

              <div style={{ marginBottom:14 }}>
                <label style={{ display:"block", fontSize:11, letterSpacing:1.5, color:C.textMid, textTransform:"uppercase", marginBottom:6, fontWeight:600 }}>內容概述</label>
                <textarea value={task.description} onChange={e=>updateTask(task.id,"description",e.target.value)}
                  placeholder="描述任務的目標、範圍或相關說明…" rows={3}
                  style={{ ...baseInput, resize:"vertical", minHeight:80 }}
                  onFocus={e=>(e.target.style.borderColor=C.blue)} onBlur={e=>(e.target.style.borderColor=C.border)}/>
              </div>

              {/* Type toggle */}
              <div style={{ marginBottom:14 }}>
                <label style={{ display:"block", fontSize:11, letterSpacing:1.5, color:C.textMid, textTransform:"uppercase", marginBottom:8, fontWeight:600 }}>類型</label>
                <div style={{ display:"flex", gap:8 }}>
                  {[{ v:"deadline", label:"📌 期限" }, { v:"period", label:"📅 週期" }].map(({ v, label }) => (
                    <button key={v} onClick={()=>updateTask(task.id,"type",v)}
                      style={{ padding:"7px 18px", borderRadius:8, fontFamily:"inherit", fontSize:13, fontWeight:600,
                        cursor:"pointer", transition:"all 0.15s",
                        border:`1.5px solid ${task.type===v?C.blue:C.border}`,
                        background:task.type===v?C.blue:C.white, color:task.type===v?"#fff":C.textMid }}>
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Date fields */}
              {task.type==="deadline" ? (
                <div style={{ marginBottom:14 }}>
                  <label style={{ display:"block", fontSize:11, letterSpacing:1.5, color:C.textMid, textTransform:"uppercase", marginBottom:7, fontWeight:600 }}>截止日期</label>
                  <input type="date" value={task.deadline||""} onChange={e=>updateTask(task.id,"deadline",e.target.value)}
                    style={{ ...baseInput, width:"auto" }}
                    onFocus={e=>(e.target.style.borderColor=C.amber)} onBlur={e=>(e.target.style.borderColor=C.border)}/>
                </div>
              ) : (
                <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:16, marginBottom:14 }}>
                  <div>
                    <label style={{ display:"block", fontSize:11, letterSpacing:1.5, color:C.green, textTransform:"uppercase", marginBottom:7, fontWeight:600 }}>開始日期</label>
                    <input type="date" value={task.period_start||""} onChange={e=>updateTask(task.id,"period_start",e.target.value)}
                      style={{ ...baseInput, borderColor:`${C.green}44`, background:C.greenLight }}
                      onFocus={e=>(e.target.style.borderColor=C.green)} onBlur={e=>(e.target.style.borderColor=`${C.green}44`)}/>
                  </div>
                  <div>
                    <label style={{ display:"block", fontSize:11, letterSpacing:1.5, color:C.purple, textTransform:"uppercase", marginBottom:7, fontWeight:600 }}>結束日期</label>
                    <input type="date" value={task.period_end||""} onChange={e=>updateTask(task.id,"period_end",e.target.value)}
                      style={{ ...baseInput, borderColor:`${C.purple}44`, background:C.purpleLight }}
                      onFocus={e=>(e.target.style.borderColor=C.purple)} onBlur={e=>(e.target.style.borderColor=`${C.purple}44`)}/>
                  </div>
                  {task.period_start && task.period_end && task.period_end < task.period_start && (
                    <div style={{ gridColumn:"1/-1", padding:"8px 12px", background:"#fef2f2", border:`1px solid ${C.red}44`, borderRadius:8, fontSize:12, color:C.red }}>
                      ⚠️ 結束日期不能早於開始日期
                    </div>
                  )}
                </div>
              )}

              {/* URL */}
              <div>
                <label style={{ display:"block", fontSize:11, letterSpacing:1.5, color:C.textMid, textTransform:"uppercase", marginBottom:7, fontWeight:600 }}>相關連結（選填）</label>
                <input type="url" value={task.url||""} onChange={e=>updateTask(task.id,"url",e.target.value)}
                  placeholder="https://…" style={baseInput}
                  onFocus={e=>(e.target.style.borderColor=C.blue)} onBlur={e=>(e.target.style.borderColor=C.border)}/>
                {task.url && !task.url.startsWith("http") && <div style={{ marginTop:5, fontSize:11, color:C.red }}>⚠️ 請確認連結以 http 或 https 開頭</div>}
                {task.url && task.url.startsWith("http") && (
                  <a href={task.url} target="_blank" rel="noreferrer"
                    style={{ display:"inline-flex", alignItems:"center", gap:4, marginTop:8,
                      fontSize:12, color:C.blue, textDecoration:"none", fontWeight:600 }}>↗ 開啟連結</a>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

// ─── ProjectDetail ────────────────────────────────────────────
const ProjectDetail = ({ project, isNew, onUpdate, onBack, allPics }) => {
  const [step, setStep] = useState(isNew ? 0 : 4);
  const [info,          setInfoLocal]     = useState(project.info);
  const [basicChecked,  setBasicChecked]  = useState(project.basicChecked);
  const [basicNotes,    setBasicNotes]    = useState(project.basicNotes   || {});
  const [faqChecked,    setFaqChecked]    = useState(project.faqChecked);
  const [faqNotes,      setFaqNotes]      = useState(project.faqNotes     || {});
  const [batch2Checked, setBatch2Checked] = useState(project.batch2Checked);
  const [batch2Notes,   setBatch2Notes]   = useState(project.batch2Notes  || {});
  const [sheetLinks,    setSheetLinks]    = useState(project.sheetLinks);
  const [tasks,         setTasks]         = useState(project.tasks || []);
  const [saveStatus,    setSaveStatus]    = useState("idle");
  const saveTimer = useRef(null);

  useEffect(() => {
    setSaveStatus("saving");
    if (saveTimer.current) clearTimeout(saveTimer.current);
    onUpdate({ ...project, info, basicChecked, basicNotes, faqChecked, faqNotes, batch2Checked, batch2Notes, sheetLinks, tasks });
    saveTimer.current = setTimeout(() => {
      setSaveStatus("saved");
      saveTimer.current = setTimeout(() => setSaveStatus("idle"), 2000);
    }, 900);
  }, [info, basicChecked, basicNotes, faqChecked, faqNotes, batch2Checked, batch2Notes, sheetLinks, tasks]); // eslint-disable-line

  const setInfo     = useCallback(fn => setInfoLocal(p=>fn(p)), []);
  const toggleArr   = useCallback((key,val) => setInfo(p=>({ ...p, [key]:p[key].includes(val)?p[key].filter(x=>x!==val):[...p[key],val] })), [setInfo]);
  const toggleCheck = useCallback((setter,key) => setter(p=>({ ...p, [key]:!p[key] })), []);

  const { hasAva, hasAca, hasGw, hasIptv } = getFlags(info.products, info.integrations);
  const canBatch1 = hasAva||hasAca, canBatch2 = hasAva||hasGw;
  const activeFaq = FAQ_ITEMS.filter(item => item!==FAQ_TV_ITEM||hasIptv);

  const basicCount = hasAva ? Object.values(basicChecked).filter(Boolean).length : 0;
  const acaCount   = hasAca && basicChecked[ACA_ITEM] ? 1 : 0;
  const faqCount   = hasAva ? Object.entries(faqChecked).filter(([k,v])=>v&&(k!==FAQ_TV_ITEM||hasIptv)).length : 0;
  const b2Count    = hasAva ? BATCH2_ITEMS.filter(it=>batch2Checked[it]).length : 0;
  const gwCount    = hasGw  && batch2Checked[GW_ITEM] ? 1 : 0;
  const totalItems = calcTotal(info.products, info.integrations);
  const totalPct   = totalItems===0 ? 0 : Math.round(((basicCount+acaCount+faqCount+b2Count+gwCount)/totalItems)*100);

  // Steps: 0=info, 1=batch1, 2=batch2, 3=tasks, 4=overview
  const STEPS = ["專案資訊","第一批資料","第二批資料","任務紀錄","總覽"];

  const LockScreen = ({ msg }) => (
    <div style={{ textAlign:"center", padding:"60px 0", color:C.textLight }}>
      <div style={{ fontSize:36, marginBottom:14 }}>🔒</div>
      <div style={{ fontSize:15, fontWeight:600, color:C.textMid, marginBottom:20 }}>{msg}</div>
      <button onClick={()=>setStep(0)} style={{ background:C.blue, color:"#fff", border:"none",
        borderRadius:10, padding:"10px 22px", fontSize:13, fontWeight:700,
        cursor:"pointer", fontFamily:"inherit" }}>前往專案資訊</button>
    </div>
  );

  return (
    <div style={{ minHeight:"100vh", background:C.bg, fontFamily:"'Noto Sans TC','Segoe UI',sans-serif" }}>
      <style>{GLOBAL_CSS}</style>

      {/* Header */}
      <div style={{ background:C.white, borderBottom:`1px solid ${C.border}`, padding:"0 40px",
        display:"flex", alignItems:"center", justifyContent:"space-between",
        height:60, position:"sticky", top:0, zIndex:10 }}>
        <div style={{ display:"flex", alignItems:"center", gap:12 }}>
          <button onClick={onBack} style={{ background:"none", border:"none", cursor:"pointer",
            color:C.textMid, fontSize:13, fontFamily:"inherit", padding:0 }}>← 返回列表</button>
          <span style={{ color:C.border }}>│</span>
          <div style={{ width:26, height:26, borderRadius:7, background:C.blue,
            display:"flex", alignItems:"center", justifyContent:"center", fontSize:14 }}>🏨</div>
          <span style={{ fontSize:15, fontWeight:700, color:C.text }}>{info.name||"新專案"}</span>
          {info.hotelId && <span style={{ fontSize:12, color:C.textLight, fontFamily:"'DM Mono',monospace" }}>#{info.hotelId}</span>}
        </div>
        <div style={{ fontSize:13, color:C.textMid, background:C.bg, border:`1px solid ${C.border}`,
          borderRadius:8, padding:"5px 14px", fontFamily:"'DM Mono',monospace", fontWeight:600,
          display:"flex", alignItems:"center", gap:8 }}>
          <span style={{ color:totalPct===100?C.green:C.blue }}>{totalPct}%</span> 完成
          <span style={{ fontSize:11, fontWeight:400, minWidth:60, transition:"color 0.3s",
            color:saveStatus==="saving"?C.amber:saveStatus==="saved"?C.green:C.textLight }}>
            {saveStatus==="saving"?"· 儲存中…":saveStatus==="saved"?"· 已儲存 ✓":"· 自動儲存"}
          </span>
        </div>
      </div>

      {/* Tab nav */}
      <div style={{ background:C.white, borderBottom:`1px solid ${C.border}`, padding:"0 40px", display:"flex" }}>
        {STEPS.map((s,i) => {
          const locked = (i===1&&!canBatch1)||(i===2&&!canBatch2);
          const tip    = i===1?"請先選購 AVA 或 ACA":"請先選購 AVA 或 GW";
          return (
            <button key={i} onClick={()=>!locked&&setStep(i)} title={locked?tip:""}
              style={{ padding:"14px 18px", background:"none", border:"none", fontFamily:"inherit",
                borderBottom:`2.5px solid ${step===i?C.blue:"transparent"}`,
                color:locked?C.border:step===i?C.blue:C.textLight,
                cursor:locked?"not-allowed":"pointer", fontSize:13,
                fontWeight:step===i?700:500, transition:"all 0.15s",
                display:"flex", alignItems:"center", gap:7 }}>
              <span style={{ width:20, height:20, borderRadius:"50%", display:"inline-flex",
                alignItems:"center", justifyContent:"center", fontSize:11, fontWeight:700,
                background:locked?C.bg:step===i?C.blueLight:C.bg,
                border:`1.5px solid ${locked?C.border:step===i?C.blue:C.border}`,
                color:locked?C.border:step===i?C.blue:C.textLight }}>
                {locked?"🔒":i+1}
              </span>
              {s}
            </button>
          );
        })}
      </div>

      <div style={{ maxWidth:820, margin:"0 auto", padding:"32px 32px 80px" }}>

        {/* Step 0: 專案資訊 */}
        {step===0 && (
          <div style={{ animation:"fadeIn 0.25s ease" }}>
            <div style={{ marginBottom:24 }}>
              <h2 style={{ fontSize:20, fontWeight:700, color:C.text, margin:"0 0 5px" }}>專案基本資訊</h2>
              <p style={{ fontSize:13, color:C.textMid, margin:0 }}>填寫飯店基本資料與購置設備</p>
            </div>
            <Card>
              <SectionLabel title="飯店資訊" icon="🏨"/>
              <div style={{ display:"grid", gridTemplateColumns:"2fr 1fr", gap:16 }}>
                <FInput label="飯店名稱" value={info.name} onChange={v=>setInfo(p=>({ ...p, name:v }))} placeholder="例：台北大飯店"/>
                <FInput label="Hotel ID" value={info.hotelId} onChange={v=>setInfo(p=>({ ...p, hotelId:v }))} placeholder="例：TPE-001"/>
              </div>
              <div style={{ marginBottom:18 }}>
                <label style={{ display:"block", fontSize:11, letterSpacing:1.5, color:C.textMid, textTransform:"uppercase", marginBottom:7, fontWeight:600 }}>Jira Epic 連結</label>
                <input type="url" value={info.jiraEpic} onChange={e=>setInfo(p=>({ ...p, jiraEpic:e.target.value }))}
                  placeholder="https://your-domain.atlassian.net/browse/EPIC-123" style={baseInput}
                  onFocus={e=>(e.target.style.borderColor="#0052cc")} onBlur={e=>(e.target.style.borderColor=C.border)}/>
                {info.jiraEpic&&!info.jiraEpic.startsWith("http")&&<div style={{ marginTop:6, fontSize:12, color:C.red }}>⚠️ 連結格式不正確</div>}
                {info.jiraEpic&&info.jiraEpic.startsWith("http")&&<a href={info.jiraEpic} target="_blank" rel="noreferrer" style={{ display:"inline-flex", alignItems:"center", gap:4, marginTop:6, fontSize:12, color:"#0052cc", textDecoration:"none", fontWeight:600 }}>↗ 開啟 Jira Epic</a>}
              </div>
              <div style={{ marginBottom:18 }}>
                <label style={{ display:"block", fontSize:11, letterSpacing:1.5, color:C.textMid, textTransform:"uppercase", marginBottom:7, fontWeight:600 }}>負責人（PIC）</label>
                <datalist id="pic-list">{allPics.map(p=><option key={p} value={p}/>)}</datalist>
                <input list="pic-list" value={info.pic} onChange={e=>setInfo(p=>({ ...p, pic:e.target.value }))}
                  placeholder="輸入負責人姓名，若不在清單內將自動新增" style={baseInput}
                  onFocus={e=>(e.target.style.borderColor=C.green)} onBlur={e=>(e.target.style.borderColor=C.border)}/>
                {info.pic&&!allPics.includes(info.pic)&&<div style={{ marginTop:6, fontSize:12, color:C.green }}>✦ 將新增「{info.pic}」至 PIC 清單</div>}
              </div>
              <FInput label="地址" value={info.address} onChange={v=>setInfo(p=>({ ...p, address:v }))} placeholder="例：台北市中山區南京東路一段"/>
              <div style={{ marginBottom:18 }}>
                <label style={{ display:"block", fontSize:11, letterSpacing:1.5, color:C.textMid, textTransform:"uppercase", marginBottom:7, fontWeight:600 }}>所在國家</label>
                <div style={{ display:"flex", flexWrap:"wrap", gap:8, marginBottom:10 }}>
                  {COUNTRIES.map(c=><Chip key={c} label={c} active={info.region===c} color={C.blue} onClick={()=>setInfo(p=>({ ...p, region:c, regionOther:c!=="其他"?"":p.regionOther }))}/>)}
                </div>
                {info.region==="其他"&&<input type="text" value={info.regionOther} onChange={e=>setInfo(p=>({ ...p, regionOther:e.target.value }))}
                  placeholder="請輸入國家／地區名稱" style={{ ...baseInput, borderColor:C.blue }}/>}
              </div>
            </Card>
            <Card>
              <SectionLabel title="購置產品" icon="📦"/>
              <div style={{ display:"flex", flexWrap:"wrap", gap:10, marginBottom:14 }}>
                {PRODUCTS.map(p=><Chip key={p} label={p} active={info.products.includes(p)} color={PRODUCT_COLORS[p]||C.blue} onClick={()=>toggleArr("products",p)}/>)}
              </div>
              {info.products.includes("AVA")&&(
                <div style={{ background:C.blueLight, border:`1px solid ${C.blueBorder}`, borderRadius:12, padding:16 }}>
                  <div style={{ fontSize:11, color:C.blue, letterSpacing:1.5, textTransform:"uppercase", marginBottom:12, fontWeight:700 }}>AVA 機台數量</div>
                  <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:16 }}>
                    <FInput label="裝機數量" value={info.avaUnits} onChange={v=>setInfo(p=>({ ...p, avaUnits:v }))} placeholder="例：50" type="number"/>
                    <FInput label="備品機台數量" value={info.avaSpare} onChange={v=>setInfo(p=>({ ...p, avaSpare:v }))} placeholder="例：5" type="number"/>
                  </div>
                </div>
              )}
            </Card>
            <Card>
              <SectionLabel title="串接功能" icon="🔗" color={C.purple}/>
              <div style={{ display:"flex", flexWrap:"wrap", gap:10, marginBottom:14 }}>
                {INTEGRATIONS.map(i=><Chip key={i} label={i} active={info.integrations.includes(i)} color={C.purple} onClick={()=>toggleArr("integrations",i)}/>)}
              </div>
              {info.integrations.length>0&&(
                <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
                  {info.integrations.map(intg=>(
                    <div key={intg}>
                      <label style={{ display:"block", fontSize:11, letterSpacing:1.5, color:C.purple, textTransform:"uppercase", marginBottom:6, fontWeight:600 }}>{intg} 備註說明</label>
                      <textarea value={info.integrationNotes[intg]||""} onChange={e=>setInfo(p=>({ ...p, integrationNotes:{ ...p.integrationNotes, [intg]:e.target.value } }))}
                        placeholder={`請說明 ${intg} 串接相關需求或細節`} rows={3}
                        style={{ ...baseInput, resize:"vertical", minHeight:72 }}
                        onFocus={e=>(e.target.style.borderColor=C.purple)} onBlur={e=>(e.target.style.borderColor=C.border)}/>
                    </div>
                  ))}
                </div>
              )}
              <div style={{ marginTop:24 }}>
                <SectionLabel title="日期設定" icon="📅"/>
                <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:16 }}>
                  <div>
                    <label style={{ display:"block", fontSize:11, letterSpacing:1.5, color:C.textMid, textTransform:"uppercase", marginBottom:7, fontWeight:600 }}>上線日期</label>
                    <input type="date" value={info.launchDate} onChange={e=>setInfo(p=>({ ...p, launchDate:e.target.value }))}
                      style={baseInput} onFocus={e=>(e.target.style.borderColor=C.blue)} onBlur={e=>(e.target.style.borderColor=C.border)}/>
                  </div>
                  <div>
                    <label style={{ display:"block", fontSize:11, letterSpacing:1.5, color:C.green, textTransform:"uppercase", marginBottom:7, fontWeight:600 }}>第一批資料期限</label>
                    <div style={{ fontSize:10, color:C.textLight, marginBottom:6 }}>基礎設定 ＋ FAQ</div>
                    <input type="date" value={info.batch1Deadline} onChange={e=>setInfo(p=>({ ...p, batch1Deadline:e.target.value }))}
                      style={{ ...baseInput, borderColor:info.launchDate&&info.batch1Deadline&&info.batch1Deadline>info.launchDate?C.red:`${C.green}44`, background:C.greenLight }}
                      onFocus={e=>(e.target.style.borderColor=C.green)} onBlur={e=>(e.target.style.borderColor=info.launchDate&&info.batch1Deadline&&info.batch1Deadline>info.launchDate?C.red:`${C.green}44`)}/>
                  </div>
                  <div>
                    <label style={{ display:"block", fontSize:11, letterSpacing:1.5, color:C.purple, textTransform:"uppercase", marginBottom:7, fontWeight:600 }}>第二批資料期限</label>
                    <div style={{ fontSize:10, color:C.textLight, marginBottom:6 }}>Showcase ＋ 廣告 ＋ QR</div>
                    <input type="date" value={info.batch2Deadline} onChange={e=>setInfo(p=>({ ...p, batch2Deadline:e.target.value }))}
                      style={{ ...baseInput, borderColor:`${C.purple}44`, background:C.purpleLight }}
                      onFocus={e=>(e.target.style.borderColor=C.purple)} onBlur={e=>(e.target.style.borderColor=`${C.purple}44`)}/>
                  </div>
                </div>
                {info.launchDate&&info.batch1Deadline&&info.batch1Deadline>info.launchDate&&(
                  <div style={{ marginTop:10, padding:"9px 14px", background:"#fef2f2", border:`1px solid ${C.red}44`, borderRadius:10, fontSize:12, color:C.red }}>
                    ⚠️ 第一批資料期限（{info.batch1Deadline}）晚於上線日期（{info.launchDate}），請確認是否正確。
                  </div>
                )}
              </div>
              <div style={{ marginTop:24 }}>
                <SectionLabel title="其餘功能需求或備注" icon="📝"/>
                <textarea value={info.notes} onChange={e=>setInfo(p=>({ ...p, notes:e.target.value }))}
                  placeholder="說明是否有額外功能開發需求…" style={{ ...baseInput, minHeight:90, resize:"vertical" }}
                  onFocus={e=>(e.target.style.borderColor=C.blue)} onBlur={e=>(e.target.style.borderColor=C.border)}/>
                <div style={{ marginTop:6, fontSize:11, color:C.textLight }}>
                  💡 輸入 <code style={{ background:C.bg, padding:"1px 5px", borderRadius:4, fontSize:11 }}>[顯示文字](https://網址)</code> 可在總覽頁顯示為超連結
                </div>
              </div>
            </Card>
            <NavRow onNext={()=>setStep(1)} nextLabel="下一步：第一批資料 →" nextColor={C.blue}/>
          </div>
        )}

        {/* Step 1: 第一批資料 */}
        {step===1&&(
          <div style={{ animation:"fadeIn 0.25s ease" }}>
            {!canBatch1?<LockScreen msg="請先選購 AVA 或 ACA 以開啟第一批資料"/>:(
              <>
                <div style={{ marginBottom:24 }}>
                  <h2 style={{ fontSize:20, fontWeight:700, color:C.text, margin:"0 0 6px" }}>第一批資料</h2>
                  <div style={{ display:"flex", alignItems:"center", gap:10, marginTop:4 }}>
                    <span style={{ fontSize:11, background:C.greenLight, color:C.green, border:`1px solid ${C.green}44`, borderRadius:6, padding:"2px 10px", fontWeight:700 }}>第一批</span>
                    {info.batch1Deadline&&<span style={{ fontSize:12, color:C.textMid }}>期限：{info.batch1Deadline}</span>}
                  </div>
                </div>
                {hasAva&&(
                  <Card>
                    <SectionCount title="基礎設定資料表" checked={basicCount} total={BASIC_ITEMS.length} color={C.green}/>
                    {BASIC_ITEMS.map(item=>(
                      <div key={item} style={{ marginBottom:8 }}>
                        <CheckRow label={item} checked={!!basicChecked[item]} onChange={()=>toggleCheck(setBasicChecked,item)} color={C.green}/>
                        <NoteArea value={basicNotes[item]||""} onChange={v=>setBasicNotes(p=>({ ...p, [item]:v }))} focusColor={C.green}/>
                      </div>
                    ))}
                    <SheetLink value={sheetLinks.basic} onChange={v=>setSheetLinks(p=>({ ...p, basic:v }))} color={C.green}/>
                  </Card>
                )}
                {hasAca&&(
                  <Card>
                    <SectionCount title="ACA 設定" checked={acaCount} total={1} color={PRODUCT_COLORS.ACA}/>
                    <div style={{ marginBottom:8 }}>
                      <CheckRow label={ACA_ITEM} checked={!!basicChecked[ACA_ITEM]} onChange={()=>toggleCheck(setBasicChecked,ACA_ITEM)} color={PRODUCT_COLORS.ACA}/>
                      <NoteArea value={basicNotes[ACA_ITEM]||""} onChange={v=>setBasicNotes(p=>({ ...p, [ACA_ITEM]:v }))} focusColor={PRODUCT_COLORS.ACA}/>
                    </div>
                    <SheetLink value={sheetLinks[ACA_LINK_KEY]||""} onChange={v=>setSheetLinks(p=>({ ...p, [ACA_LINK_KEY]:v }))} color={PRODUCT_COLORS.ACA}/>
                  </Card>
                )}
                {hasAva&&(
                  <Card>
                    <SectionCount title="FAQ 資料表" checked={faqCount} total={activeFaq.length} color={C.amber}/>
                    {activeFaq.map(item=>(
                      <div key={item} style={{ marginBottom:8 }}>
                        <CheckRow label={item} checked={!!faqChecked[item]} onChange={()=>toggleCheck(setFaqChecked,item)} color={C.amber}/>
                        <NoteArea value={faqNotes[item]||""} onChange={v=>setFaqNotes(p=>({ ...p, [item]:v }))} focusColor={C.amber}/>
                      </div>
                    ))}
                    {!hasIptv&&(
                      <div style={{ display:"flex", alignItems:"center", gap:8, padding:"10px 14px", borderRadius:10, background:C.bg, border:`1px solid ${C.border}`, marginBottom:6, opacity:0.6 }}>
                        <div style={{ width:20, height:20, borderRadius:6, border:`2px solid ${C.borderMid}`, background:C.border, flexShrink:0 }}/>
                        <span style={{ fontSize:14, color:C.textLight }}>{FAQ_TV_ITEM}</span>
                        <span style={{ marginLeft:"auto", fontSize:11, color:C.textLight, background:C.borderMid+"44", borderRadius:5, padding:"2px 8px" }}>未選擇 IPTV，不需填寫</span>
                      </div>
                    )}
                    <SheetLink value={sheetLinks.faq} onChange={v=>setSheetLinks(p=>({ ...p, faq:v }))} color={C.amber}/>
                  </Card>
                )}
                <NavRow onBack={()=>setStep(0)} onNext={()=>setStep(2)} nextLabel="下一步：第二批資料 →" nextColor={C.green}/>
              </>
            )}
          </div>
        )}

        {/* Step 2: 第二批資料 */}
        {step===2&&(
          <div style={{ animation:"fadeIn 0.25s ease" }}>
            {!canBatch2?<LockScreen msg="請先選購 AVA 或 GW 以開啟第二批資料"/>:(
              <>
                <div style={{ marginBottom:24 }}>
                  <h2 style={{ fontSize:20, fontWeight:700, color:C.text, margin:"0 0 6px" }}>第二批資料</h2>
                  <div style={{ display:"flex", alignItems:"center", gap:10, marginTop:4 }}>
                    <span style={{ fontSize:11, background:C.purpleLight, color:C.purple, border:`1px solid ${C.purple}44`, borderRadius:6, padding:"2px 10px", fontWeight:700 }}>第二批</span>
                    {info.batch2Deadline&&<span style={{ fontSize:12, color:C.textMid }}>期限：{info.batch2Deadline}</span>}
                  </div>
                </div>
                <Card>
                  <SectionCount title="第二批資料" checked={b2Count+gwCount} total={(hasAva?BATCH2_ITEMS.length:0)+(hasGw?1:0)} color={C.purple}/>
                  {hasAva&&BATCH2_ITEMS.map((item,idx)=>(
                    <div key={item} style={{ marginBottom:16 }}>
                      <CheckRow label={item} checked={!!batch2Checked[item]} onChange={()=>toggleCheck(setBatch2Checked,item)} color={C.purple}/>
                      <NoteArea value={batch2Notes[item]||""} onChange={v=>setBatch2Notes(p=>({ ...p, [item]:v }))} focusColor={C.purple}/>
                      <SheetLink value={sheetLinks[BATCH2_LINK_KEYS[idx]]} onChange={v=>setSheetLinks(p=>({ ...p, [BATCH2_LINK_KEYS[idx]]:v }))} color={C.purple}/>
                    </div>
                  ))}
                  {hasGw&&(
                    <div style={{ marginBottom:16 }}>
                      <CheckRow label={GW_ITEM} checked={!!batch2Checked[GW_ITEM]} onChange={()=>toggleCheck(setBatch2Checked,GW_ITEM)} color={C.purple}/>
                      <NoteArea value={batch2Notes[GW_ITEM]||""} onChange={v=>setBatch2Notes(p=>({ ...p, [GW_ITEM]:v }))} focusColor={C.purple}/>
                      <SheetLink value={sheetLinks[GW_LINK_KEY]} onChange={v=>setSheetLinks(p=>({ ...p, [GW_LINK_KEY]:v }))} color={C.purple}/>
                    </div>
                  )}
                </Card>
                <NavRow onBack={()=>setStep(1)} onNext={()=>setStep(3)} nextLabel="下一步：任務紀錄 →" nextColor={C.purple}/>
              </>
            )}
          </div>
        )}

        {/* Step 3: 任務紀錄 */}
        {step===3&&(
          <TasksTab projectId={project.id} tasks={tasks} onTasksChange={setTasks}/>
        )}
        {step===3&&tasks.length>0&&(
          <div style={{ marginTop:24 }}>
            <NavRow onBack={()=>setStep(2)} onNext={()=>setStep(4)} nextLabel="查看總覽 →" nextColor={C.blue}/>
          </div>
        )}
        {step===3&&tasks.length===0&&(
          <div style={{ marginTop:24 }}>
            <NavRow onBack={()=>setStep(2)} onNext={()=>setStep(4)} nextLabel="查看總覽 →" nextColor={C.blue}/>
          </div>
        )}

        {/* Step 4: 總覽 */}
        {step===4&&(
          <div style={{ animation:"fadeIn 0.25s ease" }}>
            <div style={{ marginBottom:24 }}>
              <h2 style={{ fontSize:20, fontWeight:700, color:C.text, margin:"0 0 5px" }}>專案總覽</h2>
              <p style={{ fontSize:13, color:C.textMid, margin:0 }}>
                所有資料的完成度一覽
                {project.updatedAt&&<span style={{ marginLeft:12, color:C.textLight }}>· 最後更新：{new Date(project.updatedAt).toLocaleString("zh-TW",{ month:"numeric", day:"numeric", hour:"2-digit", minute:"2-digit" })}</span>}
              </p>
            </div>
            <Card>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:12 }}>
                <span style={{ fontSize:13, color:C.textMid, fontWeight:500 }}>整體完成度</span>
                <span style={{ fontSize:26, fontWeight:700, fontFamily:"'DM Mono',monospace", color:totalPct===100?C.green:C.blue }}>{totalPct}%</span>
              </div>
              <div style={{ height:10, background:C.bg, borderRadius:5, overflow:"hidden" }}>
                <div style={{ height:"100%", borderRadius:5, width:`${totalPct}%`, transition:"width 0.8s ease",
                  background:totalPct===100?C.green:`linear-gradient(90deg,${C.blue},${C.purple})` }}/>
              </div>
            </Card>
            {(info.batch1Deadline||info.batch2Deadline)&&(
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:14, marginBottom:20 }}>
                {[
                  { label:"第一批資料期限", date:info.batch1Deadline, sub:"基礎設定 ＋ FAQ", color:C.green, bg:C.greenLight },
                  { label:"第二批資料期限", date:info.batch2Deadline, sub:"Showcase ＋ 廣告 ＋ QR", color:C.purple, bg:C.purpleLight },
                ].map(({ label, date, sub, color, bg })=>(
                  <div key={label} style={{ background:bg, border:`1px solid ${color}33`, borderRadius:14, padding:"14px 18px", display:"flex", alignItems:"center", gap:14 }}>
                    <span style={{ fontSize:24 }}>🗓️</span>
                    <div>
                      <div style={{ fontSize:10, color, letterSpacing:1.5, textTransform:"uppercase", marginBottom:2, fontWeight:700 }}>{label}</div>
                      <div style={{ fontSize:15, fontWeight:700, color:C.text, fontFamily:"'DM Mono',monospace" }}>{date||"—"}</div>
                      <div style={{ fontSize:11, color:C.textMid, marginTop:2 }}>{sub}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
            <div style={{ display:"flex", gap:14, marginBottom:20, flexWrap:"wrap" }}>
              {hasAva&&<ProgressCard label="基礎設定資料表" checked={basicCount} total={BASIC_ITEMS.length} color={C.green}/>}
              {hasAca&&<ProgressCard label="ACA 設定" checked={acaCount} total={1} color={PRODUCT_COLORS.ACA}/>}
              {hasAva&&<ProgressCard label="FAQ 資料表" checked={faqCount} total={activeFaq.length} color={C.amber}/>}
              {(hasAva||hasGw)&&<ProgressCard label="第二批資料" checked={b2Count+gwCount} total={(hasAva?BATCH2_ITEMS.length:0)+(hasGw?1:0)} color={C.purple}/>}
            </div>
            {info.name&&(
              <Card>
                <div style={{ fontSize:11, letterSpacing:2, color:C.blue, textTransform:"uppercase", marginBottom:16, fontWeight:700 }}>📋 專案資訊</div>
                <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"10px 28px" }}>
                  {[
                    ["飯店名稱",info.name],["Hotel ID",info.hotelId||"—"],
                    ["負責人（PIC）",info.pic||"—"],["地址",info.address],
                    ["所在國家",info.region==="其他"?(info.regionOther||"其他"):info.region],
                    ["上線日期",info.launchDate||"—"],
                    ["購置產品",info.products.join("、")||"—"],
                    ["串接功能",info.integrations.join("、")||"無"],
                    info.products.includes("AVA")&&["AVA 裝機 / 備品",`${info.avaUnits||"—"} / ${info.avaSpare||"—"} 台`],
                    ["第一批資料期限",info.batch1Deadline||"—"],
                    ["第二批資料期限",info.batch2Deadline||"—"],
                  ].filter(Boolean).map(([k,v])=>(
                    <div key={k} style={{ padding:"10px 0", borderBottom:`1px solid ${C.border}` }}>
                      <div style={{ fontSize:11, color:C.textLight, letterSpacing:1, textTransform:"uppercase", marginBottom:4, fontWeight:500 }}>{k}</div>
                      <div style={{ fontSize:14, color:C.text, fontWeight:500 }}>{v||"—"}</div>
                    </div>
                  ))}
                  {info.jiraEpic&&(
                    <div style={{ padding:"10px 0", borderBottom:`1px solid ${C.border}` }}>
                      <div style={{ fontSize:11, color:C.textLight, letterSpacing:1, textTransform:"uppercase", marginBottom:4, fontWeight:500 }}>Jira Epic</div>
                      <a href={info.jiraEpic} target="_blank" rel="noreferrer"
                        style={{ fontSize:13, color:"#0052cc", textDecoration:"none", fontWeight:600,
                          display:"inline-flex", alignItems:"center", gap:5,
                          background:"#e9f0ff", border:"1px solid #b3c7f7", borderRadius:7, padding:"4px 11px" }}>
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="#0052cc"><path d="M11.571 11.429L6.857 6.714A6 6 0 0 1 17.143 17l-5.572-5.571zm.858.857L17.143 17A6 6 0 0 1 6.857 6.714l5.572 5.572z"/></svg>
                        開啟 Jira Epic ↗
                      </a>
                    </div>
                  )}
                </div>
                {info.notes&&(
                  <div style={{ marginTop:14, padding:14, background:C.bg, borderRadius:10, border:`1px solid ${C.border}` }}>
                    <div style={{ fontSize:11, color:C.textLight, letterSpacing:1, textTransform:"uppercase", marginBottom:6, fontWeight:500 }}>其餘功能需求或備注</div>
                    <RichText text={info.notes} style={{ fontSize:13, color:C.textMid }}/>
                  </div>
                )}
                {info.integrations.some(k=>info.integrationNotes[k])&&(
                  <div style={{ marginTop:14, padding:14, background:C.purpleLight, borderRadius:10, border:`1px solid ${C.purple}33` }}>
                    <div style={{ fontSize:11, color:C.purple, letterSpacing:1, textTransform:"uppercase", marginBottom:10, fontWeight:700 }}>串接功能備註</div>
                    {info.integrations.filter(k=>info.integrationNotes[k]).map(k=>(
                      <div key={k} style={{ marginBottom:10, paddingBottom:10, borderBottom:`1px solid ${C.purple}22` }}>
                        <div style={{ fontSize:11, fontWeight:700, color:C.purple, marginBottom:4 }}>{k}</div>
                        <div style={{ fontSize:13, color:C.textMid, lineHeight:1.6, whiteSpace:"pre-wrap" }}>{info.integrationNotes[k]}</div>
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            )}
            {/* Batch 1 checklists */}
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:16, marginBottom:16 }}>
              {hasAva&&(
                <OvCard title="基礎設定資料表" color={C.green} linkKey="basic" sheetLinks={sheetLinks}>
                  {BASIC_ITEMS.map(item=><OvCheckRow key={item} label={item} checked={basicChecked[item]} note={basicNotes[item]} color={C.green}/>)}
                </OvCard>
              )}
              {hasAva&&(
                <OvCard title="FAQ 資料表" color={C.amber} linkKey="faq" sheetLinks={sheetLinks}>
                  {activeFaq.map(item=><OvCheckRow key={item} label={item} checked={faqChecked[item]} note={faqNotes[item]} color={C.amber}/>)}
                  {!hasIptv&&<div style={{ display:"flex", alignItems:"center", gap:8, padding:"8px 0", opacity:0.5 }}>
                    <span style={{ fontSize:13, color:C.border }}>—</span>
                    <span style={{ fontSize:12, color:C.textLight }}>{FAQ_TV_ITEM}</span>
                    <span style={{ marginLeft:"auto", fontSize:10, color:C.textLight, background:C.bg, borderRadius:5, padding:"2px 7px" }}>未選 IPTV</span>
                  </div>}
                </OvCard>
              )}
              {hasAca&&(
                <OvCard title="ACA 設定" color={PRODUCT_COLORS.ACA} linkKey={ACA_LINK_KEY} sheetLinks={sheetLinks}>
                  <OvCheckRow label={ACA_ITEM} checked={basicChecked[ACA_ITEM]} note={basicNotes[ACA_ITEM]} color={PRODUCT_COLORS.ACA}/>
                </OvCard>
              )}
            </div>
            {/* Batch 2 */}
            {(hasAva||hasGw)&&(
              <div style={{ background:C.white, border:`1px solid ${C.border}`, borderRadius:16, padding:18, marginBottom:16, boxShadow:"0 1px 4px #0000000a" }}>
                <div style={{ fontSize:11, letterSpacing:1.5, color:C.purple, textTransform:"uppercase", marginBottom:14, fontWeight:700 }}>第二批資料</div>
                <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
                  {hasAva&&BATCH2_ITEMS.map((item,idx)=><OvBatch2Row key={item} item={item} checked={batch2Checked[item]} note={batch2Notes[item]} linkKey={BATCH2_LINK_KEYS[idx]} sheetLinks={sheetLinks}/>)}
                  {hasGw&&(
                    <div style={{ position:"relative" }}>
                      <OvBatch2Row item={GW_ITEM} checked={batch2Checked[GW_ITEM]} note={batch2Notes[GW_ITEM]} linkKey={GW_LINK_KEY} sheetLinks={sheetLinks}/>
                      <span style={{ position:"absolute", top:12, right:14, fontSize:10, color:"#b45309", background:"#fffbeb", border:"1px solid #fcd34d", borderRadius:5, padding:"2px 7px" }}>GW</span>
                    </div>
                  )}
                </div>
              </div>
            )}
            {/* Tasks overview */}
            {tasks.length>0&&(
              <div style={{ background:C.white, border:`1px solid ${C.border}`, borderRadius:16, padding:18, marginBottom:24, boxShadow:"0 1px 4px #0000000a" }}>
                <div style={{ fontSize:11, letterSpacing:1.5, color:C.blue, textTransform:"uppercase", marginBottom:14, fontWeight:700 }}>任務紀錄（{tasks.length} 項）</div>
                <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
                  {tasks.map((task,idx)=>(
                    <div key={task.id} style={{ padding:"12px 14px", background:C.bg, borderRadius:10, border:`1px solid ${C.border}` }}>
                      <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:task.description?6:0 }}>
                        <span style={{ fontSize:11, fontWeight:700, color:C.textLight }}>#{idx+1}</span>
                        <span style={{ fontSize:13, fontWeight:600, color:C.text }}>{task.name||"（未命名任務）"}</span>
                        <span style={{ marginLeft:"auto", fontSize:10, background:task.type==="deadline"?C.amberLight:C.greenLight,
                          color:task.type==="deadline"?C.amber:C.green,
                          border:`1px solid ${task.type==="deadline"?C.amber+"44":C.green+"44"}`,
                          borderRadius:5, padding:"2px 8px", fontWeight:600, whiteSpace:"nowrap" }}>
                          {task.type==="deadline"
                            ? `📌 ${task.deadline||"—"}`
                            : `📅 ${task.period_start||"—"} → ${task.period_end||"—"}`}
                        </span>
                      </div>
                      {task.description&&<div style={{ fontSize:12, color:C.textMid, lineHeight:1.6, marginLeft:34 }}>{task.description}</div>}
                    </div>
                  ))}
                </div>
              </div>
            )}
            <NavRow onBack={()=>setStep(3)}/>
          </div>
        )}
      </div>
    </div>
  );
};

// ─── Root ─────────────────────────────────────────────────────
export default function App() {
  const [page,     setPage]     = useState("home"); // "home" | "calendar"
  const [view,     setView]     = useState("home"); // "home" | "detail"
  const [projects, setProjects] = useState([]);
  const [allTasks, setAllTasks] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [isNew,    setIsNew]    = useState(false);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState(null);
  const saveTimer = useRef({});

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const { data:rows, error:e1 } = await sb.from("projects").select("*").order("created_at",{ ascending:false });
        if (e1) throw e1;
        const { data:progs, error:e2 } = await sb.from("project_progress").select("*");
        if (e2) throw e2;
        const { data:taskRows, error:e3 } = await sb.from("tasks").select("*").order("created_at",{ ascending:true });
        if (e3) throw e3;
        const progMap = Object.fromEntries((progs??[]).map(p=>[p.project_id,p]));
        const tasksByProject = {};
        (taskRows??[]).forEach(t => {
          if (!tasksByProject[t.project_id]) tasksByProject[t.project_id]=[];
          tasksByProject[t.project_id].push({ id:t.id, project_id:t.project_id, name:t.name||"", description:t.description||"", type:t.type||"deadline", deadline:t.deadline||"", period_start:t.period_start||"", period_end:t.period_end||"", url:t.url||"" });
        });
        const projs = (rows??[]).map(r=>({ ...dbToUi(r,progMap[r.id]), tasks:tasksByProject[r.id]||[] }));
        setProjects(projs);
        setAllTasks(taskRows??[]);
      } catch(err) { setError("無法連線到資料庫："+(err.message??err)); }
      finally { setLoading(false); }
    })();
  }, []);

  const handleNew = async () => {
    const proj = newProject();
    setProjects(prev=>[proj,...prev]);
    setActiveId(proj.id); setIsNew(true); setView("detail");
    try {
      const { project, progress } = uiToDb(proj);
      const { error:e1 } = await sb.from("projects").insert(project); if (e1) throw e1;
      const { error:e2 } = await sb.from("project_progress").insert(progress); if (e2) throw e2;
    } catch(err) { setError("新增專案失敗："+(err.message??err)); }
  };

  const handleUpdate = useCallback((updated) => {
    setProjects(prev=>prev.map(p=>p.id===updated.id?updated:p));
    // Sync tasks to global allTasks
    setAllTasks(prev=>{
      const filtered = prev.filter(t=>t.project_id!==updated.id);
      return [...filtered, ...(updated.tasks||[])];
    });
    if (saveTimer.current[updated.id]) clearTimeout(saveTimer.current[updated.id]);
    saveTimer.current[updated.id] = setTimeout(async () => {
      try {
        const { project, progress } = uiToDb(updated);
        const { error:e1 } = await sb.from("projects").upsert(project); if (e1) throw e1;
        const { error:e2 } = await sb.from("project_progress").upsert(progress,{ onConflict:"project_id" }); if (e2) throw e2;
      } catch(err) { setError("儲存失敗："+(err.message??err)); }
    }, 800);
  }, []);

  const handleDelete = useCallback(async (id) => {
    setProjects(prev=>prev.filter(p=>p.id!==id));
    setAllTasks(prev=>prev.filter(t=>t.project_id!==id));
    try {
      const { error:e } = await sb.from("projects").delete().eq("id",id); if (e) throw e;
    } catch(err) { setError("刪除失敗："+(err.message??err)); }
  }, []);

  const handleOpen = (id) => { setActiveId(id); setIsNew(false); setView("detail"); };
  const activeProject = projects.find(p=>p.id===activeId);
  const allPics = useMemo(()=>[...new Set(projects.map(p=>p.info.pic).filter(Boolean))].sort(),[projects]);

  if (loading) return (
    <div style={{ minHeight:"100vh", background:C.bg, display:"flex", flexDirection:"column",
      alignItems:"center", justifyContent:"center", fontFamily:"'Noto Sans TC',sans-serif", gap:16 }}>
      <style>{GLOBAL_CSS}</style>
      <div style={{ width:40, height:40, border:`3px solid ${C.blueBorder}`, borderTopColor:C.blue,
        borderRadius:"50%", animation:"spin 0.8s linear infinite" }}/>
      <div style={{ fontSize:14, color:C.textMid }}>載入專案資料中…</div>
    </div>
  );

  const isDetailView = view==="detail" && activeProject;

  return (
    <div style={{ minHeight:"100vh", background:C.bg, fontFamily:"'Noto Sans TC','Segoe UI',sans-serif" }}>
      <style>{GLOBAL_CSS}</style>

      {/* Global header — always visible */}
      {!isDetailView && (
        <div style={{ background:C.white, borderBottom:`1px solid ${C.border}`, position:"sticky", top:0, zIndex:10 }}>
          {/* Top bar */}
          <div style={{ padding:"0 40px", display:"flex", alignItems:"center", justifyContent:"space-between", height:60 }}>
            <div style={{ display:"flex", alignItems:"center", gap:10 }}>
              <div style={{ width:32, height:32, borderRadius:8, background:C.blue,
                display:"flex", alignItems:"center", justifyContent:"center", fontSize:16 }}>🏨</div>
              <span style={{ fontSize:17, fontWeight:700, color:C.text }}>專案交付中心</span>
            </div>
            <button onClick={handleNew} style={{ background:C.blue, color:"#fff", border:"none",
              borderRadius:10, padding:"9px 20px", fontSize:14, fontWeight:700,
              cursor:"pointer", fontFamily:"inherit", boxShadow:"0 2px 8px #1d4ed840" }}>
              + 新增專案
            </button>
          </div>
          {/* Page nav */}
          <div style={{ padding:"0 40px", display:"flex", borderTop:`1px solid ${C.border}` }}>
            {[{ id:"home", label:"🏠 專案列表" }, { id:"calendar", label:"📅 專案行事曆" }].map(({ id, label }) => (
              <button key={id} onClick={()=>setPage(id)}
                style={{ padding:"12px 20px", background:"none", border:"none", fontFamily:"inherit",
                  borderBottom:`2.5px solid ${page===id?C.blue:"transparent"}`,
                  color:page===id?C.blue:C.textLight, cursor:"pointer",
                  fontSize:13, fontWeight:page===id?700:500, transition:"all 0.15s" }}>
                {label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Error toast */}
      {error && (
        <div style={{ position:"fixed", bottom:24, left:"50%", transform:"translateX(-50%)",
          background:"#fef2f2", border:`1px solid ${C.red}44`, borderRadius:12,
          padding:"12px 20px", fontSize:13, color:C.red, zIndex:9999,
          boxShadow:"0 4px 16px #0000001a", display:"flex", alignItems:"center",
          gap:12, fontFamily:"inherit" }}>
          ⚠️ {error}
          <button onClick={()=>setError(null)} style={{ background:"none", border:"none",
            cursor:"pointer", color:C.red, fontWeight:700, fontSize:16, padding:0, lineHeight:1 }}>×</button>
        </div>
      )}

      {/* Content */}
      {isDetailView
        ? <ProjectDetail project={activeProject} isNew={isNew} onUpdate={handleUpdate} onBack={()=>setView("home")} allPics={allPics}/>
        : page==="calendar"
          ? <CalendarPage projects={projects} allTasks={allTasks} onTaskAdded={task => {
              setAllTasks(prev => [...prev, task]);
              setProjects(prev => prev.map(p => p.id===task.project_id
                ? { ...p, tasks:[...p.tasks, task] }
                : p
              ));
            }}/>
          : <HomePage projects={projects} onNew={handleNew} onOpen={handleOpen} onDelete={handleDelete}/>
      }
    </div>
  );
}
