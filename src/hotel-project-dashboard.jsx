import { useState, useMemo, useEffect, useCallback, useRef } from "react";
import { createClient } from "@supabase/supabase-js";

// ─── Supabase ─────────────────────────────────────────────────
const sb = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

// ─── Constants ────────────────────────────────────────────────
const PRODUCTS     = ["AVA", "AVT", "ACA", "TMSP", "GW", "KMS"];
const INTEGRATIONS = ["PBX", "PMS", "TMS", "RCU", "POS", "IPTV"];
const COUNTRIES    = ["台灣", "日本", "新加坡", "印尼", "馬來西亞", "澳洲", "美國", "其他"];
const PRODUCT_COLORS = {
  AVA:"var(--prod-ava)", AVT:"var(--prod-avt)", ACA:"var(--prod-aca)",
  TMSP:"var(--prod-tmsp)", GW:"var(--prod-gw)", KMS:"var(--prod-kms)"
};

const BASIC_ITEMS  = ["房型及機台擺放位置圖片","需申請後台權限的 email 帳號","樓層房號表及 WiFi 資訊","機台重啟（Check out）方式","是否需開啟打掃 & 勿擾功能","通話快捷鍵設定 & 分機提供","歡迎畫面背景","歡迎詞填寫","後台服務功能設定 & 送物 / 修繕項目清單","TMS Pro 設定"];
const FAQ_TV_ITEM  = "電視頻道設定（若串接項目不含 IPTV 則不用填寫）";
const FAQ_ITEMS    = ["飯店基本資訊","飯店內設施","飯店提供之服務","入住規則","備品清單",FAQ_TV_ITEM,"特別推薦美食景點"];
const ACA_ITEM     = "轉接情境與歡迎詞設定";
const ACA_LINK_KEY = "acaScenario";
const BATCH2_ITEMS     = ["機台 Showcase 設定","廣告設定","Pop-up QR code 內容設定"];
const BATCH2_LINK_KEYS = ["showcase","ad","popupQR"];
const GW_ITEM     = "GuestWeb 內容建置";
const GW_LINK_KEY = "guestWeb";

// Calendar event type colours — CSS var based for dark mode
const CAL_COLORS = {
  launch:    { bg:"var(--cal-launch-bg)",  text:"var(--cal-launch-text)",  border:"var(--cal-launch-border)" },
  batch1:    { bg:"var(--cal-batch1-bg)",  text:"var(--cal-batch1-text)",  border:"var(--cal-batch1-border)" },
  batch2:    { bg:"var(--cal-batch2-bg)",  text:"var(--cal-batch2-text)",  border:"var(--cal-batch2-border)" },
  taskDL:    { bg:"var(--cal-task-bg)",    text:"var(--cal-task-text)",    border:"var(--cal-task-border)"   },
  taskPeriod:{ bg:"var(--cal-period-bg)",  text:"var(--cal-period-text)",  border:"var(--cal-period-border)" },
};

// ─── Theme — all values are CSS variable references ───────────
const C = {
  bg:         "var(--bg)",
  white:      "var(--surface)",
  border:     "var(--border)",
  borderMid:  "var(--border-mid)",
  text:       "var(--text)",
  textMid:    "var(--text-mid)",
  textLight:  "var(--text-subtle)",
  blue:       "var(--accent)",
  blueLight:  "var(--accent-light)",
  blueBorder: "var(--accent-border)",
  green:      "var(--green)",
  greenLight: "var(--green-light)",
  amber:      "var(--amber)",
  amberLight: "var(--amber-light)",
  purple:     "var(--purple)",
  purpleLight:"var(--purple-light)",
  red:        "var(--red)",
};

const baseInput = {
  width:"100%", background:"var(--surface)", border:"1px solid var(--border)",
  borderRadius:8, color:"var(--text)", padding:"9px 12px", fontSize:14,
  outline:"none", fontFamily:"inherit", boxSizing:"border-box", transition:"border-color 0.15s",
};

const GLOBAL_CSS = `
  @import url('https://fonts.googleapis.com/css2?family=DM+Mono:wght@400;500&family=Inter:wght@400;500;600;700&family=Noto+Sans+TC:wght@300;400;500;700&display=swap');

  :root {
    --bg: #F5F5F5;
    --surface: #FFFFFF;
    --surface-raised: #FAFAFA;
    --border: #E5E5E5;
    --border-mid: #D4D4D4;
    --text: #111111;
    --text-mid: #6B6B6B;
    --text-subtle: #A3A3A3;
    --accent: #E8621A;
    --accent-light: #FFF4EE;
    --accent-border: rgba(232,98,26,0.25);
    --accent-subtle: rgba(232,98,26,0.07);
    --green: #16A34A;
    --green-light: #F0FDF4;
    --green-subtle: rgba(22,163,74,0.08);
    --amber: #B45309;
    --amber-light: #FFFBEB;
    --amber-subtle: rgba(180,83,9,0.08);
    --red: #DC2626;
    --red-light: #FEF2F2;
    --red-subtle: rgba(220,38,38,0.07);
    --purple: #7C3AED;
    --purple-light: #F5F3FF;
    --purple-subtle: rgba(124,58,237,0.07);
    --shadow-sm: 0 1px 2px rgba(0,0,0,0.05);
    --shadow: 0 1px 3px rgba(0,0,0,0.07), 0 1px 2px rgba(0,0,0,0.04);
    --cal-launch-bg: #DBEAFE; --cal-launch-text: #1E40AF; --cal-launch-border: #93C5FD;
    --cal-batch1-bg: #DCFCE7; --cal-batch1-text: #166534; --cal-batch1-border: #86EFAC;
    --cal-batch2-bg: #F3E8FF; --cal-batch2-text: #6B21A8; --cal-batch2-border: #D8B4FE;
    --cal-task-bg:   #FEF3C7; --cal-task-text:   #92400E; --cal-task-border:   #FCD34D;
    --cal-period-bg: #FFE4E6; --cal-period-text:  #9F1239; --cal-period-border: #FCA5A5;
    --prod-ava:#1e6fb5; --prod-avt:#0891b2; --prod-aca:#0e7a5a;
    --prod-tmsp:#7c3aed; --prod-gw:#b45309; --prod-kms:#be185d;
  }

  @media (prefers-color-scheme: dark) {
    :root {
      --bg: #17171E;
      --surface: #21212B;
      --surface-raised: #2A2A36;
      --border: #32323F;
      --border-mid: #42424F;
      --text: #EDEDED;
      --text-mid: #A3A3A3;
      --text-subtle: #6B6B6B;
      --accent: #F4873D;
      --accent-light: #2A1A0A;
      --accent-border: rgba(244,135,61,0.3);
      --accent-subtle: rgba(244,135,61,0.08);
      --green: #22C55E;
      --green-light: #052E16;
      --green-subtle: rgba(34,197,94,0.1);
      --amber: #F59E0B;
      --amber-light: #1C1200;
      --amber-subtle: rgba(245,158,11,0.1);
      --red: #EF4444;
      --red-light: #2D0F0F;
      --red-subtle: rgba(239,68,68,0.1);
      --purple: #A78BFA;
      --purple-light: #1E0A3C;
      --purple-subtle: rgba(167,139,250,0.1);
      --shadow-sm: 0 1px 2px rgba(0,0,0,0.4);
      --shadow: 0 1px 3px rgba(0,0,0,0.5), 0 1px 2px rgba(0,0,0,0.4);
      --cal-launch-bg: #1A2744; --cal-launch-text: #93C5FD; --cal-launch-border: #1E3A6E;
      --cal-batch1-bg: #0A2E1A; --cal-batch1-text: #86EFAC; --cal-batch1-border: #14532D;
      --cal-batch2-bg: #1E0A3C; --cal-batch2-text: #D8B4FE; --cal-batch2-border: #4C1D95;
      --cal-task-bg:   #2A1C00; --cal-task-text:   #FCD34D; --cal-task-border:   #78350F;
      --cal-period-bg: #2D0A14; --cal-period-text:  #FCA5A5; --cal-period-border: #881337;
      --prod-ava:#4d90d4; --prod-avt:#22c4de; --prod-aca:#22a474;
      --prod-tmsp:#a78bfa; --prod-gw:#f59e0b; --prod-kms:#e879a0;
    }
  }

  *, *::before, *::after { box-sizing: border-box; }
  body { margin: 0; background: var(--bg); color: var(--text);
    font-family: 'Inter', 'Noto Sans TC', sans-serif; font-weight: 400; }
  :lang(zh), :lang(zh-TW) { font-family: 'Noto Sans TC', 'Inter', sans-serif; font-weight: 300; }
  ::-webkit-scrollbar { width: 5px; }
  ::-webkit-scrollbar-track { background: transparent; }
  ::-webkit-scrollbar-thumb { background: var(--border-mid); border-radius: 3px; }
  input[type="date"]::-webkit-calendar-picker-indicator { cursor: pointer; }
  @media (prefers-color-scheme: dark) {
    input[type="date"]::-webkit-calendar-picker-indicator { filter: invert(0.7); }
    select option { background: var(--surface); color: var(--text); }
  }
  @keyframes fadeIn { from { opacity:0; transform:translateY(6px); } to { opacity:1; transform:none; } }
  @keyframes spin   { to { transform: rotate(360deg); } }

  /* Manual theme overrides — higher specificity than media query */
  html[data-theme="light"] {
    --bg: #F5F5F5; --surface: #FFFFFF; --surface-raised: #FAFAFA;
    --border: #E5E5E5; --border-mid: #D4D4D4;
    --text: #111111; --text-mid: #6B6B6B; --text-subtle: #A3A3A3;
    --accent: #E8621A; --accent-light: #FFF4EE;
    --accent-border: rgba(232,98,26,0.25); --accent-subtle: rgba(232,98,26,0.07);
    --green: #16A34A; --green-light: #F0FDF4; --green-subtle: rgba(22,163,74,0.08);
    --amber: #B45309; --amber-light: #FFFBEB; --amber-subtle: rgba(180,83,9,0.08);
    --red: #DC2626; --red-light: #FEF2F2; --red-subtle: rgba(220,38,38,0.07);
    --purple: #7C3AED; --purple-light: #F5F3FF; --purple-subtle: rgba(124,58,237,0.07);
    --shadow-sm: 0 1px 2px rgba(0,0,0,0.05);
    --shadow: 0 1px 3px rgba(0,0,0,0.07), 0 1px 2px rgba(0,0,0,0.04);
    --cal-launch-bg: #DBEAFE; --cal-launch-text: #1E40AF; --cal-launch-border: #93C5FD;
    --cal-batch1-bg: #DCFCE7; --cal-batch1-text: #166534; --cal-batch1-border: #86EFAC;
    --cal-batch2-bg: #F3E8FF; --cal-batch2-text: #6B21A8; --cal-batch2-border: #D8B4FE;
    --cal-task-bg: #FEF3C7; --cal-task-text: #92400E; --cal-task-border: #FCD34D;
    --cal-period-bg: #FFE4E6; --cal-period-text: #9F1239; --cal-period-border: #FCA5A5;
    --prod-ava:#1e6fb5; --prod-avt:#0891b2; --prod-aca:#0e7a5a;
    --prod-tmsp:#7c3aed; --prod-gw:#b45309; --prod-kms:#be185d;
  }
  html[data-theme="dark"] {
    --bg: #17171E; --surface: #21212B; --surface-raised: #2A2A36;
    --border: #32323F; --border-mid: #42424F;
    --text: #EDEDED; --text-mid: #A3A3A3; --text-subtle: #6B6B6B;
    --accent: #F4873D; --accent-light: #2A1A0A;
    --accent-border: rgba(244,135,61,0.3); --accent-subtle: rgba(244,135,61,0.08);
    --green: #22C55E; --green-light: #052E16; --green-subtle: rgba(34,197,94,0.1);
    --amber: #F59E0B; --amber-light: #1C1200; --amber-subtle: rgba(245,158,11,0.1);
    --red: #EF4444; --red-light: #2D0F0F; --red-subtle: rgba(239,68,68,0.1);
    --purple: #A78BFA; --purple-light: #1E0A3C; --purple-subtle: rgba(167,139,250,0.1);
    --shadow-sm: 0 1px 2px rgba(0,0,0,0.4);
    --shadow: 0 1px 3px rgba(0,0,0,0.5), 0 1px 2px rgba(0,0,0,0.4);
    --cal-launch-bg: #1A2744; --cal-launch-text: #93C5FD; --cal-launch-border: #1E3A6E;
    --cal-batch1-bg: #0A2E1A; --cal-batch1-text: #86EFAC; --cal-batch1-border: #14532D;
    --cal-batch2-bg: #1E0A3C; --cal-batch2-text: #D8B4FE; --cal-batch2-border: #4C1D95;
    --cal-task-bg: #2A1C00; --cal-task-text: #FCD34D; --cal-task-border: #78350F;
    --cal-period-bg: #2D0A14; --cal-period-text: #FCA5A5; --cal-period-border: #881337;
    --prod-ava:#4d90d4; --prod-avt:#22c4de; --prod-aca:#22a474;
    --prod-tmsp:#a78bfa; --prod-gw:#f59e0b; --prod-kms:#e879a0;
  }
  html[data-theme="dark"] input[type="date"]::-webkit-calendar-picker-indicator { filter: invert(0.7); }
  html[data-theme="dark"] select option { background: #1C1C1C; color: #EDEDED; }
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
  is_internal: true,
});

// ─── DB ↔ UI ──────────────────────────────────────────────────
const dbToUi = (row, prog) => ({
  id: row.id,
  updatedAt: prog?.updated_at ?? row.updated_at ?? null,
  info: {
    name: row.name ?? "", hotelId: row.hotel_id ?? "",
    address: row.address ?? "", region: row.region ?? "", regionOther: row.region_other ?? "",
    products: row.products ?? [], avaUnits: row.ava_units ?? "", avaSpare: row.ava_spare ?? "", avtUnits: row.avt_units ?? "",
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
    products: p.info.products, ava_units: p.info.avaUnits, ava_spare: p.info.avaSpare, avt_units: p.info.avtUnits,
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
    products:[], avaUnits:"", avaSpare:"", avtUnits:"", integrations:[], integrationNotes:{},
    launchDate:"", batch1Deadline:"", batch2Deadline:"", notes:"", pic:"", jiraEpic:"",
  },
  basicChecked:{}, basicNotes:{}, faqChecked:{}, faqNotes:{},
  batch2Checked:{}, batch2Notes:{},
  sheetLinks:{ basic:"", faq:"", showcase:"", ad:"", popupQR:"", guestWeb:"", acaScenario:"" },
  tasks:[],
});

// ─── Shared UI components ─────────────────────────────────────

// Linear-style thin progress bar (replaces Ring)
const LinearProgress = ({ pct, color }) => (
  <div style={{ height:3, background:"var(--border)", borderRadius:2, overflow:"hidden", width:"100%" }}>
    <div style={{ height:"100%", borderRadius:2, background:color, width:`${pct}%`, transition:"width 0.5s ease" }}/>
  </div>
);

const ProgressCard = ({ label, checked, total, color }) => {
  const pct = total===0 ? 0 : Math.round((checked/total)*100);
  return (
    <div style={{ background:"var(--surface)", border:"1px solid var(--border)", borderRadius:12,
      padding:"16px 20px", flex:1, minWidth:150 }}>
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:10 }}>
        <span style={{ fontSize:11, letterSpacing:1.2, color:"var(--text-subtle)", textTransform:"uppercase", fontWeight:600 }}>{label}</span>
        <span style={{ fontSize:13, fontWeight:700, color, fontFamily:"'DM Mono',monospace" }}>{pct}%</span>
      </div>
      <LinearProgress pct={pct} color={color}/>
      <div style={{ display:"flex", justifyContent:"space-between", marginTop:8 }}>
        <span style={{ fontSize:12, color:"var(--text-subtle)", fontFamily:"'DM Mono',monospace" }}>{checked}/{total}</span>
        <span style={{ fontSize:11, color:total-checked===0?color:"var(--text-subtle)", fontWeight:total-checked===0?600:400 }}>
          {total-checked===0 ? "✓ 完成" : `剩 ${total-checked} 項`}
        </span>
      </div>
    </div>
  );
};

// ─── SVG Icons（線框風格，strokeWidth=1.6）─────────────────────
const Icon = ({ d, size=16, color="currentColor", fill="none", strokeWidth=1.6, style={} }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill={fill}
    stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" style={style}>
    <path d={d}/>
  </svg>
);

// 常用 icon paths
const ICONS = {
  folder:     "M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7z",
  warning:    "M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z M12 9v4 M12 17h.01",
  rocket:     "M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z M12 15l-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0 M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5",
  check:      "M20 6L9 17l-5-5",
  bell:       "M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9 M13.73 21a2 2 0 0 1-3.46 0",
  calendar:   "M3 4h18v18H3z M3 9h18 M8 2v4 M16 2v4",
  search:     "M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16z M21 21l-4.35-4.35",
  filter:     "M22 3H2l8 9.46V19l4 2v-8.54L22 3z",
  sort:       "M3 6h18 M7 12h10 M10 18h4",
  user:       "M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2 M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z",
  pin:        "M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z M12 10a1 1 0 1 0 0-2 1 1 0 0 0 0 2z",
  link:       "M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71 M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71",
  chevronR:   "M9 18l6-6-6-6",
  tag:        "M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z M7 7h.01",
  grid:       "M3 3h7v7H3z M14 3h7v7h-7z M14 14h7v7h-7z M3 14h7v7H3z",
  trash:      "M3 6h18 M8 6V4h8v2 M19 6l-1 14H6L5 6",
  jira:       "M11.571 11.429L6.857 6.714A6 6 0 0 1 17.143 17l-5.572-5.571zm.858.857L17.143 17A6 6 0 0 1 6.857 6.714l5.572 5.572z",
  home:       "M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z M9 22V12h6v10",
  sun:        "M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0z",
  moon:       "M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z",
  monitor:    "M2 3h20a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1H2a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z M8 21h8 M12 17v4",
  send:       "M22 2L11 13 M22 2l-7 20-4-9-9-4 20-7z",
  msgSquare:  "M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z",
  pencil:     "M12 20h9 M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4 9.5-9.5z",
  sparkle:     "M12 2l3 6.5L22 10l-5 4.5L18.5 22 12 19l-6.5 3L7 14.5 2 10l7-1.5L12 2z",
  building:    "M3 21h18 M5 21V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16 M9 21v-4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v4 M9 7h1 M14 7h1 M9 11h1 M14 11h1",
  mail:         "M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z M22 6l-10 7L2 6",
  package:     "M16.5 9.4l-9-5.19 M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z M3.27 6.96L12 12.01l8.73-5.05 M12 22.08V12",
  fileText:    "M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z M14 2v6h6 M16 13H8 M16 17H8 M10 9H8",
  bellOff:     "M13.73 21a2 2 0 0 1-3.46 0 M18.63 13A17.89 17.89 0 0 1 18 8 M6.26 6.26A5.86 5.86 0 0 0 6 8c0 7-3 9-3 9h14 M18 8a6 6 0 0 0-9.33-5 M1 1l22 22",
  clipboardList:"M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2 M15 2H9a1 1 0 0 0-1 1v2a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V3a1 1 0 0 0-1-1z M9 12h6 M9 16h4",
  repeat:      "M17 2l4 4-4 4 M3 11V9a4 4 0 0 1 4-4h14 M7 22l-4-4 4-4 M21 13v2a4 4 0 0 1-4 4H3",
  lock:        "M19 11H5a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7a2 2 0 0 0-2-2z M7 11V7a5 5 0 0 1 10 0v4",
  refresh:     "M23 4v6h-6 M1 20v-6h6 M3.51 9a9 9 0 0 1 14.85-3.36L23 10 M1 14l4.64 4.36A9 9 0 0 0 20.49 15",
};

// 語意化 icon 元件
const Ico = ({ name, size=16, color="currentColor", strokeWidth=1.6, style={} }) => (
  <Icon d={ICONS[name]||""} size={size} color={color} strokeWidth={strokeWidth} style={style}/>
);

const MiniBar = ({ pct, color }) => (
  <div style={{ height:4, background:"var(--border)", borderRadius:2, overflow:"hidden", flex:1 }}>
    <div style={{ height:"100%", borderRadius:2, background:color, width:`${pct}%`, transition:"width 0.5s ease" }}/>
  </div>
);

const Card = ({ children, style={} }) => (
  <div style={{ background:"var(--surface)", border:"1px solid var(--border)", borderRadius:12,
    padding:24, marginBottom:16, ...style }}>
    {children}
  </div>
);

const SectionLabel = ({ title, icon, color="var(--accent)" }) => (
  <div style={{ fontSize:11, letterSpacing:1.5, color, textTransform:"uppercase", marginBottom:12,
    display:"flex", alignItems:"center", gap:6, fontWeight:600 }}>
    {icon && <Ico name={icon} size={12} color="currentColor"/>}{title}
  </div>
);

const SectionCount = ({ title, checked, total, color }) => (
  <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:14 }}>
    <div style={{ fontSize:15, fontWeight:600, color:"var(--text)" }}>{title}</div>
    <div style={{ border:"1px solid var(--border)", borderRadius:8, padding:"4px 12px", background:"var(--surface-raised)" }}>
      <span style={{ fontSize:16, fontWeight:700, color, fontFamily:"'DM Mono',monospace" }}>{checked}</span>
      <span style={{ fontSize:12, color:"var(--text-subtle)" }}>/{total}</span>
    </div>
  </div>
);

// RichText: 支援 markdown 列表（- / 1.）、粗體、斜體、行內代碼、超連結
function renderRichText(text) {
  if (!text) return "";
  // HTML escape
  let h = text
    .replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
  // Markdown links [label](url) → <a>
  h = h.replace(/\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g,
    '<a href="$2" target="_blank" rel="noreferrer" style="color:var(--accent);text-decoration:underline;font-weight:500">$1</a>');
  // Headers
  h = h.replace(/^### (.+)$/gm,"<div style='font-size:13px;font-weight:700;margin:8px 0 3px;color:var(--text)'>$1</div>");
  h = h.replace(/^## (.+)$/gm, "<div style='font-size:14px;font-weight:700;margin:10px 0 4px;color:var(--text)'>$1</div>");
  // Lists
  const lines = h.split("\n"), out = [];
  let inUL=false, inOL=false;
  for (const raw of lines) {
    const ul=raw.match(/^[-•]\s+(.+)$/), ol=raw.match(/^(\d+)\.\s+(.+)$/);
    if (ul) {
      if (inOL){out.push("</ol>");inOL=false;}
      if (!inUL){out.push("<ul style='margin:5px 0;padding-left:0;list-style:none'>");inUL=true;}
      out.push(`<li style='display:flex;gap:6px;margin:2px 0'><span style='color:var(--text-subtle);flex-shrink:0'>·</span><span>${ul[1]}</span></li>`);
    } else if (ol) {
      if (inUL){out.push("</ul>");inUL=false;}
      if (!inOL){out.push("<ol style='margin:5px 0;padding-left:18px'>");inOL=true;}
      out.push(`<li style='margin:2px 0'>${ol[2]}</li>`);
    } else {
      if (inUL){out.push("</ul>");inUL=false;}
      if (inOL){out.push("</ol>");inOL=false;}
      out.push(raw===""?"<br/>":raw);
    }
  }
  if (inUL) out.push("</ul>");
  if (inOL) out.push("</ol>");
  h = out.join("\n");
  // Inline
  h = h.replace(/\*\*(.+?)\*\*/g,"<strong>$1</strong>");
  h = h.replace(/\*([^*\n]+?)\*/g,"<em>$1</em>");
  h = h.replace(/`([^`\n]+)`/g,"<code style='background:var(--surface-raised);padding:1px 5px;border-radius:4px;font-family:DM Mono,monospace;font-size:0.88em'>$1</code>");
  h = h.replace(/([^\n])\n([^\n<])/g,"$1<br/>$2");
  return h;
}

const RichText = ({ text, style:s={} }) => {
  if (!text) return null;
  return <div style={{ lineHeight:1.7, ...s }} dangerouslySetInnerHTML={{ __html: renderRichText(text) }}/>;
};

const FInput = ({ label, value, onChange, placeholder, type="text", focusColor="var(--accent)" }) => (
  <div style={{ marginBottom:16 }}>
    <label style={{ display:"block", fontSize:11, letterSpacing:1.4, color:"var(--text-subtle)",
      textTransform:"uppercase", marginBottom:6, fontWeight:600 }}>{label}</label>
    <input type={type} value={value} onChange={e=>onChange(e.target.value)}
      placeholder={placeholder} style={baseInput}
      onFocus={e=>(e.target.style.borderColor=focusColor)}
      onBlur={e=>(e.target.style.borderColor="var(--border)")}/>
  </div>
);

const Chip = ({ label, active, onClick, color="var(--accent)" }) => (
  <button onClick={onClick} style={{ padding:"5px 13px", borderRadius:6, fontFamily:"inherit",
    border:`1px solid ${active?color:"var(--border)"}`, background:active?color:"transparent",
    color:active?"#fff":"var(--text-mid)", cursor:"pointer", fontSize:13, fontWeight:500, transition:"all 0.12s" }}>
    {label}
  </button>
);

// CheckRow: simplified — checked always green-subtle, no red unchecked state
const CheckRow = ({ label, checked, onChange, color="var(--green)" }) => (
  <div onClick={onChange} style={{ display:"flex", alignItems:"center", gap:10, padding:"9px 12px",
    borderRadius:8, cursor:"pointer", marginBottom:4,
    background: checked ? "var(--green-subtle)" : "transparent",
    border: `1px solid ${checked ? "var(--green)" : "var(--border)"}`,
    transition:"all 0.12s" }}>
    <div style={{ width:17, height:17, borderRadius:4, flexShrink:0,
      border:`1.5px solid ${checked ? "var(--green)" : "var(--border-mid)"}`,
      background: checked ? "var(--green)" : "transparent",
      display:"flex", alignItems:"center", justifyContent:"center", transition:"all 0.12s" }}>
      {checked && <span style={{ color:"#fff", fontSize:10, fontWeight:700 }}>✓</span>}
    </div>
    <span style={{ fontSize:13, color: checked ? "var(--text)" : "var(--text-mid)", flex:1 }}>{label}</span>
    {!checked && <span style={{ fontSize:10, color:"var(--text-subtle)", fontWeight:500 }}>待完成</span>}
  </div>
);

const NoteArea = ({ value, onChange, focusColor="var(--accent)" }) => (
  <textarea value={value} onChange={e=>onChange(e.target.value)}
    placeholder="補充說明進行狀況或缺少項目…" rows={2}
    style={{ ...baseInput, marginTop:4, fontSize:12, color:"var(--text-mid)",
      resize:"vertical", minHeight:52, background:"var(--surface-raised)" }}
    onFocus={e=>(e.target.style.borderColor=focusColor)}
    onBlur={e=>(e.target.style.borderColor="var(--border)")}/>
);

const SheetLink = ({ value, onChange, color="var(--accent)" }) => {
  const invalid = value.length>0 && !value.startsWith("http");
  return (
    <div style={{ marginTop:12, padding:"11px 13px", background:"var(--accent-subtle)",
      border:`1px solid ${invalid?"var(--red)":"var(--accent-border)"}`, borderRadius:10 }}>
      <label style={{ display:"flex", alignItems:"center", gap:5, fontSize:11, letterSpacing:1.2,
        color:"var(--accent)", textTransform:"uppercase", marginBottom:7, fontWeight:600 }}><Ico name="link" size={11} color="currentColor"/> 檔案連結</label>
      <input type="url" value={value} onChange={e=>onChange(e.target.value)}
        placeholder="貼上 Excel 檔案連結或其他資料表連結"
        style={{ ...baseInput, borderColor:invalid?"var(--red)":"var(--border)" }}
        onFocus={e=>(e.target.style.borderColor=invalid?"var(--red)":"var(--accent)")}
        onBlur={e=>(e.target.style.borderColor=invalid?"var(--red)":"var(--border)")}/>
      {invalid && <div style={{ marginTop:5, fontSize:11, color:"var(--red)" }}>⚠️ 連結格式不正確，請確認是否以 http 或 https 開頭</div>}
      {!invalid && value && <a href={value} target="_blank" rel="noreferrer"
        style={{ display:"inline-flex", alignItems:"center", gap:4, marginTop:7,
          fontSize:12, color:"var(--accent)", textDecoration:"none", fontWeight:600 }}>↗ 開啟連結</a>}
    </div>
  );
};

const NavRow = ({ onBack, onNext, nextLabel, nextColor="var(--accent)" }) => (
  <div style={{ display:"flex", justifyContent:onBack?"space-between":"flex-end" }}>
    {onBack && <button onClick={onBack} style={{ background:"transparent", color:"var(--text-mid)",
      border:"1px solid var(--border)", borderRadius:8, padding:"9px 20px",
      fontSize:13, cursor:"pointer", fontFamily:"inherit" }}>← 返回</button>}
    {onNext && <button onClick={onNext} style={{ background:nextColor, color:"#fff", border:"none",
      borderRadius:8, padding:"9px 22px", fontSize:13, fontWeight:600,
      cursor:"pointer", fontFamily:"inherit" }}>{nextLabel}</button>}
  </div>
);

// Read-only overview check row
const OvCheckRow = ({ label, checked, note, color }) => (
  <div style={{ borderBottom:"1px solid var(--border)" }}>
    <div style={{ display:"flex", alignItems:"flex-start", gap:8, padding:"7px 0" }}>
      <span style={{ fontSize:12, color:checked?color:"var(--border-mid)", flexShrink:0, marginTop:2, fontWeight:700 }}>{checked?"✓":"○"}</span>
      <div style={{ flex:1, minWidth:0 }}>
        <span style={{ fontSize:12, color:checked?"var(--text)":"var(--text-subtle)", lineHeight:1.5 }}>{label}</span>
        {note && <div style={{ marginTop:4, padding:"5px 9px", background:"var(--bg)",
          border:"1px solid var(--border)", borderRadius:6, fontSize:11, color:"var(--text-mid)",
          lineHeight:1.6, whiteSpace:"pre-wrap" }}>{note}</div>}
      </div>
    </div>
  </div>
);

const OvCard = ({ title, color, children, linkKey, sheetLinks }) => (
  <div style={{ background:"var(--surface)", border:"1px solid var(--border)", borderRadius:12, padding:16 }}>
    <div style={{ fontSize:11, letterSpacing:1.4, color, textTransform:"uppercase", marginBottom:12, fontWeight:600 }}>{title}</div>
    {children}
    {linkKey && sheetLinks[linkKey] && (
      <a href={sheetLinks[linkKey]} target="_blank" rel="noreferrer"
        style={{ display:"inline-flex", alignItems:"center", gap:5, marginTop:12,
          fontSize:12, color:"var(--accent)", textDecoration:"none", fontWeight:600,
          background:"var(--accent-subtle)", border:"1px solid var(--accent-border)",
          borderRadius:6, padding:"4px 10px" }}>
        <Ico name="link" size={12} color="currentColor"/> 開啟資料表
      </a>
    )}
  </div>
);

const OvBatch2Row = ({ item, checked, note, linkKey, sheetLinks }) => {
  const done=!!checked, hasNote=note&&note.trim();
  return (
    <div style={{ background:done?"var(--purple-subtle)":"transparent",
      border:`1px solid ${done?"var(--purple)":"var(--border)"}`, borderRadius:10, padding:"11px 13px" }}>
      <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:(hasNote||sheetLinks[linkKey])?7:0 }}>
        <span style={{ fontSize:12, color:done?"var(--purple)":"var(--border-mid)", fontWeight:700 }}>{done?"✓":"○"}</span>
        <span style={{ fontSize:13, color:done?"var(--text)":"var(--text-subtle)", fontWeight:done?600:400 }}>{item}</span>
      </div>
      {hasNote && <div style={{ margin:"5px 0 7px 20px", padding:"5px 9px", background:"var(--bg)",
        border:"1px solid var(--border)", borderRadius:6, fontSize:11, color:"var(--text-mid)",
        lineHeight:1.6, whiteSpace:"pre-wrap" }}>{note}</div>}
      {sheetLinks[linkKey] && <div style={{ marginLeft:20 }}>
        <a href={sheetLinks[linkKey]} target="_blank" rel="noreferrer"
          style={{ fontSize:11, color:"var(--purple)", textDecoration:"none", fontWeight:600,
            background:"var(--purple-subtle)", border:"1px solid var(--purple)",
            borderRadius:5, padding:"2px 9px", display:"inline-flex", alignItems:"center", gap:4 }}><Ico name="link" size={11} color="currentColor"/> 連結</a>
      </div>}
    </div>
  );
};

// Dropdown filter
const FilterSelect = ({ label, value, onChange, options }) => (
  <div style={{ display:"flex", flexDirection:"column", gap:4 }}>
    {label && <label style={{ fontSize:11, color:"var(--text-subtle)", fontWeight:600, letterSpacing:1, textTransform:"uppercase" }}>{label}</label>}
    <select value={value} onChange={e=>onChange(e.target.value)}
      style={{ ...baseInput, width:"auto", minWidth:110, padding:"7px 28px 7px 10px", fontSize:13,
        borderRadius:8, cursor:"pointer", appearance:"none",
        backgroundImage:`url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='11' height='11' viewBox='0 0 12 12'%3E%3Cpath fill='%236B6B6B' d='M6 8L1 3h10z'/%3E%3C/svg%3E")`,
        backgroundRepeat:"no-repeat", backgroundPosition:"right 8px center" }}
      onFocus={e=>(e.target.style.borderColor="var(--accent)")} onBlur={e=>(e.target.style.borderColor="var(--border)")}>
      {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  </div>
);

// ─── ThemeToggle ──────────────────────────────────────────────
const THEME_OPTIONS = [
  { value:"light",  label:"普通", icoName:"sun"     },
  { value:"dark",   label:"深色", icoName:"moon"    },
  { value:"system", label:"系統", icoName:"monitor" },
];

const ThemeToggle = ({ theme, setTheme }) => (
  <div style={{ display:"flex", alignItems:"center", background:"var(--surface-raised)",
    border:"1px solid var(--border)", borderRadius:9, padding:3, gap:2, height:36 }}>
    {THEME_OPTIONS.map(({ value, label, icoName }) => {
      const active = theme === value;
      return (
        <button key={value} onClick={() => setTheme(value)}
          title={label}
          style={{ display:"flex", alignItems:"center", gap:5, padding:"0 10px",
            height:28, borderRadius:6, border:"none", fontFamily:"inherit", cursor:"pointer",
            background: active ? "var(--surface)" : "transparent",
            color: active ? "var(--text)" : "var(--text-subtle)",
            fontSize:12, fontWeight: active ? 600 : 400,
            boxShadow: active ? "var(--shadow-sm)" : "none",
            transition:"all 0.12s" }}>
          <Ico name={icoName} size={13} color="currentColor"/>
          <span>{label}</span>
        </button>
      );
    })}
  </div>
);

// ─── Web Push helpers ─────────────────────────────────────────
const VAPID_PUBLIC_KEY = "BMOXcSXV84orS-yHbUFFfB3FGT495QlvSryCMh5rCmkLvUFrPv6iZsGPtUUD56pjdHazRvn4yxAk4QzWLyg-ABU";

function urlBase64ToUint8Array(b64) {
  const pad = "=".repeat((4 - b64.length % 4) % 4);
  const b = (b64 + pad).replace(/-/g,"+").replace(/_/g,"/");
  return Uint8Array.from([...atob(b)].map(c=>c.charCodeAt(0)));
}
function subToKeys(sub) {
  const p256dh = btoa(String.fromCharCode(...new Uint8Array(sub.getKey("p256dh")))).replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/,"");
  const auth   = btoa(String.fromCharCode(...new Uint8Array(sub.getKey("auth")))).replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/,"");
  return { endpoint:sub.endpoint, p256dh, auth };
}
async function getOrCreateSub(picName, userId = null) {
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) return null;
  const reg = await navigator.serviceWorker.register("/sw.js");
  let pushSub = await reg.pushManager.getSubscription();
  if (!pushSub) {
    if (Notification.permission !== "granted") {
      const perm = await Notification.requestPermission();
      if (perm !== "granted") return null;
    }
    pushSub = await reg.pushManager.subscribe({ userVisibleOnly:true, applicationServerKey:urlBase64ToUint8Array(VAPID_PUBLIC_KEY) });
  }
  const keys = subToKeys(pushSub);
  const { data:existing } = await sb.from("push_subscriptions").select("*").eq("endpoint",keys.endpoint).maybeSingle();
  if (existing) return existing;
  const { data:created } = await sb.from("push_subscriptions").insert({
    pic_name:picName, user_id:userId, ...keys, subscribed_projects:[], notify_days_before:0
  }).select().single();
  return created;
}
async function updateSub(id, patch) {
  const { data } = await sb.from("push_subscriptions").update(patch).eq("id",id).select().single();
  return data;
}
async function deleteSub(id) {
  const reg = await navigator.serviceWorker.getRegistration("/sw.js");
  if (reg) { const s = await reg.pushManager.getSubscription(); if (s) await s.unsubscribe(); }
  await sb.from("push_subscriptions").delete().eq("id",id);
}

const NOTIFY_OPTIONS = [
  { label:"當日提醒", value:0 },
  { label:"提前 1 天", value:1 },
  { label:"提前 3 天", value:3 },
  { label:"提前 7 天", value:7 },
];

const NotificationPanel = ({ projects, session, profile, onClose }) => {
  const [sub,     setSub]     = useState(null);
  const [loading, setLoading] = useState(false);
  const [status,  setStatus]  = useState(""); // "" | "unsupported" | "denied"

  const displayName = profile?.display_name || session?.user?.email || "";
  const userId      = session?.user?.id ?? null;

  useEffect(() => {
    if (!("Notification" in window)||!("serviceWorker" in navigator)) { setStatus("unsupported"); return; }
    if (Notification.permission==="denied") { setStatus("denied"); return; }
    (async()=>{
      const reg = await navigator.serviceWorker.getRegistration("/sw.js");
      if (reg) {
        const pushSub = await reg.pushManager.getSubscription();
        if (pushSub) {
          const { data } = await sb.from("push_subscriptions").select("*").eq("endpoint",pushSub.endpoint).maybeSingle();
          if (data) { setSub(data); return; }
        }
      }
      // Fallback：用 user_id 查詢（換裝置時仍能恢復設定）
      if (userId) {
        const { data } = await sb.from("push_subscriptions").select("*").eq("user_id",userId).maybeSingle();
        if (data) setSub(data);
      }
    })();
  }, []);

  const handleSubscribe = async () => {
    setLoading(true);
    const result = await getOrCreateSub(displayName, userId);
    if (!result) setStatus("denied");
    else setSub(result);
    setLoading(false);
  };

  const handleToggleProject = async (projId) => {
    if (!sub) return;
    const curr = sub.subscribed_projects||[];
    const next = curr.includes(projId) ? curr.filter(id=>id!==projId) : [...curr,projId];
    const updated = await updateSub(sub.id,{ subscribed_projects:next });
    setSub(updated);
  };

  const handleNotifyDays = async (days) => {
    if (!sub) return;
    const updated = await updateSub(sub.id,{ notify_days_before:days });
    setSub(updated);
  };

  const handleUnsubscribe = async () => {
    if (!sub) return;
    setLoading(true);
    await deleteSub(sub.id);
    setSub(null);
    setLoading(false);
  };

  return (
    <>
      <div onClick={onClose} style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.3)", zIndex:20000 }}/>
      <div style={{ position:"fixed", top:0, right:0, bottom:0, width:380, background:C.white,
        borderLeft:`1px solid ${C.border}`, boxShadow:"-4px 0 24px rgba(0,0,0,0.12)",
        zIndex:20001, display:"flex", flexDirection:"column", fontFamily:"inherit" }}>
        {/* Header */}
        <div style={{ padding:"20px 20px 16px", borderBottom:`1px solid ${C.border}`, display:"flex", alignItems:"center", justifyContent:"space-between" }}>
          <div>
            <div style={{ fontSize:16, fontWeight:700, color:C.text }}>通知設定</div>
            <div style={{ fontSize:12, color:C.textMid, marginTop:2 }}>Email 提醒</div>
          </div>
          <button onClick={onClose} style={{ background:"none", border:`1px solid ${C.border}`, borderRadius:8, padding:"4px 10px", cursor:"pointer", fontSize:18, color:C.textMid, fontFamily:"inherit" }}>✕</button>
        </div>

        <div style={{ flex:1, overflowY:"auto", padding:20 }}>
          {status==="unsupported" && (
            <div style={{ background:"var(--red-light)", border:`1px solid ${C.red}33`, borderRadius:10, padding:14, fontSize:13, color:C.red }}>
              此瀏覽器不支援 Email 提醒，建議改用 Chrome 或 Edge。
            </div>
          )}
          {status==="denied" && (
            <div style={{ background:"var(--red-light)", border:`1px solid ${C.red}33`, borderRadius:10, padding:14, fontSize:13, color:C.red }}>
              通知權限已被封鎖，請至瀏覽器設定手動開啟後重試。
            </div>
          )}
          {status===""&&!sub&&(
            <div>
              <div style={{ fontSize:13, color:C.textMid, marginBottom:14, lineHeight:1.6 }}>
                點擊下方按鈕啟用 Email 提醒，首次使用時瀏覽器會詢問通知授權。
              </div>
              <div style={{ padding:"10px 14px", background:"var(--surface-raised)",
                border:"1px solid var(--border)", borderRadius:8, marginBottom:14,
                fontSize:13, color:"var(--text)" }}>
                通知顯示名稱：<strong>{displayName || "（請先至個人設定填入顯示名稱）"}</strong>
              </div>
              <button onClick={handleSubscribe} disabled={loading}
                style={{ width:"100%", padding:"10px 0", background:C.blue, color:"#fff",
                  border:"none", borderRadius:8, fontSize:14, fontWeight:700,
                  cursor:"pointer", fontFamily:"inherit" }}>
                {loading?"啟用中…":"啟用 Email 提醒"}
              </button>
            </div>
          )}
          {sub&&(
            <div>
              <div style={{ background:C.greenLight, border:`1px solid ${C.green}33`, borderRadius:10,
                padding:"10px 14px", fontSize:13, color:C.green, marginBottom:20,
                display:"flex", alignItems:"center", gap:8 }}>
                ✓ 已啟用 Email 提醒・{sub.pic_name}
              </div>

              {/* 提醒時機 */}
              <div style={{ marginBottom:20 }}>
                <div style={{ fontSize:11, fontWeight:700, color:C.textMid, textTransform:"uppercase", letterSpacing:"0.08em", marginBottom:10 }}>提醒時機</div>
                <div style={{ display:"flex", flexWrap:"wrap", gap:8 }}>
                  {NOTIFY_OPTIONS.map(({ label, value })=>(
                    <button key={value} onClick={()=>handleNotifyDays(value)}
                      style={{ padding:"6px 14px", borderRadius:20, fontSize:13, cursor:"pointer", fontFamily:"inherit",
                        background:sub.notify_days_before===value?C.blue:C.bg,
                        color:sub.notify_days_before===value?"#fff":C.text,
                        border:`1px solid ${sub.notify_days_before===value?C.blue:C.border}`,
                        fontWeight:sub.notify_days_before===value?700:400 }}>
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {/* 訂閱專案 */}
              <div>
                <div style={{ fontSize:11, fontWeight:700, color:C.textMid, textTransform:"uppercase", letterSpacing:"0.08em", marginBottom:10 }}>
                  訂閱專案（{(sub.subscribed_projects||[]).length} / {projects.length}）
                </div>
                <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
                  {projects.map(proj=>{
                    const active=(sub.subscribed_projects||[]).includes(proj.id);
                    return (
                      <div key={proj.id} onClick={()=>handleToggleProject(proj.id)}
                        style={{ display:"flex", alignItems:"center", justifyContent:"space-between",
                          padding:"10px 14px", borderRadius:10, cursor:"pointer",
                          background:active?C.blueLight:C.bg,
                          border:`1px solid ${active?C.blueBorder:"transparent"}`,
                          transition:"all 0.15s" }}>
                        <div>
                          <div style={{ fontSize:13, color:C.text, fontWeight:active?600:400 }}>{proj.info?.name||"未命名專案"}</div>
                          {proj.info?.pic&&<div style={{ fontSize:11, color:C.textLight, marginTop:1 }}>👤 {proj.info.pic}</div>}
                        </div>
                        {active?<Ico name="bell" size={16} color="currentColor"/>:<Ico name="bellOff" size={16} color="currentColor"/>}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* 取消訂閱 */}
              <div style={{ marginTop:28, paddingTop:16, borderTop:`1px solid ${C.border}` }}>
                <button onClick={handleUnsubscribe} disabled={loading}
                  style={{ width:"100%", padding:"8px 0", background:"none",
                    border:`1px solid ${C.red}66`, borderRadius:10, color:C.red,
                    fontSize:13, cursor:"pointer", fontFamily:"inherit" }}>
                  {loading?"處理中…":"取消所有 Email 提醒"}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
};


// ─── InAppNotifModal ──────────────────────────────────────────
const InAppNotifModal = ({ urgentNotifs, customerNotifs, onClose, onProjectOpen }) => {
  const totalBadge = urgentNotifs.length + customerNotifs.length;
  return (
  <>
    <div onClick={onClose} style={{ position:"fixed", inset:0, zIndex:9997 }}/>
    <div style={{ position:"fixed", top:58, right:40, width:360, maxHeight:500,
      background:"var(--surface)", border:"1px solid var(--border)", borderRadius:14,
      boxShadow:"0 8px 30px rgba(0,0,0,0.15)", zIndex:9998,
      display:"flex", flexDirection:"column", overflow:"hidden" }}>
      <div style={{ padding:"14px 16px 10px", borderBottom:"1px solid var(--border)",
        display:"flex", alignItems:"center", justifyContent:"space-between" }}>
        <div style={{ fontSize:14, fontWeight:700, color:"var(--text)" }}>通知</div>
        {totalBadge>0 && (
          <span style={{ fontSize:11, background:"var(--red-light)", color:"var(--red)",
            borderRadius:20, padding:"2px 9px", fontWeight:600 }}>
            {totalBadge} 筆
          </span>
        )}
      </div>
      <div style={{ overflowY:"auto", flex:1 }}>
        {/* 客戶更新 */}
        {customerNotifs.length>0 && (<>
          <div style={{ padding:"8px 16px 4px", fontSize:10, fontWeight:700, letterSpacing:"0.08em",
            textTransform:"uppercase", color:"var(--accent)" }}>客戶更新</div>
          {customerNotifs.map((n, i) => {
            const p = n.payload ?? {};
            return (
              <div key={i} onClick={()=>{ onClose(); onProjectOpen(n.project_id); }}
                style={{ display:"flex", alignItems:"center", gap:12, padding:"10px 16px",
                  borderBottom:"1px solid var(--border)", cursor:"pointer", transition:"background 0.1s",
                  background:n.read?"transparent":"var(--accent-subtle)" }}
                onMouseEnter={e=>e.currentTarget.style.background="var(--surface-raised)"}
                onMouseLeave={e=>e.currentTarget.style.background=n.read?"transparent":"var(--accent-subtle)"}>
                <div style={{ width:34, height:34, borderRadius:8, flexShrink:0,
                  background:p.checked?"var(--green-light)":"var(--amber-light)",
                  display:"flex", alignItems:"center", justifyContent:"center" }}>
                  {p.checked
                    ? <Ico name="check" size={16} color="var(--green)" strokeWidth={2.5}/>
                    : <Ico name="warning" size={15} color="var(--amber)"/>}
                </div>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontSize:13, fontWeight:600, color:"var(--text)",
                    overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
                    {n.projects?.name ?? p.hotel_id}
                  </div>
                  <div style={{ fontSize:11, color:"var(--text-subtle)", marginTop:2,
                    overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
                    {p.email} · {p.checked?"已勾選":"已取消"} {p.item_key}
                  </div>
                </div>
                <div style={{ fontSize:10, color:"var(--text-subtle)", flexShrink:0 }}>
                  {new Date(n.created_at).toLocaleString("zh-TW",{month:"numeric",day:"numeric",hour:"2-digit",minute:"2-digit"})}
                </div>
              </div>
            );
          })}
        </>)}
        {/* 即將到期 */}
        {urgentNotifs.length>0 && (<>
          <div style={{ padding:"8px 16px 4px", fontSize:10, fontWeight:700, letterSpacing:"0.08em",
            textTransform:"uppercase", color:"var(--red)" }}>即將到期</div>
          {urgentNotifs.map((n, i) => (
            <div key={i} onClick={()=>{ onClose(); onProjectOpen(n.projId); }}
              style={{ display:"flex", alignItems:"center", gap:12, padding:"10px 16px",
                borderBottom:"1px solid var(--border)", cursor:"pointer", transition:"background 0.1s" }}
              onMouseEnter={e=>e.currentTarget.style.background="var(--surface-raised)"}
              onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
              <div style={{ width:34, height:34, borderRadius:8, flexShrink:0,
                background:n.days===0?"var(--red-light)":n.days<=2?"var(--amber-light)":"var(--green-light)",
                display:"flex", alignItems:"center", justifyContent:"center",
                fontFamily:"'DM Mono',monospace", fontSize:12, fontWeight:700,
                color:n.days===0?"var(--red)":n.days<=2?"var(--amber)":"var(--green)" }}>
                {n.days===0?"今天":`${n.days}天`}
              </div>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ fontSize:13, fontWeight:600, color:"var(--text)",
                  overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{n.name}</div>
                <div style={{ fontSize:11, color:"var(--text-subtle)", marginTop:2,
                  overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{n.label} · {n.date}</div>
              </div>
            </div>
          ))}
        </>)}
        {/* Empty */}
        {totalBadge===0 && (
          <div style={{ padding:"32px 16px", textAlign:"center", color:"var(--text-subtle)", fontSize:13 }}>
            ✓ 目前無未讀通知
          </div>
        )}
      </div>
    </div>
  </>
  );
};

// ─── Calendar Page ─────────────────────────────────────────────
const CalendarPage = ({ projects, allTasks, onTaskAdded, onTaskDeleted }) => {
  const today = new Date();
  const [year,        setYear]        = useState(today.getFullYear());
  const [month,       setMonth]       = useState(today.getMonth());
  const [filters,     setFilters]     = useState({ launch:true, batch:true, task:true });
  const [expandedDay, setExpandedDay] = useState(null);
  const [expandedPos, setExpandedPos] = useState(null);
  const gridRef = useRef(null);
  const [modal,       setModal]       = useState(null);
  const [draft,       setDraft]       = useState({ projectId:"", name:"", description:"", type:"deadline", deadline:"", period_start:"", period_end:"", url:"", is_internal:true });
  const [saving,      setSaving]      = useState(false);

  const openAddModal  = (dateStr) => { setDraft({ projectId:projects[0]?.id||"", name:"", description:"", type:"deadline", deadline:dateStr, period_start:dateStr, period_end:"", url:"", is_internal:true }); setModal({ mode:"add", date:dateStr }); };
  const openEditModal = (task)    => { setDraft({ projectId:task.project_id, name:task.name, description:task.description||"", type:task.type, deadline:task.deadline||"", period_start:task.period_start||"", period_end:task.period_end||"", url:task.url||"", is_internal:task.is_internal??true, taskId:task.id }); setModal({ mode:"edit", date:task.deadline||task.period_start||task.period_end||"" }); };
  const closeModal    = ()        => { setModal(null); setSaving(false); };

  const deleteTask = async (taskId) => {
    if (!window.confirm("確定要刪除此任務嗎？此操作無法還原。")) return;
    setExpandedDay(null); setExpandedPos(null); closeModal();
    await sb.from("tasks").delete().eq("id", taskId);
    onTaskDeleted(taskId);
  };

  const saveTask = async () => {
    if (!draft.projectId || !draft.name.trim()) return;
    setSaving(true);
    if (modal.mode==="add") {
      const task = { id:crypto.randomUUID(), project_id:draft.projectId, name:draft.name.trim(), description:draft.description, type:draft.type, deadline:draft.type==="deadline"?(draft.deadline||null):null, period_start:draft.type==="period"?(draft.period_start||null):null, period_end:draft.type==="period"?(draft.period_end||null):null, url:draft.url||"", is_internal:draft.is_internal??true };
      const { error } = await sb.from("tasks").insert(task);
      if (!error) onTaskAdded(task, false);
    } else {
      const updates = { name:draft.name.trim(), description:draft.description, type:draft.type, deadline:draft.type==="deadline"?(draft.deadline||null):null, period_start:draft.type==="period"?(draft.period_start||null):null, period_end:draft.type==="period"?(draft.period_end||null):null, url:draft.url||"", is_internal:draft.is_internal??true };
      await sb.from("tasks").update(updates).eq("id", draft.taskId);
      onTaskAdded({ ...updates, id:draft.taskId, project_id:draft.projectId }, true);
    }
    closeModal();
  };

  const toggleFilter = (k) => setFilters(f=>({ ...f, [k]:!f[k] }));

  const events = useMemo(() => {
    const list = [];
    const inMonth = (d) => { if (!d) return false; const dt=new Date(d); return dt.getFullYear()===year && dt.getMonth()===month; };
    projects.forEach(proj => {
      const name = proj.info.name||"（未命名）";
      if (filters.launch && proj.info.launchDate && inMonth(proj.info.launchDate))
        list.push({ date:proj.info.launchDate, label:name, sub:"上線日", ...CAL_COLORS.launch, taskId:null });
      if (filters.batch) {
        if (proj.info.batch1Deadline && inMonth(proj.info.batch1Deadline))
          list.push({ date:proj.info.batch1Deadline, label:name, sub:"第一批期限", ...CAL_COLORS.batch1, taskId:null });
        if (proj.info.batch2Deadline && inMonth(proj.info.batch2Deadline))
          list.push({ date:proj.info.batch2Deadline, label:name, sub:"第二批期限", ...CAL_COLORS.batch2, taskId:null });
      }
    });
    if (filters.task) {
      allTasks.forEach(task => {
        const proj = projects.find(p=>p.id===task.project_id);
        const name = proj?.info.name||"（未命名）";
        if (task.type==="deadline" && task.deadline && inMonth(task.deadline))
          list.push({ date:task.deadline, label:name, sub:`任務：${task.name}`, ...CAL_COLORS.taskDL, taskId:task.id, taskObj:task });
        if (task.type==="period") {
          if (task.period_start && inMonth(task.period_start))
            list.push({ date:task.period_start, label:name, sub:`任務開始：${task.name}`, ...CAL_COLORS.taskPeriod, taskId:task.id, taskObj:task });
          if (task.period_end && inMonth(task.period_end))
            list.push({ date:task.period_end, label:name, sub:`任務結束：${task.name}`, ...CAL_COLORS.taskPeriod, taskId:task.id, taskObj:task });
        }
      });
    }
    return list;
  }, [projects, allTasks, year, month, filters]);

  const firstDay=new Date(year,month,1).getDay(), daysInMonth=new Date(year,month+1,0).getDate();
  const cells=[];
  for (let i=0;i<firstDay;i++) cells.push(null);
  for (let d=1;d<=daysInMonth;d++) cells.push(d);
  while (cells.length%7!==0) cells.push(null);

  const mkKey = (d) => d?`${year}-${String(month+1).padStart(2,"0")}-${String(d).padStart(2,"0")}`:null;
  const getEventsForDay = (d) => { const k=mkKey(d); return k?events.filter(e=>e.date===k):[]; };
  const monthNames=["1月","2月","3月","4月","5月","6月","7月","8月","9月","10月","11月","12月"];
  const dayNames=["日","一","二","三","四","五","六"];
  const realTodayStr=`${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,"0")}-${String(today.getDate()).padStart(2,"0")}`;

  const ModalContent = modal ? (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.35)", zIndex:20000, display:"flex", alignItems:"center", justifyContent:"center", padding:24 }}
      onClick={e=>{ if(e.target===e.currentTarget) closeModal(); }}>
      <div style={{ background:C.white, borderRadius:14, padding:28, width:"100%", maxWidth:520, boxShadow:"0 20px 60px rgba(0,0,0,0.2)", animation:"fadeIn 0.2s ease" }}>
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:24 }}>
          <div>
            <h3 style={{ fontSize:18, fontWeight:700, color:C.text, margin:"0 0 4px" }}>{modal.mode==="add"?"新增任務":"編輯任務"}</h3>
            <div style={{ fontSize:12, color:C.textLight }}>{fmtDate(modal.date)}</div>
          </div>
          <button onClick={closeModal} style={{ background:"none", border:`1px solid ${C.border}`, borderRadius:8, padding:"4px 10px", cursor:"pointer", fontSize:16, color:C.textLight, fontFamily:"inherit" }}>✕</button>
        </div>
        {modal.mode==="add" && (
          <div style={{ marginBottom:16 }}>
            <label style={{ display:"block", fontSize:11, letterSpacing:1.5, color:C.textMid, textTransform:"uppercase", marginBottom:7, fontWeight:600 }}>歸屬專案</label>
            <select value={draft.projectId} onChange={e=>setDraft(d=>({ ...d, projectId:e.target.value }))}
              style={{ ...baseInput, padding:"10px 32px 10px 14px", appearance:"none", backgroundImage:`url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%2394a3b8' d='M6 8L1 3h10z'/%3E%3C/svg%3E")`, backgroundRepeat:"no-repeat", backgroundPosition:"right 10px center", cursor:"pointer" }}
              onFocus={e=>(e.target.style.borderColor=C.blue)} onBlur={e=>(e.target.style.borderColor=C.border)}>
              {projects.map(p=><option key={p.id} value={p.id}>{p.info.name||"（未命名）"}{p.info.hotelId?` #${p.info.hotelId}`:""}</option>)}
            </select>
          </div>
        )}
        <div style={{ marginBottom:16 }}>
          <label style={{ display:"block", fontSize:11, letterSpacing:1.5, color:C.textMid, textTransform:"uppercase", marginBottom:7, fontWeight:600 }}>任務名稱 *</label>
          <input value={draft.name} onChange={e=>setDraft(d=>({ ...d, name:e.target.value }))} placeholder="輸入任務名稱" style={baseInput}
            onFocus={e=>(e.target.style.borderColor=C.blue)} onBlur={e=>(e.target.style.borderColor=C.border)}/>
        </div>
        <div style={{ marginBottom:16 }}>
          <label style={{ display:"block", fontSize:11, letterSpacing:1.5, color:C.textMid, textTransform:"uppercase", marginBottom:7, fontWeight:600 }}>內容概述</label>
          <textarea value={draft.description} onChange={e=>setDraft(d=>({ ...d, description:e.target.value }))} placeholder="描述任務目標或相關說明…" rows={3}
            style={{ ...baseInput, resize:"vertical", minHeight:72 }}
            onFocus={e=>(e.target.style.borderColor=C.blue)} onBlur={e=>(e.target.style.borderColor=C.border)}/>
        </div>
        <div style={{ marginBottom:16 }}>
          <label style={{ display:"block", fontSize:11, letterSpacing:1.5, color:C.textMid, textTransform:"uppercase", marginBottom:7, fontWeight:600 }}>相關連結（選填）</label>
          <input type="url" value={draft.url} onChange={e=>setDraft(d=>({ ...d, url:e.target.value }))} placeholder="https://…" style={baseInput}
            onFocus={e=>(e.target.style.borderColor=C.blue)} onBlur={e=>(e.target.style.borderColor=C.border)}/>
          {draft.url && !draft.url.startsWith("http") && <div style={{ marginTop:5, fontSize:11, color:C.red }}>⚠️ 請確認連結以 http 或 https 開頭</div>}
        </div>
        <div style={{ marginBottom:16 }}>
          <label style={{ display:"block", fontSize:11, letterSpacing:1.5, color:C.textMid, textTransform:"uppercase", marginBottom:8, fontWeight:600 }}>類型</label>
          <div style={{ display:"flex", gap:8 }}>
            {[{ v:"deadline", ico:"pin", text:"期限" },{ v:"period", ico:"repeat", text:"週期" }].map(({ v, ico, text })=>(
              <button key={v} onClick={()=>setDraft(d=>({ ...d, type:v }))}
                style={{ padding:"7px 18px", borderRadius:8, fontFamily:"inherit", fontSize:13, fontWeight:600, cursor:"pointer", transition:"all 0.15s", border:`1.5px solid ${draft.type===v?C.blue:C.border}`, background:draft.type===v?C.blue:C.white, color:draft.type===v?"#fff":C.textMid, display:"flex", alignItems:"center", gap:5 }}><Ico name={ico} size={13} color="currentColor"/>{text}</button>
            ))}
          </div>
        </div>
        {draft.type==="deadline" ? (
          <div style={{ marginBottom:20 }}>
            <label style={{ display:"block", fontSize:11, letterSpacing:1.5, color:C.textMid, textTransform:"uppercase", marginBottom:7, fontWeight:600 }}>截止日期</label>
            <input type="date" value={draft.deadline} onChange={e=>setDraft(d=>({ ...d, deadline:e.target.value }))} style={{ ...baseInput, width:"auto" }}
              onFocus={e=>(e.target.style.borderColor=C.amber)} onBlur={e=>(e.target.style.borderColor=C.border)}/>
          </div>
        ) : (
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12, marginBottom:20 }}>
            <div>
              <label style={{ display:"block", fontSize:11, letterSpacing:1.5, color:C.green, textTransform:"uppercase", marginBottom:7, fontWeight:600 }}>開始日期</label>
              <input type="date" value={draft.period_start} onChange={e=>setDraft(d=>({ ...d, period_start:e.target.value }))} style={{ ...baseInput, borderColor:C.border, background:C.greenLight }}
                onFocus={e=>(e.target.style.borderColor=C.green)} onBlur={e=>(e.target.style.borderColor=C.border)}/>
            </div>
            <div>
              <label style={{ display:"block", fontSize:11, letterSpacing:1.5, color:C.purple, textTransform:"uppercase", marginBottom:7, fontWeight:600 }}>結束日期</label>
              <input type="date" value={draft.period_end} onChange={e=>setDraft(d=>({ ...d, period_end:e.target.value }))} style={{ ...baseInput, borderColor:C.border, background:C.purpleLight }}
                onFocus={e=>(e.target.style.borderColor=C.purple)} onBlur={e=>(e.target.style.borderColor=C.border)}/>
            </div>
          </div>
        )}
        {/* is_internal toggle */}
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between",
          padding:"14px 0", borderTop:`1px solid ${C.border}`, marginBottom:4 }}>
          <div>
            <div style={{ fontSize:12, fontWeight:600, color:C.text }}>對客戶公開</div>
            <div style={{ fontSize:11, color:C.textLight, marginTop:2 }}>
              {draft.is_internal ? "僅限內部可見" : "客戶端儀表可見"}
            </div>
          </div>
          <button onClick={()=>setDraft(d=>({ ...d, is_internal:!d.is_internal }))}
            style={{ position:"relative", width:44, height:24, borderRadius:12, border:"none",
              background:draft.is_internal?C.borderMid:C.green, cursor:"pointer",
              transition:"background 0.2s", flexShrink:0 }}>
            <div style={{ position:"absolute", top:3, left:draft.is_internal?3:23, width:18, height:18,
              borderRadius:"50%", background:"#fff", transition:"left 0.2s",
              boxShadow:"0 1px 3px rgba(0,0,0,0.2)" }}/>
          </button>
        </div>
        <div style={{ display:"flex", justifyContent:"flex-end", gap:10 }}>
          <button onClick={closeModal} style={{ background:C.white, color:C.textMid, border:`1px solid ${C.border}`, borderRadius:10, padding:"10px 20px", fontSize:14, cursor:"pointer", fontFamily:"inherit" }}>取消</button>
          <button onClick={saveTask} disabled={!draft.name.trim()||saving}
            style={{ background:!draft.name.trim()||saving?C.borderMid:C.blue, color:"#fff", border:"none", borderRadius:10, padding:"10px 24px", fontSize:14, fontWeight:700, cursor:!draft.name.trim()||saving?"not-allowed":"pointer", fontFamily:"inherit", boxShadow:draft.name.trim()&&!saving?`0 2px 8px ${C.blue}40`:"none", transition:"all 0.15s" }}>
            {saving?"儲存中…":modal.mode==="add"?"新增任務":"儲存變更"}
          </button>
        </div>
      </div>
    </div>
  ) : null;

  return (
    <div style={{ padding:"32px 40px 80px", maxWidth:1200, margin:"0 auto" }}>
      {ModalContent}

      {/* Header */}
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:24, flexWrap:"wrap", gap:16 }}>
        <div style={{ display:"flex", alignItems:"center", gap:16 }}>
          <button onClick={()=>{ if(month===0){setMonth(11);setYear(y=>y-1);}else setMonth(m=>m-1); }} style={{ background:C.white, border:`1px solid ${C.border}`, borderRadius:8, padding:"6px 12px", cursor:"pointer", fontFamily:"inherit", fontSize:16 }}>‹</button>
          <h2 style={{ fontSize:20, fontWeight:700, color:C.text, margin:0 }}>{year}年 {monthNames[month]}</h2>
          <button onClick={()=>{ if(month===11){setMonth(0);setYear(y=>y+1);}else setMonth(m=>m+1); }} style={{ background:C.white, border:`1px solid ${C.border}`, borderRadius:8, padding:"6px 12px", cursor:"pointer", fontFamily:"inherit", fontSize:16 }}>›</button>
          <button onClick={()=>{ setYear(today.getFullYear()); setMonth(today.getMonth()); }} style={{ background:C.blueLight, border:`1px solid ${C.blueBorder}`, borderRadius:8, padding:"6px 14px", cursor:"pointer", fontFamily:"inherit", fontSize:12, color:C.blue, fontWeight:600 }}>今天</button>
        </div>
        <div style={{ display:"flex", gap:10, flexWrap:"wrap", alignItems:"center" }}>
          {[{ k:"launch", label:"上線日", ...CAL_COLORS.launch },{ k:"batch", label:"資料期限", ...CAL_COLORS.batch1 },{ k:"task", label:"任務", ...CAL_COLORS.taskDL }].map(({ k, label, bg, text, border })=>(
            <button key={k} onClick={()=>toggleFilter(k)}
              style={{ display:"flex", alignItems:"center", gap:6, padding:"5px 12px", borderRadius:8, cursor:"pointer", fontFamily:"inherit", fontSize:12, fontWeight:600, transition:"all 0.15s", background:filters[k]?bg:C.bg, border:`1.5px solid ${filters[k]?border:C.border}`, color:filters[k]?text:C.textLight, opacity:filters[k]?1:0.6 }}>
              <span style={{ width:8, height:8, borderRadius:"50%", background:filters[k]?text:C.borderMid, flexShrink:0 }}/>{label}
            </button>
          ))}
        </div>
      </div>

      {/* Calendar grid */}
      <div ref={gridRef} style={{ border:`1px solid ${C.border}`, borderRadius:12, position:"relative", overflow:"visible" }}
        onClick={()=>{ setExpandedDay(null); setExpandedPos(null); }}>
        <div style={{ background:C.white, borderRadius:12, overflow:"hidden" }}>
        <div style={{ display:"grid", gridTemplateColumns:"repeat(7,minmax(0,1fr))", borderBottom:`1px solid ${C.border}` }}>
          {dayNames.map(d=><div key={d} style={{ padding:"10px 0", textAlign:"center", fontSize:12, fontWeight:700, color:d==="日"?C.red:d==="六"?C.blue:C.textMid }}>{d}</div>)}
        </div>
        {Array.from({ length:cells.length/7 }).map((_,wi)=>(
          <div key={wi} style={{ display:"grid", gridTemplateColumns:"repeat(7,minmax(0,1fr))", borderBottom:wi<cells.length/7-1?`1px solid ${C.border}`:"none" }}>
            {cells.slice(wi*7,wi*7+7).map((d,di)=>{
              const k         = mkKey(d);
              const isToday   = k===realTodayStr;
              const isExpanded= expandedDay===k;
              const dayEvents = d?getEventsForDay(d):[];
              const col       = di===0?C.red:di===6?C.blue:C.text;
              const visible   = isExpanded?dayEvents:dayEvents.slice(0,2);
              const hasMore   = !isExpanded && dayEvents.length>2;
              return (
                <div key={di}
                  onClick={e=>{ e.stopPropagation(); if(d&&dayEvents.length>2) {
                    if(isExpanded) { setExpandedDay(null); setExpandedPos(null); }
                    else {
                      const cellRect = e.currentTarget.getBoundingClientRect();
                      const gridRect = gridRef.current.getBoundingClientRect();
                      setExpandedPos({ top: cellRect.bottom - gridRect.top, left: cellRect.left - gridRect.left, width: cellRect.width });
                      setExpandedDay(k);
                    }
                  }}}
                  style={{ minHeight:110, padding:"6px 8px", borderRight:di<6?`1px solid ${C.border}`:"none",
                    background:isToday?C.blueLight:d?C.white:"var(--surface-raised)",
                    display:"flex", flexDirection:"column", overflow:"hidden", minWidth:0,
                    cursor:d&&dayEvents.length>2?"pointer":"default", transition:"background 0.15s",
                    position:"relative", zIndex:1 }}>
                  {d && (
                    <>
                      {/* Date + add button */}
                      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:4, flexShrink:0 }}>
                        {isToday
                          ? <span style={{ background:C.blue, color:"#fff", borderRadius:"50%", width:22, height:22, display:"inline-flex", alignItems:"center", justifyContent:"center", fontSize:12, fontWeight:700 }}>{d}</span>
                          : <span style={{ fontSize:13, color:col }}>{d}</span>}
                        {projects.length>0 && (
                          <button onClick={e=>{ e.stopPropagation(); openAddModal(k); }}
                            style={{ background:"none", border:`1px solid ${C.border}`, borderRadius:5, width:18, height:18, display:"flex", alignItems:"center", justifyContent:"center", cursor:"pointer", fontSize:12, color:C.textLight, padding:0, lineHeight:1, flexShrink:0, transition:"all 0.15s" }}
                            onMouseEnter={e=>{ e.currentTarget.style.background=C.blue; e.currentTarget.style.borderColor=C.blue; e.currentTarget.style.color="#fff"; }}
                            onMouseLeave={e=>{ e.currentTarget.style.background="none"; e.currentTarget.style.borderColor=C.border; e.currentTarget.style.color=C.textLight; }}
                            title="新增任務">+</button>
                        )}
                      </div>
                      {/* Event labels */}
                      <div style={{ display:"flex", flexDirection:"column", gap:3, flex:1, overflow:"hidden" }}>
                        {dayEvents.slice(0,2).map((ev,ei)=>(
                          <div key={ei} title={`${ev.label} — ${ev.sub}`}
                            onClick={e=>{ e.stopPropagation(); if(ev.taskId) openEditModal(ev.taskObj); }}
                            style={{ borderRadius:5, padding:"3px 6px", background:ev.bg, border:`1px solid ${ev.border}`, cursor:ev.taskId?"pointer":"default", transition:"opacity 0.15s" }}
                            onMouseEnter={e=>{ if(ev.taskId) e.currentTarget.style.opacity="0.7"; }}
                            onMouseLeave={e=>{ e.currentTarget.style.opacity="1"; }}>
                            <div style={{ fontSize:10, fontWeight:700, color:ev.text, lineHeight:1.3, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
                              {ev.sub}{ev.taskId?" ✎":""}
                            </div>
                            <div style={{ fontSize:10, color:ev.text, opacity:0.7, lineHeight:1.3, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{ev.label}</div>
                          </div>
                        ))}
                        {dayEvents.length>2 && !isExpanded && <div style={{ fontSize:10, color:C.blue, padding:"1px 4px", fontWeight:600 }}>+{dayEvents.length-2} 更多 ↓</div>}
                        {isExpanded && <div style={{ fontSize:10, color:C.blue, padding:"1px 4px", fontWeight:600 }}>▲ 收起</div>}
                      </div>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        ))}
        </div>{/* end inner overflow:hidden */}

        {/* Absolute dropdown for expanded day - inside relative grid container */}
        {expandedDay && expandedPos && (() => {
          const dayEvs = events.filter(e=>e.date===expandedDay);
          const ITEM_H = 52;
          const dropH  = Math.min(dayEvs.length, 5) * ITEM_H + 36;
          return (
            <div onClick={e=>e.stopPropagation()}
              style={{ position:"absolute", top:expandedPos.top, left:expandedPos.left,
                width:Math.max(expandedPos.width, 180), height:dropH,
                background:C.white, border:`1px solid ${C.blueBorder}`,
                borderRadius:10, boxShadow:"0 8px 24px rgba(0,0,0,0.15)",
                zIndex:9999, display:"flex", flexDirection:"column" }}>
              <div style={{ flex:1, overflowY:"auto", padding:"8px 8px 0", display:"flex", flexDirection:"column", gap:4 }}>
                {dayEvs.map((ev,ei)=>(
                  <div key={ei} title={`${ev.label} — ${ev.sub}`}
                    style={{ borderRadius:5, padding:"4px 8px", background:ev.bg, border:`1px solid ${ev.border}`, flexShrink:0, display:"flex", alignItems:"flex-start", gap:4 }}>
                    <div style={{ flex:1, minWidth:0, cursor:ev.taskId?"pointer":"default" }}
                      onClick={e=>{ e.stopPropagation(); if(ev.taskId){ openEditModal(ev.taskObj); setExpandedDay(null); setExpandedPos(null); }}}
                      onMouseEnter={e=>{ if(ev.taskId) e.currentTarget.style.opacity="0.7"; }}
                      onMouseLeave={e=>{ e.currentTarget.style.opacity="1"; }}>
                      <div style={{ fontSize:10, fontWeight:700, color:ev.text, lineHeight:1.4, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
                        {ev.sub}{ev.taskId?" ✎":""}
                      </div>
                      <div style={{ fontSize:10, color:ev.text, opacity:0.7, lineHeight:1.3, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{ev.label}</div>
                    </div>
                    {ev.taskId && (
                      <button onClick={e=>{ e.stopPropagation(); deleteTask(ev.taskId); }}
                        style={{ background:"none", border:"none", cursor:"pointer", padding:"1px 3px",
                          fontSize:11, color:ev.text, opacity:0.5, flexShrink:0, lineHeight:1 }}
                        onMouseEnter={e=>{ e.currentTarget.style.opacity="1"; e.currentTarget.style.color=C.red; }}
                        onMouseLeave={e=>{ e.currentTarget.style.opacity="0.5"; e.currentTarget.style.color=ev.text; }}
                        title="刪除任務"><Ico name="trash" size={14} color="currentColor"/></button>
                    )}
                  </div>
                ))}
              </div>
              <div onClick={()=>{ setExpandedDay(null); setExpandedPos(null); }}
                style={{ fontSize:10, color:C.textLight, textAlign:"center", padding:"6px 0",
                  borderTop:`1px solid ${C.border}`, cursor:"pointer", flexShrink:0 }}>▲ 收起</div>
            </div>
          );
        })()}
      </div>{/* end outer grid container */}

      {/* Event list */}
      {events.length>0 && (
        <div style={{ marginTop:24 }}>
          <h3 style={{ fontSize:15, fontWeight:700, color:C.text, marginBottom:12 }}>本月事件</h3>
          <div style={{ background:"var(--surface)", border:"1px solid var(--border)", borderRadius:12, overflow:"hidden" }}>
            {[...events].sort((a,b)=>a.date.localeCompare(b.date)).map((ev,i,arr)=>(
              <div key={i}
                style={{ display:"flex", alignItems:"center", gap:10, padding:"9px 14px",
                  borderBottom:i<arr.length-1?"1px solid var(--border)":"none",
                  borderLeft:`3px solid ${ev.border}`, background:"var(--surface)" }}>
                {/* 日期 */}
                <span style={{ fontSize:12, fontWeight:700, color:"var(--text-mid)", fontFamily:"'DM Mono',monospace", flexShrink:0, minWidth:80 }}>{fmtDate(ev.date)}</span>
                {/* 專案名稱 + 任務/類型名稱 */}
                <div style={{ flex:1, minWidth:0, display:"flex", alignItems:"baseline", gap:6, overflow:"hidden" }}>
                  <span style={{ fontSize:13, fontWeight:700, color:"var(--text)", flexShrink:0, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap", maxWidth:"55%" }}>{ev.label}</span>
                  <span style={{ fontSize:12, color:"var(--text-subtle)", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{ev.sub}</span>
                </div>
                {/* 任務操作按鈕 */}
                {ev.taskId && (
                  <div style={{ display:"flex", gap:2, flexShrink:0 }}>
                    <button onClick={()=>openEditModal(ev.taskObj)}
                      style={{ background:"none", border:"none", cursor:"pointer", padding:"4px 6px", color:"var(--text-subtle)", borderRadius:6, transition:"all 0.12s" }}
                      onMouseEnter={e=>{ e.currentTarget.style.color="var(--accent)"; e.currentTarget.style.background="var(--surface-raised)"; }}
                      onMouseLeave={e=>{ e.currentTarget.style.color="var(--text-subtle)"; e.currentTarget.style.background="none"; }}
                      title="編輯任務"><Ico name="pencil" size={13} color="currentColor"/></button>
                    <button onClick={()=>deleteTask(ev.taskId)}
                      style={{ background:"none", border:"none", cursor:"pointer", padding:"4px 6px", color:"var(--text-subtle)", borderRadius:6, transition:"all 0.12s" }}
                      onMouseEnter={e=>{ e.currentTarget.style.color="var(--red)"; e.currentTarget.style.background="var(--surface-raised)"; }}
                      onMouseLeave={e=>{ e.currentTarget.style.color="var(--text-subtle)"; e.currentTarget.style.background="none"; }}
                      title="刪除任務"><Ico name="trash" size={13} color="currentColor"/></button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};


// ─── HomePage ─────────────────────────────────────────────────
const HomePage = ({ projects, onNew, onOpen, onDelete, allPics, session, profile }) => {
  const [search,        setSearch]        = useState("");
  const [regionFilter,  setRegionFilter]  = useState("all");
  const [productFilter, setProductFilter] = useState("all");
  const [picFilter,     setPicFilter]     = useState("all");
  const [sortBy,        setSortBy]        = useState("created_desc");
  const [showNotif,     setShowNotif]     = useState(false);

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
    { label:"專案總數",         value:projects.length, icon:"folder",  color:"var(--accent)",  sub:"所有專案" },
    { label:"逾期未完成",       value:overdueCount,    icon:"warning", color:overdueCount>0?"var(--red)":"var(--green)", sub:overdueCount>0?"需立即處理":"目前正常" },
    { label:"即將上線", value:soonCount,       icon:"rocket",  color:"var(--amber)",   sub:"預計 30 天內上線" },
    { label:"已完成資料",       value:doneCount,       icon:"check",   color:"var(--purple)",  sub:"資料已搜集完成" },
  ];

  return (
    <div style={{ padding:"28px 40px 80px", maxWidth:1200, margin:"0 auto" }}>
      {/* Stat cards */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:12, marginBottom:28 }}>
        {stats.map(({ label, value, icon, color, sub }) => (
          <div key={label} style={{ background:"var(--surface)", border:"1px solid var(--border)",
            borderRadius:12, padding:"18px 20px", animation:"fadeIn 0.2s ease" }}>
            <div style={{ display:"flex", alignItems:"flex-start", justifyContent:"space-between", marginBottom:14 }}>
              <span style={{ fontSize:12, color:"var(--text-mid)", fontWeight:500, lineHeight:1.4 }}>{label}</span>
              <div style={{ width:32, height:32, borderRadius:8, background:color+"15",
                display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
                <Ico name={icon} size={16} color={color} strokeWidth={1.8}/>
              </div>
            </div>
            <div style={{ fontSize:32, fontWeight:700, color, fontFamily:"'DM Mono',monospace",
              letterSpacing:-1, marginBottom:4 }}>{value}</div>
            <div style={{ fontSize:11, color:"var(--text-subtle)" }}>{sub}</div>
          </div>
        ))}
      </div>

      {/* 篩選欄（含通知設定，統一外框） */}
      <div style={{ background:"var(--surface)", border:"1px solid var(--border)",
        borderRadius:12, padding:"14px 18px", marginBottom:20 }}>
        <div style={{ display:"flex", alignItems:"center", gap:12, flexWrap:"wrap" }}>
          {/* 搜尋 */}
          <div style={{ position:"relative", flex:"0 0 220px" }}>
            <div style={{ position:"absolute", left:10, top:"50%", transform:"translateY(-50%)", pointerEvents:"none" }}>
              <Ico name="search" size={14} color="var(--text-subtle)"/>
            </div>
            <input value={search} onChange={e=>setSearch(e.target.value)}
              placeholder="飯店名稱、地區、產品、PIC..."
              style={{ ...baseInput, paddingLeft:32, fontSize:13, width:"100%" }}
              onFocus={e=>(e.target.style.borderColor="var(--accent)")}
              onBlur={e=>(e.target.style.borderColor="var(--border)")}/>
          </div>
          <div style={{ width:1, height:28, background:"var(--border)", flexShrink:0 }}/>
          {/* 篩選 selects */}
          <FilterSelect label="" value={regionFilter}  onChange={setRegionFilter}  options={regionOptions} placeholder="地區"/>
          <FilterSelect label="" value={productFilter} onChange={setProductFilter} options={productOptions} placeholder="產品"/>
          <FilterSelect label="" value={picFilter}     onChange={setPicFilter}     options={picOptions} placeholder="PIC"/>
          {/* 分隔線 */}
          <div style={{ width:1, height:28, background:"var(--border)", flexShrink:0 }}/>
          {/* 排序 */}
          <FilterSelect label="" value={sortBy} onChange={setSortBy} options={[
            { value:"created_desc", label:"新增時間（最新）" },
            { value:"created_asc",  label:"新增時間（最舊）" },
            { value:"launch_asc",   label:"上線日期（最近）" },
            { value:"launch_desc",  label:"上線日期（最遠）" },
          ]} placeholder="排序"/>
          {/* 通知設定 */}
          <button onClick={()=>setShowNotif(true)}
            style={{ marginLeft:"auto", display:"flex", alignItems:"center", gap:6,
              background:"transparent", border:"1px solid var(--border)", borderRadius:8,
              padding:"7px 13px", cursor:"pointer", fontFamily:"inherit",
              fontSize:13, color:"var(--text-mid)", transition:"all 0.12s" }}
            onMouseEnter={e=>{ e.currentTarget.style.borderColor="var(--accent)"; e.currentTarget.style.color="var(--accent)"; }}
            onMouseLeave={e=>{ e.currentTarget.style.borderColor="var(--border)"; e.currentTarget.style.color="var(--text-mid)"; }}>
            <Ico name="bell" size={14} color="currentColor"/>
            通知設定
          </button>
        </div>
      </div>

      {/* Project grid */}
      {filtered.length===0 ? (
        <div style={{ textAlign:"center", padding:"60px 0", color:C.textLight }}>
          <div style={{ width:52, height:52, borderRadius:14, background:"var(--accent-subtle)",
            display:"flex", alignItems:"center", justifyContent:"center", margin:"0 auto 12px" }}>
            <Ico name="building" size={26} color="var(--accent)"/>
          </div>
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
                style={{ background:"var(--surface)", border:"1px solid var(--border)", borderRadius:12,
                  padding:20, cursor:"pointer", transition:"border-color 0.15s, box-shadow 0.15s",
                  animation:"fadeIn 0.2s ease" }}
                onClick={()=>onOpen(proj.id)}
                onMouseEnter={e=>{ e.currentTarget.style.borderColor="var(--accent-border)"; e.currentTarget.style.boxShadow="0 4px 16px rgba(0,0,0,0.08)"; }}
                onMouseLeave={e=>{ e.currentTarget.style.borderColor="var(--border)"; e.currentTarget.style.boxShadow="none"; }}>

                {/* Row 1 */}
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:10 }}>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ display:"flex", alignItems:"center", gap:8, flexWrap:"wrap", marginBottom:3 }}>
                      <span style={{ fontSize:16, fontWeight:700, color:C.text }}>{proj.info.name||"（未命名）"}</span>
                      {proj.info.hotelId && <span style={{ fontSize:11, color:C.textLight, fontFamily:"'DM Mono',monospace", background:C.bg, padding:"2px 7px", borderRadius:5 }}>#{proj.info.hotelId}</span>}
                      {rd && <span style={{ fontSize:11, background:C.blueLight, color:C.blue, border:`1px solid ${C.blueBorder}`, borderRadius:6, padding:"2px 9px", fontWeight:600 }}>{rd}</span>}
                      {isComplete  && <span style={{ fontSize:11, background:C.greenLight, color:C.green, border:`1px solid ${C.green}33`, borderRadius:6, padding:"2px 9px", fontWeight:700 }}>✓ 完成</span>}
                      {!isComplete && isSoon && <span style={{ fontSize:11, background:C.amberLight, color:C.amber, border:`1px solid ${C.amber}33`, borderRadius:6, padding:"2px 8px 2px 6px", fontWeight:700, display:"inline-flex", alignItems:"center", gap:4 }}><Ico name="rocket" size={11} color="var(--amber)"/>即將上線</span>}
                    </div>
                    {proj.info.address && <div style={{ display:"flex", alignItems:"center", gap:4, fontSize:12, color:C.textLight, marginTop:2 }}>
                      <Ico name="pin" size={12} color="var(--text-subtle)"/> {proj.info.address}
                    </div>}
                  </div>
                  <button onClick={e=>{ e.stopPropagation(); if(window.confirm(`確定要移除「${proj.info.name||"此專案"}」嗎？`)) onDelete(proj.id); }}
                    style={{ background:"none", border:`1px solid ${C.border}`, borderRadius:7, padding:"4px 9px",
                      cursor:"pointer", fontSize:13, color:C.textLight, lineHeight:1,
                      transition:"all 0.15s", fontFamily:"inherit", flexShrink:0, marginLeft:8 }}
                    onMouseEnter={e=>{ e.currentTarget.style.background="var(--red-subtle)"; e.currentTarget.style.borderColor="var(--red)"; e.currentTarget.style.color="var(--red)"; }}
                    onMouseLeave={e=>{ e.currentTarget.style.background="none"; e.currentTarget.style.borderColor=C.border; e.currentTarget.style.color=C.textLight; }}
                    title="移除專案"><Ico name="trash" size={14} color="currentColor"/></button>
                </div>

                {/* Row 2a: Products + PIC */}
                {(proj.info.products.length>0||proj.info.pic) && (
                  <div style={{ display:"flex", alignItems:"center", gap:6, marginBottom:6, flexWrap:"wrap" }}>
                    {proj.info.products.map(p=>(
                      <span key={p} style={{ fontSize:12, fontWeight:700, color:"#fff", background:PRODUCT_COLORS[p]||C.blue, borderRadius:7, padding:"3px 11px" }}>{p}</span>
                    ))}
                    {proj.info.pic && <span style={{ marginLeft:"auto", fontSize:11, background:C.greenLight, color:C.green, border:`1px solid ${C.green}33`, borderRadius:6, padding:"2px 8px 2px 6px", fontWeight:600, display:"inline-flex", alignItems:"center", gap:4 }}><Ico name="user" size={11} color="var(--green)"/>{proj.info.pic}</span>}
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
                        <Ico name="calendar" size={13} color="var(--text-subtle)"/>
                        <span style={{ fontSize:12, color:C.textMid }}>上線日</span>
                        <span style={{ fontSize:12, color:C.text, fontWeight:700, fontFamily:"'DM Mono',monospace" }}>{proj.info.launchDate}</span>
                        {d!==null&&d>=0 && <span style={{ marginLeft:"auto", fontSize:11, fontWeight:600, color:d<=7?C.red:d<=30?C.amber:C.textLight }}>{d===0?"今天":`${d}天後`}</span>}
                      </div>
                    )}
                    {nd && (
                      <div style={{ display:"flex", alignItems:"center", gap:6,
                        background:nd.days<=7?"var(--red-subtle)":"var(--green-light)",
                        border:`1px solid ${nd.days<=7?C.red+"33":C.green+"33"}`,
                        borderRadius:9, padding:"7px 12px" }}>
                        <Ico name="calendar" size={13} color={nd.days<=7?C.red:C.green}/>
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
      {/* Notification panel */}
      {showNotif&&<NotificationPanel projects={projects} session={session} profile={profile} onClose={()=>setShowNotif(false)}/>}
    </div>
  );
};


// ─── AI Chat ──────────────────────────────────────────────────
const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY ?? "";

function renderMarkdown(md) {
  // 1. HTML-escape first
  let h = md
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

  // 2. Headers (must run before bold so ## text isn't mangled)
  h = h.replace(/^### (.+)$/gm, "<div style='font-size:13px;font-weight:700;margin:10px 0 3px;color:var(--text)'>$1</div>");
  h = h.replace(/^## (.+)$/gm,  "<div style='font-size:14px;font-weight:700;margin:12px 0 4px;color:var(--text)'>$1</div>");

  // 3. Process line-by-line so list items don't bleed into each other
  const lines = h.split("\n");
  const out = [];
  let inUL = false, inOL = false;

  for (const raw of lines) {
    const ulMatch = raw.match(/^[-•]\s+(.+)$/);
    const olMatch = raw.match(/^(\d+)\.\s+(.+)$/);

    if (ulMatch) {
      if (inOL) { out.push("</ol>"); inOL = false; }
      if (!inUL) { out.push("<ul style='margin:6px 0;padding-left:0;list-style:none'>"); inUL = true; }
      out.push(`<li style='display:flex;gap:6px;margin:3px 0'><span style='color:var(--text-subtle);flex-shrink:0'>·</span><span>${ulMatch[1]}</span></li>`);
    } else if (olMatch) {
      if (inUL) { out.push("</ul>"); inUL = false; }
      if (!inOL) { out.push("<ol style='margin:6px 0;padding-left:18px'>"); inOL = true; }
      out.push(`<li style='margin:3px 0'>${olMatch[2]}</li>`);
    } else {
      if (inUL) { out.push("</ul>"); inUL = false; }
      if (inOL) { out.push("</ol>"); inOL = false; }
      out.push(raw === "" ? "<br/>" : raw);
    }
  }
  if (inUL) out.push("</ul>");
  if (inOL) out.push("</ol>");
  h = out.join("\n");

  // 4. Inline styles (after list processing so ** inside <li> works)
  h = h.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
  h = h.replace(/\*([^*\n]+?)\*/g, "<em>$1</em>");
  h = h.replace(/`([^`\n]+)`/g, "<code style='background:var(--surface-raised);padding:1px 5px;border-radius:4px;font-family:DM Mono,monospace;font-size:0.88em'>$1</code>");

  // 5. Paragraph breaks (consecutive non-list lines separated by blank)
  h = h.replace(/([^\n])\n([^\n<])/g, "$1<br/>$2");

  return h;
}

const AiPanel = ({ projects, allTasks, onClose }) => {
  const [msgs,   setMsgs]   = useState([]);
  const [input,  setInput]  = useState("");
  const [busy,   setBusy]   = useState(false);
  const bottomRef = useRef(null);
  const inputRef  = useRef(null);

  // Build project context summary — projects + progress + tasks
  const projectCtx = useMemo(() => {
    if (!projects.length) return "（目前無專案資料）";
    return projects.map(p => {
      const pct    = calcPct(p);
      const prods  = p.info.products.join(",") || "無";
      const intgs  = p.info.integrations.join(",") || "無";
      const launch = p.info.launchDate    ? `上線:${p.info.launchDate}`          : "";
      const dl1    = p.info.batch1Deadline? `第一批期限:${p.info.batch1Deadline}` : "";
      const dl2    = p.info.batch2Deadline? `第二批期限:${p.info.batch2Deadline}` : "";

      // Checklist progress
      const bc = p.basicChecked  ?? {};
      const fc = p.faqChecked    ?? {};
      const b2 = p.batch2Checked ?? {};
      const uncheckedBasic  = BASIC_ITEMS.filter(k => !bc[k]);
      const uncheckedFaq    = FAQ_ITEMS.filter(k => !fc[k]);
      const uncheckedBatch2 = [...BATCH2_ITEMS, GW_ITEM].filter(k => !b2[k]);

      // Tasks for this project
      const projTasks = (allTasks ?? []).filter(t => t.project_id === p.id);
      const taskSummary = projTasks.length
        ? projTasks.map(t => {
            const dateStr = t.type === "deadline"
              ? (t.deadline ? `截止:${t.deadline}` : "")
              : [t.period_start && `開始:${t.period_start}`, t.period_end && `結束:${t.period_end}`].filter(Boolean).join(" ");
            const vis = t.is_internal ? "內部" : "客戶可見";
            return `  任務[${t.name||"未命名"}] ${dateStr} ${vis}${t.description ? ` 說明:${t.description}` : ""}`;
          }).join("\n")
        : "  （無任務）";

      return [
        `【${p.info.name||"未命名"}】 ID:${p.info.hotelId||"-"} PIC:${p.info.pic||"-"}`,
        `  產品:${prods} 串接:${intgs} 完成度:${pct}%`,
        `  ${[launch,dl1,dl2].filter(Boolean).join(" ")}`,
        uncheckedBasic.length  ? `  基礎設定未完成(${uncheckedBasic.length}):${uncheckedBasic.join("、")}` : "  基礎設定:全部完成",
        uncheckedFaq.length    ? `  FAQ未完成(${uncheckedFaq.length}):${uncheckedFaq.join("、")}` : "  FAQ:全部完成",
        uncheckedBatch2.length ? `  第二批未完成(${uncheckedBatch2.length}):${uncheckedBatch2.join("、")}` : "  第二批:全部完成",
        `  任務列表:\n${taskSummary}`,
      ].join("\n");
    }).join("\n\n");
  }, [projects, allTasks]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior:"smooth" });
  }, [msgs, busy]);

  const sendText = async (text) => {
    const trimmed = text.trim();
    if (!trimmed || busy || !GEMINI_API_KEY) return;
    setInput("");
    const userMsg = { role:"user", text:trimmed };
    setMsgs(prev => [...prev, userMsg]);
    setBusy(true);

    const history = [...msgs, userMsg];
    const contents = history.map(m => ({
      role: m.role === "user" ? "user" : "model",
      parts: [{ text: m.text }],
    }));

    const systemPrompt = `你是飯店專案進度儀表板的 AI 助理。請根據以下專案資料，簡短、精確地回答問題（繁體中文、300字以內）。\n\n專案資料：\n${projectCtx}`;

    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite:generateContent?key=${GEMINI_API_KEY}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            system_instruction: { parts: [{ text: systemPrompt }] },
            contents,
            generationConfig: {
              maxOutputTokens: 8192,
              temperature: 0.4,
              thinkingConfig: { thinkingLevel: "low" },
            },
          }),
        }
      );
      const data = await res.json();
      const parts = data?.candidates?.[0]?.content?.parts ?? [];
      const reply = parts.find(p => !p.thought)?.text ?? parts[0]?.text ?? "（AI 無回應，請確認 API Key）";
      setMsgs(prev => [...prev, { role:"model", text: reply }]);
    } catch(e) {
      setMsgs(prev => [...prev, { role:"model", text: "⚠️ 呼叫 AI 失敗：" + e.message }]);
    }
    setBusy(false);
    setTimeout(() => inputRef.current?.focus(), 100);
  };
  const send = () => sendText(input);

  const handleKey = (e) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); }
  };

  return (
    <>
      <div onClick={onClose} style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.2)", zIndex:19998 }}/>
      <div style={{ position:"fixed", top:0, right:0, bottom:0, width:400,
        background:"var(--surface)", borderLeft:"1px solid var(--border)",
        boxShadow:"-6px 0 32px rgba(0,0,0,0.12)", zIndex:19999,
        display:"flex", flexDirection:"column", fontFamily:"inherit" }}>
        {/* Header */}
        <div style={{ padding:"16px 20px", borderBottom:"1px solid var(--border)",
          display:"flex", alignItems:"center", justifyContent:"space-between", flexShrink:0 }}>
          <div style={{ display:"flex", alignItems:"center", gap:10 }}>
            <div style={{ width:30, height:30, borderRadius:8, background:"var(--accent)",
              display:"flex", alignItems:"center", justifyContent:"center" }}>
              <Ico name="msgSquare" size={15} color="#fff"/>
            </div>
            <div>
              <div style={{ fontSize:14, fontWeight:700, color:"var(--text)" }}>AI 助理</div>
              <div style={{ fontSize:11, color:"var(--text-subtle)" }}>Gemini 3.1 Flash Lite</div>
            </div>
          </div>
          <button onClick={onClose}
            style={{ background:"none", border:"1px solid var(--border)", borderRadius:7,
              padding:"4px 10px", cursor:"pointer", fontSize:16, color:"var(--text-subtle)", fontFamily:"inherit" }}>✕</button>
        </div>

        {/* Messages */}
        <div style={{ flex:1, overflowY:"auto", padding:"16px 20px", display:"flex", flexDirection:"column", gap:12 }}>
          {msgs.length===0 && (
            <div style={{ display:"flex", flexDirection:"column", alignItems:"center", padding:"28px 0 8px" }}>
              <div style={{ width:44, height:44, borderRadius:12, background:"var(--accent-light,var(--blue-light,#eff6ff))",
                display:"flex", alignItems:"center", justifyContent:"center", marginBottom:12 }}>
                <Ico name="msgSquare" size={22} color="var(--accent)"/>
              </div>
              <div style={{ fontSize:13, color:"var(--text-subtle)", lineHeight:1.7, textAlign:"center", marginBottom:20 }}>
                你好！我能讀取所有專案資料，<br/>有什麼可以幫到你的嗎？
              </div>
              <div style={{ display:"flex", flexDirection:"column", gap:7, width:"100%" }}>
                {["有哪些專案快要到期？","完成度最低的是哪個？","現在有哪些事待完成？"].map(p => (
                  <button key={p} onClick={()=>sendText(p)}
                    style={{ padding:"9px 14px", borderRadius:10,
                      border:"1px solid var(--border)", background:"var(--surface-raised)",
                      cursor:"pointer", fontFamily:"inherit", fontSize:13,
                      color:"var(--text)", textAlign:"left", transition:"all 0.12s",
                      display:"flex", alignItems:"center", gap:8 }}>
                    <span style={{ fontSize:11, color:"var(--text-subtle)", flexShrink:0 }}>→</span>
                    {p}
                  </button>
                ))}
              </div>
            </div>
          )}
          {msgs.map((m, i) => (
            <div key={i} style={{ display:"flex", justifyContent:m.role==="user"?"flex-end":"flex-start" }}>
              <div style={{ maxWidth:"82%", padding:"9px 13px", borderRadius:14,
                borderBottomRightRadius:m.role==="user"?4:14,
                borderBottomLeftRadius:m.role==="user"?14:4,
                background:m.role==="user"?"var(--accent)":"var(--surface-raised)",
                border:m.role==="user"?"none":"1px solid var(--border)" }}>
                {m.role==="user" ? (
                  <span style={{ fontSize:13, color:"#fff", lineHeight:1.6 }}>{m.text}</span>
                ) : (
                  <div style={{ fontSize:13, color:"var(--text)", lineHeight:1.7 }}
                    dangerouslySetInnerHTML={{ __html: renderMarkdown(m.text) }}/>
                )}
              </div>
            </div>
          ))}
          {busy && (
            <div style={{ display:"flex", justifyContent:"flex-start" }}>
              <div style={{ padding:"10px 14px", borderRadius:14, borderBottomLeftRadius:4,
                background:"var(--surface-raised)", border:"1px solid var(--border)",
                display:"flex", gap:5, alignItems:"center" }}>
                {[0,1,2].map(i=>(
                  <div key={i} style={{ width:6, height:6, borderRadius:"50%", background:"var(--text-subtle)",
                    animation:"spin 1s linear infinite", animationDelay:`${i*0.2}s`, opacity:0.6 }}/>
                ))}
              </div>
            </div>
          )}
          <div ref={bottomRef}/>
        </div>

        {/* Input */}
        {!GEMINI_API_KEY && (
          <div style={{ padding:"8px 20px", background:"var(--amber-light)",
            borderTop:"1px solid var(--amber)", fontSize:12, color:"var(--amber)" }}>
            ⚠️ 未設定 VITE_GEMINI_API_KEY，AI 功能停用
          </div>
        )}
        <div style={{ padding:"12px 16px", borderTop:"1px solid var(--border)", flexShrink:0 }}>
          <div style={{ position:"relative", border:"1.5px solid var(--border)", borderRadius:14,
            background:"var(--surface)", transition:"border-color 0.15s" }}
            onFocusCapture={e=>e.currentTarget.style.borderColor="var(--accent)"}
            onBlurCapture={e=>e.currentTarget.style.borderColor="var(--border)"}>
            <textarea ref={inputRef} value={input} onChange={e=>setInput(e.target.value)}
              onKeyDown={handleKey} placeholder="輸入問題，Enter 送出…" rows={2}
              disabled={!GEMINI_API_KEY}
              style={{ display:"block", width:"100%", border:"none", background:"transparent",
                resize:"none", fontSize:13, lineHeight:1.6, outline:"none",
                color:"var(--text)", fontFamily:"inherit",
                padding:"10px 48px 10px 14px", boxSizing:"border-box" }}/>
            <button onClick={send} disabled={!input.trim()||busy||!GEMINI_API_KEY}
              style={{ position:"absolute", right:8, bottom:8, width:32, height:32,
                borderRadius:9, border:"none",
                background:input.trim()&&!busy&&GEMINI_API_KEY?"var(--accent)":"var(--border)",
                cursor:input.trim()&&!busy&&GEMINI_API_KEY?"pointer":"default",
                display:"flex", alignItems:"center", justifyContent:"center", transition:"background 0.15s" }}>
              <Ico name="send" size={14} color="#fff"/>
            </button>
          </div>
          <div style={{ marginTop:6, fontSize:11, color:"var(--text-subtle)", textAlign:"center" }}>
            Enter 送出 · Shift+Enter 換行
          </div>
        </div>
      </div>
    </>
  );
};


// ─── CustomerAccessPanel ──────────────────────────────────────
const CustomerAccessPanel = ({ hotelId, projectId, session, onClose }) => {
  const [emails,   setEmails]   = useState([]);
  const [newEmail, setNewEmail] = useState("");
  const [loading,  setLoading]  = useState(false);
  const [adding,   setAdding]   = useState(false);
  const [removing, setRemoving] = useState(null); // email being removed
  const [error,    setError]    = useState("");

  const authHeader = { Authorization: `Bearer ${session?.access_token ?? ""}` };

  const fetchEmails = async () => {
    setLoading(true);
    const { data } = await sb
      .from("customer_access")
      .select("email, created_at")
      .eq("hotel_id", hotelId)
      .order("created_at", { ascending: true });
    setEmails(data ?? []);
    setLoading(false);
  };

  useEffect(() => { if (hotelId) fetchEmails(); }, [hotelId]); // eslint-disable-line

  const handleAdd = async () => {
    const email = newEmail.trim().toLowerCase();
    if (!email || adding) return;
    if (!email.includes("@")) { setError("請輸入有效的 email 格式"); return; }
    setAdding(true); setError("");
    const res = await fetch(CUSTOMER_ACCESS_MANAGE, {
      method: "POST",
      headers: { ...authHeader, "Content-Type": "application/json" },
      body: JSON.stringify({ action: "add", hotel_id: hotelId, email }),
    });
    if (res.ok) { setNewEmail(""); await fetchEmails(); }
    else setError("新增失敗，請確認 email 格式後再試");
    setAdding(false);
  };

  const handleRemove = async (email) => {
    if (removing) return;
    setRemoving(email);
    const res = await fetch(CUSTOMER_ACCESS_MANAGE, {
      method: "POST",
      headers: { ...authHeader, "Content-Type": "application/json" },
      body: JSON.stringify({ action: "remove", hotel_id: hotelId, email }),
    });
    if (res.ok) await fetchEmails();
    else setError("移除失敗，請稍後再試");
    setRemoving(null);
  };

  return (
    <>
      <div onClick={onClose} style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.3)", zIndex:20000 }}/>
      <div style={{ position:"fixed", top:0, right:0, bottom:0, width:380, background:"var(--surface)",
        borderLeft:"1px solid var(--border)", boxShadow:"-4px 0 24px rgba(0,0,0,0.12)",
        zIndex:20001, display:"flex", flexDirection:"column", fontFamily:"inherit" }}>

        {/* Header */}
        <div style={{ padding:"20px 20px 16px", borderBottom:"1px solid var(--border)",
          display:"flex", alignItems:"center", justifyContent:"space-between" }}>
          <div>
            <div style={{ fontSize:15, fontWeight:700, color:"var(--text)" }}>客戶存取管理</div>
            <div style={{ fontSize:12, color:"var(--text-subtle)", marginTop:2 }}>
              Hotel ID: <span style={{ fontFamily:"'DM Mono',monospace" }}>{hotelId || "—"}</span>
            </div>
          </div>
          <button onClick={onClose} style={{ background:"none", border:"1px solid var(--border)",
            borderRadius:8, padding:"4px 10px", cursor:"pointer", fontSize:16,
            color:"var(--text-subtle)", fontFamily:"inherit" }}>✕</button>
        </div>

        {/* Email list */}
        <div style={{ flex:1, overflowY:"auto", padding:20 }}>
          {loading ? (
            <div style={{ textAlign:"center", padding:"40px 0", color:"var(--text-subtle)" }}>
              <div style={{ width:24, height:24, border:"2.5px solid var(--border)",
                borderTopColor:"var(--accent)", borderRadius:"50%",
                animation:"spin 0.7s linear infinite", margin:"0 auto 10px" }}/>
              載入中…
            </div>
          ) : emails.length === 0 ? (
            <div style={{ textAlign:"center", padding:"40px 0", color:"var(--text-subtle)", fontSize:13 }}>
              <Ico name="user" size={28} color="var(--border-mid)"/>
              <div style={{ marginTop:10 }}>尚未指定任何客戶存取權限</div>
            </div>
          ) : (
            <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
              {emails.map(({ email, created_at }) => (
                <div key={email} style={{ display:"flex", alignItems:"center", gap:10,
                  padding:"10px 14px", borderRadius:10, background:"var(--surface-raised)",
                  border:"1px solid var(--border)" }}>
                  <Ico name="user" size={14} color="var(--text-subtle)"/>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ fontSize:13, color:"var(--text)", overflow:"hidden",
                      textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{email}</div>
                    <div style={{ fontSize:11, color:"var(--text-subtle)", marginTop:1 }}>
                      {new Date(created_at).toLocaleDateString("zh-TW")} 新增
                    </div>
                  </div>
                  <button onClick={() => handleRemove(email)}
                    disabled={removing === email}
                    style={{ background:"none", border:"1px solid var(--border)", borderRadius:7,
                      padding:"4px 8px", cursor:"pointer", color:"var(--text-subtle)",
                      fontFamily:"inherit", transition:"all 0.12s", flexShrink:0 }}
                    onMouseEnter={e=>{ e.currentTarget.style.borderColor="var(--red)"; e.currentTarget.style.color="var(--red)"; }}
                    onMouseLeave={e=>{ e.currentTarget.style.borderColor="var(--border)"; e.currentTarget.style.color="var(--text-subtle)"; }}>
                    {removing === email
                      ? <div style={{ width:12, height:12, border:"2px solid var(--border-mid)",
                          borderTopColor:"var(--red)", borderRadius:"50%",
                          animation:"spin 0.7s linear infinite" }}/>
                      : <Ico name="trash" size={13} color="currentColor"/>}
                  </button>
                </div>
              ))}
            </div>
          )}

          {error && (
            <div style={{ marginTop:14, padding:"9px 14px", background:"var(--red-light)",
              border:"1px solid rgba(220,38,38,0.25)", borderRadius:9,
              fontSize:12, color:"var(--red)" }}>
              {error}
            </div>
          )}
        </div>

        {/* Add email */}
        <div style={{ padding:"16px 20px", borderTop:"1px solid var(--border)", flexShrink:0 }}>
          <label style={{ display:"block", fontSize:11, fontWeight:600, letterSpacing:"0.08em",
            textTransform:"uppercase", color:"var(--text-mid)", marginBottom:8 }}>
            新增客戶 Email
          </label>
          <div style={{ display:"flex", gap:8 }}>
            <input type="email" value={newEmail}
              onChange={e=>{ setNewEmail(e.target.value); setError(""); }}
              onKeyDown={e=>e.key==="Enter" && handleAdd()}
              placeholder="client@hotel.com"
              style={{ flex:1, minWidth:0, border:"1.5px solid var(--border)", borderRadius:10,
                padding:"9px 12px", fontSize:13, background:"var(--surface)",
                color:"var(--text)", fontFamily:"inherit", outline:"none" }}
              onFocus={e=>(e.target.style.borderColor="var(--accent)")}
              onBlur={e=>(e.target.style.borderColor="var(--border)")}/>
            <button onClick={handleAdd} disabled={!newEmail.trim() || adding}
              style={{ padding:"0 16px", borderRadius:10, border:"none", flexShrink:0,
                background:newEmail.trim()&&!adding?"var(--accent)":"var(--border)",
                color:"#fff", fontFamily:"inherit", fontSize:13, fontWeight:700,
                cursor:newEmail.trim()&&!adding?"pointer":"default",
                display:"flex", alignItems:"center", gap:6, transition:"background 0.15s",
                whiteSpace:"nowrap" }}>
              {adding
                ? <div style={{ width:13, height:13, border:"2px solid rgba(255,255,255,0.4)",
                    borderTopColor:"#fff", borderRadius:"50%", animation:"spin 0.7s linear infinite" }}/>
                : <Ico name="user" size={13} color="#fff"/>}
              新增
            </button>
          </div>
        </div>
      </div>
    </>
  );
};

// ─── JiraTab ──────────────────────────────────────────────────
const JIRA_PROXY              = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/jira-proxy`;
const CUSTOMER_ACCESS_MANAGE  = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/customer-access-manage`;
const JIRA_ANON  = import.meta.env.VITE_SUPABASE_ANON_KEY;

const JIRA_STATUSES = ["交付","DEV","DEV_DONE","IN MONITOR","審核中","IN VERIFICATION","INIT","INIT_DONE","LINK TO RD JIRA","PROCESSING","TEST","TEST_DONE","完成"];

// 顏色依 statusCategory 決定，不依賴狀態名稱字串
// key: "new" = 待辦（灰）, "indeterminate" = 進行中（藍）, "done" = 完成（綠）
function statusStyle(statusCategory) {
  if (statusCategory === "done")          return { bg:"#D1FAE5", color:"#065F46" };
  if (statusCategory === "indeterminate") return { bg:"#DBEAFE", color:"#1E40AF" };
  return { bg:"var(--border)", color:"var(--text-mid)" };
}

async function jiraFetch(action, params = {}, body = null, accessToken = null) {
  const url = new URL(JIRA_PROXY);
  url.searchParams.set("action", action);
  Object.entries(params).forEach(([k,v]) => url.searchParams.set(k, v));
  try {
    const headers = {
      Authorization: `Bearer ${JIRA_ANON}`,
      "Content-Type": "application/json",
    };
    if (accessToken) headers["x-user-token"] = accessToken;
    const res = await fetch(url.toString(), {
      method: body ? "POST" : "GET",
      headers,
      body: body ? JSON.stringify(body) : undefined,
      cache: "no-store",
    });
    if (!res.ok) return { error: `HTTP ${res.status}` };
    return res.json();
  } catch(e) {
    return { error: e.message ?? "network error" };
  }
}

function parseEpicId(epicUrl) {
  if (!epicUrl) return null;
  const m = epicUrl.match(/browse\/(AHP-\d+)/i);
  return m ? m[1].toUpperCase() : null;
}

const JiraTab = ({ epicUrl, projectInfo, projectId, onBack, onNext, accessToken }) => {
  const epicId = parseEpicId(epicUrl);
  const [issues,      setIssues]      = useState([]);
  const [loading,     setLoading]     = useState(false);
  const [error,       setError]       = useState("");
  const [transitions, setTransitions] = useState({});
  const [activeKey,   setActiveKey]   = useState(null);
  const [updating,    setUpdating]    = useState({});
  const [descLoading, setDescLoading] = useState(false);
  const [descSuccess, setDescSuccess] = useState(false);

  const fetchIssues = async () => {
    if (!epicId) return;
    setLoading(true); setError("");
    const data = await jiraFetch("issues", { epicId }, null, accessToken);
    if (data.error) setError("無法讀取 Jira 資料，請確認 Epic 連結是否正確。");
    else setIssues(data.issues ?? []);
    setLoading(false);
  };

  const handleUpdateDescription = async () => {
    if (!epicId) return;
    setDescLoading(true); setDescSuccess(false); setError("");
    const data = await jiraFetch("updateDescription", {}, {
      epicId,
      hotelName:    projectInfo?.name         ?? "",
      hotelId:      projectInfo?.hotelId      ?? "",
      products:     projectInfo?.products     ?? [],
      integrations: projectInfo?.integrations ?? [],
      avaUnits:     projectInfo?.avaUnits     ?? "",
      avaSpare:     projectInfo?.avaSpare     ?? "",
      avtUnits:     projectInfo?.avtUnits     ?? "",
    }, accessToken);
    if (data.success) setDescSuccess(true);
    else setError("更新 Epic Description 失敗，請稍後再試。");
    setDescLoading(false);
    setTimeout(() => setDescSuccess(false), 3000);
  };

  useEffect(() => { if (epicId) fetchIssues(); }, [epicId]); // eslint-disable-line

  const openDropdown = async (issueKey) => {
    if (activeKey === issueKey) { setActiveKey(null); return; }
    setActiveKey(issueKey);
    if (!transitions[issueKey]) {
      const data = await jiraFetch("transitions", { issueKey }, null, accessToken);
      setTransitions(prev => ({ ...prev, [issueKey]: data.transitions ?? [] }));
    }
  };

  const doTransition = async (issueKey, transitionId, toName, toCategory) => {
    const fromStatus = issues.find(i => i.key === issueKey)?.status ?? "";
    setUpdating(prev => ({ ...prev, [issueKey]: true }));
    setActiveKey(null);
    // 樂觀更新：立即更新 UI
    setIssues(prev => prev.map(i => i.key===issueKey
      ? { ...i, status: toName, statusCategory: toCategory }
      : i
    ));
    const data = await jiraFetch("transition", {}, {
      issueKey, transitionId,
      fromStatus, toStatus: toName, projectId,
    }, accessToken);
    if (!data.success) {
      setError(`更新 ${issueKey} 狀態失敗，請重新同步`);
      fetchIssues();
    }
    setUpdating(prev => ({ ...prev, [issueKey]: false }));
  };

  const st = (issue) => statusStyle(issue.statusCategory ?? "new");

  return (
    <div style={{ animation:"fadeIn 0.25s ease" }}>
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:24 }}>
        <div>
          <h2 style={{ fontSize:20, fontWeight:700, color:C.text, margin:"0 0 4px" }}>Jira 子任務</h2>
          {epicId
            ? <p style={{ fontSize:13, color:C.textMid, margin:0 }}>Epic：<span style={{ fontFamily:"'DM Mono',monospace", color:C.blue }}>{epicId}</span></p>
            : <p style={{ fontSize:13, color:C.red, margin:0 }}>尚未填寫 Jira Epic 連結，請至「專案資訊」tab 填寫。</p>}
        </div>
        {epicId && (
          <div style={{ display:"flex", gap:8 }}>
            <button onClick={handleUpdateDescription} disabled={descLoading}
              style={{ display:"flex", alignItems:"center", gap:6,
                background:descSuccess?C.greenLight:C.white,
                border:`1px solid ${descSuccess?C.green:C.border}`, borderRadius:9, padding:"7px 14px",
                cursor:descLoading?"wait":"pointer", fontSize:13,
                color:descSuccess?C.green:C.textMid, fontFamily:"inherit", transition:"all 0.2s" }}>
              {descLoading?"更新中…":descSuccess?"✓ 已更新":<><Ico name="fileText" size={13} color="currentColor"/> 更新 Epic Description</>}
            </button>
            <button onClick={fetchIssues} disabled={loading}
              style={{ display:"flex", alignItems:"center", gap:6, background:C.white,
                border:`1px solid ${C.border}`, borderRadius:9, padding:"7px 14px",
                cursor:loading?"wait":"pointer", fontSize:13, color:C.textMid, fontFamily:"inherit" }}>
              {loading ? "同步中…" : <><Ico name="refresh" size={13} color="currentColor"/> 同步 Jira</>}
            </button>
          </div>
        )}
      </div>

      {error && (
        <div style={{ background:"var(--red-light)", border:`1px solid ${C.red}44`, borderRadius:10,
          padding:"10px 16px", fontSize:13, color:C.red, marginBottom:16 }}>{error}</div>
      )}

      {loading && (
        <div style={{ textAlign:"center", padding:"40px 0", color:C.textMid }}>
          <div style={{ width:28, height:28, border:`3px solid ${C.blueBorder}`, borderTopColor:C.blue,
            borderRadius:"50%", animation:"spin 0.8s linear infinite", margin:"0 auto 12px" }}/>
          載入 Jira 子任務中…
        </div>
      )}

      {!loading && epicId && issues.length===0 && !error && (
        <div style={{ textAlign:"center", padding:"48px 0", color:C.textLight }}>
          <div style={{ marginBottom:10 }}><Ico name="clipboardList" size={32} color="var(--text-subtle)"/></div>
          <div style={{ fontSize:14 }}>此 Epic 底下尚無子任務</div>
        </div>
      )}

      {!loading && issues.length>0 && (
        <div style={{ display:"flex", flexDirection:"column", gap:10, marginBottom:8 }}>
          {/* Header */}
          <div style={{ display:"grid", gridTemplateColumns:"120px 1fr 160px 140px",
            gap:12, padding:"6px 16px", fontSize:11, fontWeight:700,
            color:C.textLight, letterSpacing:"0.08em", textTransform:"uppercase" }}>
            <span>Issue</span><span>名稱</span><span>負責人</span><span>狀態</span>
          </div>
          {issues.map(issue => {
            const s = st(issue);
            const trans = transitions[issue.key] ?? [];
            const isOpen = activeKey===issue.key;
            const isUpdating = !!updating[issue.key];
            return (
              <div key={issue.key} style={{ background:C.white, border:`1px solid ${C.border}`,
                borderRadius:12, padding:"12px 16px", position:"relative" }}>
                <div style={{ display:"grid", gridTemplateColumns:"120px 1fr 160px 140px",
                  gap:12, alignItems:"center" }}>
                  {/* Key */}
                  <a href={`https://aiello-eng.atlassian.net/browse/${issue.key}`}
                    target="_blank" rel="noreferrer"
                    style={{ fontSize:12, fontWeight:700, color:"#0052cc", textDecoration:"none",
                      fontFamily:"'DM Mono',monospace", background:"#e9f0ff",
                      border:"1px solid #b3c7f7", borderRadius:6, padding:"3px 8px",
                      display:"inline-block", whiteSpace:"nowrap" }}>
                    {issue.key}
                  </a>
                  {/* Summary */}
                  <span style={{ fontSize:13, color:C.text, lineHeight:1.4 }}>{issue.summary}</span>
                  {/* Assignee */}
                  <span style={{ fontSize:12, color:C.textMid, overflow:"hidden",
                    textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
                    {issue.assignee ?? "—"}
                  </span>
                  {/* Status dropdown trigger */}
                  <div style={{ position:"relative" }}>
                    <button onClick={()=>openDropdown(issue.key)} disabled={isUpdating}
                      style={{ display:"flex", alignItems:"center", gap:6, padding:"5px 10px",
                        borderRadius:8, border:`1px solid ${s.color}44`,
                        background:s.bg, color:s.color, fontSize:12, fontWeight:700,
                        cursor:isUpdating?"wait":"pointer", fontFamily:"inherit",
                        width:"100%", justifyContent:"space-between" }}>
                      <span>{isUpdating ? "更新中…" : issue.status}</span>
                      {!isUpdating && <span style={{ fontSize:10 }}>▾</span>}
                    </button>
                    {/* Dropdown */}
                    {isOpen && trans.length>0 && (
                      <div style={{ position:"absolute", top:"calc(100% + 4px)", left:0, right:0,
                        background:C.white, border:`1px solid ${C.border}`, borderRadius:10,
                        boxShadow:"0 8px 24px rgba(0,0,0,0.12)", zIndex:100, overflow:"hidden" }}>
                        {trans.map(t => {
                          const ts = statusStyle(t.statusCategory ?? "new");
                          return (
                            <button key={t.id} onClick={()=>doTransition(issue.key, t.id, t.name, t.statusCategory ?? "new")}
                              style={{ display:"flex", alignItems:"center", gap:8, width:"100%",
                                padding:"8px 12px", background:"none", border:"none",
                                cursor:"pointer", fontFamily:"inherit", textAlign:"left",
                                borderBottom:`1px solid ${C.border}` }}
                              onMouseEnter={e=>e.currentTarget.style.background=C.bg}
                              onMouseLeave={e=>e.currentTarget.style.background="none"}>
                              <span style={{ padding:"2px 8px", borderRadius:6, fontSize:11,
                                fontWeight:700, background:ts.bg, color:ts.color,
                                whiteSpace:"nowrap" }}>{t.name}</span>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
          <div style={{ fontSize:12, color:C.textLight, textAlign:"right", marginTop:4 }}>
            共 {issues.length} 筆子任務・點擊狀態標籤可切換
          </div>
        </div>
      )}

      <div style={{ marginTop:24 }}>
        <NavRow onBack={onBack} onNext={onNext} nextLabel="下一步：任務紀錄 →" nextColor={C.blue}/>
      </div>

      {/* Close dropdown on outside click */}
      {activeKey && (
        <div onClick={()=>setActiveKey(null)}
          style={{ position:"fixed", inset:0, zIndex:99 }}/>
      )}
    </div>
  );
};

// ─── TasksTab ─────────────────────────────────────────────────
const TasksTab = ({ projectId, tasks, onTasksChange }) => {
  const taskTimer = useRef({});
  const [selectedIds, setSelectedIds] = useState(new Set());

  const toggleSelect = (id) => setSelectedIds(prev => {
    const next = new Set(prev);
    next.has(id) ? next.delete(id) : next.add(id);
    return next;
  });
  const isAllSelected = tasks.length > 0 && selectedIds.size === tasks.length;
  const toggleSelectAll = () => setSelectedIds(isAllSelected ? new Set() : new Set(tasks.map(t => t.id)));

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
    if (!window.confirm("確定要刪除此任務嗎？此操作無法還原。")) return;
    onTasksChange(tasks.filter(t=>t.id!==id));
    setSelectedIds(prev => { const next = new Set(prev); next.delete(id); return next; });
    await sb.from("tasks").delete().eq("id", id);
  };

  const removeSelected = async () => {
    if (!selectedIds.size) return;
    if (!window.confirm(`確定要刪除選取的 ${selectedIds.size} 筆任務嗎？此操作無法還原。`)) return;
    const ids = [...selectedIds];
    onTasksChange(tasks.filter(t => !ids.includes(t.id)));
    setSelectedIds(new Set());
    await Promise.all(ids.map(id => sb.from("tasks").delete().eq("id", id)));
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
        url:t.url||"", is_internal:t.is_internal??true,
      });
    }, 800);
  };

  return (
    <div style={{ animation:"fadeIn 0.25s ease" }}>
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:selectedIds.size>0?12:24 }}>
        <div>
          <h2 style={{ fontSize:20, fontWeight:700, color:C.text, margin:"0 0 4px" }}>任務紀錄</h2>
          <p style={{ fontSize:13, color:C.textMid, margin:0 }}>記錄與此專案相關的任務與期限</p>
        </div>
        <div style={{ display:"flex", gap:8, alignItems:"center" }}>
          {tasks.length > 0 && (
            <button onClick={toggleSelectAll}
              style={{ background:C.bg, color:C.textMid, border:`1px solid ${C.border}`,
                borderRadius:8, padding:"7px 14px", fontSize:12, cursor:"pointer", fontFamily:"inherit" }}>
              {isAllSelected ? "取消全選" : "全選"}
            </button>
          )}
          <button onClick={addTask} style={{ background:C.blue, color:"#fff", border:"none",
            borderRadius:10, padding:"9px 18px", fontSize:13, fontWeight:700,
            cursor:"pointer", fontFamily:"inherit", boxShadow:`0 2px 8px ${C.blue}40` }}>+ 新增任務</button>
        </div>
      </div>

      {/* 批次操作列 */}
      {selectedIds.size > 0 && (
        <div style={{ display:"flex", alignItems:"center", gap:12, padding:"10px 16px",
          background:C.blueLight, border:`1px solid ${C.blueBorder}`, borderRadius:12, marginBottom:16 }}>
          <span style={{ fontSize:13, color:C.blue, fontWeight:600 }}>已選取 {selectedIds.size} 筆</span>
          <button onClick={removeSelected}
            style={{ marginLeft:"auto", padding:"6px 16px", background:C.red, color:"#fff", border:"none",
              borderRadius:8, fontSize:13, fontWeight:700, cursor:"pointer", fontFamily:"inherit" }}>
            <><Ico name="trash" size={13} color="currentColor"/> 刪除選取（{selectedIds.size}）</>
          </button>
        </div>
      )}

      {tasks.length===0 ? (
        <div style={{ textAlign:"center", padding:"50px 0", color:C.textLight }}>
          <div style={{ marginBottom:10 }}><Ico name="clipboardList" size={32} color="var(--text-subtle)"/></div>
          <div style={{ fontSize:14, fontWeight:500 }}>尚無任務，點擊右上角「新增任務」開始</div>
        </div>
      ) : (
        <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
          {tasks.map((task, idx) => {
            const isSelected = selectedIds.has(task.id);
            return (
            <Card key={task.id} style={{ padding:20, border:`1px solid ${isSelected ? C.blueBorder : C.border}`, background:isSelected ? C.blueLight : C.white }}>
              <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", gap:12, marginBottom:16 }}>
                <div style={{ display:"flex", alignItems:"center", gap:10, flex:1 }}>
                  {/* Checkbox */}
                  <div onClick={()=>toggleSelect(task.id)}
                    style={{ width:18, height:18, borderRadius:5, flexShrink:0, cursor:"pointer",
                      border:`2px solid ${isSelected ? C.blue : C.borderMid}`,
                      background:isSelected ? C.blue : C.white,
                      display:"flex", alignItems:"center", justifyContent:"center" }}>
                    {isSelected && <span style={{ color:"#fff", fontSize:11, lineHeight:1 }}>✓</span>}
                  </div>
                  <span style={{ fontSize:11, fontWeight:700, color:C.textLight, minWidth:24 }}>#{idx+1}</span>
                  <input value={task.name} onChange={e=>updateTask(task.id,"name",e.target.value)}
                    placeholder="任務名稱" style={{ ...baseInput, fontSize:15, fontWeight:600, padding:"8px 12px" }}
                    onFocus={e=>(e.target.style.borderColor=C.blue)} onBlur={e=>(e.target.style.borderColor=C.border)}/>
                </div>
                <button onClick={()=>removeTask(task.id)}
                  style={{ background:"none", border:`1px solid ${C.border}`, borderRadius:7, padding:"5px 10px",
                    cursor:"pointer", fontSize:13, color:C.textLight, transition:"all 0.15s", fontFamily:"inherit", flexShrink:0 }}
                  onMouseEnter={e=>{ e.currentTarget.style.background="var(--red-subtle)"; e.currentTarget.style.borderColor="var(--red)"; e.currentTarget.style.color="var(--red)"; }}
                  onMouseLeave={e=>{ e.currentTarget.style.background="none"; e.currentTarget.style.borderColor=C.border; e.currentTarget.style.color=C.textLight; }}><Ico name="trash" size={14} color="currentColor"/></button>
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
                  {[{ v:"deadline", ico:"pin", text:"期限" }, { v:"period", ico:"repeat", text:"週期" }].map(({ v, ico, text }) => (
                    <button key={v} onClick={()=>updateTask(task.id,"type",v)}
                      style={{ padding:"7px 18px", borderRadius:8, fontFamily:"inherit", fontSize:13, fontWeight:600,
                        cursor:"pointer", transition:"all 0.15s",
                        border:`1.5px solid ${task.type===v?C.blue:C.border}`,
                        background:task.type===v?C.blue:C.white, color:task.type===v?"#fff":C.textMid,
                        display:"flex", alignItems:"center", gap:5 }}>
                      <Ico name={ico} size={13} color="currentColor"/>{text}
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
                      style={{ ...baseInput, borderColor:C.border, background:C.greenLight }}
                      onFocus={e=>(e.target.style.borderColor=C.green)} onBlur={e=>(e.target.style.borderColor=C.border)}/>
                  </div>
                  <div>
                    <label style={{ display:"block", fontSize:11, letterSpacing:1.5, color:C.purple, textTransform:"uppercase", marginBottom:7, fontWeight:600 }}>結束日期</label>
                    <input type="date" value={task.period_end||""} onChange={e=>updateTask(task.id,"period_end",e.target.value)}
                      style={{ ...baseInput, borderColor:C.border, background:C.purpleLight }}
                      onFocus={e=>(e.target.style.borderColor=C.purple)} onBlur={e=>(e.target.style.borderColor=C.border)}/>
                  </div>
                  {task.period_start && task.period_end && task.period_end < task.period_start && (
                    <div style={{ gridColumn:"1/-1", padding:"8px 12px", background:"var(--red-light)", border:`1px solid ${C.red}44`, borderRadius:8, fontSize:12, color:C.red }}>
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

              {/* 客戶可見度 toggle */}
              <div style={{ marginTop:18, paddingTop:16, borderTop:`1px solid ${C.border}`,
                display:"flex", alignItems:"center", justifyContent:"space-between" }}>
                <div>
                  <div style={{ fontSize:12, fontWeight:600, color:C.text }}>對客戶公開</div>
                  <div style={{ fontSize:11, color:C.textLight, marginTop:2 }}>
                    {task.is_internal ? "僅限內部可見" : "客戶端儀表可見"}
                  </div>
                </div>
                <button
                  onClick={() => updateTask(task.id, "is_internal", !task.is_internal)}
                  style={{
                    position:"relative", width:44, height:24, borderRadius:12, border:"none",
                    background: task.is_internal ? C.borderMid : C.green,
                    cursor:"pointer", transition:"background 0.2s", flexShrink:0,
                  }}>
                  <div style={{
                    position:"absolute", top:3, left: task.is_internal ? 3 : 23,
                    width:18, height:18, borderRadius:"50%", background:"#fff",
                    transition:"left 0.2s", boxShadow:"0 1px 3px rgba(0,0,0,0.2)",
                  }}/>
                </button>
              </div>
            </Card>
            );
          })}
        </div>
      )}
    </div>
  );
};

// ─── ProjectDetail ────────────────────────────────────────────
const ProjectDetail = ({ project, isNew, onUpdate, onBack, onDelete, allPics, session, profile }) => {
  const [step, setStep] = useState(isNew ? 0 : 5);
  const [info,          setInfoLocal]     = useState(project.info);
  const [basicChecked,  setBasicChecked]  = useState(project.basicChecked);
  const [basicNotes,    setBasicNotes]    = useState(project.basicNotes   || {});
  const [faqChecked,    setFaqChecked]    = useState(project.faqChecked);
  const [faqNotes,      setFaqNotes]      = useState(project.faqNotes     || {});
  const [batch2Checked, setBatch2Checked] = useState(project.batch2Checked);
  const [batch2Notes,   setBatch2Notes]   = useState(project.batch2Notes  || {});
  const [sheetLinks,    setSheetLinks]    = useState(project.sheetLinks);
  const [tasks,         setTasks]         = useState(project.tasks || []);
  const [saveStatus,       setSaveStatus]       = useState("idle");
  const [showCustomerAccess, setShowCustomerAccess] = useState(false);
  const [projSub,       setProjSub]       = useState(null);
  const [subLoading,    setSubLoading]    = useState(false);
  const [copiedHotelId, setCopiedHotelId] = useState(false);
  const [jiraBoot, setJiraBoot] = useState({ open:false, step:"idle", epicKey:"", epicUrl:"", created:0, failed:[], issueTypeName:"", reporterName:"", errorMsg:"" });
  const saveTimer = useRef(null);

  useEffect(() => {
    (async()=>{
      // ── 進入頁面時從 DB 拉最新 progress（確保看到客戶最新勾選狀態）──
      const { data: prog } = await sb
        .from("project_progress")
        .select("basic_checked, faq_checked, batch2_checked")
        .eq("project_id", project.id)
        .maybeSingle();
      if (prog) {
        if (prog.basic_checked)  setBasicChecked(prev  => ({ ...prev,  ...prog.basic_checked  }));
        if (prog.faq_checked)    setFaqChecked(prev    => ({ ...prev,  ...prog.faq_checked    }));
        if (prog.batch2_checked) setBatch2Checked(prev => ({ ...prev,  ...prog.batch2_checked }));
      }

      // ── Push subscription 恢復 ──────────────────────────────────────
      if (!("serviceWorker" in navigator)) return;
      const reg = await navigator.serviceWorker.getRegistration("/sw.js");
      if (!reg) return;
      const pushSub = await reg.pushManager.getSubscription();
      if (!pushSub) return;
      const { data } = await sb.from("push_subscriptions").select("*").eq("endpoint",pushSub.endpoint).maybeSingle();
      if (data) setProjSub(data);
    })();
  }, [project.id]); // eslint-disable-line

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
  const toggleCheck = useCallback((setter, key, field) => {
    setter(p => {
      const newVal = !p[key];
      sb.rpc("update_check_item", {
        p_project_id: project.id,
        p_field: field,
        p_key: key,
        p_value: newVal,
      }).then(({ error }) => { if (error) console.error("[toggleCheck] RPC error:", error.message); });
      return { ...p, [key]: newVal };
    });
  }, [project.id]); // eslint-disable-line

  const bootstrapJira = async () => {
    const hotelName = info.name.trim();
    if (!hotelName) return;
    setJiraBoot({ open:true, step:"creating_epic", epicKey:"", epicUrl:"", created:0, failed:[], issueTypeName:"", reporterName:"" });

    try {
      // Step 1: 判斷是否使用個人 token
      // 有個人 token → reporter 自動是本人，不需要 searchUser
      // 無個人 token → Fallback AlanFang，用 searchUser 查 PIC accountId 設 reporter
      const hasPersonalToken = !!(profile?.jira_email && profile?.jira_token);
      let reporterAccountId = null;
      let reporterName = "";

      if (!hasPersonalToken && info.pic?.trim()) {
        const userRes = await jiraFetch("searchUser", { query: info.pic.trim() }, null, session?.access_token);
        const users = userRes.users ?? [];
        const match = users.find(u => u.displayName === info.pic.trim()) || users[0];
        if (match) { reporterAccountId = match.accountId; reporterName = match.displayName; }
      }

      // Step 2: 建立 Epic
      const epicRes = await jiraFetch("createEpic", {}, { hotelName, reporterAccountId }, session?.access_token);
      if (epicRes.error) {
        setJiraBoot(p=>({ ...p, step:"error", errorMsg: typeof epicRes.error === "string" ? epicRes.error : JSON.stringify(epicRes.error) }));
        return;
      }
      const { epicKey, epicUrl } = epicRes;

      // Step 3: 查詢 AHP issue types，優先選 Task / 任务
      const typesRes = await jiraFetch("getIssueTypes", {}, null, session?.access_token);
      const types = typesRes.types ?? [];
      const SKIP   = /epic|子任務|subtask|sub-task/i;
      const PREFER = /^(task|任务)$/i;
      const taskType =
        types.find(t => PREFER.test(t.name)) ||
        types.find(t => !SKIP.test(t.name))  ||
        types[0];
      const issueTypeName = taskType?.name ?? "Task";

      setJiraBoot(p=>({ ...p, step:"creating_tasks", epicKey, epicUrl, issueTypeName, reporterName }));

      // Step 4: 批次建立 51 筆子任務
      const taskRes = await jiraFetch("createTasks", {}, { epicKey, hotelName, issueTypeName, reporterAccountId }, session?.access_token);
      if (taskRes.error) {
        setJiraBoot(p=>({ ...p, step:"error", errorMsg: typeof taskRes.error === "string" ? taskRes.error : JSON.stringify(taskRes.error) }));
        return;
      }

      // Step 5: 直接寫 Supabase，確保 Epic URL 持久化
      await sb.from("projects").update({ jira_epic: epicUrl }).eq("id", project.id);

      setInfo(p=>({ ...p, jiraEpic: epicUrl }));
      setJiraBoot(p=>({ ...p, step:"done", created:taskRes.created, failed:taskRes.failed??[], issueTypeName, reporterName }));

    } catch (err) {
      console.error("bootstrapJira error:", err);
      setJiraBoot(p=>({ ...p, step:"error", errorMsg: err?.message || String(err) || "JavaScript 執行錯誤" }));
    }
  };

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

  // Steps: 0=info, 1=batch1, 2=batch2, 3=jira, 4=tasks, 5=overview
  const STEPS = ["專案資訊","第一批資料","第二批資料","Jira 子任務","任務紀錄","總覽"];

  const LockScreen = ({ msg }) => (
    <div style={{ textAlign:"center", padding:"60px 0", color:C.textLight }}>
      <div style={{ marginBottom:14 }}><Ico name="lock" size={36} color="var(--text-subtle)"/></div>
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
        height:60, position:"sticky", top:0, zIndex:10000 }}>
        <div style={{ display:"flex", alignItems:"center", gap:12 }}>
          <button onClick={onBack} style={{ background:"none", border:"none", cursor:"pointer",
            color:C.textMid, fontSize:13, fontFamily:"inherit", padding:0 }}>← 返回列表</button>
          {isNew && (
            <button onClick={()=>{ onDelete(project.id); onBack(); }}
              style={{ background:"none", border:`1px solid ${C.red}66`, borderRadius:8,
                padding:"4px 12px", cursor:"pointer", fontSize:12, color:C.red,
                fontFamily:"inherit", marginLeft:4 }}>取消新增</button>
          )}
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
                {locked?<Ico name="lock" size={11} color="currentColor"/>:i+1}
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
            <div style={{ marginBottom:24, display:"flex", alignItems:"flex-start", justifyContent:"space-between", gap:12 }}>
              <div>
                <h2 style={{ fontSize:20, fontWeight:700, color:C.text, margin:"0 0 5px" }}>專案基本資訊</h2>
                <p style={{ fontSize:13, color:C.textMid, margin:0 }}>填寫飯店基本資料與購置設備</p>
              </div>
              <button onClick={()=>setShowCustomerAccess(true)}
                style={{ display:"flex", alignItems:"center", gap:6, padding:"7px 14px", flexShrink:0,
                  background:"var(--surface)", border:"1px solid var(--border)", borderRadius:9,
                  cursor:"pointer", fontSize:13, color:"var(--text-mid)", fontFamily:"inherit",
                  transition:"all 0.15s" }}
                onMouseEnter={e=>{ e.currentTarget.style.borderColor="var(--accent)"; e.currentTarget.style.color="var(--accent)"; }}
                onMouseLeave={e=>{ e.currentTarget.style.borderColor="var(--border)"; e.currentTarget.style.color="var(--text-mid)"; }}>
                <Ico name="user" size={13} color="currentColor"/>
                客戶存取
              </button>
            </div>
            <Card>
              <SectionLabel title="飯店資訊" icon="building"/>
              <div style={{ display:"grid", gridTemplateColumns:"2fr 1fr", gap:16 }}>
                <FInput label="飯店名稱" value={info.name} onChange={v=>setInfo(p=>({ ...p, name:v }))} placeholder="例：台北大飯店"/>
                <FInput label="Hotel ID" value={info.hotelId} onChange={v=>setInfo(p=>({ ...p, hotelId:v }))} placeholder="例：TPE-001"/>
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
              <div style={{ marginBottom:18 }}>
                <label style={{ display:"block", fontSize:11, letterSpacing:1.5, color:C.textMid, textTransform:"uppercase", marginBottom:7, fontWeight:600 }}>Jira Epic 連結</label>
                <input type="url" value={info.jiraEpic} onChange={e=>setInfo(p=>({ ...p, jiraEpic:e.target.value }))}
                  placeholder="https://your-domain.atlassian.net/browse/EPIC-123" style={baseInput}
                  onFocus={e=>(e.target.style.borderColor="#0052cc")} onBlur={e=>(e.target.style.borderColor=C.border)}/>
                {info.jiraEpic&&!info.jiraEpic.startsWith("http")&&<div style={{ marginTop:6, fontSize:12, color:C.red }}>⚠️ 連結格式不正確</div>}
                {info.jiraEpic&&info.jiraEpic.startsWith("http")&&<a href={info.jiraEpic} target="_blank" rel="noreferrer" style={{ display:"inline-flex", alignItems:"center", gap:4, marginTop:6, fontSize:12, color:"#0052cc", textDecoration:"none", fontWeight:600 }}>↗ 開啟 Jira Epic</a>}

                {/* Bootstrap 按鈕：僅在 jiraEpic 為空且有飯店名稱時顯示 */}
                {!info.jiraEpic && info.name.trim() && (
                  <div style={{ marginTop:12, padding:"13px 15px", background:"var(--accent-subtle)",
                    border:"1px solid var(--accent-border)", borderRadius:10 }}>
                    <div style={{ fontSize:13, color:"var(--text-mid)", marginBottom:10, lineHeight:1.6 }}>
                      尚未建立 Jira Epic。點擊下方按鈕可自動建立 Epic 並匯入 51 筆標準子任務。
                    </div>
                    <button onClick={()=>setJiraBoot(p=>({ ...p, open:true, step:"idle" }))}
                      style={{ display:"inline-flex", alignItems:"center", gap:7, padding:"7px 15px",
                        background:"#0052cc", color:"#fff", border:"none", borderRadius:8,
                        fontSize:13, fontWeight:600, cursor:"pointer", fontFamily:"inherit" }}>
                      <><Ico name="rocket" size={13} color="currentColor"/> 建立 Jira Epic 與任務</>
                    </button>
                  </div>
                )}

                {/* Bootstrap Modal */}
                {jiraBoot.open && (
                  <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.4)", zIndex:20000,
                    display:"flex", alignItems:"center", justifyContent:"center", padding:24 }}
                    onClick={e=>{ if(e.target===e.currentTarget && !["creating_epic","creating_tasks"].includes(jiraBoot.step))
                      setJiraBoot(p=>({...p,open:false})); }}>
                    <div style={{ background:"var(--surface)", borderRadius:14, padding:28, width:"100%", maxWidth:460,
                      boxShadow:"0 20px 60px rgba(0,0,0,0.2)", animation:"fadeIn 0.2s ease" }}>

                      {/* Header 含 X 關閉按鈕 */}
                      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:16 }}>
                        <h3 style={{ fontSize:17, fontWeight:700, color:"var(--text)", margin:0 }}>建立 Jira Epic 與任務</h3>
                        {!["creating_epic","creating_tasks"].includes(jiraBoot.step) && (
                          <button onClick={()=>setJiraBoot(p=>({...p,open:false}))}
                            style={{ background:"none", border:"1px solid var(--border)", borderRadius:6,
                              padding:"3px 9px", cursor:"pointer", fontSize:15, color:"var(--text-mid)",
                              lineHeight:1, fontFamily:"inherit" }}>✕</button>
                        )}
                      </div>

                      {/* Idle：確認畫面 */}
                      {jiraBoot.step==="idle" && (<>
                        <div style={{ padding:"10px 14px", background:"var(--surface-raised)",
                          border:"1px solid var(--border)", borderRadius:8, fontSize:13, marginBottom:18, lineHeight:1.7 }}>
                          Epic 名稱：<strong style={{ color:"var(--text)" }}>{info.name}</strong><br/>
                          專案：<strong style={{ color:"var(--text)" }}>AHP</strong>　
                          子任務：<strong style={{ color:"var(--text)" }}>51 筆</strong>（含指定 assignee）<br/>
                          {profile?.jira_email && profile?.jira_token ? (<>
                            Reporter：<strong style={{ color:"var(--text)" }}>{profile.display_name || profile.jira_email}</strong>
                            <span style={{ fontSize:11, color:"var(--text-subtle)", marginLeft:6 }}>（使用個人 API Token）</span>
                          </>) : info.pic ? (<>
                            Reporter：<strong style={{ color:"var(--text)" }}>{info.pic}</strong>
                          </>) : null}
                        </div>
                        <div style={{ display:"flex", gap:10, justifyContent:"flex-end" }}>
                          <button onClick={()=>setJiraBoot(p=>({...p,open:false}))}
                            style={{ padding:"8px 18px", background:"transparent", border:"1px solid var(--border)",
                              borderRadius:8, fontSize:13, cursor:"pointer", fontFamily:"inherit", color:"var(--text-mid)" }}>取消</button>
                          <button onClick={bootstrapJira}
                            style={{ padding:"8px 20px", background:"#0052cc", color:"#fff", border:"none",
                              borderRadius:8, fontSize:13, fontWeight:600, cursor:"pointer", fontFamily:"inherit" }}>確認建立</button>
                        </div>
                      </>)}

                      {/* Step 1：建立 Epic 中 */}
                      {jiraBoot.step==="creating_epic" && (
                        <div style={{ textAlign:"center", padding:"20px 0" }}>
                          <div style={{ width:28, height:28, border:"3px solid var(--accent-border)", borderTopColor:"var(--accent)",
                            borderRadius:"50%", animation:"spin 0.8s linear infinite", margin:"0 auto 14px" }}/>
                          <div style={{ fontSize:13, color:"var(--text-mid)" }}>正在建立 Epic…</div>
                        </div>
                      )}

                      {/* Step 2：建立子任務中 */}
                      {jiraBoot.step==="creating_tasks" && (
                        <div style={{ textAlign:"center", padding:"16px 0" }}>
                          <div style={{ fontSize:13, fontWeight:600, color:"var(--green)", marginBottom:12 }}>
                            ✓ Epic&nbsp;
                            <a href={jiraBoot.epicUrl} target="_blank" rel="noreferrer"
                              style={{ color:"#0052cc", textDecoration:"none", fontWeight:700 }}>{jiraBoot.epicKey}</a>&nbsp;已建立
                          </div>
                          <div style={{ width:28, height:28, border:"3px solid var(--accent-border)", borderTopColor:"var(--accent)",
                            borderRadius:"50%", animation:"spin 0.8s linear infinite", margin:"0 auto 12px" }}/>
                          <div style={{ fontSize:13, color:"var(--text-mid)" }}>正在建立 51 筆子任務，請稍候（約 15 秒）…</div>
                          {jiraBoot.issueTypeName && (
                            <div style={{ marginTop:8, fontSize:11, color:"var(--text-subtle)" }}>
                              Issue type：<code style={{ background:"var(--surface-raised)", padding:"1px 6px", borderRadius:4 }}>{jiraBoot.issueTypeName}</code>
                              {jiraBoot.reporterName && <>　Reporter：<code style={{ background:"var(--surface-raised)", padding:"1px 6px", borderRadius:4 }}>{jiraBoot.reporterName}</code></>}
                            </div>
                          )}
                        </div>
                      )}

                      {/* 完成 */}
                      {jiraBoot.step==="done" && (
                        <div>
                          <div style={{ padding:"12px 14px", background:"var(--green-subtle)",
                            border:"1px solid var(--green)", borderRadius:8, marginBottom:14 }}>
                            <div style={{ fontSize:14, fontWeight:600, color:"var(--green)", marginBottom:4 }}>✓ 建立完成</div>
                            <div style={{ fontSize:12, color:"var(--text-mid)" }}>
                              Epic：<a href={jiraBoot.epicUrl} target="_blank" rel="noreferrer"
                                style={{ color:"#0052cc", fontWeight:700, textDecoration:"none" }}>{jiraBoot.epicKey}</a>
                              　子任務：{jiraBoot.created} 筆已建立
                            </div>
                          </div>
                          {jiraBoot.failed.length>0 && (
                            <div style={{ padding:"10px 12px", background:"var(--red-subtle)",
                              border:"1px solid var(--red)", borderRadius:8, marginBottom:14 }}>
                              <div style={{ fontSize:12, fontWeight:600, color:"var(--red)", marginBottom:8 }}>
                                ⚠️ {jiraBoot.failed.length} 筆建立失敗
                              </div>
                              {jiraBoot.failed[0]?.msg && (
                                <div style={{ marginBottom:8, padding:"7px 10px", background:"var(--surface)",
                                  border:"1px solid var(--border)", borderRadius:6,
                                  fontSize:11, color:"var(--text-mid)", fontFamily:"'DM Mono',monospace",
                                  wordBreak:"break-all", lineHeight:1.6 }}>
                                  <span style={{ color:"var(--red)", fontWeight:600 }}>Jira 錯誤：</span>
                                  {typeof jiraBoot.failed[0].msg === "string"
                                    ? jiraBoot.failed[0].msg
                                    : JSON.stringify(jiraBoot.failed[0].msg)}
                                </div>
                              )}
                              <div style={{ maxHeight:140, overflowY:"auto" }}>
                                {jiraBoot.failed.map((f,i)=>(
                                  <div key={i} style={{ fontSize:11, color:"var(--text-mid)", marginTop:3 }}>・{f.summary}</div>
                                ))}
                              </div>
                            </div>
                          )}
                          <div style={{ display:"flex", justifyContent:"flex-end" }}>
                            <button onClick={()=>setJiraBoot(p=>({...p,open:false}))}
                              style={{ padding:"8px 20px", background:"var(--accent)", color:"#fff", border:"none",
                                borderRadius:8, fontSize:13, fontWeight:600, cursor:"pointer", fontFamily:"inherit" }}>完成</button>
                          </div>
                        </div>
                      )}

                      {/* 錯誤 */}
                      {jiraBoot.step==="error" && (
                        <div>
                          <div style={{ padding:"12px 14px", background:"var(--red-subtle)",
                            border:"1px solid var(--red)", borderRadius:8, marginBottom:16, fontSize:13, color:"var(--red)" }}>
                            ⚠️ 建立 Epic 時發生錯誤，請確認飯店名稱填寫正確並重新嘗試。
                          </div>
                          {jiraBoot.errorMsg && (
                            <div style={{ padding:"9px 12px", background:"var(--surface-raised)",
                              border:"1px solid var(--border)", borderRadius:7, marginBottom:14,
                              fontSize:11, color:"var(--text-mid)", fontFamily:"'DM Mono',monospace",
                              wordBreak:"break-all", lineHeight:1.6 }}>
                              <span style={{ color:"var(--red)", fontWeight:600 }}>錯誤詳情：</span>{jiraBoot.errorMsg}
                            </div>
                          )}
                          <div style={{ display:"flex", justifyContent:"flex-end" }}>
                            <button onClick={()=>setJiraBoot({ open:false, step:"idle", epicKey:"", epicUrl:"", created:0, failed:[], errorMsg:"" })}
                              style={{ padding:"8px 18px", background:"transparent", border:"1px solid var(--border)",
                                borderRadius:8, fontSize:13, cursor:"pointer", fontFamily:"inherit", color:"var(--text-mid)" }}>關閉</button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </Card>
            <Card>
              <SectionLabel title="購置產品" icon="package"/>
              <div style={{ display:"flex", flexWrap:"wrap", gap:10, marginBottom:14 }}>
                {PRODUCTS.map(p=><Chip key={p} label={p} active={info.products.includes(p)} color={PRODUCT_COLORS[p]||C.blue} onClick={()=>toggleArr("products",p)}/>)}
              </div>
              {/* AVA only → blue box */}
              {info.products.includes("AVA")&&!info.products.includes("AVT")&&(
                <div style={{ background:C.amberLight, border:`1px solid ${C.amber}44`, borderRadius:12, padding:16 }}>
                  <div style={{ fontSize:11, color:C.amber, letterSpacing:1.5, textTransform:"uppercase", marginBottom:12, fontWeight:700 }}>AVA 機台數量</div>
                  <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:16 }}>
                    <FInput label="裝機數量" value={info.avaUnits} onChange={v=>setInfo(p=>({ ...p, avaUnits:v }))} placeholder="例：50" type="number"/>
                    <FInput label="備品機台數量" value={info.avaSpare} onChange={v=>setInfo(p=>({ ...p, avaSpare:v }))} placeholder="例：5" type="number"/>
                  </div>
                </div>
              )}
              {/* AVT（含 AVA+AVT）→ orange box */}
              {info.products.includes("AVT")&&(
                <div style={{ background:C.amberLight, border:`1px solid ${C.amber}44`, borderRadius:12, padding:16 }}>
                  {info.products.includes("AVA")&&(
                    <>
                      <div style={{ fontSize:11, color:C.amber, letterSpacing:1.5, textTransform:"uppercase", marginBottom:12, fontWeight:700 }}>AVA 機台數量</div>
                      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:16, marginBottom:16 }}>
                        <FInput label="裝機數量" value={info.avaUnits} onChange={v=>setInfo(p=>({ ...p, avaUnits:v }))} placeholder="例：50" type="number"/>
                        <FInput label="備品機台數量" value={info.avaSpare} onChange={v=>setInfo(p=>({ ...p, avaSpare:v }))} placeholder="例：5" type="number"/>
                      </div>
                      <div style={{ borderTop:`1px solid ${C.amber}33`, marginBottom:16 }}/>
                    </>
                  )}
                  <div style={{ fontSize:11, color:C.amber, letterSpacing:1.5, textTransform:"uppercase", marginBottom:12, fontWeight:700 }}>AVT 機台數量</div>
                  <div style={{ maxWidth:"50%" }}>
                    <FInput label="裝機數量" value={info.avtUnits} onChange={v=>setInfo(p=>({ ...p, avtUnits:v }))} placeholder="例：30" type="number"/>
                  </div>
                </div>
              )}
            </Card>
            <Card>
              <SectionLabel title="串接功能" icon="link" color={C.purple}/>
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
                <SectionLabel title="日期設定" icon="calendar"/>
                <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:16 }}>
                  <div>
                    <label style={{ display:"block", fontSize:11, letterSpacing:1.5, color:C.textMid, textTransform:"uppercase", marginBottom:7, fontWeight:600 }}>上線日期</label>
                    <input type="date" value={info.launchDate} onChange={e=>setInfo(p=>({ ...p, launchDate:e.target.value }))}
                      style={baseInput} onFocus={e=>(e.target.style.borderColor=C.blue)} onBlur={e=>(e.target.style.borderColor=C.border)}/>
                  </div>
                  <div>
                    <label style={{ display:"block", fontSize:11, letterSpacing:1.5, color:C.green, textTransform:"uppercase", marginBottom:7, fontWeight:600 }}>第一批資料期限</label>
                    <input type="date" value={info.batch1Deadline} onChange={e=>setInfo(p=>({ ...p, batch1Deadline:e.target.value }))}
                      style={{ ...baseInput, borderColor:info.launchDate&&info.batch1Deadline&&info.batch1Deadline>info.launchDate?C.red:C.border, background:C.greenLight }}
                      onFocus={e=>(e.target.style.borderColor=C.green)} onBlur={e=>(e.target.style.borderColor=info.launchDate&&info.batch1Deadline&&info.batch1Deadline>info.launchDate?C.red:C.border)}/>
                  </div>
                  <div>
                    <label style={{ display:"block", fontSize:11, letterSpacing:1.5, color:C.purple, textTransform:"uppercase", marginBottom:7, fontWeight:600 }}>第二批資料期限</label>
                    <input type="date" value={info.batch2Deadline} onChange={e=>setInfo(p=>({ ...p, batch2Deadline:e.target.value }))}
                      style={{ ...baseInput, borderColor:C.border, background:C.purpleLight }}
                      onFocus={e=>(e.target.style.borderColor=C.purple)} onBlur={e=>(e.target.style.borderColor=C.border)}/>
                  </div>
                </div>
                {info.launchDate&&info.batch1Deadline&&info.batch1Deadline>info.launchDate&&(
                  <div style={{ marginTop:10, padding:"9px 14px", background:"var(--red-light)", border:`1px solid ${C.red}44`, borderRadius:10, fontSize:12, color:C.red }}>
                    ⚠️ 第一批資料期限（{info.batch1Deadline}）晚於上線日期（{info.launchDate}），請確認是否正確。
                  </div>
                )}
              </div>
              <div style={{ marginTop:24 }}>
                <SectionLabel title="其餘功能需求或備注" icon="fileText"/>
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
                        <CheckRow label={item} checked={!!basicChecked[item]} onChange={()=>toggleCheck(setBasicChecked, item, "basic_checked")} color={C.green}/>
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
                      <CheckRow label={ACA_ITEM} checked={!!basicChecked[ACA_ITEM]} onChange={()=>toggleCheck(setBasicChecked, ACA_ITEM, "basic_checked")} color={PRODUCT_COLORS.ACA}/>
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
                        <CheckRow label={item} checked={!!faqChecked[item]} onChange={()=>toggleCheck(setFaqChecked, item, "faq_checked")} color={C.amber}/>
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
                <div style={{ marginBottom:20 }}>
                  <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between" }}>
                    <h2 style={{ fontSize:20, fontWeight:700, color:C.text, margin:0 }}>第二批資料</h2>
                    <div style={{ border:"1px solid var(--border)", borderRadius:8, padding:"4px 12px", background:"var(--surface-raised)" }}>
                      <span style={{ fontSize:16, fontWeight:700, color:C.purple, fontFamily:"'DM Mono',monospace" }}>{b2Count+gwCount}</span>
                      <span style={{ fontSize:12, color:"var(--text-subtle)" }}>/{(hasAva?BATCH2_ITEMS.length:0)+(hasGw?1:0)}</span>
                    </div>
                  </div>
                  <div style={{ display:"flex", alignItems:"center", gap:10, marginTop:8 }}>
                    <span style={{ fontSize:11, background:C.purpleLight, color:C.purple, border:`1px solid ${C.purple}44`, borderRadius:6, padding:"2px 10px", fontWeight:700 }}>第二批</span>
                    {info.batch2Deadline&&<span style={{ fontSize:12, color:C.textMid }}>期限：{info.batch2Deadline}</span>}
                  </div>
                </div>
                {hasAva&&BATCH2_ITEMS.map((item,idx)=>{
                  const isDone = !!batch2Checked[item];
                  return (
                    <div key={item} style={{ background:isDone?"var(--purple-subtle)":"var(--surface)",
                      border:`1px solid ${isDone?"var(--purple)":"var(--border)"}`,
                      borderRadius:12, marginBottom:12, overflow:"hidden" }}>
                      {/* 卡片 header：點擊切換勾選 */}
                      <div onClick={()=>toggleCheck(setBatch2Checked, item, "batch2_checked")}
                        style={{ display:"flex", alignItems:"center", gap:10, padding:"14px 16px", cursor:"pointer" }}>
                        <div style={{ width:18, height:18, borderRadius:4, flexShrink:0,
                          border:`1.5px solid ${isDone?"var(--purple)":"var(--border-mid)"}`,
                          background:isDone?"var(--purple)":"transparent",
                          display:"flex", alignItems:"center", justifyContent:"center", transition:"all 0.12s" }}>
                          {isDone && <span style={{ color:"#fff", fontSize:10, fontWeight:700 }}>✓</span>}
                        </div>
                        <span style={{ fontSize:14, fontWeight:600, color:"var(--text)", flex:1 }}>{item}</span>
                        {!isDone && <span style={{ fontSize:10, color:"var(--text-subtle)", fontWeight:500 }}>待完成</span>}
                      </div>
                      {/* 卡片 body：備註 + 檔案連結 */}
                      <div style={{ padding:"0 16px 16px" }}>
                        <NoteArea value={batch2Notes[item]||""} onChange={v=>setBatch2Notes(p=>({ ...p, [item]:v }))} focusColor="var(--purple)"/>
                        <SheetLink value={sheetLinks[BATCH2_LINK_KEYS[idx]]} onChange={v=>setSheetLinks(p=>({ ...p, [BATCH2_LINK_KEYS[idx]]:v }))} color="var(--purple)"/>
                      </div>
                    </div>
                  );
                })}
                {hasGw&&(()=>{
                  const isDone = !!batch2Checked[GW_ITEM];
                  return (
                    <div style={{ background:isDone?"var(--purple-subtle)":"var(--surface)",
                      border:`1px solid ${isDone?"var(--purple)":"var(--border)"}`,
                      borderRadius:12, marginBottom:12, overflow:"hidden" }}>
                      <div onClick={()=>toggleCheck(setBatch2Checked, GW_ITEM, "batch2_checked")}
                        style={{ display:"flex", alignItems:"center", gap:10, padding:"14px 16px", cursor:"pointer" }}>
                        <div style={{ width:18, height:18, borderRadius:4, flexShrink:0,
                          border:`1.5px solid ${isDone?"var(--purple)":"var(--border-mid)"}`,
                          background:isDone?"var(--purple)":"transparent",
                          display:"flex", alignItems:"center", justifyContent:"center", transition:"all 0.12s" }}>
                          {isDone && <span style={{ color:"#fff", fontSize:10, fontWeight:700 }}>✓</span>}
                        </div>
                        <span style={{ fontSize:14, fontWeight:600, color:"var(--text)", flex:1 }}>{GW_ITEM}</span>
                        <span style={{ fontSize:10, color:"var(--prod-gw)", background:"var(--amber-subtle)",
                          border:"1px solid var(--amber)", borderRadius:5, padding:"2px 8px", fontWeight:600 }}>GW</span>
                        {!isDone && <span style={{ fontSize:10, color:"var(--text-subtle)", fontWeight:500, marginLeft:4 }}>待完成</span>}
                      </div>
                      <div style={{ padding:"0 16px 16px" }}>
                        <NoteArea value={batch2Notes[GW_ITEM]||""} onChange={v=>setBatch2Notes(p=>({ ...p, [GW_ITEM]:v }))} focusColor="var(--purple)"/>
                        <SheetLink value={sheetLinks[GW_LINK_KEY]} onChange={v=>setSheetLinks(p=>({ ...p, [GW_LINK_KEY]:v }))} color="var(--purple)"/>
                      </div>
                    </div>
                  );
                })()}
                <NavRow onBack={()=>setStep(1)} onNext={()=>setStep(3)} nextLabel="下一步：Jira 子任務 →" nextColor={C.purple}/>
              </>
            )}
          </div>
        )}

        {/* Step 3: Jira 子任務 */}
        {step===3&&(
          <JiraTab epicUrl={info.jiraEpic} projectInfo={info} projectId={project.id}
            onBack={()=>setStep(2)} onNext={()=>setStep(4)}
            accessToken={session?.access_token}/>
        )}

        {/* Step 4: 任務紀錄 */}
        {step===4&&(
          <TasksTab projectId={project.id} tasks={tasks} onTasksChange={setTasks}/>
        )}
        {step===4&&(
          <div style={{ marginTop:24 }}>
            <NavRow onBack={()=>setStep(3)} onNext={()=>setStep(5)} nextLabel="查看總覽 →" nextColor={C.blue}/>
          </div>
        )}

        {/* Step 5: 總覽 */}
        {step===5&&(
          <div style={{ animation:"fadeIn 0.25s ease" }}>
            <div style={{ marginBottom:24 }}>
              <div style={{ display:"flex", alignItems:"flex-start", justifyContent:"space-between", gap:12 }}>
                <div>
                  <h2 style={{ fontSize:20, fontWeight:700, color:C.text, margin:"0 0 5px" }}>專案總覽</h2>
                  <p style={{ fontSize:13, color:C.textMid, margin:0 }}>
                    所有資料的完成度一覽
                    {project.updatedAt&&<span style={{ marginLeft:12, color:C.textLight }}>· 最後更新：{new Date(project.updatedAt).toLocaleString("zh-TW",{ month:"numeric", day:"numeric", hour:"2-digit", minute:"2-digit" })}</span>}
                  </p>
                </div>
                {/* Subscribe toggle */}
                <button disabled={subLoading} onClick={async()=>{
                  setSubLoading(true);
                  if (!projSub) { alert("請先至主頁的「🔔 通知設定」啟用 Email 提醒，再回來訂閱此專案。"); setSubLoading(false); return; }
                  const isSubscribed=(projSub.subscribed_projects||[]).includes(project.id);
                  const curr=projSub.subscribed_projects||[];
                  const next=isSubscribed?curr.filter(id=>id!==project.id):[...curr,project.id];
                  const updated=await updateSub(projSub.id,{ subscribed_projects:next });
                  setProjSub(updated); setSubLoading(false);
                }} style={{ flexShrink:0, display:"flex", alignItems:"center", gap:6,
                  padding:"7px 14px", borderRadius:9, cursor:subLoading?"wait":"pointer",
                  border:`1px solid ${projSub&&(projSub.subscribed_projects||[]).includes(project.id)?C.blueBorder:C.border}`,
                  background:projSub&&(projSub.subscribed_projects||[]).includes(project.id)?C.blueLight:C.bg,
                  color:projSub&&(projSub.subscribed_projects||[]).includes(project.id)?C.blue:C.textMid,
                  fontSize:13, fontFamily:"inherit", transition:"all 0.15s" }}>
                  {projSub&&(projSub.subscribed_projects||[]).includes(project.id)
                  ?<><Ico name="bell" size={13} color="currentColor"/> 已訂閱提醒</>
                  :<><Ico name="bellOff" size={13} color="currentColor"/> 訂閱此專案提醒</>}
                </button>
              </div>
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
                    <Ico name="calendar" size={22} color={color}/>
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
                <div style={{ fontSize:11, letterSpacing:2, color:C.blue, textTransform:"uppercase", marginBottom:16, fontWeight:700, display:"flex", alignItems:"center", gap:6 }}><Ico name="clipboardList" size={13} color="currentColor"/>專案資訊</div>
                <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"10px 28px" }}>
                  {[
                    ["飯店名稱",info.name],["Hotel ID",info.hotelId||"—"],
                    ["負責人（PIC）",info.pic||"—"],["地址",info.address],
                    ["所在國家",info.region==="其他"?(info.regionOther||"其他"):info.region],
                    ["上線日期",info.launchDate||"—"],
                    ["購置產品",info.products.join("、")||"—"],
                    ["串接功能",info.integrations.join("、")||"無"],
                    info.products.includes("AVA")&&["AVA 裝機 / 備品",`${info.avaUnits||"—"} / ${info.avaSpare||"—"} 台`],
                    info.products.includes("AVT")&&["AVT 裝機台數",`${info.avtUnits||"—"} 台`],
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
                          background:"var(--accent-light)", border:"1px solid var(--accent-border)", borderRadius:7, padding:"4px 11px" }}>
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
                        <RichText text={info.integrationNotes[k]} style={{ fontSize:13, color:C.textMid }}/>
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
              <div style={{ background:C.white, border:"1px solid var(--border)", borderRadius:12, padding:16, marginBottom:16 }}>
                <div style={{ fontSize:11, letterSpacing:1.5, color:C.purple, textTransform:"uppercase", marginBottom:14, fontWeight:700 }}>第二批資料</div>
                <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
                  {hasAva&&BATCH2_ITEMS.map((item,idx)=><OvBatch2Row key={item} item={item} checked={batch2Checked[item]} note={batch2Notes[item]} linkKey={BATCH2_LINK_KEYS[idx]} sheetLinks={sheetLinks}/>)}
                  {hasGw&&(
                    <div style={{ position:"relative" }}>
                      <OvBatch2Row item={GW_ITEM} checked={batch2Checked[GW_ITEM]} note={batch2Notes[GW_ITEM]} linkKey={GW_LINK_KEY} sheetLinks={sheetLinks}/>
                      <span style={{ position:"absolute", top:12, right:14, fontSize:10, color:"var(--amber)", background:"var(--amber-light)", border:"1px solid var(--amber)", borderRadius:5, padding:"2px 7px" }}>GW</span>
                    </div>
                  )}
                </div>
              </div>
            )}
            {/* Tasks overview */}
            {tasks.length>0&&(
              <div style={{ background:C.white, border:`1px solid ${C.border}`, borderRadius:16, padding:18, marginBottom:24, boxShadow:"var(--shadow)" }}>
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
                          borderRadius:5, padding:"2px 8px", fontWeight:600, whiteSpace:"nowrap", display:"inline-flex", alignItems:"center", gap:4 }}>
                          {task.type==="deadline"
                            ? <><Ico name="pin" size={10} color="currentColor"/> {task.deadline||"—"}</>
                            : <><Ico name="repeat" size={10} color="currentColor"/> {task.period_start||"—"} → {task.period_end||"—"}</>}
                        </span>
                      </div>
                      {task.description&&<RichText text={task.description} style={{ fontSize:12, color:C.textMid, marginLeft:34 }}/>}
                    </div>
                  ))}
                </div>
              </div>
            )}
            <NavRow onBack={()=>setStep(4)}/>
          </div>
        )}
      </div>
      {/* CustomerAccessPanel - content div 後、root div 內 */}
      {showCustomerAccess && (
        <CustomerAccessPanel
          hotelId={info.hotelId}
          projectId={project.id}
          session={session}
          onClose={()=>setShowCustomerAccess(false)}/>
      )}
    </div>
  );
};

// ─── LoginPage ────────────────────────────────────────────────
const LoginPage = ({ theme, setTheme }) => {
  const [email,   setEmail]   = useState("");
  const [sent,    setSent]    = useState(false);
  const [loading, setLoading] = useState(false);
  const [err,     setErr]     = useState("");

  const send = async () => {
    if (!email.trim()) return;
    if (!email.trim().toLowerCase().endsWith("@aiello.ai")) {
      setErr("僅限 @aiello.ai 帳號登入");
      return;
    }
    setLoading(true); setErr("");
    const { error } = await sb.auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: window.location.origin },
    });
    if (error) setErr(error.message);
    else setSent(true);
    setLoading(false);
  };

  return (
    <div style={{ minHeight:"100vh", background:"var(--bg)", display:"flex", flexDirection:"column",
      alignItems:"center", justifyContent:"center", fontFamily:"'Noto Sans TC','Segoe UI',sans-serif" }}>
      <style>{GLOBAL_CSS}</style>
      {/* Theme toggle 右上角 */}
      <div style={{ position:"fixed", top:16, right:20 }}>
        <ThemeToggle theme={theme} setTheme={setTheme}/>
      </div>
      <div style={{ background:"var(--surface)", border:"1px solid var(--border)", borderRadius:14,
        padding:"40px 36px", width:"100%", maxWidth:380, textAlign:"center",
        boxShadow:"0 4px 24px rgba(0,0,0,0.08)" }}>
        <div style={{ width:56, height:56, borderRadius:14, background:"var(--accent)",
          display:"flex", alignItems:"center", justifyContent:"center", margin:"0 auto 14px" }}>
          <Ico name="building" size={26} color="#fff"/>
        </div>
        <h1 style={{ fontSize:20, fontWeight:700, color:"var(--text)", margin:"0 0 6px" }}>專案交付中心</h1>
        <p style={{ fontSize:13, color:"var(--text-mid)", margin:"0 0 28px" }}>輸入公司 email 以收取登入連結</p>
        {!sent ? (<>
          <input type="email" value={email} onChange={e=>setEmail(e.target.value)}
            placeholder="your@aiello.ai"
            style={{ ...baseInput, marginBottom:12, textAlign:"center" }}
            onKeyDown={e=>e.key==="Enter"&&send()}
            onFocus={e=>(e.target.style.borderColor="var(--accent)")}
            onBlur={e=>(e.target.style.borderColor="var(--border)")}/>
          {err && <div style={{ fontSize:12, color:"var(--red)", marginBottom:8 }}>{err}</div>}
          <button onClick={send} disabled={loading||!email.trim()}
            style={{ width:"100%", padding:"10px 0", background:email.trim()?"var(--accent)":"var(--border)",
              color:email.trim()?"#fff":"var(--text-subtle)", border:"none", borderRadius:8,
              fontSize:14, fontWeight:600, cursor:email.trim()?"pointer":"default", fontFamily:"inherit" }}>
            {loading ? "寄送中…" : "寄送登入連結"}
          </button>
        </>) : (
          <div style={{ animation:"fadeIn 0.3s ease" }}>
            <div style={{ width:56, height:56, borderRadius:14, background:"var(--green-light)",
              border:"2px solid var(--green)", display:"flex", alignItems:"center",
              justifyContent:"center", margin:"0 auto 14px" }}>
              <Ico name="mail" size={24} color="var(--green)"/>
            </div>
            <p style={{ fontSize:14, color:"var(--text-mid)", lineHeight:1.8 }}>
              登入連結已寄至<br/>
              <strong style={{ color:"var(--text)" }}>{email}</strong><br/>
              請點擊信件中的連結完成登入
            </p>
            <button onClick={()=>{ setSent(false); setEmail(""); }}
              style={{ marginTop:16, background:"none", border:"none", color:"var(--text-subtle)",
                fontSize:12, cursor:"pointer", fontFamily:"inherit", textDecoration:"underline" }}>
              重新輸入 email
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

// ─── UserSettingsPanel ────────────────────────────────────────
const UserSettingsPanel = ({ profile, userId, onClose, onSaved }) => {
  const [displayName, setDisplayName] = useState(profile?.display_name || "");
  const [jiraEmail,   setJiraEmail]   = useState(profile?.jira_email   || "");
  const [jiraToken,   setJiraToken]   = useState(profile?.jira_token   || "");
  const [saving,      setSaving]      = useState(false);
  const [saved,       setSaved]       = useState(false);

  const save = async () => {
    setSaving(true);
    await sb.from("user_profiles").upsert({
      id: userId, display_name: displayName,
      jira_email: jiraEmail, jira_token: jiraToken,
      updated_at: new Date().toISOString(),
    });
    setSaving(false); setSaved(true);
    onSaved({ display_name: displayName, jira_email: jiraEmail, jira_token: jiraToken });
    setTimeout(() => setSaved(false), 2000);
  };

  const logout = async () => { await sb.auth.signOut(); onClose(); };

  return (
    <>
      <div onClick={onClose} style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.3)", zIndex:20000 }}/>
      <div style={{ position:"fixed", top:0, right:0, bottom:0, width:380, background:"var(--surface)",
        borderLeft:"1px solid var(--border)", boxShadow:"-4px 0 24px rgba(0,0,0,0.12)",
        zIndex:20001, display:"flex", flexDirection:"column", fontFamily:"inherit" }}>
        <div style={{ padding:"20px 20px 16px", borderBottom:"1px solid var(--border)",
          display:"flex", alignItems:"center", justifyContent:"space-between" }}>
          <div>
            <div style={{ fontSize:15, fontWeight:700, color:"var(--text)" }}>個人設定</div>
            <div style={{ fontSize:12, color:"var(--text-mid)", marginTop:2 }}>Jira 連線與帳號管理</div>
          </div>
          <button onClick={onClose} style={{ background:"none", border:"1px solid var(--border)",
            borderRadius:8, padding:"4px 10px", cursor:"pointer", fontSize:16,
            color:"var(--text-mid)", fontFamily:"inherit" }}>✕</button>
        </div>
        <div style={{ flex:1, overflowY:"auto", padding:20 }}>
          <div style={{ marginBottom:18 }}>
            <label style={{ display:"block", fontSize:11, letterSpacing:1.4, color:"var(--text-subtle)",
              textTransform:"uppercase", marginBottom:6, fontWeight:600 }}>顯示名稱</label>
            <input value={displayName} onChange={e=>setDisplayName(e.target.value)}
              placeholder="與 Jira 顯示名稱一致" style={baseInput}
              onFocus={e=>(e.target.style.borderColor="var(--accent)")}
              onBlur={e=>(e.target.style.borderColor="var(--border)")}/>
            <div style={{ fontSize:11, color:"var(--text-subtle)", marginTop:4 }}>
              建立 Jira Epic 時作為 reporter，請與 Jira 顯示名稱完全一致
            </div>
          </div>
          <div style={{ marginBottom:14 }}>
            <label style={{ display:"block", fontSize:11, letterSpacing:1.4, color:"var(--text-subtle)",
              textTransform:"uppercase", marginBottom:6, fontWeight:600 }}>Jira Email</label>
            <input type="email" value={jiraEmail} onChange={e=>setJiraEmail(e.target.value)}
              placeholder="your@aiello.ai" style={baseInput}
              onFocus={e=>(e.target.style.borderColor="var(--accent)")}
              onBlur={e=>(e.target.style.borderColor="var(--border)")}/>
          </div>
          <div style={{ marginBottom:24 }}>
            <label style={{ display:"block", fontSize:11, letterSpacing:1.4, color:"var(--text-subtle)",
              textTransform:"uppercase", marginBottom:6, fontWeight:600 }}>Jira API Token</label>
            <input type="password" value={jiraToken} onChange={e=>setJiraToken(e.target.value)}
              placeholder="ATATT3x…" style={baseInput}
              onFocus={e=>(e.target.style.borderColor="var(--accent)")}
              onBlur={e=>(e.target.style.borderColor="var(--border)")}/>
            <div style={{ fontSize:11, color:"var(--text-subtle)", marginTop:4 }}>
              前往&nbsp;
              <a href="https://id.atlassian.com/manage-profile/security/api-tokens"
                target="_blank" rel="noreferrer" style={{ color:"var(--accent)" }}>
                Atlassian 帳號設定
              </a>&nbsp;建立 API token
            </div>
          </div>
          <button onClick={save} disabled={saving}
            style={{ width:"100%", padding:"10px 0",
              background:saved?"var(--green)":"var(--accent)", color:"#fff",
              border:"none", borderRadius:8, fontSize:13, fontWeight:600,
              cursor:"pointer", fontFamily:"inherit", transition:"background 0.2s" }}>
            {saving?"儲存中…":saved?"✓ 已儲存":"儲存設定"}
          </button>
        </div>
        <div style={{ padding:"16px 20px", borderTop:"1px solid var(--border)" }}>
          <button onClick={logout}
            style={{ width:"100%", padding:"8px 0", background:"none",
              border:"1px solid var(--red)", borderRadius:8, color:"var(--red)",
              fontSize:13, cursor:"pointer", fontFamily:"inherit" }}>
            登出
          </button>
        </div>
      </div>
    </>
  );
};

// ─── Root ─────────────────────────────────────────────────────
export default function App() {
  const [page,     setPage]     = useState("home");
  const [view,     setView]     = useState("home");
  const [projects, setProjects] = useState([]);
  const [allTasks, setAllTasks] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [isNew,    setIsNew]    = useState(false);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState(null);
  const [theme,    setTheme]    = useState(() => localStorage.getItem("hotel-dash-theme") || "system");
  const [showInAppNotif, setShowInAppNotif] = useState(false);
  const [showAi,         setShowAi]         = useState(false);
  const [customerNotifs, setCustomerNotifs] = useState([]);
  // Auth
  const [session,      setSession]      = useState(null);
  const [profile,      setProfile]      = useState(null);
  const [authLoading,  setAuthLoading]  = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const saveTimer = useRef({});

  // ── Auth state ───────────────────────────────────────────────
  useEffect(() => {
    sb.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session) loadProfile(session.user.id);
      else setAuthLoading(false);
    });
    const { data: { subscription } } = sb.auth.onAuthStateChange((_, session) => {
      setSession(session);
      if (session) loadProfile(session.user.id);
      else { setProfile(null); setAuthLoading(false); }
    });
    return () => subscription.unsubscribe();
  }, []);

  const loadProfile = async (userId) => {
    const { data } = await sb.from("user_profiles").select("*").eq("id", userId).maybeSingle();
    setProfile(data);
    setAuthLoading(false);
  };

  // Apply theme to <html> element whenever it changes
  useEffect(() => {
    const root = document.documentElement;
    if (theme === "system") {
      root.removeAttribute("data-theme");
    } else {
      root.setAttribute("data-theme", theme);
    }
    localStorage.setItem("hotel-dash-theme", theme);
  }, [theme]);

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
          tasksByProject[t.project_id].push({ id:t.id, project_id:t.project_id, name:t.name||"", description:t.description||"", type:t.type||"deadline", deadline:t.deadline||"", period_start:t.period_start||"", period_end:t.period_end||"", url:t.url||"", is_internal:t.is_internal??true });
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
        const { error:e2 } = await sb.from("project_progress").upsert({
          project_id:    progress.project_id,
          basic_notes:   progress.basic_notes,
          faq_notes:     progress.faq_notes,
          batch2_notes:  progress.batch2_notes,
          sheet_links:   progress.sheet_links,
        }, { onConflict:"project_id" }); if (e2) throw e2;
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

  // Urgent notifications: project dates + task deadlines within 7 days
  const urgentNotifs = useMemo(() => {
    const list = [];
    projects.forEach(proj => {
      const name = proj.info.name || "（未命名）";
      [
        { label:"上線日",   date:proj.info.launchDate      },
        { label:"第一批期限", date:proj.info.batch1Deadline },
        { label:"第二批期限", date:proj.info.batch2Deadline },
      ].forEach(({ label, date }) => {
        const d = daysUntil(date);
        if (d !== null && d >= 0 && d <= 7)
          list.push({ projId:proj.id, name, label, date, days:d });
      });
      (proj.tasks || []).forEach(task => {
        if (task.type === "deadline") {
          const d = daysUntil(task.deadline);
          if (d !== null && d >= 0 && d <= 7)
            list.push({ projId:proj.id, name, label:`任務：${task.name}`, date:task.deadline, days:d });
        }
      });
    });
    return list.sort((a, b) => a.days - b.days);
  }, [projects]);

  const fetchCustomerNotifs = useCallback(async () => {
    const { data } = await sb
      .from("notifications")
      .select("*, projects(name, hotel_id)")
      .order("created_at", { ascending: false })
      .limit(3);
    setCustomerNotifs(data ?? []);
  }, []);

  useEffect(() => {
    fetchCustomerNotifs();
    const timer = setInterval(fetchCustomerNotifs, 30000);
    return () => clearInterval(timer);
  }, [fetchCustomerNotifs]);

  if (authLoading) return (
    <div style={{ minHeight:"100vh", background:"var(--bg)", display:"flex", alignItems:"center",
      justifyContent:"center", fontFamily:"'Noto Sans TC','Segoe UI',sans-serif" }}>
      <style>{GLOBAL_CSS}</style>
      <div style={{ width:28, height:28, border:"3px solid var(--accent-border)", borderTopColor:"var(--accent)",
        borderRadius:"50%", animation:"spin 0.8s linear infinite" }}/>
    </div>
  );

  if (!session) return <LoginPage theme={theme} setTheme={setTheme}/>;

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
        <div style={{ background:C.white, borderBottom:`1px solid ${C.border}`, position:"sticky", top:0, zIndex:10000 }}>
          {/* Top bar */}
          <div style={{ padding:"0 40px", display:"flex", alignItems:"center", justifyContent:"space-between", height:60 }}>
            <div style={{ display:"flex", alignItems:"center", gap:10 }}>
              <div style={{ width:36, height:36, borderRadius:9, background:"var(--accent)",
                display:"flex", alignItems:"center", justifyContent:"center", fontSize:18, flexShrink:0 }}>🏨</div>
              <div>
                <div style={{ fontSize:15, fontWeight:700, color:"var(--text)", lineHeight:1.2, fontFamily:"'Inter',sans-serif" }}>Hotel Project Dashboard</div>
                <div style={{ fontSize:11, color:"var(--text-subtle)", lineHeight:1.2, fontWeight:300 }}>掌握專案進度，讓交付更透明</div>
              </div>
            </div>
            <div style={{ display:"flex", alignItems:"center", gap:8 }}>
              <div style={{ height:36, display:"flex", alignItems:"center" }}>
                <ThemeToggle theme={theme} setTheme={setTheme}/>
              </div>
              {/* Bell: in-app notifications */}
              <div style={{ position:"relative" }}>
                <button onClick={()=>setShowInAppNotif(v=>!v)}
                  style={{ width:36, height:36, display:"flex", alignItems:"center", justifyContent:"center",
                    background:"var(--surface-raised)", border:"1px solid var(--border)", borderRadius:9,
                    cursor:"pointer", color:"var(--text-subtle)", transition:"all 0.12s" }}
                  onMouseEnter={e=>{ e.currentTarget.style.borderColor="var(--accent)"; e.currentTarget.style.color="var(--accent)"; }}
                  onMouseLeave={e=>{ e.currentTarget.style.borderColor="var(--border)"; e.currentTarget.style.color="var(--text-subtle)"; }}>
                  <Ico name="bell" size={16} color="currentColor"/>
                </button>
                {(urgentNotifs.length>0 || customerNotifs.some(n=>!n.read)) && (
                  <div style={{ position:"absolute", top:4, right:4, width:8, height:8,
                    borderRadius:"50%", background:"var(--red)",
                    border:"2px solid var(--surface)", pointerEvents:"none" }}/>
                )}
                {showInAppNotif && (
                  <InAppNotifModal
                    urgentNotifs={urgentNotifs}
                    customerNotifs={customerNotifs}
                    onClose={async ()=>{
                      setShowInAppNotif(false);
                      const unreadIds = customerNotifs.filter(n=>!n.read).map(n=>n.id);
                      if (unreadIds.length>0) {
                        await sb.from("notifications").update({ read:true }).in("id", unreadIds);
                        setCustomerNotifs(prev => prev.map(n => ({ ...n, read:true })));
                      }
                    }}
                    onProjectOpen={id=>{ setShowInAppNotif(false); handleOpen(id); }}/>
                )}
              </div>
              {/* AI assistant button */}
              <button onClick={()=>setShowAi(v=>!v)}
                style={{ width:36, height:36, display:"flex", alignItems:"center", justifyContent:"center",
                  background:showAi?"var(--accent)":"var(--surface-raised)",
                  border:"1px solid var(--border)", borderRadius:9,
                  cursor:"pointer", color:showAi?"#fff":"var(--text-subtle)", transition:"all 0.12s" }}
                onMouseEnter={e=>{ if(!showAi){ e.currentTarget.style.borderColor="var(--accent)"; e.currentTarget.style.color="var(--accent)"; }}}
                onMouseLeave={e=>{ if(!showAi){ e.currentTarget.style.borderColor="var(--border)"; e.currentTarget.style.color="var(--text-subtle)"; }}}
                title="AI 助理">
                <Ico name="msgSquare" size={16} color="currentColor"/>
              </button>
              <button onClick={()=>setShowSettings(true)}
                style={{ height:36, display:"flex", alignItems:"center", gap:9,
                  background:"var(--surface-raised)", border:"1px solid var(--border)",
                  borderRadius:10, padding:"0 12px 0 5px", cursor:"pointer",
                  fontFamily:"inherit", transition:"all 0.12s" }}
                onMouseEnter={e=>{ e.currentTarget.style.borderColor="var(--accent)"; }}
                onMouseLeave={e=>{ e.currentTarget.style.borderColor="var(--border)"; }}>
                <div style={{ width:26, height:26, borderRadius:"50%", flexShrink:0,
                  background:"var(--accent)", display:"flex", alignItems:"center",
                  justifyContent:"center", fontSize:12, fontWeight:700, color:"#fff" }}>
                  {(profile?.display_name || session?.user?.email || "?")[0].toUpperCase()}
                </div>
                <div style={{ textAlign:"left" }}>
                  <div style={{ fontSize:13, fontWeight:600, color:"var(--text)", lineHeight:1.3 }}>
                    {profile?.display_name || "設定名稱"}
                  </div>
                  {profile?.display_name && (
                    <div style={{ fontSize:10, color:"var(--text-subtle)", lineHeight:1.2 }}>
                      {session?.user?.email}
                    </div>
                  )}
                </div>
              </button>
              <button onClick={handleNew}
                style={{ height:36, background:"var(--accent)", color:"#fff", border:"none",
                  borderRadius:9, padding:"0 18px", fontSize:13, fontWeight:600,
                  cursor:"pointer", fontFamily:"inherit", whiteSpace:"nowrap" }}>
                + 新增專案
              </button>
            </div>
          </div>
          {/* UserSettingsPanel */}
          {showSettings && (
            <UserSettingsPanel
              profile={profile}
              userId={session.user.id}
              onClose={()=>setShowSettings(false)}
              onSaved={updated=>setProfile(p=>({ ...p, ...updated }))}
            />
          )}
          {/* Page nav */}
          <div style={{ padding:"0 40px", display:"flex", borderTop:`1px solid ${C.border}` }}>
            {[{ id:"home", label:"專案列表", ico:"home" }, { id:"calendar", label:"專案行事曆", ico:"calendar" }].map(({ id, label, ico }) => (
              <button key={id} onClick={()=>setPage(id)}
                style={{ display:"flex", alignItems:"center", gap:7, padding:"12px 20px", background:"none", border:"none", fontFamily:"inherit",
                  borderBottom:`2.5px solid ${page===id?C.blue:"transparent"}`,
                  color:page===id?C.blue:C.textLight, cursor:"pointer",
                  fontSize:13, fontWeight:page===id?700:500, transition:"all 0.15s" }}>
                <Ico name={ico} size={14} color="currentColor"/>
                {label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Error toast */}
      {error && (
        <div style={{ position:"fixed", bottom:24, left:"50%", transform:"translateX(-50%)",
          background:"var(--red-light)", border:`1px solid ${C.red}44`, borderRadius:12,
          padding:"12px 20px", fontSize:13, color:C.red, zIndex:9999,
          boxShadow:"0 4px 16px rgba(0,0,0,0.1)", display:"flex", alignItems:"center",
          gap:12, fontFamily:"inherit" }}>
          ⚠️ {error}
          <button onClick={()=>setError(null)} style={{ background:"none", border:"none",
            cursor:"pointer", color:C.red, fontWeight:700, fontSize:16, padding:0, lineHeight:1 }}>×</button>
        </div>
      )}

      {/* AI Panel */}
      {showAi && <AiPanel projects={projects} allTasks={allTasks} onClose={()=>setShowAi(false)}/>}

      {/* Content */}
      {isDetailView
        ? <ProjectDetail project={activeProject} isNew={isNew} onUpdate={handleUpdate} onBack={()=>setView("home")} onDelete={handleDelete} allPics={allPics} session={session} profile={profile}/>
        : page==="calendar"
          ? <CalendarPage projects={projects} allTasks={allTasks} onTaskAdded={(task, isEdit) => {
              setAllTasks(prev => isEdit
                ? prev.map(t => t.id===task.id ? { ...t, ...task } : t)
                : [...prev, task]
              );
              setProjects(prev => prev.map(p => {
                if (p.id !== task.project_id) return p;
                return {
                  ...p,
                  tasks: isEdit
                    ? p.tasks.map(t => t.id===task.id ? { ...t, ...task } : t)
                    : [...p.tasks, task],
                };
              }));
            }} onTaskDeleted={(taskId) => {
              setAllTasks(prev => prev.filter(t => t.id !== taskId));
              setProjects(prev => prev.map(p => ({ ...p, tasks: p.tasks.filter(t => t.id !== taskId) })));
            }}/>
          : <HomePage projects={projects} onNew={handleNew} onOpen={handleOpen} onDelete={handleDelete} allPics={allPics} session={session} profile={profile}/>
      }
    </div>
  );
}
