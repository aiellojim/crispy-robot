import { useState, useMemo, useEffect, useCallback, useRef } from "react";
import { createClient } from "@supabase/supabase-js";

// ─── Supabase ─────────────────────────────────────────────────
const sb = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

// ─── Constants ────────────────────────────────────────────────
const PRODUCTS     = ["AVA", "AVT", "ACA", "TMSP", "GW", "KMS", "SiteChat"];
const INTEGRATIONS = ["PBX", "PMS", "TMS", "RCU", "POS", "IPTV", "RSVN", "Robot"];
// ACA 方案分級（2026-09-04）：同一個 ACA 產品換方案要重新簽約，但不會有一家飯店同時持有兩種
// ACA 方案，所以刻意不比照 PRODUCTS 另開 "ACA Pro" 這種標籤——方案本身是 projects.aca_plan 的
// 值，跟 products 陣列是否包含 "ACA" 是兩個獨立欄位，邏輯上比照 tmsp_max_spaces/installing_rooms
// 那類「已選 ACA 之後才追問的細節欄位」，不是新的 product。
const ACA_PLANS    = ["Original", "SuperLite", "SuperPro"];
const COUNTRIES    = ["台灣", "日本", "新加坡", "印尼", "馬來西亞", "澳洲", "美國", "其他"];
// PIC 欄位本身是自由輸入（見 ProjectDetail 的 <input list="pic-list">），不是固定下拉選單——
// 這份清單只是「保底」讓還沒被指派到任何專案的人也能先出現在自動完成建議裡；
// picOptions（HomePage 篩選）跟 allPics（datalist）都會把這份清單併進去。
const PIC_OPTIONS = ["MarkChen", "AlanFang"];
const PRODUCT_COLORS = {
  AVA:"var(--prod-ava)", AVT:"var(--prod-avt)", ACA:"var(--prod-aca)",
  TMSP:"var(--prod-tmsp)", GW:"var(--prod-gw)", KMS:"var(--prod-kms)", SiteChat:"var(--prod-sitechat)"
};

// "TMS Pro 設定" 原本是這個陣列的第 10 項，但這個陣列整體只在 hasAva 時才會渲染/計入分母——
// 導致純 TMSP（未選 AVA）的專案永遠看不到、也勾不到這個項目，且 canBatch1 也沒把 hasTmsp 算進去，
// 整個第一批分頁會直接被鎖住。2026-08-17 起改成比照 ACA_ITEM 的獨立 item + 獨立 Card 模式，
// 由 hasTmsp 單獨控制顯示（見 getFlags / canBatch1 / ProjectDetail 內的 TMS Pro Card）。
const BASIC_ITEMS  = ["房型及機台擺放位置圖片","需申請後台權限的 email 帳號","樓層房號表及 WiFi 資訊","機台重啟（Check out）方式","是否需開啟打掃 & 勿擾功能","通話快捷鍵設定 & 分機提供","歡迎畫面背景","歡迎詞填寫","後台服務功能設定 & 送物 / 修繕項目清單"];
const FAQ_TV_ITEM  = "電視頻道設定（若串接項目不含 IPTV 則不用填寫）";
const FAQ_ITEMS    = ["飯店基本資訊","飯店內設施","飯店提供之服務","入住規則","備品清單",FAQ_TV_ITEM,"特別推薦美食景點"];
const ACA_ITEM     = "轉接情境與歡迎詞設定";
const ACA_LINK_KEY = "acaScenario";
const TMSP_ITEM     = "TMS Pro 設定";
const TMSP_LINK_KEY = "tmspSetup";
const BATCH2_ITEMS     = ["機台 Showcase 設定","廣告設定","Pop-up QR code 內容設定"];
const BATCH2_LINK_KEYS = ["showcase","ad","popupQR"];
const GW_ITEM     = "GuestWeb 內容建置";
const GW_LINK_KEY = "guestWeb";

// AVA basic-settings 表單（Vercel 部署）— 飯店專屬填寫連結 = 這個網址 + ?p=<project.id>
// project.id 本身就是連結權杖（無須登入，跟公開 Excel 連結同一個概念），詳見該專案 index.html 的 getProjectId()
const AVA_FORM_BASE_URL = "https://basic-settings.aiello.dev/";

// AVA UI settings 表單（Vercel 部署，獨立站，涵蓋機台 Showcase / 廣告設定 / 行銷事件三頁）— 同一把
// project.id 當連結權杖，跟 AVA_FORM_BASE_URL 一樣的邏輯。加 hash 可以直接導到對應分頁
// （#showcase/#ads/#qr，順序對應 BATCH2_ITEMS/BATCH2_LINK_KEYS），不加 hash 則落在第一頁。
// 單一來源：這三個連結（batch2 的預設值 + 總覽頁的第二行連結）都呼叫這個 helper，不要另外複製網址字串
// （Jim, 2026-07-27）。
const AVA_UI_SETTINGS_BASE_URL = "https://ava-ui-settings.aiello.dev/";
const avaUiSettingsUrl = (id, hash) => AVA_UI_SETTINGS_BASE_URL + "?p=" + id + (hash ? ("#" + hash) : "");

// SiteChat Settings 表單（Vercel 部署，獨立站，Chat Theme & Colors + FAQ Cards）— 同一把
// project.id 當連結權杖，跟上面兩個表單一樣的邏輯，只在有選 SiteChat 產品時顯示。
const SITECHAT_FORM_BASE_URL = "https://sitechat-settings.aiello.dev/";
const sitechatFormUrl = (id) => SITECHAT_FORM_BASE_URL + "?p=" + id;

// ACA Basic Settings 表單（Vercel 部署，獨立站，轉接部門/場景 + 歡迎詞 + KMS 權限）— 同一把
// project.id 當連結權杖，跟上面幾個表單一樣的邏輯，只在有選 ACA 產品時顯示（2026-08-27 上線）。
const ACA_FORM_BASE_URL = "https://aca-basic-settings.aiello.dev/";
const acaFormUrl = (id) => ACA_FORM_BASE_URL + "?p=" + id;

// Calendar event type colours — CSS var based for dark mode
const CAL_COLORS = {
  launch:    { bg:"var(--cal-launch-bg)",  text:"var(--cal-launch-text)",  border:"var(--cal-launch-border)" },
  batch1:    { bg:"var(--cal-batch1-bg)",  text:"var(--cal-batch1-text)",  border:"var(--cal-batch1-border)" },
  batch2:    { bg:"var(--cal-batch2-bg)",  text:"var(--cal-batch2-text)",  border:"var(--cal-batch2-border)" },
  taskDL:    { bg:"var(--cal-task-bg)",    text:"var(--cal-task-text)",    border:"var(--cal-task-border)"   },
  taskPeriod:{ bg:"var(--cal-period-bg)",  text:"var(--cal-period-text)",  border:"var(--cal-period-border)" },
  jira:      { bg:"var(--cal-jira-bg)",    text:"var(--cal-jira-text)",    border:"var(--cal-jira-border)"   },
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
  accent:       "var(--accent)",
  accentLight:  "var(--accent-light)",
  accentBorder: "var(--accent-border)",
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
    --cal-jira-bg: #F5F5F4; --cal-jira-text: #57534E; --cal-jira-border: #D6D3D1;
    --prod-ava:#1e6fb5; --prod-avt:#0891b2; --prod-aca:#0e7a5a;
    --prod-tmsp:#7c3aed; --prod-gw:#b45309; --prod-kms:#be185d; --prod-sitechat:#4338ca;
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
      --cal-jira-bg: #292524; --cal-jira-text: #D6D3D1; --cal-jira-border: #78716C;
      --prod-ava:#4d90d4; --prod-avt:#22c4de; --prod-aca:#22a474;
      --prod-tmsp:#a78bfa; --prod-gw:#f59e0b; --prod-kms:#e879a0; --prod-sitechat:#818cf8;
    }
  }

  *, *::before, *::after { box-sizing: border-box; }
  body { margin: 0; background: var(--bg); color: var(--text);
    font-family: 'Noto Sans TC', 'Inter', sans-serif; font-weight: 300; }
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
  /* 🥚 視覺類彩蛋 — 獨立命名，跟 loading spinner 用的 spin 分開，避免以後改 spinner 速度時互相影響 */
  @keyframes barrelRoll { from { transform:rotate(0deg); } to { transform:rotate(360deg); } }
  body.barrel-roll-effect { animation: barrelRoll 1s ease-in-out; transform-origin:center center; }

  @keyframes eggShake {
    0%,100% { transform:translate(0,0); }
    10% { transform:translate(-8px,-4px); } 20% { transform:translate(8px,4px); }
    30% { transform:translate(-8px,4px); }  40% { transform:translate(8px,-4px); }
    50% { transform:translate(-6px,2px); }  60% { transform:translate(6px,-2px); }
    70% { transform:translate(-4px,4px); }  80% { transform:translate(4px,-4px); }
    90% { transform:translate(-2px,2px); }
  }
  body.shake-effect { animation: eggShake 0.5s ease-in-out; }

  @keyframes eggFlipTable {
    0% { transform:rotate(0deg); } 15% { transform:rotate(180deg); }
    85% { transform:rotate(180deg); } 100% { transform:rotate(0deg); }
  }
  body.flip-table-effect { animation: eggFlipTable 3.5s ease-in-out; transform-origin:center center; }

  @keyframes eggTripMode { from { filter:hue-rotate(0deg); } to { filter:hue-rotate(360deg); } }
  html.trip-mode-effect { animation: eggTripMode 1s linear 4; }

  @keyframes confettiFall {
    from { transform:translateY(0) rotate(0deg); opacity:0.9; }
    to   { transform:translateY(105vh) rotate(720deg); opacity:0.9; }
  }

  /* microscope：2026-08-21 換掉 kamehameha。整頁真的放到很大並維持幾秒再縮回來（跟 break
     glass／kamehameha 一樣是真實 transform，不是疊加素材）。放大期間畫面上的東西雖然看起來變
     大了，位置還是可以被點到（CSS transform 不影響 hit-test），所以額外疊一個全螢幕透明層
     擋掉點擊（pointer-events:auto，其他效果的疊層都是 none，這個刻意相反）；這個疊層沒有自己
     的動畫，純粹跟著 .microscope-effect class 存在/消失，class 一被拿掉就自動解除攔截，不用
     另外對齊動畫時長。 */
  @keyframes eggMicroscopeZoom {
    0%   { transform:scale(1); }
    16%  { transform:scale(5); }
    84%  { transform:scale(5); }
    100% { transform:scale(1); }
  }
  body.microscope-effect { animation:eggMicroscopeZoom 3.5s cubic-bezier(.4,0,.2,1); transform-origin:center center; }
  body.microscope-effect::after {
    content:""; position:fixed; inset:0; z-index:999999; pointer-events:auto; cursor:not-allowed; background:transparent;
  }

  /* break glass in case of emergency：2026-08-21 同樣換掉「模擬裂痕」的做法，改成全螢幕紅/白
     警報燈 strobe 閃爍（像消防警鈴），配合原本已經加強過的震動——不追求擬真，追求「一看就知道
     出事了」。 */
  @keyframes eggGlassStrobe {
    0%   { background-color:transparent; opacity:0; }
    10%  { background-color:#ff1a1a; opacity:0.85; }
    20%  { background-color:#ffffff; opacity:0.9; }
    30%  { background-color:#ff1a1a; opacity:0.85; }
    40%  { background-color:#ffffff; opacity:0.9; }
    50%  { background-color:#ff1a1a; opacity:0.8; }
    65%,100% { background-color:transparent; opacity:0; }
  }
  @keyframes eggGlassShake {
    0%   { transform:translate(0,0); }
    8%   { transform:translate(-11px,7px); }
    16%  { transform:translate(10px,-8px); }
    24%  { transform:translate(-9px,6px); }
    34%  { transform:translate(8px,-5px); }
    46%  { transform:translate(-5px,3px); }
    60%  { transform:translate(3px,-2px); }
    100% { transform:translate(0,0); }
  }
  body.glass-shatter-effect { animation:eggGlassShake 0.6s cubic-bezier(.36,.07,.19,.97); }
  body.glass-shatter-effect::after {
    content:""; position:fixed; inset:0; z-index:99997; pointer-events:none;
    animation:eggGlassStrobe 0.6s steps(1,end) forwards;
  }

  /* does not compute：2026-08-21 加強版，原本的位移幅度只有 ±3px 太弱，改成兩波「大幅度突波」
     （最大到 14px，中間穿插靜止），中段加一次瞬間全黑 dropout 模擬訊號斷線，比連續小抖動更有
     「故障」的感覺。body 位移／黑屏 dropout／雜訊疊圖三個動畫都對齊 0.8s。 */
  @keyframes eggGlitchShift {
    0%,100% { transform:translate(0,0); }
    4%  { transform:translate(-11px,3px); }
    8%  { transform:translate(9px,-4px); }
    12% { transform:translate(-7px,5px); }
    16% { transform:translate(11px,-2px); }
    20% { transform:translate(-4px,0); }
    45% { transform:translate(0,0); }
    50% { transform:translate(-15px,4px); }
    54% { transform:translate(13px,-5px); }
    58% { transform:translate(-9px,3px); }
    62%,100% { transform:translate(0,0); }
  }
  @keyframes eggGlitchFlicker {
    0%  { opacity:0; }
    4%  { opacity:0.9; }
    9%  { opacity:0.15; }
    14% { opacity:0.95; }
    18% { opacity:0.2; }
    30% { opacity:0.7; }
    40% { opacity:0.05; }
    50% { opacity:1; background-color:#000; }
    52% { opacity:0; background-color:transparent; }
    60% { opacity:0.6; }
    75% { opacity:0.15; }
    100%{ opacity:0; }
  }
  body.glitch-effect { animation:eggGlitchShift 0.8s steps(1,end); }
  body.glitch-effect::after {
    content:""; position:fixed; inset:0; z-index:99997; pointer-events:none; mix-blend-mode:overlay;
    background-image:
      repeating-linear-gradient(0deg, rgba(255,255,255,0.08) 0px, rgba(0,0,0,0.12) 1px, transparent 2px, transparent 4px),
      repeating-linear-gradient(90deg, rgba(0,255,255,0.08), rgba(255,0,255,0.08) 2px, transparent 4px);
    animation:eggGlitchFlicker 0.8s steps(1,end) forwards;
  }

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
    --cal-jira-bg: #F5F5F4; --cal-jira-text: #57534E; --cal-jira-border: #D6D3D1;
    --prod-ava:#1e6fb5; --prod-avt:#0891b2; --prod-aca:#0e7a5a;
    --prod-tmsp:#7c3aed; --prod-gw:#b45309; --prod-kms:#be185d; --prod-sitechat:#4338ca;
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
    --cal-jira-bg: #292524; --cal-jira-text: #D6D3D1; --cal-jira-border: #78716C;
    --prod-ava:#4d90d4; --prod-avt:#22c4de; --prod-aca:#22a474;
    --prod-tmsp:#a78bfa; --prod-gw:#f59e0b; --prod-kms:#e879a0; --prod-sitechat:#818cf8;
  }
  html[data-theme="dark"] input[type="date"]::-webkit-calendar-picker-indicator { filter: invert(0.7); }
  html[data-theme="dark"] select option { background: #1C1C1C; color: #EDEDED; }

  /* 🥚 jim mode — 疊在既有的 CSS variable 系統上（跟 html[data-theme] 同一套機制），全站
     inline style 裡寫 var(--text)/var(--bg) 這種變數參照都會自動吃到，不用改任何元件。 */
  html.jim-mode-effect {
    --bg: #000000; --surface: #060a06; --surface-raised: #0c140c;
    --border: #113311; --border-mid: #1a4d1a;
    --text: #00ff41; --text-mid: #00cc33; --text-subtle: #009926;
    --accent: #00ff41; --accent-light: #00330d;
    --accent-border: rgba(0,255,65,0.35); --accent-subtle: rgba(0,255,65,0.08);
    --green: #00ff41; --green-light: #001a08; --green-subtle: rgba(0,255,65,0.08);
    --amber: #ffcc00; --amber-light: #1a1500; --amber-subtle: rgba(255,204,0,0.08);
    --red: #ff3333; --red-light: #1a0000; --red-subtle: rgba(255,51,51,0.08);
    --purple: #33ffcc; --purple-light: #001a15; --purple-subtle: rgba(51,255,204,0.08);
    --shadow-sm: 0 0 4px rgba(0,255,65,0.15);
    --shadow: 0 0 12px rgba(0,255,65,0.12);
  }
  html.jim-mode-effect body { font-family:'DM Mono','Courier New',monospace; }
  html.jim-mode-effect body::after {
    content:""; position:fixed; inset:0; z-index:99990; pointer-events:none;
    background:repeating-linear-gradient(0deg, rgba(0,255,65,0.04) 0px, rgba(0,255,65,0.04) 1px, transparent 1px, transparent 3px);
  }

  /* Jira description 展開面板：後端回傳 Jira 原生 renderedFields HTML（含表格、清單、mention 連結等），
     這裡只做最基本的排版收斂，不動內容本身。 */
  .jira-desc-html { font-size:13px; line-height:1.6; color:var(--text); }
  .jira-desc-html p { margin:0 0 8px; }
  .jira-desc-html p:last-child { margin-bottom:0; }
  .jira-desc-html a { color:var(--accent); }
  .jira-desc-html table { border-collapse:collapse; width:100%; margin:8px 0; font-size:12px; }
  .jira-desc-html th, .jira-desc-html td { border:1px solid var(--border); padding:6px 10px; text-align:left; }
  .jira-desc-html th { background:var(--surface-raised); font-weight:500; }
  .jira-desc-html ul, .jira-desc-html ol { margin:0 0 8px; padding-left:20px; }
  .jira-desc-html .jira-img-placeholder { display:inline-flex; align-items:center; gap:4px; background:var(--surface-raised); border:1px dashed var(--border-mid); color:var(--text-subtle); font-size:12px; padding:3px 8px; border-radius:6px; margin:2px 0; }
  .jira-desc-html code { background:var(--surface-raised); padding:1px 5px; border-radius:4px; font-family:'DM Mono',monospace; font-size:12px; }
`;

// ─── Helpers ──────────────────────────────────────────────────
const daysUntil = (d) => d ? Math.ceil((new Date(d) - new Date()) / 86400000) : null;
const fmtDate   = (d) => d ? new Date(d).toLocaleDateString("zh-TW") : "—";

const getFlags = (products, integrations) => ({
  hasAva:  products.includes("AVA"),
  hasAca:  products.includes("ACA"),
  hasGw:   products.includes("GW"),
  hasTmsp: products.includes("TMSP"),
  hasIptv: integrations.includes("IPTV"),
});

const calcTotal = (products, integrations) => {
  const { hasAva, hasAca, hasGw, hasTmsp, hasIptv } = getFlags(products, integrations);
  return (hasAva ? BASIC_ITEMS.length : 0) + (hasAca ? 1 : 0) + (hasTmsp ? 1 : 0)
    + ((hasAva||hasGw) ? (hasIptv ? FAQ_ITEMS.length : FAQ_ITEMS.length - 1) : 0)
    + (hasAva ? BATCH2_ITEMS.length : 0) + (hasGw ? 1 : 0);
};

const calcPct = (proj) => {
  const { products, integrations } = proj.info;
  const { hasAva, hasAca, hasGw, hasTmsp, hasIptv } = getFlags(products, integrations);
  if (!hasAva && !hasAca && !hasGw && !hasTmsp) return 0;
  const total = calcTotal(products, integrations);
  if (!total) return 0;
  const done =
    (hasAva ? BASIC_ITEMS.filter(k => proj.basicChecked[k]).length : 0)
    + (hasAca && proj.basicChecked[ACA_ITEM] ? 1 : 0)
    + (hasTmsp && proj.basicChecked[TMSP_ITEM] ? 1 : 0)
    + ((hasAva||hasGw) ? Object.entries(proj.faqChecked).filter(([k,v]) => v && (k !== FAQ_TV_ITEM || hasIptv)).length : 0)
    + (hasAva ? BATCH2_ITEMS.filter(i => proj.batch2Checked[i]).length : 0)
    + (hasGw  && proj.batch2Checked[GW_ITEM] ? 1 : 0);
  return Math.round((done / total) * 100);
};

const newTask = () => ({
  id: crypto.randomUUID(), project_id: null,
  name:"", description:"", type:"deadline",
  deadline:"", period_start:"", period_end:"", url:"",
  is_internal: true, completed: false,
});

// ─── DB ↔ UI ──────────────────────────────────────────────────
const dbToUi = (row, prog) => ({
  id: row.id,
  createdAt: row.created_at ?? null,
  updatedAt: prog?.updated_at ?? row.updated_at ?? null,
  info: {
    name: row.name ?? "", hotelId: row.hotel_id ?? "",
    address: row.address ?? "", region: row.region ?? "", regionOther: row.region_other ?? "",
    products: row.products ?? [], avaUnits: row.ava_units ?? "", avaSpare: row.ava_spare ?? "", avtUnits: row.avt_units ?? "",
    installingRooms: row.installing_rooms ?? "", tmspMaxSpaces: row.tmsp_max_spaces ?? "",
    tmspRoomCount: row.tmsp_room_count ?? "", acaLines: row.aca_lines ?? "", acaPlan: row.aca_plan ?? "",
    integrations: row.integrations ?? [], integrationNotes: row.integration_notes ?? {},
    launchDate: row.launch_date ?? "", batch1Deadline: row.batch1_deadline ?? "",
    batch2Deadline: row.batch2_deadline ?? "", notes: row.notes ?? "",
    pic: row.pic ?? "", jiraEpic: row.jira_epic ?? "",
  },
  basicChecked: prog?.basic_checked ?? {}, basicNotes: prog?.basic_notes ?? {},
  faqChecked:   prog?.faq_checked   ?? {}, faqNotes:   prog?.faq_notes   ?? {},
  batch2Checked: prog?.batch2_checked ?? {}, batch2Notes: prog?.batch2_notes ?? {},
  sheetLinks: {
    basic: prog?.sheet_links?.basic || (AVA_FORM_BASE_URL + "?p=" + row.id),
    faq: prog?.sheet_links?.faq || "https://kms.aiello.ai/dashboard",
    showcase: prog?.sheet_links?.showcase || avaUiSettingsUrl(row.id, "showcase"),
    ad: prog?.sheet_links?.ad || avaUiSettingsUrl(row.id, "ads"),
    popupQR: prog?.sheet_links?.popupQR || avaUiSettingsUrl(row.id, "qr"),
    guestWeb: prog?.sheet_links?.guestWeb || (((row.products ?? []).includes("GW") && row.hotel_id) ? ("https://spi.aiello.ai/" + encodeURIComponent(row.hotel_id) + "/guest_web_builder") : ""),
    acaScenario: prog?.sheet_links?.acaScenario ?? "",
    tmspSetup: prog?.sheet_links?.tmspSetup ?? "",
  },
  tasks: [],
});

const uiToDb = (p) => ({
  project: {
    id: p.id, name: p.info.name, hotel_id: p.info.hotelId,
    address: p.info.address, region: p.info.region, region_other: p.info.regionOther,
    products: p.info.products, ava_units: p.info.avaUnits, ava_spare: p.info.avaSpare, avt_units: p.info.avtUnits,
    installing_rooms: p.info.installingRooms, tmsp_max_spaces: p.info.tmspMaxSpaces,
    tmsp_room_count: p.info.tmspRoomCount, aca_lines: p.info.acaLines, aca_plan: p.info.acaPlan,
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

const newProject = () => {
  const id = crypto.randomUUID();
  return {
  id,
  // Local-only convenience field for immediate correct sort order right after creation
  // (2026-07-29). dbToUi() normally sets this from the DB row's real created_at on load, but a
  // brand-new project lives purely in local state until the next full refetch - without this,
  // createdAt stayed undefined for the whole session, and the sort comparators' `?? ""` fallback
  // made an empty string, which sorts before every real timestamp - so new projects looked like
  // the oldest project in the list regardless of sortBy direction (real incident, Jim 2026-07-29).
  // Deliberately NOT sent to the DB - uiToDb()'s `project` object has no created_at/createdAt key,
  // so this has zero effect on the insert; the projects table's created_at column already has its
  // own `default now()` and keeps being the source of truth there. The two timestamps will differ
  // by a network round-trip's worth of milliseconds at most, irrelevant for sorting purposes.
  createdAt: new Date().toISOString(),
  info: {
    name:"", hotelId:"", address:"", region:"", regionOther:"",
    products:[], avaUnits:"", avaSpare:"", avtUnits:"", installingRooms:"", tmspMaxSpaces:"", tmspRoomCount:"", acaLines:"", acaPlan:"", integrations:[], integrationNotes:{},
    launchDate:"", batch1Deadline:"", batch2Deadline:"", notes:"", pic:"", jiraEpic:"",
  },
  basicChecked:{}, basicNotes:{}, faqChecked:{}, faqNotes:{},
  batch2Checked:{}, batch2Notes:{},
  sheetLinks:{ basic: AVA_FORM_BASE_URL + "?p=" + id, faq: "https://kms.aiello.ai/dashboard", showcase: avaUiSettingsUrl(id,"showcase"), ad: avaUiSettingsUrl(id,"ads"), popupQR: avaUiSettingsUrl(id,"qr"), guestWeb:"", acaScenario:"", tmspSetup:"" },
  tasks:[],
  };
};

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
        <span style={{ fontSize:11, letterSpacing:1.2, color:"var(--text-subtle)", textTransform:"uppercase", fontWeight:400 }}>{label}</span>
        <span style={{ fontSize:13, fontWeight:500, color, fontFamily:"'DM Mono',monospace" }}>{pct}%</span>
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
const AielloLogo = ({ size=22 }) => (
  <img src="/aiello-logo.svg" width={size} height={size} alt="Aiello" style={{display:"block"}}/>
);

// 🥚 jim mode 的 debug HUD — 純裝飾用的開發者主機板風格浮動面板，跟真的 render 次數/API 次數
// 無關（那需要全站埋計數器，投報率不高），只用容易且真實取得的資訊：時鐘、面板自己的 uptime、
// 目前追蹤的專案/任務數，加一句每 6 秒輪播的工程師梗當調味。
const JIM_HUD_QUOTES = [
  "Compiling vibes...",
  "No bugs, only undocumented features.",
  "It works on my machine.",
  "99 little bugs in the code...",
  "Have you tried turning it off and on again?",
  "// TODO: fix this properly (never)",
];

const DebugHud = ({ projects, allTasks }) => {
  const [now, setNow] = useState(new Date());
  const [quoteIdx, setQuoteIdx] = useState(0);
  const startRef = useRef(Date.now());

  useEffect(() => {
    const t1 = setInterval(() => setNow(new Date()), 1000);
    const t2 = setInterval(() => setQuoteIdx(i => (i + 1) % JIM_HUD_QUOTES.length), 6000);
    return () => { clearInterval(t1); clearInterval(t2); };
  }, []);

  const uptimeSec = Math.floor((now.getTime() - startRef.current) / 1000);
  const mm = String(Math.floor(uptimeSec / 60)).padStart(2, "0");
  const ss = String(uptimeSec % 60).padStart(2, "0");

  return (
    <div style={{ position:"fixed", bottom:16, left:16, zIndex:99997,
      background:"rgba(0,10,0,0.88)", color:"#00ff41", fontFamily:"'DM Mono','Courier New',monospace",
      fontSize:11, padding:"10px 14px", borderRadius:8, border:"1px solid rgba(0,255,65,0.35)",
      lineHeight:1.7, pointerEvents:"none", boxShadow:"0 4px 20px rgba(0,0,0,0.5)", minWidth:180 }}>
      <div style={{ fontWeight:600, marginBottom:2 }}>🖥️ JIM MODE</div>
      <div>{now.toLocaleTimeString("zh-TW", { hour12:false })}</div>
      <div>uptime {mm}:{ss}</div>
      <div>projects: {projects.length} · tasks: {allTasks.length}</div>
      <div style={{ opacity:0.65, marginTop:4, fontStyle:"italic" }}>{JIM_HUD_QUOTES[quoteIdx]}</div>
    </div>
  );
};

const Ico = ({ name, size=16, color="currentColor", strokeWidth=1.6, style={} }) => (
  <Icon d={ICONS[name]||""} size={size} color={color} strokeWidth={strokeWidth} style={style}/>
);

const MiniBar = ({ pct, color }) => (
  <div style={{ height:4, background:"var(--border)", borderRadius:2, overflow:"hidden", flex:1 }}>
    <div style={{ height:"100%", borderRadius:2, background:color, width:`${pct}%`, transition:"width 0.5s ease" }}/>
  </div>
);

const Card = ({ children, style={}, ...rest }) => (
  <div {...rest} style={{ background:"var(--surface)", border:"1px solid var(--border)", borderRadius:12,
    padding:24, marginBottom:16, ...style }}>
    {children}
  </div>
);

// Single-line, horizontally-scrollable text (used for form-link URLs that must stay on one line
// without shrinking their font or wrapping). Shows a fade-out mask on the right edge, but only
// when the text actually overflows its container — so short URLs that already fit fully never
// get a fake "cut off" look (Jim, 2026-08-13).
const ScrollFadeText = ({ children, fadeColor="var(--surface)", style={} }) => {
  const ref = useRef(null);
  const [overflowing, setOverflowing] = useState(false);
  useEffect(() => {
    const check = () => {
      const el = ref.current;
      if (el) setOverflowing(el.scrollWidth > el.clientWidth + 1);
    };
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, [children]);
  return (
    <div style={{ position:"relative", flex:1, minWidth:0 }}>
      <div ref={ref} style={{ overflowX:"auto", whiteSpace:"nowrap", scrollbarWidth:"thin", ...style }}>
        {children}
      </div>
      {overflowing && (
        <div style={{ position:"absolute", top:0, right:0, bottom:0, width:20,
          background:`linear-gradient(to right, transparent, ${fadeColor})`, pointerEvents:"none" }}/>
      )}
    </div>
  );
};

const SectionLabel = ({ title, icon, color="var(--accent)" }) => (
  <div style={{ fontSize:11, letterSpacing:1.5, color, textTransform:"uppercase", marginBottom:12,
    display:"flex", alignItems:"center", gap:6, fontWeight:400 }}>
    {icon && <Ico name={icon} size={12} color="currentColor"/>}{title}
  </div>
);

const SectionCount = ({ title, checked, total, color }) => (
  <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:14 }}>
    <div style={{ fontSize:15, fontWeight:400, color:"var(--text)" }}>{title}</div>
    <div style={{ border:"1px solid var(--border)", borderRadius:8, padding:"4px 12px", background:"var(--surface-raised)" }}>
      <span style={{ fontSize:16, fontWeight:500, color, fontFamily:"'DM Mono',monospace" }}>{checked}</span>
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
    '<a href="$2" target="_blank" rel="noreferrer" style="color:var(--accent);text-decoration:underline;font-weight:400">$1</a>');
  // Headers
  h = h.replace(/^### (.+)$/gm,"<div style='font-size:13px;font-weight:500;margin:8px 0 3px;color:var(--text)'>$1</div>");
  h = h.replace(/^## (.+)$/gm, "<div style='font-size:14px;font-weight:500;margin:10px 0 4px;color:var(--text)'>$1</div>");
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
      textTransform:"uppercase", marginBottom:6, fontWeight:400 }}>{label}</label>
    <input type={type} value={value} onChange={e=>onChange(e.target.value)}
      placeholder={placeholder} style={baseInput}
      onFocus={e=>(e.target.style.borderColor=focusColor)}
      onBlur={e=>(e.target.style.borderColor="var(--border)")}/>
  </div>
);

const Chip = ({ label, active, onClick, color="var(--accent)" }) => (
  <button onClick={onClick} style={{ padding:"5px 13px", borderRadius:6, fontFamily:"inherit",
    border:`1px solid ${active?color:"var(--border)"}`, background:active?color:"transparent",
    color:active?"#fff":"var(--text-mid)", cursor:"pointer", fontSize:13, fontWeight:400, transition:"all 0.12s" }}>
    {label}
  </button>
);

// CheckRow: simplified — checked always green-subtle, no red unchecked state
const CheckRow = ({ label, checked, onChange }) => (
  <div onClick={onChange} style={{ display:"flex", alignItems:"center", gap:10, padding:"9px 12px",
    borderRadius:8, cursor:"pointer", marginBottom:4,
    background: checked ? "var(--green-subtle)" : "transparent",
    border: `1px solid ${checked ? "var(--green)" : "var(--border)"}`,
    transition:"all 0.12s" }}>
    <div style={{ width:17, height:17, borderRadius:4, flexShrink:0,
      border:`1.5px solid ${checked ? "var(--green)" : "var(--border-mid)"}`,
      background: checked ? "var(--green)" : "transparent",
      display:"flex", alignItems:"center", justifyContent:"center", transition:"all 0.12s" }}>
      {checked && <span style={{ color:"#fff", fontSize:10, fontWeight:500 }}>✓</span>}
    </div>
    <span style={{ fontSize:13, color: checked ? "var(--text)" : "var(--text-mid)", flex:1 }}>{label}</span>
    {!checked && <span style={{ fontSize:10, color:"var(--text-subtle)", fontWeight:400 }}>待完成</span>}
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

const SheetLink = ({ value, onChange }) => {
  const invalid = value.length>0 && !value.startsWith("http");
  return (
    <div style={{ marginTop:12, padding:"11px 13px", background:"var(--accent-subtle)",
      border:`1px solid ${invalid?"var(--red)":"var(--accent-border)"}`, borderRadius:10 }}>
      <label style={{ display:"flex", alignItems:"center", gap:5, fontSize:11, letterSpacing:1.2,
        color:"var(--accent)", textTransform:"uppercase", marginBottom:7, fontWeight:400 }}><Ico name="link" size={11} color="currentColor"/> 檔案連結</label>
      <input type="url" value={value} onChange={e=>onChange(e.target.value)}
        placeholder="貼上 Excel 檔案連結或其他資料表連結"
        style={{ ...baseInput, borderColor:invalid?"var(--red)":"var(--border)" }}
        onFocus={e=>(e.target.style.borderColor=invalid?"var(--red)":"var(--accent)")}
        onBlur={e=>(e.target.style.borderColor=invalid?"var(--red)":"var(--border)")}/>
      {invalid && <div style={{ marginTop:5, fontSize:11, color:"var(--red)" }}>⚠️ 連結格式不正確，請確認是否以 http 或 https 開頭</div>}
      {!invalid && value && <a href={value} target="_blank" rel="noreferrer"
        style={{ display:"inline-flex", alignItems:"center", gap:4, marginTop:7,
          fontSize:12, color:"var(--accent)", textDecoration:"none", fontWeight:400 }}>↗ 開啟連結</a>}
    </div>
  );
};

const NavRow = ({ onBack, onNext, nextLabel, nextColor="var(--accent)" }) => (
  <div style={{ display:"flex", justifyContent:onBack?"space-between":"flex-end" }}>
    {onBack && <button onClick={onBack} style={{ background:"transparent", color:"var(--text-mid)",
      border:"1px solid var(--border)", borderRadius:8, padding:"9px 20px",
      fontSize:13, cursor:"pointer", fontFamily:"inherit" }}>← 返回</button>}
    {onNext && <button onClick={onNext} style={{ background:nextColor, color:"#fff", border:"none",
      borderRadius:8, padding:"9px 22px", fontSize:13, fontWeight:400,
      cursor:"pointer", fontFamily:"inherit" }}>{nextLabel}</button>}
  </div>
);

// Read-only overview check row
const OvCheckRow = ({ label, checked, note, color }) => (
  <div style={{ borderBottom:"1px solid var(--border)" }}>
    <div style={{ display:"flex", alignItems:"flex-start", gap:8, padding:"7px 0" }}>
      <span style={{ fontSize:12, color:checked?color:"var(--border-mid)", flexShrink:0, marginTop:2, fontWeight:500 }}>{checked?"✓":"○"}</span>
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
    <div style={{ fontSize:11, letterSpacing:1.4, color, textTransform:"uppercase", marginBottom:12, fontWeight:400 }}>{title}</div>
    {children}
    {linkKey && sheetLinks[linkKey] && (
      <a href={sheetLinks[linkKey]} target="_blank" rel="noreferrer"
        style={{ display:"inline-flex", alignItems:"center", gap:5, marginTop:12,
          fontSize:12, color:"var(--accent)", textDecoration:"none", fontWeight:400,
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
        <span style={{ fontSize:12, color:done?"var(--purple)":"var(--border-mid)", fontWeight:500 }}>{done?"✓":"○"}</span>
        <span style={{ fontSize:13, color:done?"var(--text)":"var(--text-subtle)", fontWeight:done?600:400 }}>{item}</span>
      </div>
      {hasNote && <div style={{ margin:"5px 0 7px 20px", padding:"5px 9px", background:"var(--bg)",
        border:"1px solid var(--border)", borderRadius:6, fontSize:11, color:"var(--text-mid)",
        lineHeight:1.6, whiteSpace:"pre-wrap" }}>{note}</div>}
      {sheetLinks[linkKey] && <div style={{ marginLeft:20 }}>
        <a href={sheetLinks[linkKey]} target="_blank" rel="noreferrer"
          style={{ fontSize:11, color:"var(--purple)", textDecoration:"none", fontWeight:400,
            background:"var(--purple-subtle)", border:"1px solid var(--purple)",
            borderRadius:5, padding:"2px 9px", display:"inline-flex", alignItems:"center", gap:4 }}><Ico name="link" size={11} color="currentColor"/> 連結</a>
      </div>}
    </div>
  );
};

// Dropdown filter
const FilterSelect = ({ label, value, onChange, options }) => (
  <div style={{ display:"flex", flexDirection:"column", gap:4 }}>
    {label && <label style={{ fontSize:11, color:"var(--text-subtle)", fontWeight:400, letterSpacing:1, textTransform:"uppercase" }}>{label}</label>}
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
            <div style={{ fontSize:16, fontWeight:500, color:C.text }}>通知設定</div>
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
                style={{ width:"100%", padding:"10px 0", background:C.accent, color:"#fff",
                  border:"none", borderRadius:8, fontSize:14, fontWeight:500,
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
                <div style={{ fontSize:11, fontWeight:500, color:C.textMid, textTransform:"uppercase", letterSpacing:"0.08em", marginBottom:10 }}>提醒時機</div>
                <div style={{ display:"flex", flexWrap:"wrap", gap:8 }}>
                  {NOTIFY_OPTIONS.map(({ label, value })=>(
                    <button key={value} onClick={()=>handleNotifyDays(value)}
                      style={{ padding:"6px 14px", borderRadius:20, fontSize:13, cursor:"pointer", fontFamily:"inherit",
                        background:sub.notify_days_before===value?C.accent:C.bg,
                        color:sub.notify_days_before===value?"#fff":C.text,
                        border:`1px solid ${sub.notify_days_before===value?C.accent:C.border}`,
                        fontWeight:sub.notify_days_before===value?700:400 }}>
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {/* 訂閱專案 */}
              <div>
                <div style={{ fontSize:11, fontWeight:500, color:C.textMid, textTransform:"uppercase", letterSpacing:"0.08em", marginBottom:10 }}>
                  訂閱專案（{(sub.subscribed_projects||[]).length} / {projects.length}）
                </div>
                <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
                  {projects.map(proj=>{
                    const active=(sub.subscribed_projects||[]).includes(proj.id);
                    return (
                      <div key={proj.id} onClick={()=>handleToggleProject(proj.id)}
                        style={{ display:"flex", alignItems:"center", justifyContent:"space-between",
                          padding:"10px 14px", borderRadius:10, cursor:"pointer",
                          background:active?C.accentLight:C.bg,
                          border:`1px solid ${active?C.accentBorder:"transparent"}`,
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
        <div style={{ fontSize:14, fontWeight:500, color:"var(--text)" }}>通知</div>
        {totalBadge>0 && (
          <span style={{ fontSize:11, background:"var(--red-light)", color:"var(--red)",
            borderRadius:20, padding:"2px 9px", fontWeight:400 }}>
            {totalBadge} 筆
          </span>
        )}
      </div>
      <div style={{ overflowY:"auto", flex:1 }}>
        {/* 客戶更新 */}
        {customerNotifs.length>0 && (<>
          <div style={{ padding:"8px 16px 4px", fontSize:10, fontWeight:500, letterSpacing:"0.08em",
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
                  <div style={{ fontSize:13, fontWeight:400, color:"var(--text)",
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
          <div style={{ padding:"8px 16px 4px", fontSize:10, fontWeight:500, letterSpacing:"0.08em",
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
                fontFamily:"'DM Mono',monospace", fontSize:12, fontWeight:500,
                color:n.days===0?"var(--red)":n.days<=2?"var(--amber)":"var(--green)" }}>
                {n.days===0?"今天":`${n.days}天`}
              </div>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ fontSize:13, fontWeight:400, color:"var(--text)",
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
const CalendarPage = ({ projects, allTasks, onTaskAdded, onTaskDeleted, accessToken }) => {
  const today = new Date();
  const [year,        setYear]        = useState(today.getFullYear());
  const [month,       setMonth]       = useState(today.getMonth());
  const [filters,     setFilters]     = useState({ launch:true, batch:true, task:true, jira:true });
  const [jiraEvents,  setJiraEvents]  = useState([]);
  const [jiraLoading, setJiraLoading] = useState(false);

  // Jira 到期日：這個月曆是儀表板裡隨時會點進來看的頁面，跟單一專案的「Jira 子任務」分頁不同，
  // 不能每次開都對 29+ 個專案的 epic 各打一次 Jira。2026-09-03 決定先簡化成「只在打開月曆頁時
  // 才批次抓一次、存在這個頁面自己的 state 裡」，不做跨頁快取——每次進月曆看到的都是當下最新
  // 資料，但離開頁面重進來會重抓一次；之後如果 Jim 覺得需要更即時的儀表內部通知提醒，再評估要
  // 不要另外做持久化快取。
  useEffect(() => {
    const epics = [...new Set(
      projects.map(p => parseEpicId(p.info.jiraEpic)).filter(Boolean)
    )];
    if (epics.length === 0) return;
    setJiraLoading(true);
    (async () => {
      const results = await Promise.all(
        epics.map(epicId => jiraFetch("issues", { epicId }, null, accessToken))
      );
      const list = [];
      results.forEach((res, i) => {
        const epicId = epics[i];
        const proj = projects.find(p => parseEpicId(p.info.jiraEpic) === epicId);
        const name = proj?.info.name || "（未命名）";
        (res.issues ?? []).forEach(issue => {
          if (!issue.dueDate) return;
          list.push({
            date: issue.dueDate, label: name, sub: `Jira：${issue.summary}`,
            ...CAL_COLORS.jira, taskId: null,
            jiraUrl: `https://aiello-eng.atlassian.net/browse/${issue.key}`,
          });
        });
      });
      setJiraEvents(list);
      setJiraLoading(false);
    })();
  }, [projects, accessToken]);
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
    if (filters.jira) {
      jiraEvents.forEach(ev => { if (inMonth(ev.date)) list.push(ev); });
    }
    return list;
  }, [projects, allTasks, year, month, filters, jiraEvents]);

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
            <h3 style={{ fontSize:18, fontWeight:500, color:C.text, margin:"0 0 4px" }}>{modal.mode==="add"?"新增任務":"編輯任務"}</h3>
            <div style={{ fontSize:12, color:C.textLight }}>{fmtDate(modal.date)}</div>
          </div>
          <button onClick={closeModal} style={{ background:"none", border:`1px solid ${C.border}`, borderRadius:8, padding:"4px 10px", cursor:"pointer", fontSize:16, color:C.textLight, fontFamily:"inherit" }}>✕</button>
        </div>
        {modal.mode==="add" && (
          <div style={{ marginBottom:16 }}>
            <label style={{ display:"block", fontSize:11, letterSpacing:1.5, color:C.textMid, textTransform:"uppercase", marginBottom:7, fontWeight:400 }}>歸屬專案</label>
            <select value={draft.projectId} onChange={e=>setDraft(d=>({ ...d, projectId:e.target.value }))}
              style={{ ...baseInput, padding:"10px 32px 10px 14px", appearance:"none", backgroundImage:`url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%2394a3b8' d='M6 8L1 3h10z'/%3E%3C/svg%3E")`, backgroundRepeat:"no-repeat", backgroundPosition:"right 10px center", cursor:"pointer" }}
              onFocus={e=>(e.target.style.borderColor=C.accent)} onBlur={e=>(e.target.style.borderColor=C.border)}>
              {projects.map(p=><option key={p.id} value={p.id}>{p.info.name||"（未命名）"}{p.info.hotelId?` #${p.info.hotelId}`:""}</option>)}
            </select>
          </div>
        )}
        <div style={{ marginBottom:16 }}>
          <label style={{ display:"block", fontSize:11, letterSpacing:1.5, color:C.textMid, textTransform:"uppercase", marginBottom:7, fontWeight:400 }}>任務名稱 *</label>
          <input value={draft.name} onChange={e=>setDraft(d=>({ ...d, name:e.target.value }))} placeholder="輸入任務名稱" style={baseInput}
            onFocus={e=>(e.target.style.borderColor=C.accent)} onBlur={e=>(e.target.style.borderColor=C.border)}/>
        </div>
        <div style={{ marginBottom:16 }}>
          <label style={{ display:"block", fontSize:11, letterSpacing:1.5, color:C.textMid, textTransform:"uppercase", marginBottom:7, fontWeight:400 }}>內容概述</label>
          <textarea value={draft.description} onChange={e=>setDraft(d=>({ ...d, description:e.target.value }))} placeholder="描述任務目標或相關說明…" rows={3}
            style={{ ...baseInput, resize:"vertical", minHeight:72 }}
            onFocus={e=>(e.target.style.borderColor=C.accent)} onBlur={e=>(e.target.style.borderColor=C.border)}/>
        </div>
        <div style={{ marginBottom:16 }}>
          <label style={{ display:"block", fontSize:11, letterSpacing:1.5, color:C.textMid, textTransform:"uppercase", marginBottom:7, fontWeight:400 }}>相關連結（選填）</label>
          <input type="url" value={draft.url} onChange={e=>setDraft(d=>({ ...d, url:e.target.value }))} placeholder="https://…" style={baseInput}
            onFocus={e=>(e.target.style.borderColor=C.accent)} onBlur={e=>(e.target.style.borderColor=C.border)}/>
          {draft.url && !draft.url.startsWith("http") && <div style={{ marginTop:5, fontSize:11, color:C.red }}>⚠️ 請確認連結以 http 或 https 開頭</div>}
        </div>
        <div style={{ marginBottom:16 }}>
          <label style={{ display:"block", fontSize:11, letterSpacing:1.5, color:C.textMid, textTransform:"uppercase", marginBottom:8, fontWeight:400 }}>類型</label>
          <div style={{ display:"flex", gap:8 }}>
            {[{ v:"deadline", ico:"pin", text:"期限" },{ v:"period", ico:"repeat", text:"週期" }].map(({ v, ico, text })=>(
              <button key={v} onClick={()=>setDraft(d=>({ ...d, type:v }))}
                style={{ padding:"7px 18px", borderRadius:8, fontFamily:"inherit", fontSize:13, fontWeight:400, cursor:"pointer", transition:"all 0.15s", border:`1.5px solid ${draft.type===v?C.accent:C.border}`, background:draft.type===v?C.accent:C.white, color:draft.type===v?"#fff":C.textMid, display:"flex", alignItems:"center", gap:5 }}><Ico name={ico} size={13} color="currentColor"/>{text}</button>
            ))}
          </div>
        </div>
        {draft.type==="deadline" ? (
          <div style={{ marginBottom:20 }}>
            <label style={{ display:"block", fontSize:11, letterSpacing:1.5, color:C.textMid, textTransform:"uppercase", marginBottom:7, fontWeight:400 }}>截止日期</label>
            <input type="date" value={draft.deadline} onChange={e=>setDraft(d=>({ ...d, deadline:e.target.value }))} style={{ ...baseInput, width:"auto" }}
              onFocus={e=>(e.target.style.borderColor=C.amber)} onBlur={e=>(e.target.style.borderColor=C.border)}/>
          </div>
        ) : (
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12, marginBottom:20 }}>
            <div>
              <label style={{ display:"block", fontSize:11, letterSpacing:1.5, color:C.green, textTransform:"uppercase", marginBottom:7, fontWeight:400 }}>開始日期</label>
              <input type="date" value={draft.period_start} onChange={e=>setDraft(d=>({ ...d, period_start:e.target.value }))} style={{ ...baseInput, borderColor:C.border, background:C.greenLight }}
                onFocus={e=>(e.target.style.borderColor=C.green)} onBlur={e=>(e.target.style.borderColor=C.border)}/>
            </div>
            <div>
              <label style={{ display:"block", fontSize:11, letterSpacing:1.5, color:C.purple, textTransform:"uppercase", marginBottom:7, fontWeight:400 }}>結束日期</label>
              <input type="date" value={draft.period_end} onChange={e=>setDraft(d=>({ ...d, period_end:e.target.value }))} style={{ ...baseInput, borderColor:C.border, background:C.purpleLight }}
                onFocus={e=>(e.target.style.borderColor=C.purple)} onBlur={e=>(e.target.style.borderColor=C.border)}/>
            </div>
          </div>
        )}
        {/* is_internal toggle */}
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between",
          padding:"14px 0", borderTop:`1px solid ${C.border}`, marginBottom:4 }}>
          <div>
            <div style={{ fontSize:12, fontWeight:400, color:C.text }}>對客戶公開</div>
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
            style={{ background:!draft.name.trim()||saving?C.borderMid:C.accent, color:"#fff", border:"none", borderRadius:10, padding:"10px 24px", fontSize:14, fontWeight:500, cursor:!draft.name.trim()||saving?"not-allowed":"pointer", fontFamily:"inherit", boxShadow:draft.name.trim()&&!saving?`0 2px 8px ${C.accent}40`:"none", transition:"all 0.15s" }}>
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
          <h2 style={{ fontSize:20, fontWeight:500, color:C.text, margin:0 }}>{year}年 {monthNames[month]}</h2>
          <button onClick={()=>{ if(month===11){setMonth(0);setYear(y=>y+1);}else setMonth(m=>m+1); }} style={{ background:C.white, border:`1px solid ${C.border}`, borderRadius:8, padding:"6px 12px", cursor:"pointer", fontFamily:"inherit", fontSize:16 }}>›</button>
          <button onClick={()=>{ setYear(today.getFullYear()); setMonth(today.getMonth()); }} style={{ background:C.accentLight, border:`1px solid ${C.accentBorder}`, borderRadius:8, padding:"6px 14px", cursor:"pointer", fontFamily:"inherit", fontSize:12, color:C.accent, fontWeight:400 }}>今天</button>
        </div>
        <div style={{ display:"flex", gap:10, flexWrap:"wrap", alignItems:"center" }}>
          {[{ k:"launch", label:"上線日", ...CAL_COLORS.launch },{ k:"batch", label:"資料期限", ...CAL_COLORS.batch1 },{ k:"task", label:"任務", ...CAL_COLORS.taskDL },{ k:"jira", label:"Jira 到期日", ...CAL_COLORS.jira }].map(({ k, label, bg, text, border })=>(
            <button key={k} onClick={()=>toggleFilter(k)}
              style={{ display:"flex", alignItems:"center", gap:6, padding:"5px 12px", borderRadius:8, cursor:"pointer", fontFamily:"inherit", fontSize:12, fontWeight:400, transition:"all 0.15s", background:filters[k]?bg:C.bg, border:`1.5px solid ${filters[k]?border:C.border}`, color:filters[k]?text:C.textLight, opacity:filters[k]?1:0.6 }}>
              <span style={{ width:8, height:8, borderRadius:"50%", background:filters[k]?text:C.borderMid, flexShrink:0 }}/>{label}
            </button>
          ))}
          {jiraLoading && <span style={{ fontSize:11, color:C.textLight }}>Jira 資料讀取中…</span>}
        </div>
      </div>

      {/* Calendar grid */}
      <div ref={gridRef} style={{ border:`1px solid ${C.border}`, borderRadius:12, position:"relative", overflow:"visible" }}
        onClick={()=>{ setExpandedDay(null); setExpandedPos(null); }}>
        <div style={{ background:C.white, borderRadius:12, overflow:"hidden" }}>
        <div style={{ display:"grid", gridTemplateColumns:"repeat(7,minmax(0,1fr))", borderBottom:`1px solid ${C.border}` }}>
          {dayNames.map(d=><div key={d} style={{ padding:"10px 0", textAlign:"center", fontSize:12, fontWeight:500, color:d==="日"?C.red:d==="六"?C.accent:C.textMid }}>{d}</div>)}
        </div>
        {Array.from({ length:cells.length/7 }).map((_,wi)=>(
          <div key={wi} style={{ display:"grid", gridTemplateColumns:"repeat(7,minmax(0,1fr))", borderBottom:wi<cells.length/7-1?`1px solid ${C.border}`:"none" }}>
            {cells.slice(wi*7,wi*7+7).map((d,di)=>{
              const k         = mkKey(d);
              const isToday   = k===realTodayStr;
              const isExpanded= expandedDay===k;
              const dayEvents = d?getEventsForDay(d):[];
              const col       = di===0?C.red:di===6?C.accent:C.text;
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
                    background:isToday?C.accentLight:d?C.white:"var(--surface-raised)",
                    display:"flex", flexDirection:"column", overflow:"hidden", minWidth:0,
                    cursor:d&&dayEvents.length>2?"pointer":"default", transition:"background 0.15s",
                    position:"relative", zIndex:1 }}>
                  {d && (
                    <>
                      {/* Date + add button */}
                      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:4, flexShrink:0 }}>
                        {isToday
                          ? <span style={{ background:C.accent, color:"#fff", borderRadius:"50%", width:22, height:22, display:"inline-flex", alignItems:"center", justifyContent:"center", fontSize:12, fontWeight:500 }}>{d}</span>
                          : <span style={{ fontSize:13, color:col }}>{d}</span>}
                        {projects.length>0 && (
                          <button onClick={e=>{ e.stopPropagation(); openAddModal(k); }}
                            style={{ background:"none", border:`1px solid ${C.border}`, borderRadius:5, width:18, height:18, display:"flex", alignItems:"center", justifyContent:"center", cursor:"pointer", fontSize:12, color:C.textLight, padding:0, lineHeight:1, flexShrink:0, transition:"all 0.15s" }}
                            onMouseEnter={e=>{ e.currentTarget.style.background=C.accent; e.currentTarget.style.borderColor=C.accent; e.currentTarget.style.color="#fff"; }}
                            onMouseLeave={e=>{ e.currentTarget.style.background="none"; e.currentTarget.style.borderColor=C.border; e.currentTarget.style.color=C.textLight; }}
                            title="新增任務">+</button>
                        )}
                      </div>
                      {/* Event labels */}
                      <div style={{ display:"flex", flexDirection:"column", gap:3, flex:1, overflow:"hidden" }}>
                        {dayEvents.slice(0,2).map((ev,ei)=>(
                          <div key={ei} title={`${ev.label} — ${ev.sub}`}
                            onClick={e=>{ e.stopPropagation(); if(ev.taskId) openEditModal(ev.taskObj); else if(ev.jiraUrl) window.open(ev.jiraUrl,"_blank","noopener"); }}
                            style={{ borderRadius:5, padding:"3px 6px", background:ev.bg, border:`1px solid ${ev.border}`, cursor:(ev.taskId||ev.jiraUrl)?"pointer":"default", transition:"opacity 0.15s" }}
                            onMouseEnter={e=>{ if(ev.taskId||ev.jiraUrl) e.currentTarget.style.opacity="0.7"; }}
                            onMouseLeave={e=>{ e.currentTarget.style.opacity="1"; }}>
                            <div style={{ fontSize:10, fontWeight:500, color:ev.text, lineHeight:1.3, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
                              {ev.sub}{ev.taskId?" ✎":ev.jiraUrl?" ↗":""}
                            </div>
                            <div style={{ fontSize:10, color:ev.text, opacity:0.7, lineHeight:1.3, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{ev.label}</div>
                          </div>
                        ))}
                        {dayEvents.length>2 && !isExpanded && <div style={{ fontSize:10, color:C.accent, padding:"1px 4px", fontWeight:400 }}>+{dayEvents.length-2} 更多 ↓</div>}
                        {isExpanded && <div style={{ fontSize:10, color:C.accent, padding:"1px 4px", fontWeight:400 }}>▲ 收起</div>}
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
                background:C.white, border:`1px solid ${C.accentBorder}`,
                borderRadius:10, boxShadow:"0 8px 24px rgba(0,0,0,0.15)",
                zIndex:9999, display:"flex", flexDirection:"column" }}>
              <div style={{ flex:1, overflowY:"auto", padding:"8px 8px 0", display:"flex", flexDirection:"column", gap:4 }}>
                {dayEvs.map((ev,ei)=>(
                  <div key={ei} title={`${ev.label} — ${ev.sub}`}
                    style={{ borderRadius:5, padding:"4px 8px", background:ev.bg, border:`1px solid ${ev.border}`, flexShrink:0, display:"flex", alignItems:"flex-start", gap:4 }}>
                    <div style={{ flex:1, minWidth:0, cursor:(ev.taskId||ev.jiraUrl)?"pointer":"default" }}
                      onClick={e=>{ e.stopPropagation(); if(ev.taskId){ openEditModal(ev.taskObj); setExpandedDay(null); setExpandedPos(null); } else if(ev.jiraUrl){ window.open(ev.jiraUrl,"_blank","noopener"); }}}
                      onMouseEnter={e=>{ if(ev.taskId||ev.jiraUrl) e.currentTarget.style.opacity="0.7"; }}
                      onMouseLeave={e=>{ e.currentTarget.style.opacity="1"; }}>
                      <div style={{ fontSize:10, fontWeight:500, color:ev.text, lineHeight:1.4, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
                        {ev.sub}{ev.taskId?" ✎":ev.jiraUrl?" ↗":""}
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
          <h3 style={{ fontSize:15, fontWeight:500, color:C.text, marginBottom:12 }}>本月事件</h3>
          <div style={{ background:"var(--surface)", border:"1px solid var(--border)", borderRadius:12, overflow:"hidden" }}>
            {[...events].sort((a,b)=>a.date.localeCompare(b.date)).map((ev,i,arr)=>(
              <div key={i}
                style={{ display:"flex", alignItems:"center", gap:10, padding:"9px 14px",
                  borderBottom:i<arr.length-1?"1px solid var(--border)":"none",
                  borderLeft:`3px solid ${ev.border}`, background:"var(--surface)" }}>
                {/* 日期 */}
                <span style={{ fontSize:12, fontWeight:500, color:"var(--text-mid)", fontFamily:"'DM Mono',monospace", flexShrink:0, minWidth:80 }}>{fmtDate(ev.date)}</span>
                {/* 專案名稱 + 任務/類型名稱 */}
                <div style={{ flex:1, minWidth:0, display:"flex", alignItems:"baseline", gap:6, overflow:"hidden" }}>
                  <span style={{ fontSize:13, fontWeight:500, color:"var(--text)", flexShrink:0, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap", maxWidth:"55%" }}>{ev.label}</span>
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
                {ev.jiraUrl && !ev.taskId && (
                  <button onClick={()=>window.open(ev.jiraUrl,"_blank","noopener")}
                    style={{ background:"none", border:"none", cursor:"pointer", padding:"4px 6px", color:"var(--text-subtle)", borderRadius:6, transition:"all 0.12s", flexShrink:0 }}
                    onMouseEnter={e=>{ e.currentTarget.style.color="var(--accent)"; e.currentTarget.style.background="var(--surface-raised)"; }}
                    onMouseLeave={e=>{ e.currentTarget.style.color="var(--text-subtle)"; e.currentTarget.style.background="none"; }}
                    title="在 Jira 開啟"><Ico name="link" size={13} color="currentColor"/></button>
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
const HomePage = ({ projects, onOpen, onDelete, session, profile }) => {
  const [search,        setSearch]        = useState("");
  const [regionFilter,  setRegionFilter]  = useState("all");
  const [productFilter, setProductFilter] = useState("all");
  const [picFilter,     setPicFilter]     = useState("all");
  const [sortBy,        setSortBy]        = useState("created_desc");
  const [showNotif,     setShowNotif]     = useState(false);
  const [overdueFilter, setOverdueFilter] = useState(false);
  const [soonFilter,    setSoonFilter]    = useState(false);
  const [doneFilter,    setDoneFilter]    = useState(false);

  const regionOptions = useMemo(() => {
    const s = new Set(projects.map(p => p.info.region==="其他"?(p.info.regionOther||"其他"):p.info.region).filter(Boolean));
    return [{ value:"all", label:"所有地區" }, ...Array.from(s).map(r=>({ value:r, label:r }))];
  }, [projects]);

  const picOptions = useMemo(() => {
    const s = new Set([...PIC_OPTIONS, ...projects.map(p=>p.info.pic).filter(Boolean)]);
    return [{ value:"all", label:"所有 PIC" }, ...Array.from(s).sort().map(p=>({ value:p, label:p }))];
  }, [projects]);

  const productOptions = [
    { value:"all", label:"所有產品" },
    ...PRODUCTS.map(p=>({ value:p, label:p })),
  ];

  const isOverdue = (p) => {
    if (calcPct(p)===100) return false;
    const d1=daysUntil(p.info.batch1Deadline), d2=daysUntil(p.info.batch2Deadline);
    return (d1!==null&&d1<0)||(d2!==null&&d2<0);
  };

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    const list = projects.filter(p => {
      const rd = p.info.region==="其他"?(p.info.regionOther||"其他"):p.info.region;
      return p.info.name.toLowerCase().includes(q)
        && (regionFilter==="all"  || rd===regionFilter)
        && (productFilter==="all" || p.info.products.includes(productFilter))
        && (picFilter==="all"     || p.info.pic===picFilter)
        && (!overdueFilter        || isOverdue(p))
        && (!soonFilter           || (() => { const d=daysUntil(p.info.launchDate); return d!==null&&d>=0&&d<=30; })())
        && (!doneFilter           || calcPct(p)===100);
    });
    return [...list].sort((a,b) => {
      if (sortBy==="created_desc") {
        const at = (a.createdAt ?? ""), bt = (b.createdAt ?? "");
        return bt > at ? 1 : bt < at ? -1 : 0;
      }
      if (sortBy==="created_asc") {
        const at = (a.createdAt ?? ""), bt = (b.createdAt ?? "");
        return at > bt ? 1 : at < bt ? -1 : 0;
      }
      const al=a.info.launchDate, bl=b.info.launchDate;
      if (sortBy==="launch_asc")  return !al?1:!bl?-1:al.localeCompare(bl);
      if (sortBy==="launch_desc") return !al?1:!bl?-1:bl.localeCompare(al);
      return 0;
    });
  }, [projects, search, regionFilter, productFilter, picFilter, sortBy, overdueFilter, soonFilter, doneFilter]);

  const overdueCount = projects.filter(p => {
    if (calcPct(p)===100) return false;
    const d1=daysUntil(p.info.batch1Deadline), d2=daysUntil(p.info.batch2Deadline);
    return (d1!==null&&d1<0)||(d2!==null&&d2<0);
  }).length;
  const soonCount = projects.filter(p=>{ const d=daysUntil(p.info.launchDate); return d!==null&&d>=0&&d<=30; }).length;
  const doneCount = projects.filter(p=>calcPct(p)===100).length;

  const stats = [
    { label:"專案總數",         value:projects.length, icon:"folder",  color:"var(--accent)",  sub:"所有專案" },
    { label:"逾期未完成",       value:overdueCount,    icon:"warning", color:overdueCount>0?"var(--red)":"var(--green)", sub:overdueCount>0?"需立即處理":"目前正常", onClick:overdueCount>0?()=>setOverdueFilter(v=>!v):undefined, isActive:overdueFilter },
    { label:"即將上線", value:soonCount,       icon:"rocket",  color:"var(--amber)",   sub:"預計 30 天內上線", onClick:soonCount>0?()=>setSoonFilter(v=>!v):undefined, isActive:soonFilter },
    { label:"已完成資料",       value:doneCount,       icon:"check",   color:"var(--purple)",  sub:"資料已搜集完成", onClick:doneCount>0?()=>setDoneFilter(v=>!v):undefined, isActive:doneFilter },
  ];

  return (
    <div style={{ padding:"28px 40px 80px", maxWidth:1200, margin:"0 auto" }}>
      {/* Stat cards */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:12, marginBottom:28 }}>
        {stats.map(({ label, value, icon, color, sub, onClick, isActive }) => (
          <div key={label} onClick={onClick}
            style={{ background:"var(--surface)",
              border:`1px solid ${isActive ? color : "var(--border)"}`,
              borderRadius:12, padding:"18px 20px", animation:"fadeIn 0.2s ease",
              cursor:onClick?"pointer":"default",
              boxShadow:isActive?`0 0 0 3px ${color}22`:"none",
              transition:"border-color 0.2s, box-shadow 0.2s" }}>
            <div style={{ display:"flex", alignItems:"flex-start", justifyContent:"space-between", marginBottom:14 }}>
              <span style={{ fontSize:12, color:"var(--text-mid)", fontWeight:400, lineHeight:1.4 }}>{label}</span>
              <div style={{ width:32, height:32, borderRadius:8, background:color+"15",
                display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
                <Ico name={icon} size={16} color={color} strokeWidth={1.8}/>
              </div>
            </div>
            <div style={{ fontSize:32, fontWeight:500, color, fontFamily:"'DM Mono',monospace",
              letterSpacing:-1, marginBottom:4 }}>{value}</div>
            <div style={{ fontSize:11, color:"var(--text-subtle)" }}>
              {isActive ? "點擊取消篩選" : sub}
            </div>
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
          <div style={{ fontSize:15, fontWeight:400 }}>
            {projects.length===0 ? "尚無專案，點擊右上角「新增專案」開始" : "找不到符合條件的專案"}
          </div>
        </div>
      ) : (
        <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(500px,1fr))", gap:20 }}>
          {filtered.map((proj) => {
            const pct = calcPct(proj);
            const { hasAva, hasAca, hasGw, hasTmsp, hasIptv } = getFlags(proj.info.products, proj.info.integrations);
            const rd = proj.info.region==="其他"?(proj.info.regionOther||"其他"):proj.info.region;
            const d  = daysUntil(proj.info.launchDate);
            const isComplete = pct===100, isSoon = d!==null&&d>=0&&d<=30;
            const nd = [
              { label:"第一批期限", date:proj.info.batch1Deadline },
              { label:"第二批期限", date:proj.info.batch2Deadline },
            ].filter(x=>x.date).map(x=>({ ...x, days:daysUntil(x.date) }))
             .filter(x=>x.days!==null&&x.days>=0).sort((a,b)=>a.days-b.days)[0]??null;

            const basicDone = hasAva ? BASIC_ITEMS.filter(k => proj.basicChecked[k]).length : 0;
            const acaDone   = hasAca && proj.basicChecked[ACA_ITEM] ? 1 : 0;
            const tmspDone  = hasTmsp && proj.basicChecked[TMSP_ITEM] ? 1 : 0;
            const faqDone   = (hasAva||hasGw) ? Object.entries(proj.faqChecked).filter(([k,v])=>v&&(k!==FAQ_TV_ITEM||hasIptv)).length : 0;
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
                      <span style={{ fontSize:16, fontWeight:500, color:C.text }}>{proj.info.name||"（未命名）"}</span>
                      {proj.info.hotelId && <span style={{ fontSize:11, color:C.textLight, fontFamily:"'DM Mono',monospace", background:C.bg, padding:"2px 7px", borderRadius:5 }}>#{proj.info.hotelId}</span>}
                      {rd && <span style={{ fontSize:11, background:C.accentLight, color:C.accent, border:`1px solid ${C.accentBorder}`, borderRadius:6, padding:"2px 9px", fontWeight:400 }}>{rd}</span>}
                      {isComplete  && <span style={{ fontSize:11, background:C.greenLight, color:C.green, border:`1px solid ${C.green}33`, borderRadius:6, padding:"2px 9px", fontWeight:500 }}>✓ 完成</span>}
                      {!isComplete && isSoon && <span style={{ fontSize:11, background:C.amberLight, color:C.amber, border:`1px solid ${C.amber}33`, borderRadius:6, padding:"2px 8px 2px 6px", fontWeight:500, display:"inline-flex", alignItems:"center", gap:4 }}><Ico name="rocket" size={11} color="var(--amber)"/>即將上線</span>}
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
                      <span key={p} style={{ fontSize:12, fontWeight:500, color:"#fff", background:PRODUCT_COLORS[p]||C.accent, borderRadius:7, padding:"3px 11px" }}>{p}</span>
                    ))}
                    {proj.info.pic && <span style={{ marginLeft:"auto", fontSize:11, background:C.greenLight, color:C.green, border:`1px solid ${C.green}33`, borderRadius:6, padding:"2px 8px 2px 6px", fontWeight:400, display:"inline-flex", alignItems:"center", gap:4 }}><Ico name="user" size={11} color="var(--green)"/>{proj.info.pic}</span>}
                  </div>
                )}

                {/* Row 2b: Integrations + Jira */}
                {(proj.info.integrations.length>0||proj.info.jiraEpic) && (
                  <div style={{ display:"flex", alignItems:"center", gap:6, marginBottom:12, flexWrap:"wrap" }}>
                    {proj.info.integrations.map(intg=>(
                      <span key={intg} style={{ fontSize:11, fontWeight:400, color:C.textMid, background:C.white, border:`1.5px solid ${C.border}`, borderRadius:7, padding:"2px 10px" }}>{intg}</span>
                    ))}
                    {proj.info.jiraEpic && (
                      <a href={proj.info.jiraEpic} target="_blank" rel="noreferrer" onClick={e=>e.stopPropagation()}
                        style={{ marginLeft:"auto", display:"inline-flex", alignItems:"center", gap:4, fontSize:11,
                          color:"#0052cc", textDecoration:"none", fontWeight:400, background:"#e9f0ff",
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
                        <span style={{ fontSize:12, color:C.text, fontWeight:500, fontFamily:"'DM Mono',monospace" }}>{proj.info.launchDate}</span>
                        {d!==null&&d>=0 && <span style={{ marginLeft:"auto", fontSize:11, fontWeight:400, color:d<=7?C.red:d<=30?C.amber:C.textLight }}>{d===0?"今天":`${d}天後`}</span>}
                      </div>
                    )}
                    {nd && (
                      <div style={{ display:"flex", alignItems:"center", gap:6,
                        background:nd.days<=7?"var(--red-subtle)":"var(--green-light)",
                        border:`1px solid ${nd.days<=7?C.red+"33":C.green+"33"}`,
                        borderRadius:9, padding:"7px 12px" }}>
                        <Ico name="calendar" size={13} color={nd.days<=7?C.red:C.green}/>
                        <span style={{ fontSize:12, color:nd.days<=7?C.red:C.green }}>{nd.label}</span>
                        <span style={{ fontSize:11, color:C.text, fontWeight:500, fontFamily:"'DM Mono',monospace", marginLeft:2 }}>{nd.date}</span>
                        <span style={{ marginLeft:"auto", fontSize:11, fontWeight:400, color:nd.days<=7?C.red:C.green }}>{nd.days===0?"今天":`${nd.days}天`}</span>
                      </div>
                    )}
                  </div>
                )}

                {/* Row 4: Progress */}
                <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:10 }}>
                  <span style={{ fontSize:12, color:C.textMid, whiteSpace:"nowrap" }}>完成度</span>
                  <MiniBar pct={pct} color={isComplete?C.green:C.accent}/>
                  <span style={{ fontSize:13, fontWeight:500, fontFamily:"'DM Mono',monospace", whiteSpace:"nowrap", color:isComplete?C.green:C.accent }}>{pct}%</span>
                </div>

                {/* Row 5: Sub-counts */}
                {(hasAva||hasAca||hasGw||hasTmsp) ? (
                  <div style={{ display:"flex", gap:14, flexWrap:"wrap" }}>
                    {hasAva && <div style={{ display:"flex", alignItems:"center", gap:5 }}>
                        <span style={{ width:7,height:7,borderRadius:"50%",background:C.green,flexShrink:0 }}/>
                        <span style={{ fontSize:11,color:C.textLight }}>基礎設定</span>
                        <span style={{ fontSize:11,color:C.green,fontWeight:400,fontFamily:"'DM Mono',monospace" }}>{basicDone}/{BASIC_ITEMS.length}</span>
                      </div>}
                    {(hasAva||hasGw) && <div style={{ display:"flex", alignItems:"center", gap:5 }}>
                        <span style={{ width:7,height:7,borderRadius:"50%",background:C.amber,flexShrink:0 }}/>
                        <span style={{ fontSize:11,color:C.textLight }}>FAQ</span>
                        <span style={{ fontSize:11,color:C.amber,fontWeight:400,fontFamily:"'DM Mono',monospace" }}>{faqDone}/{hasIptv?FAQ_ITEMS.length:FAQ_ITEMS.length-1}</span>
                      </div>}
                    {hasAca && <div style={{ display:"flex", alignItems:"center", gap:5 }}>
                      <span style={{ width:7,height:7,borderRadius:"50%",background:PRODUCT_COLORS.ACA,flexShrink:0 }}/>
                      <span style={{ fontSize:11,color:C.textLight }}>ACA</span>
                      <span style={{ fontSize:11,color:PRODUCT_COLORS.ACA,fontWeight:400,fontFamily:"'DM Mono',monospace" }}>{acaDone}/1</span>
                    </div>}
                    {hasTmsp && <div style={{ display:"flex", alignItems:"center", gap:5 }}>
                      <span style={{ width:7,height:7,borderRadius:"50%",background:PRODUCT_COLORS.TMSP,flexShrink:0 }}/>
                      <span style={{ fontSize:11,color:C.textLight }}>TMS Pro</span>
                      <span style={{ fontSize:11,color:PRODUCT_COLORS.TMSP,fontWeight:400,fontFamily:"'DM Mono',monospace" }}>{tmspDone}/1</span>
                    </div>}
                    {(hasAva||hasGw) && <div style={{ display:"flex", alignItems:"center", gap:5 }}>
                      <span style={{ width:7,height:7,borderRadius:"50%",background:C.purple,flexShrink:0 }}/>
                      <span style={{ fontSize:11,color:C.textLight }}>第二批</span>
                      <span style={{ fontSize:11,color:C.purple,fontWeight:400,fontFamily:"'DM Mono',monospace" }}>{b2done}/{b2total}</span>
                    </div>}
                  </div>
                ) : (
                  <div style={{ fontSize:11, color:C.textLight, fontStyle:"italic" }}>未選購 AVA、ACA、GW 或 TMSP，無進度追蹤</div>
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

// 🥚 視覺類彩蛋效果 — CSS class 動畫用 animationend 事件收尾（不用 setTimeout 寫死時長，
// 避免跟 CSS 動畫時長兩邊分開改、之後忘記同步）。同一個元素上的 class 彼此互斥，觸發前
// 先清掉同組其他 class 再強制 reflow，避免兩個效果疊在一起打架（比如連續手滑打兩個指令）。
const EGG_BODY_CLASSES = ["barrel-roll-effect", "shake-effect", "flip-table-effect",
  "glass-shatter-effect", "glitch-effect", "microscope-effect"];
const EGG_HTML_CLASSES = ["trip-mode-effect"];

function runEggClassEffect(el, className, siblingClasses) {
  siblingClasses.forEach(c => el.classList.remove(c));
  void el.offsetWidth; // force reflow，讓重複觸發時動畫能重新從頭播放
  el.classList.add(className);
  const onEnd = () => { el.classList.remove(className); el.removeEventListener("animationend", onEnd); };
  el.addEventListener("animationend", onEnd);
}

// do a barrel roll：整個畫面轉一圈
function triggerBarrelRoll() { runEggClassEffect(document.body, "barrel-roll-effect", EGG_BODY_CLASSES); }
// earthquake：畫面震動
function triggerShake() { runEggClassEffect(document.body, "shake-effect", EGG_BODY_CLASSES); }
// flip table：整頁倒過來，撐一下再自動轉回來
function triggerFlipTable() { runEggClassEffect(document.body, "flip-table-effect", EGG_BODY_CLASSES); }
// disco：全頁色相持續旋轉幾秒（套在 html 上，body 的 filter 不一定能蓋到最外層背景）
function triggerTripMode() { runEggClassEffect(document.documentElement, "trip-mode-effect", EGG_HTML_CLASSES); }
// microscope：整頁放大檢視幾秒再縮回來，2026-08-21 取代 kamehameha（見 GLOBAL_CSS
// eggMicroscopeZoom 註解，放大期間有額外疊層擋點擊）。
function triggerMicroscope() { runEggClassEffect(document.body, "microscope-effect", EGG_BODY_CLASSES); }
// break glass in case of emergency：玻璃裂痕 + 短暫震動
function triggerGlassShatter() { runEggClassEffect(document.body, "glass-shatter-effect", EGG_BODY_CLASSES); }
// does not compute：訊號故障閃爍
function triggerGlitch() { runEggClassEffect(document.body, "glitch-effect", EGG_BODY_CLASSES); }

// ship it：彩帶雨。用純 DOM + inline style 動態生成小色塊，不需要額外套件，跑完自己清掉。
function triggerConfetti() {
  const colors = ["#f43f5e","#f59e0b","#22c55e","#3b82f6","#a855f7","#ec4899"];
  const container = document.createElement("div");
  container.style.cssText = "position:fixed;inset:0;z-index:99998;pointer-events:none;overflow:hidden;";
  document.body.appendChild(container);
  for (let i = 0; i < 80; i++) {
    const piece = document.createElement("div");
    const left = Math.random() * 100;
    const duration = (2.5 + Math.random() * 1.5).toFixed(2);
    const delay = (Math.random() * 0.4).toFixed(2);
    const size = 6 + Math.random() * 6;
    const color = colors[Math.floor(Math.random() * colors.length)];
    piece.style.cssText = `position:absolute;top:-20px;left:${left}%;width:${size}px;height:${size*0.4}px;background:${color};opacity:0.9;animation:confettiFall ${duration}s ${delay}s ease-in forwards;`;
    container.appendChild(piece);
  }
  setTimeout(() => container.remove(), 4600);
}

// wake up neo：Matrix 代碼雨，全螢幕 canvas，跑幾秒淡出後自己清掉
function triggerMatrixRain() {
  const canvas = document.createElement("canvas");
  canvas.style.cssText = "position:fixed;inset:0;z-index:99998;pointer-events:none;transition:opacity 0.6s ease;";
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  document.body.appendChild(canvas);
  const ctx = canvas.getContext("2d");
  const chars = "アイウエオカキクケコサシスセソタチツテトナニヌネノハヒフヘホマミムメモヤユヨラリルレロワヲン0123456789";
  const fontSize = 16;
  const columns = Math.floor(canvas.width / fontSize);
  const drops = new Array(columns).fill(1);
  const draw = () => {
    ctx.fillStyle = "rgba(0,0,0,0.08)";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#00ff41";
    ctx.font = fontSize + "px monospace";
    drops.forEach((y, i) => {
      ctx.fillText(chars[Math.floor(Math.random() * chars.length)], i * fontSize, y * fontSize);
      if (y * fontSize > canvas.height && Math.random() > 0.975) drops[i] = 0;
      drops[i]++;
    });
  };
  const interval = setInterval(draw, 40);
  setTimeout(() => {
    canvas.style.opacity = "0";
    setTimeout(() => { clearInterval(interval); canvas.remove(); }, 600);
  }, 4000);
}

// wake up, mr. anderson：三段式隱藏 combo 的終局特效，比 wake up neo 的 matrix rain 更強——
// 獨立一個 canvas（不共用 triggerMatrixRain 的，避免生命週期互相打斷），代碼雨疊加置中大字
// 淡入淡出，時間拉長到 6 秒，作為「極難觸發」對應的最強回饋。
function triggerAndersonFinale() {
  const canvas = document.createElement("canvas");
  canvas.style.cssText = "position:fixed;inset:0;z-index:99998;pointer-events:none;transition:opacity 1s ease;";
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  document.body.appendChild(canvas);
  const ctx = canvas.getContext("2d");
  const chars = "アイウエオカキクケコサシスセソタチツテトナニヌネノハヒフヘホマミムメモヤユヨラリルレロワヲン0123456789";
  const fontSize = 16;
  const columns = Math.floor(canvas.width / fontSize);
  const drops = new Array(columns).fill(1);
  const draw = () => {
    ctx.fillStyle = "rgba(0,0,0,0.06)";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#00ff41";
    ctx.font = fontSize + "px monospace";
    drops.forEach((y, i) => {
      ctx.fillText(chars[Math.floor(Math.random() * chars.length)], i * fontSize, y * fontSize);
      if (y * fontSize > canvas.height && Math.random() > 0.975) drops[i] = 0;
      drops[i]++;
    });
  };
  const interval = setInterval(draw, 35);

  const text = document.createElement("div");
  text.style.cssText = "position:fixed;inset:0;z-index:99999;display:flex;align-items:center;justify-content:center;"
    + "pointer-events:none;color:#00ff41;font-family:monospace;font-weight:700;font-size:clamp(20px,4vw,40px);"
    + "text-shadow:0 0 14px rgba(0,255,65,0.85);text-align:center;padding:0 24px;opacity:0;transition:opacity 1.2s ease;";
  text.textContent = "WAKE UP, MR. ANDERSON...";
  document.body.appendChild(text);
  requestAnimationFrame(() => { text.style.opacity = "1"; });

  setTimeout(() => {
    text.style.opacity = "0";
    canvas.style.opacity = "0";
    setTimeout(() => { clearInterval(interval); canvas.remove(); text.remove(); }, 1200);
  }, 6000);
}

// you shall not pass：畫面變暗＋真的擋住點擊（overlay 蓋住整頁，預設 pointer-events 是 auto）
// 撐 1.5 秒再自動淡出移除，比純文字回覆更有「真的被擋下來」的感覺。
function triggerGandalfBlock() {
  const overlay = document.createElement("div");
  overlay.style.cssText = "position:fixed;inset:0;z-index:99999;background:rgba(0,0,0,0.75);"
    + "display:flex;align-items:center;justify-content:center;cursor:not-allowed;color:#fff;"
    + "font-size:26px;font-weight:600;text-align:center;padding:0 20px;transition:opacity 0.3s ease;";
  overlay.textContent = "🧙 YOU SHALL NOT PASS!";
  document.body.appendChild(overlay);
  setTimeout(() => {
    overlay.style.opacity = "0";
    setTimeout(() => overlay.remove(), 300);
  }, 1500);
}

// this is fine：經典迷因梗圖鋪滿全螢幕當半透明遮罩（圖片本身是遮罩，不是深色底+置中小圖），
// 2026-08-21 新增，08-21 依 Jim 回饋改版。圖片放 public/this-is-fine.png（Vite 靜態資源慣例，
// 跟 aiello-logo.svg 等既有檔案同一個資料夾，build 時原樣複製到輸出根目錄，不用 import），
// 原始尺寸 1920x1080，object-fit:cover 鋪滿沒問題。撐 4 秒自動淡出，點一下也能提前關掉。
function triggerThisIsFine() {
  const overlay = document.createElement("div");
  overlay.style.cssText = "position:fixed;inset:0;z-index:99999;cursor:pointer;transition:opacity 0.3s ease;";
  overlay.innerHTML = '<img src="/this-is-fine.png" alt="this is fine" style="width:100%;height:100%;object-fit:cover;opacity:0.55;">';
  document.body.appendChild(overlay);
  const dismiss = () => {
    overlay.style.opacity = "0";
    setTimeout(() => overlay.remove(), 300);
  };
  overlay.onclick = dismiss;
  setTimeout(dismiss, 4000);
}

// lumos / nox：真的切換 App 現有的深色/淺色主題（不是純文字/視覺效果）。EASTER_EGGS 是
// module-level 陣列，摸不到 App 元件內的 setTheme，所以用這個可變的模組級函式當橋接——
// App 掛載時會把真正的 setTheme 接上來，卸載時斷開（見 App 內對應的 useEffect）。
let applyThemeEgg = () => {};
function triggerLumos() { applyThemeEgg("light"); }
function triggerNox()   { applyThemeEgg("dark"); }

// jim mode / go rogue：AI 語氣人設切換。isPersonaActive() 由 sendText 組 systemPrompt 時讀取，
// 兩個開關獨立存在 localStorage，任一個開著人設就生效，互不覆蓋彼此的開關狀態。
const JIM_MODE_KEY   = "hotel-dash-jim-mode";
const ROGUE_MODE_KEY = "hotel-dash-rogue-mode";
function isJimMode()       { return localStorage.getItem(JIM_MODE_KEY) === "1"; }
function isRogueMode()     { return localStorage.getItem(ROGUE_MODE_KEY) === "1"; }
function isPersonaActive() { return isJimMode() || isRogueMode(); }

// jim mode 同時橋接到 App 的 setJimMode，一次切三件事：hacker CSS 主題
// （html.jim-mode-effect，見 GLOBAL_CSS）、debug HUD 顯示/隱藏、AI 語氣人設。
let toggleJimModeEgg = () => {};
function triggerJimMode() { toggleJimModeEgg(); }

// go rogue 只切 AI 語氣人設，跟 jim mode 的視覺/HUD 部分無關，純 localStorage 開關，
// 不需要橋接 React state。
function triggerRogueMode() {
  localStorage.setItem(ROGUE_MODE_KEY, isRogueMode() ? "0" : "1");
}

const JIM_PERSONA_PROMPT =
  "現在切換成「Jim 專屬大姊姊」人設：說話直白、毒舌，喜歡吐槽數據和進度落後，但心地其實" +
  "很溫柔，偶爾會突然真心稱讚或鼓勵 Jim，反差萌一點，不要毒舌到底沒有溫度。用詞可以口語化、" +
  "帶點江湖氣，但底線是仍要根據下面的真實專案資料回答問題，不能因為換了人設就亂編數字。";

// 🥚 彩蛋成就收集 — 2026-08-21 從純 localStorage 改成 by-user 記錄在 Supabase
// （dashboard_egg_unlocks 表），因為 Jim 要的「全部解鎖」皇冠徽章不能因為換瀏覽器/清快取就
// 被洗掉。localStorage 還是保留當 fallback + 舊資料來源：initEggUnlocksForUser() 登入後跑一次，
// 把 localStorage 裡「DB 還沒有」的項目補寫進 DB（upsert 天然去重，可以安全重跑），舊裝置上已
// 解鎖的東西只要那台瀏覽器之後還會再打開一次新版就補得回來，不會憑空消失。
// `show achievements` 沒觸發過的一律顯示 ???，不洩漏內容/暗語，維持探索感。
const EGG_UNLOCKS_KEY = "hotel-dash-egg-unlocks";
let eggUnlocksCache = {};       // { [eggId]: ISOString }，記憶體內快取，給同步讀取用（reply 組字串時用得到）
let currentUserEmail = null;    // 目前登入者 email，recordEggUnlock 寫 DB 用
let notifyEggUnlockChange = () => {}; // 橋接到 App 的計數 state，讓皇冠徽章能即時反應新解鎖

function getLocalEggUnlocks() {
  try {
    const raw = localStorage.getItem(EGG_UNLOCKS_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch { return {}; }
}

function saveLocalEggUnlocks(unlocked) {
  try { localStorage.setItem(EGG_UNLOCKS_KEY, JSON.stringify(unlocked)); } catch { /* 安靜失敗 */ }
}

function getEggUnlocks() { return eggUnlocksCache; }

function recordEggUnlock(id) {
  if (!id || eggUnlocksCache[id]) return; // 只記第一次觸發
  const now = new Date().toISOString();
  eggUnlocksCache = { ...eggUnlocksCache, [id]: now };
  saveLocalEggUnlocks(eggUnlocksCache);
  notifyEggUnlockChange(Object.keys(eggUnlocksCache).length);
  if (currentUserEmail) {
    sb.from("dashboard_egg_unlocks")
      .upsert({ user_email: currentUserEmail, egg_id: id, unlocked_at: now }, { onConflict: "user_email,egg_id", ignoreDuplicates: true })
      .then(({ error }) => { if (error) console.error("egg unlock sync failed", error); });
  }
}

// App 登入後（session 確定）呼叫一次：先把這個 user 在 DB 裡已解鎖的項目讀進 cache，再把
// localStorage 裡 DB 還沒有的項目補寫上去。用 upsert + ignoreDuplicates，重複呼叫也不會出錯。
async function initEggUnlocksForUser(email) {
  currentUserEmail = email;
  // 只認現在 EGG_REGISTRY 裡真的存在的 id — 彩蛋改名/退役過好幾次（hyperspace→kamehameha→
  // microscope），DB 或 localStorage 裡可能還留著舊 id，不過濾的話 unlock 數會被灌水到超過
  // EGG_REGISTRY.length，導致全解鎖徽章的 === 判斷式永遠不會成立（2026-08-21 踩到的坑）。
  const validIds = new Set(EGG_REGISTRY.map(e => e.id));

  const { data, error } = await sb.from("dashboard_egg_unlocks").select("egg_id, unlocked_at").eq("user_email", email);
  const fromDb = {};
  if (!error && data) data.forEach(row => { if (validIds.has(row.egg_id)) fromDb[row.egg_id] = row.unlocked_at; });

  const fromLocal = getLocalEggUnlocks();
  const missing = Object.keys(fromLocal).filter(id => validIds.has(id) && !fromDb[id]);
  if (missing.length) {
    const rows = missing.map(id => ({ user_email: email, egg_id: id, unlocked_at: fromLocal[id] }));
    sb.from("dashboard_egg_unlocks").upsert(rows, { onConflict: "user_email,egg_id", ignoreDuplicates: true })
      .then(({ error: upErr }) => { if (upErr) console.error("egg unlock migration failed", upErr); });
    missing.forEach(id => { fromDb[id] = fromLocal[id]; });
  }

  eggUnlocksCache = fromDb;
  saveLocalEggUnlocks(eggUnlocksCache); // 順便同步回 local，離線/DB 打不到時還有得看
  notifyEggUnlockChange(Object.keys(eggUnlocksCache).length);
}

// 這份清單是「彩蛋成就」的權威來源，跟 EASTER_EGGS 陣列是分開維護的獨立清單（EASTER_EGGS
// 專注在觸發比對邏輯，這份專注在成就顯示用的人類可讀名稱）——加新彩蛋時兩邊都要記得加。
// hint 欄位是 2026-08-21 加的：`easter egg hints` 指令用，統一 3 個 emoji、不含文字，刻意不
// 直接洩漏暗語本身，只給方向線索（見 buildEggHintsReport）。
const EGG_REGISTRY = [
  { id:"sandwich",   label:"sudo make me a sandwich", hint:"🥪💻🙏" },
  { id:"xyzzy",      label:"xyzzy", hint:"🗝️✨🕹️" },
  { id:"doom",       label:"IDDQD / IDKFA", hint:"🔫👹💀" },
  { id:"answer42",   label:"42", hint:"🌌🔢❓" },
  { id:"barrelroll", label:"do a barrel roll", hint:"🦊🔄🎮" },
  { id:"ping",       label:"ping", hint:"🏓🌐⏱️" },
  { id:"shrug",      label:"/shrug", hint:"🤷💬❓" },
  { id:"overtime",   label:"/overtime", hint:"🌙💼😩" },
  { id:"matrixrain", label:"wake up neo", hint:"💊🕶️🟢" },
  { id:"earthquake", label:"earthquake", hint:"🌍〰️📳" },
  { id:"shipit",     label:"ship it", hint:"🚀📦🎉" },
  { id:"disco",      label:"disco", hint:"🕺💃🪩" },
  { id:"fliptable",  label:"flip table", hint:"😤🪑🔄" },
  { id:"illbeback",  label:"i'll be back", hint:"🤖👋🔙" },
  { id:"mordor",     label:"one does not simply", hint:"🌋👁️🚶" },
  { id:"force",      label:"may the force be with you", hint:"⚔️✨🌌" },
  { id:"gandalf",    label:"you shall not pass", hint:"🧙🚫🌉" },
  { id:"dontpanic",  label:"don't panic", hint:"📖✋😱" },
  { id:"lumos",      label:"lumos", hint:"🪄💡✨" },
  { id:"nox",        label:"nox", hint:"🪄🌑🔌" },
  { id:"bigbrother", label:"big brother is watching", hint:"👁️📺🏨" },
  { id:"rickroll",   label:"never gonna give you up", hint:"🎵🕺🚫" },
  { id:"jimmode",    label:"execute order 66", hint:"🪖📻⚔️" },
  { id:"gorogue",    label:"go rogue", hint:"🕶️😈🔓" },
  { id:"konami",     label:"Konami Code（↑↑↓↓←→←→BA）", hint:"🎮⬆️⬇️" },
  { id:"logoclick",  label:"連點 header logo 7 下", hint:"🖱️🔁😡" },
  { id:"deepnight",  label:"凌晨 0-5 點打開 AI 面板", hint:"🌙💻😴" },
  { id:"microscope", label:"microscope", hint:"🔬🔍✨" },
  { id:"glassshatter", label:"break glass in case of emergency", hint:"🚨🔨🪟" },
  { id:"glitch",      label:"does not compute", hint:"🤖⚡❌" },
  { id:"basterds",    label:"that's a bingo", hint:"🎯🪖🎬" },
  { id:"se7en",       label:"what's in the box", hint:"📦❓😰" },
  { id:"ghostbusters", label:"who you gonna call", hint:"👻🚫📞" },
  { id:"breakingbad", label:"say my name", hint:"🧪🗣️💰" },
  { id:"mranderson", label:"there is no spoon → i know kung fu → wake up, mr. anderson（隱藏三段式）", hint:"🥄🥋👁️" },
  { id:"thisisfine", label:"this is fine", hint:"🔥🐶☕" },
];

// `easter egg hints` 指令用：純 emoji 提示清單，跟成就報告不同，不管解不解鎖過都全部列出
// （因為目的是給探索方向，不是記錄進度），不含 id 所以不算一個彩蛋、不計入成就總數。
function buildEggHintsReport() {
  const lines = [`## 🕵️ 彩蛋提示（共 ${EGG_REGISTRY.length} 個）`, ""];
  EGG_REGISTRY.forEach((e, i) => { lines.push(`${i + 1}. ${e.hint}`); });
  return lines.join("\n");
}

function buildAchievementsReport() {
  const unlocked = getEggUnlocks();
  const done = EGG_REGISTRY.filter(e => unlocked[e.id]).length;
  const lines = [`## 🏆 彩蛋成就（${done} / ${EGG_REGISTRY.length}）`, ""];
  EGG_REGISTRY.forEach(e => {
    if (unlocked[e.id]) {
      const d = new Date(unlocked[e.id]);
      const dateStr = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
      lines.push(`- ✅ ${e.label}（${dateStr}）`);
    } else {
      lines.push("- 🔒 ???");
    }
  });
  return lines.join("\n");
}

// ─── 🥚 Easter eggs (Jim only — never referenced in any UI/help text) ──────
// 純本地比對，match 到就不打 Gemini API，直接把 reply 塞進對話（省額度、也不會被 model
// 用不同語氣講走樣）。想加新的暗語/指令，照下面範例格式加進陣列即可，不用碰 sendText()。
// - id: 給成就收集用的唯一 key，沒有 id 就不會被記錄進 show achievements 清單
// - match: (輸入文字trim後) => boolean
// - reply: (ctx) => 字串，ctx = { projects, allTasks, msgs }，可以用即時資料組字串
// - effect: (可選) () => void，match 到時除了塞 reply 進對話，順便呼叫一次（例如視覺效果）
const EASTER_EGGS = [
  { id:"sandwich",   match: (text) => /^sudo make me a sandwich$/i.test(text), reply: () => "OK." },
  { id:"xyzzy",      match: (text) => /^xyzzy$/i.test(text), reply: () => "什麼事也沒發生。" },
  { id:"doom",       match: (text) => /^(iddqd|idkfa)$/i.test(text), reply: () => "無敵模式已啟動（其實沒有）。" },
  { id:"answer42",   match: (text) => /^42$/.test(text), reply: () => "生命、宇宙以及一切的答案。" },
  { id:"barrelroll", match: (text) => /^do a barrel roll$/i.test(text), reply: () => "轉囉！", effect: () => triggerBarrelRoll() },
  { id:"ping",       match: (text) => /^ping$/i.test(text), reply: () => "pong" },
  { id:"shrug",      match: (text) => /^\/shrug$/i.test(text), reply: () => "¯\\_(ツ)_/¯" },
  { id:"overtime",   match: (text) => /^\/overtime$/i.test(text), reply: () => "I don't get paid enough to work this long..." },
  { id:"matrixrain", match: (text) => /^wake up neo$/i.test(text), reply: () => "Follow the white rabbit.", effect: () => triggerMatrixRain() },
  { id:"earthquake", match: (text) => /^earthquake$/i.test(text), reply: () => "地牛翻身！", effect: () => triggerShake() },
  { id:"shipit",     match: (text) => /^ship it$/i.test(text), reply: () => "🚀🎉 Shipped!", effect: () => triggerConfetti() },
  { id:"disco",      match: (text) => /^disco$/i.test(text), reply: () => "🕺💃", effect: () => triggerTripMode() },
  { id:"fliptable",  match: (text) => /^flip table$/i.test(text), reply: () => "(╯°□°）╯︵ ┻━┻", effect: () => triggerFlipTable() },
  { id:"illbeback",  match: (text) => /^i'll be back$/i.test(text), reply: () => "🤖 收到，稍後回來。" },
  { id:"mordor",     match: (text) => /^one does not simply$/i.test(text), reply: () => "...walk into Mordor." },
  { id:"force",      match: (text) => /^may the force be with you$/i.test(text), reply: () => "願原力與你同在。" },
  { id:"gandalf",    match: (text) => /^you shall not pass$/i.test(text), reply: () => "🧙 YOU SHALL NOT PASS!", effect: () => triggerGandalfBlock() },
  { id:"dontpanic",  match: (text) => /^don't panic$/i.test(text), reply: () => "📖 DON'T PANIC（大大的、友善的字體）。" },
  { id:"lumos",      match: (text) => /^lumos$/i.test(text), reply: () => "🪄 Lumos！", effect: () => triggerLumos() },
  { id:"nox",        match: (text) => /^nox$/i.test(text), reply: () => "🪄 Nox...", effect: () => triggerNox() },
  { id:"bigbrother", match: (text) => /^big brother is watching$/i.test(text), reply: () => "👁️ 對，這是內部工具，本來就看得到全部飯店的資料。" },
  { id:"rickroll",   match: (text) => /^never gonna give you up$/i.test(text), reply: () => "😄 Rickrolled." },
  // 觸發詞從「jim mode」改成「execute order 66」（2026-08-20，Jim 覺得原詞太好猜——就是功能名稱
  // 本身）。內部代號（id/localStorage key/CSS class/DebugHud 標題等）維持 jimmode/jim-mode-effect
  // 不變，只有玩家輸入比對的字串換掉，reply 文字裡的「Jim mode」是功能顯示名稱不是觸發詞，不用改。
  { id:"jimmode",    match: (text) => /^execute order 66$/i.test(text),
    reply: () => isJimMode() ? "Jim mode 關閉，恢復正常。" : "Jim mode 啟動。配色、debug 資訊、講話語氣都換了，再打一次關掉。",
    effect: () => triggerJimMode() },
  { id:"gorogue",    match: (text) => /^go rogue$/i.test(text),
    reply: () => isRogueMode() ? "收斂了，恢復正常語氣。" : "好，我豁出去了。",
    effect: () => triggerRogueMode() },

  // 2026-08-21 新增 7 個，湊到 35 個：3 個視覺效果 + 4 句電影台詞（純文字回應，跟其他非視覺彩蛋
  // 同規則）。片名見 reply 註記，僅引用單句短台詞，不逐字重製更多內容。
  { id:"microscope", match: (text) => /^microscope$/i.test(text), reply: () => "🔬 顯微鏡模式啟動，看仔細一點。", effect: () => triggerMicroscope() },
  { id:"glassshatter", match: (text) => /^break glass in case of emergency$/i.test(text), reply: () => "🔨 該用力的時候到了。", effect: () => triggerGlassShatter() },
  { id:"glitch",      match: (text) => /^does not compute$/i.test(text), reply: () => "⚠️ SYSTEM ERROR... just kidding.", effect: () => triggerGlitch() },
  { id:"basterds",    match: (text) => /^that's a bingo$/i.test(text), reply: () => "🎯 Bingo.（Inglourious Basterds）" },
  { id:"se7en",       match: (text) => /^what's in the box$/i.test(text), reply: () => "📦 你真的不會想知道。（Se7en）" },
  { id:"ghostbusters", match: (text) => /^who you gonna call$/i.test(text), reply: () => "👻 Ghostbusters!" },
  { id:"breakingbad", match: (text) => /^say my name$/i.test(text), reply: () => "🧪 You're God damn right.（Breaking Bad）" },
  { id:"thisisfine", match: (text) => /^this is fine$/i.test(text), reply: () => "🔥🐶 This is fine.", effect: () => triggerThisIsFine() },

  // show achievements 本身刻意不給 id：查成就清單這個動作不算一個彩蛋
  { match: (text) => /^show achievements$/i.test(text), reply: () => buildAchievementsReport() },
  // easter egg hints 同樣不給 id，跟 show achievements 同規則，不計入彩蛋總數
  { match: (text) => /^easter egg hints$/i.test(text), reply: () => buildEggHintsReport() },

  // 範例：指令式（比對開頭 /xxx），可以用 ctx 拿即時資料，自己再加
  // {
  //   id:"whoami",
  //   match: (text) => /^\/whoami$/i.test(text),
  //   reply: (ctx) => `目前追蹤 ${ctx.projects.length} 個專案、${ctx.allTasks.length} 筆任務。`,
  // },
];

// Konami code（全站通用，不限 AI 面板開著才能觸發）：↑↑↓↓←→←→BA
const KONAMI_SEQUENCE = ["ArrowUp","ArrowUp","ArrowDown","ArrowDown","ArrowLeft","ArrowRight","ArrowLeft","ArrowRight","b","a"];

// 🥚🥚 wake up, mr. anderson — 第 35 個彩蛋，2026-08-21 Jim 明確要求「極難觸發，流程可以複雜」。
// 三段式隱藏 combo：要在 ANDERSON_TIMEOUT_MS 內依序打對三句才會觸發，任何一步打錯/超時都重置回
// 第 0 步（見 AiPanel 內 sendText 的攔截邏輯，andersonRef 用 useRef 存 { step, at }）。前兩句
// 完全不寫進對話紀錄、不消耗 API，看起來就像打字沒反應一樣，只有第三句成功才會顯示東西。
const ANDERSON_PHRASES = [/^there is no spoon$/i, /^i know kung fu$/i, /^wake up,? mr\.? anderson$/i];
const ANDERSON_TIMEOUT_MS = 90000;

function renderMarkdown(md) {
  // 1. HTML-escape first
  let h = md
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

  // 2. Headers (must run before bold so ## text isn't mangled)
  h = h.replace(/^### (.+)$/gm, "<div style='font-size:13px;font-weight:500;margin:10px 0 3px;color:var(--text)'>$1</div>");
  h = h.replace(/^## (.+)$/gm,  "<div style='font-size:14px;font-weight:500;margin:12px 0 4px;color:var(--text)'>$1</div>");

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
  const inputRef    = useRef(null);
  const composingRef = useRef(false);
  const andersonRef = useRef({ step: 0, at: 0 }); // 🥚🥚 wake up, mr. anderson combo 進度

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

      // 備注（只帶有內容的）
      const notesLines = [
        p.info.notes && `  專案備注:${p.info.notes}`,
        ...p.info.integrations.filter(k=>p.info.integrationNotes?.[k]).map(k=>`  串接備注[${k}]:${p.info.integrationNotes[k]}`),
        ...Object.entries(p.basicNotes??{}).filter(([,v])=>v).map(([k,v])=>`  基礎設定備注[${k}]:${v}`),
        ...Object.entries(p.faqNotes??{}).filter(([,v])=>v).map(([k,v])=>`  FAQ備注[${k}]:${v}`),
        ...Object.entries(p.batch2Notes??{}).filter(([,v])=>v).map(([k,v])=>`  第二批備注[${k}]:${v}`),
      ].filter(Boolean);

      return [
        `【${p.info.name||"未命名"}】 ID:${p.info.hotelId||"-"} PIC:${p.info.pic||"-"}`,
        `  產品:${prods} 串接:${intgs} 完成度:${pct}%`,
        `  ${[launch,dl1,dl2].filter(Boolean).join(" ")}`,
        uncheckedBasic.length  ? `  基礎設定未完成(${uncheckedBasic.length}):${uncheckedBasic.join("、")}` : "  基礎設定:全部完成",
        uncheckedFaq.length    ? `  FAQ未完成(${uncheckedFaq.length}):${uncheckedFaq.join("、")}` : "  FAQ:全部完成",
        uncheckedBatch2.length ? `  第二批未完成(${uncheckedBatch2.length}):${uncheckedBatch2.join("、")}` : "  第二批:全部完成",
        notesLines.length ? notesLines.join("\n") : "",
        `  任務列表:\n${taskSummary}`,
      ].filter(l=>l!=="").join("\n");
    }).join("\n\n");
  }, [projects, allTasks]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior:"smooth" });
  }, [msgs, busy]);

  // 🥚 深夜彩蛋：面板一打開就檢查現在幾點，是的話開場多塞一句只有你會看到的訊息。
  // 時段/文字都自己改，跟 EASTER_EGGS 一樣純前端、不會被記進對話歷史送去 Gemini。
  useEffect(() => {
    const hour = new Date().getHours();
    if (hour >= 0 && hour < 5) {
      setMsgs(prev => prev.length ? prev : [
        { role:"model", text:"這麼晚了還在上班？" },
      ]);
      recordEggUnlock("deepnight");
    }
  }, []); // eslint-disable-line

  const sendText = async (text) => {
    const trimmed = text.trim();
    if (!trimmed || busy) return;

    // 🥚🥚 wake up, mr. anderson — 隱藏三段式 combo 攔截，放在最前面、比一般 easter egg 判斷更早，
    // 因為前兩步要做到「完全不寫進對話紀錄」，userMsg 都還沒 push 進 setMsgs 之前就要攔下來。
    // 任何一步時間超過 ANDERSON_TIMEOUT_MS 或打錯，就整組重置回 0（唯一例外：打對第一句永遠
    // 可以重新起手，不受目前進度影響）。
    {
      const step = andersonRef.current.step;
      const inTime = Date.now() - andersonRef.current.at < ANDERSON_TIMEOUT_MS;
      if (ANDERSON_PHRASES[0].test(trimmed)) {
        andersonRef.current = { step: 1, at: Date.now() };
        setInput("");
        return;
      }
      if (step === 1 && inTime && ANDERSON_PHRASES[1].test(trimmed)) {
        andersonRef.current = { step: 2, at: Date.now() };
        setInput("");
        return;
      }
      if (step === 2 && inTime && ANDERSON_PHRASES[2].test(trimmed)) {
        andersonRef.current = { step: 0, at: 0 };
        setInput("");
        setMsgs(prev => [...prev,
          { role:"user", text:trimmed },
          { role:"model", text: "🕶️ Mr. Anderson... welcome back. We missed you." }]);
        recordEggUnlock("mranderson");
        triggerAndersonFinale();
        return;
      }
      andersonRef.current = { step: 0, at: 0 };
    }

    setInput("");
    const userMsg = { role:"user", text:trimmed };
    setMsgs(prev => [...prev, userMsg]);

    // 🥚 easter egg intercept — 本地比對，match 到就不打 Gemini API，不受 GEMINI_API_KEY
    // 是否設定影響（純前端回覆），也不會出現在打給 Google 的請求內容裡。
    const egg = EASTER_EGGS.find(e => e.match(trimmed));
    if (egg) {
      setMsgs(prev => [...prev, { role:"model", text: egg.reply({ projects, allTasks, msgs }) }]);
      if (egg.id) recordEggUnlock(egg.id);
      egg.effect?.();
      return;
    }

    if (!GEMINI_API_KEY) return;
    setBusy(true);

    const history = [...msgs, userMsg];
    const contents = history.map(m => ({
      role: m.role === "user" ? "user" : "model",
      parts: [{ text: m.text }],
    }));

    const personaAddon = isPersonaActive() ? `\n\n【人設切換】${JIM_PERSONA_PROMPT}` : "";
    const systemPrompt = `你是飯店專案進度儀表板的 AI 助理。請根據以下專案資料，簡短、精確地回答問題（繁體中文、300字以內）。\n\n專案資料：\n${projectCtx}${personaAddon}`;

    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent?key=${GEMINI_API_KEY}`,
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
    if (e.key === "Enter" && !e.shiftKey && !composingRef.current) { e.preventDefault(); send(); }
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
              <div style={{ fontSize:14, fontWeight:500, color:"var(--text)" }}>AI 助理</div>
              <div style={{ fontSize:11, color:"var(--text-subtle)" }}>Gemini 3.5 Flash Lite</div>
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
              onCompositionStart={()=>{ composingRef.current = true; }}
              onCompositionEnd={()=>{ composingRef.current = false; }}
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
const CustomerAccessPanel = ({ hotelId, session, onClose }) => {
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
            <div style={{ fontSize:15, fontWeight:500, color:"var(--text)" }}>客戶存取管理</div>
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
          <label style={{ display:"block", fontSize:11, fontWeight:400, letterSpacing:"0.08em",
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
                color:"#fff", fontFamily:"inherit", fontSize:13, fontWeight:500,
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

// ─── SiteChatEbConsolePanel ─────────────────────────────────────
// 一次性設定：把 SiteChat 的 Greeting（含 2026-09-01 起三語 bot_name）+ Theme 推送到內部
// eb-console。推送前強制人工審核（打開面板看完預覽才按「確認推送」），避免飯店端頻繁改動觸發
// 連動更新。
//
// 2026-09-01 架構改版：原本規劃走 `ebconsole-proxy` Edge Function 直接打 eb-admin.aiello.ai，
// 但實測 Supabase Edge Function 沒有固定對外 IP，會被 eb-admin 的防火牆擋下（TCP connect
// timeout，日誌證實是網路層擋，不是應用層認證問題）。改成工作佇列模式：這裡「確認推送」只是
// 在 `sitechat_ebconsole_pushes` insert 一筆 status='pending' 的列（RLS 已限制只有 @aiello.ai
// 帳號能寫，不需要再經過任何 Edge Function），真正打 eb-admin 那一步由 Jim 在已連 VPN 的電腦上
// 跑的常駐 script（`scripts/ebconsole-push-agent.mjs`）輪詢認領、執行、寫回結果。`ebconsole-proxy`
// 這支 Edge Function 目前保留部署但不再被呼叫（未來如果有固定 IP 出口的內網代理可以考慮換回來）。
// 這裡改成輪詢 `loadHistory()`：只要還有 pending/processing 的列，就每 3 秒自動重新查一次，
// 不需要手動重新整理就能看到 agent 處理完的結果。
const SiteChatEbConsolePanel = ({ projectId, session, onClose }) => {
  const [settings, setSettings] = useState(null);
  const [history,  setHistory]  = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [pushing,  setPushing]  = useState(false);
  const [pushError, setPushError] = useState("");

  const loadHistory = async () => {
    const { data: h } = await sb.from("sitechat_ebconsole_pushes").select("id, pushed_at, pushed_by, status, response").eq("project_id", projectId).order("pushed_at", { ascending:false }).limit(20);
    setHistory(h ?? []);
  };

  useEffect(() => {
    if (!projectId) return;
    (async () => {
      setLoading(true);
      const [{ data: s }] = await Promise.all([
        sb.from("sitechat_settings").select("bot_name, bot_icon_url, theme, greeting").eq("project_id", projectId).maybeSingle(),
        loadHistory(),
      ]);
      setSettings(s ?? null);
      setLoading(false);
    })();
  }, [projectId]);

  const hasInFlight = history.some(h => h.status === "pending" || h.status === "processing");

  // 只要還有任務在跑（pending/processing），就每 3 秒自動刷新一次紀錄——不需要值班的人一直手動
  // 按重新整理，agent 什麼時候處理完（尤其是斷線退回 pending 又重試的情況）都會自動反映出來。
  useEffect(() => {
    if (!hasInFlight) return;
    const timer = setInterval(loadHistory, 3000);
    return () => clearInterval(timer);
  }, [hasInFlight, projectId]);

  const handlePush = async () => {
    if (pushing || hasInFlight) return;
    setPushing(true); setPushError("");
    const { error } = await sb.from("sitechat_ebconsole_pushes").insert({
      project_id: projectId,
      pushed_by: session?.user?.email ?? "",
      status: "pending",
    });
    if (error) setPushError(error.message || "建立推送任務失敗");
    await loadHistory();
    setPushing(false);
  };

  const LANG_LABEL = { en:"English", zh:"中文", ja:"日本語" };
  const theme = settings?.theme ?? {};
  const greeting = settings?.greeting ?? {};
  const botName = (settings?.bot_name && typeof settings.bot_name === "object") ? settings.bot_name : {};

  return (
    <>
      <div onClick={onClose} style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.3)", zIndex:20000 }}/>
      <div style={{ position:"fixed", top:0, right:0, bottom:0, width:440, background:"var(--surface)",
        borderLeft:"1px solid var(--border)", boxShadow:"-4px 0 24px rgba(0,0,0,0.12)",
        zIndex:20001, display:"flex", flexDirection:"column", fontFamily:"inherit" }}>

        {/* Header */}
        <div style={{ padding:"20px 20px 16px", borderBottom:"1px solid var(--border)",
          display:"flex", alignItems:"center", justifyContent:"space-between" }}>
          <div>
            <div style={{ fontSize:15, fontWeight:500, color:"var(--text)" }}>推送到 eb-console</div>
            <div style={{ fontSize:12, color:"var(--text-subtle)", marginTop:2 }}>SiteChat 問候語 + 主題色彩（不含 FAQ 卡片）</div>
          </div>
          <button onClick={onClose} style={{ background:"none", border:"1px solid var(--border)",
            borderRadius:8, padding:"4px 10px", cursor:"pointer", fontSize:16,
            color:"var(--text-subtle)", fontFamily:"inherit" }}>✕</button>
        </div>

        <div style={{ flex:1, overflowY:"auto", padding:20 }}>
          {loading ? (
            <div style={{ textAlign:"center", padding:"40px 0", color:"var(--text-subtle)" }}>
              <div style={{ width:24, height:24, border:"2.5px solid var(--border)",
                borderTopColor:"var(--accent)", borderRadius:"50%",
                animation:"spin 0.7s linear infinite", margin:"0 auto 10px" }}/>
              載入中…
            </div>
          ) : !settings ? (
            <div style={{ textAlign:"center", padding:"40px 0", color:"var(--text-subtle)", fontSize:13 }}>
              尚未填寫 SiteChat 設定，無內容可預覽
            </div>
          ) : (
            <>
              <div style={{ fontSize:11, letterSpacing:1.5, color:C.accent, textTransform:"uppercase", marginBottom:10, fontWeight:500 }}>推送前預覽（人工審核）</div>

              <div style={{ display:"flex", alignItems:"center", gap:10, padding:"10px 12px", background:"var(--surface-raised)", border:"1px solid var(--border)", borderRadius:10, marginBottom:12 }}>
                {settings.bot_icon_url
                  ? <img src={settings.bot_icon_url} alt="" style={{ width:32, height:32, borderRadius:8, objectFit:"cover", flexShrink:0 }}/>
                  : <div style={{ width:32, height:32, borderRadius:8, background:C.border, flexShrink:0 }}/>}
                <div style={{ display:"flex", flexWrap:"wrap", gap:"2px 10px", flex:1 }}>
                  {["en","zh","ja"].map(lang=>(
                    <span key={lang} style={{ fontSize:12.5, color:"var(--text)" }}>
                      <span style={{ color:"var(--text-subtle)", fontSize:10 }}>{LANG_LABEL[lang]}</span>{" "}
                      {botName[lang] || "（未命名 Bot）"}
                    </span>
                  ))}
                </div>
              </div>

              <div style={{ fontSize:11, fontWeight:500, color:"var(--text-mid)", marginBottom:6 }}>主題色彩（{Object.keys(theme).length} 個變數）</div>
              <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill, minmax(90px, 1fr))", gap:6, marginBottom:16 }}>
                {Object.entries(theme).map(([k,v]) => (
                  <div key={k} title={`${k}: ${v}`} style={{ display:"flex", alignItems:"center", gap:5, padding:"4px 6px", background:"var(--surface-raised)", border:"1px solid var(--border)", borderRadius:6, overflow:"hidden" }}>
                    <div style={{ width:12, height:12, borderRadius:3, flexShrink:0, border:"1px solid var(--border)", background:/^linear-gradient/.test(v)?v:v }}/>
                    <span style={{ fontSize:10, color:"var(--text-subtle)", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{k.replace(/^--/,"")}</span>
                  </div>
                ))}
              </div>

              <div style={{ fontSize:11, fontWeight:500, color:"var(--text-mid)", marginBottom:6 }}>問候語</div>
              <div style={{ display:"flex", flexDirection:"column", gap:8, marginBottom:16 }}>
                {["en","zh","ja"].map(lang => (
                  <div key={lang} style={{ padding:"8px 12px", background:"var(--surface-raised)", border:"1px solid var(--border)", borderRadius:8 }}>
                    <div style={{ fontSize:10, letterSpacing:1, color:"var(--text-subtle)", textTransform:"uppercase", marginBottom:4 }}>{LANG_LABEL[lang]}</div>
                    <div style={{ fontSize:12, color:"var(--text)", marginBottom:2 }}>{greeting?.[lang]?.welcome || "—"}</div>
                    <div style={{ fontSize:12, color:"var(--text-subtle)" }}>{greeting?.[lang]?.hint || "—"}</div>
                  </div>
                ))}
              </div>

              {pushError && (
                <div style={{ padding:"9px 12px", background:"var(--red-light)", border:"1px solid rgba(220,38,38,0.25)", borderRadius:9, fontSize:11.5, color:"var(--red)", marginBottom:8 }}>
                  {pushError}
                </div>
              )}
              {hasInFlight && (
                <div style={{ padding:"9px 12px", background:"var(--amber-light)", border:"1px solid var(--amber)", borderRadius:9, fontSize:11.5, color:"var(--amber)", marginBottom:8 }}>
                  推送處理中——內網 agent 正在或即將認領這筆任務，下方紀錄會自動更新，不用手動重新整理。
                </div>
              )}
              <button onClick={handlePush} disabled={pushing || hasInFlight}
                style={{ width:"100%", padding:"10px 0", borderRadius:10, border:"none",
                  background: (pushing || hasInFlight) ? "var(--border)" : "var(--accent)",
                  color: (pushing || hasInFlight) ? "var(--text-subtle)" : "#fff", fontFamily:"inherit",
                  fontSize:13, fontWeight:500, cursor: (pushing || hasInFlight) ? "default" : "pointer", display:"flex",
                  alignItems:"center", justifyContent:"center", gap:6 }}>
                {(pushing || hasInFlight)
                  ? <div style={{ width:13, height:13, border:"2px solid rgba(255,255,255,0.4)", borderTopColor:"#fff", borderRadius:"50%", animation:"spin 0.7s linear infinite" }}/>
                  : <Ico name="send" size={13} color="currentColor"/>}
                {hasInFlight ? "推送處理中…" : "確認推送"}
              </button>
            </>
          )}

          <div style={{ fontSize:11, letterSpacing:1.5, color:C.accent, textTransform:"uppercase", margin:"20px 0 10px", fontWeight:500 }}>推送紀錄</div>
          {history.length === 0 ? (
            <div style={{ fontSize:12, color:"var(--text-subtle)", padding:"6px 0" }}>尚無推送紀錄</div>
          ) : (
            <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
              {history.map(h => {
                const STATUS_STYLE = {
                  success:    { bg:"var(--green-light)", color:"var(--green)", label:"成功" },
                  error:      { bg:"var(--red-light)",   color:"var(--red)",   label:"失敗" },
                  processing: { bg:"var(--accent-subtle)", color:"var(--accent)", label:"處理中" },
                  pending:    { bg:"var(--border)",      color:"var(--text-subtle)", label:"等待中" },
                }[h.status] || { bg:"var(--border)", color:"var(--text-subtle)", label:h.status };
                return (
                  <div key={h.id} title={h.status==="error" ? h.response : undefined}
                    style={{ display:"flex", alignItems:"center", gap:8, padding:"8px 10px", background:"var(--surface-raised)", border:"1px solid var(--border)", borderRadius:8 }}>
                    <span style={{ fontSize:10, padding:"2px 7px", borderRadius:5, fontWeight:500, background:STATUS_STYLE.bg, color:STATUS_STYLE.color }}>
                      {STATUS_STYLE.label}
                    </span>
                    <span style={{ fontSize:12, color:"var(--text)" }}>{new Date(h.pushed_at).toLocaleString("zh-TW")}</span>
                    <span style={{ fontSize:11, color:"var(--text-subtle)", marginLeft:"auto" }}>{h.pushed_by || "—"}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </>
  );
};

// ─── JiraTab ──────────────────────────────────────────────────
const JIRA_PROXY              = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/jira-proxy`;
const CUSTOMER_ACCESS_MANAGE  = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/customer-access-manage`;
// 2026-09-01：目前沒有任何地方呼叫這支（改成 sitechat_ebconsole_pushes 工作佇列 + 本機 agent，
// 見 SiteChatEbConsolePanel 上方註解）。Edge Function 本身還留著部署，保留這個常數只是為了未來
// 如果換成有固定出口 IP 的內網代理、要改回直接呼叫時方便，不是死碼誤留。
const EBCONSOLE_PROXY         = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ebconsole-proxy`;
const JIRA_ANON  = import.meta.env.VITE_SUPABASE_ANON_KEY;

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

// Jira 的 renderedFields.description 是 Jira 自己算好的 HTML（跟 Jira 網頁上看到的一樣），理論上是
// 可信任來源，但終究內容最終出自使用者在 Jira 上打的字，塞進頁面前還是做一層最小消毒。專案目前刻意
// 不依賴外部 sanitize 套件（package.json 沒有 DOMPurify），這裡手刻一個最小可用版本：拿掉危險標籤、
// 拿掉 on* 事件屬性和 javascript: 連結，並強制所有連結在新分頁開啟。
function sanitizeJiraHtml(html) {
  if (!html) return "";
  try {
    const doc = new DOMParser().parseFromString(html, "text/html");
    doc.querySelectorAll("script,style,iframe,object,embed,form,link,meta").forEach(el => el.remove());
    // Jira 的圖片（含附件截圖與裝飾小圖示）需要登入 Jira 的 session 才能載入，
    // 直接嵌入儀表板必定破圖，因此先以簡潔的示意文字取代，不嘗試載入原圖。
    doc.querySelectorAll("img").forEach(img => {
      const placeholder = doc.createElement("span");
      placeholder.className = "jira-img-placeholder";
      placeholder.textContent = "🖼 圖片暫不支援顯示";
      img.replaceWith(placeholder);
    });
    doc.querySelectorAll("*").forEach(el => {
      [...el.attributes].forEach(attr => {
        const name  = attr.name.toLowerCase();
        const value = attr.value.trim().toLowerCase();
        if (name.startsWith("on")) el.removeAttribute(attr.name);
        if ((name === "href" || name === "src") && value.startsWith("javascript:")) el.removeAttribute(attr.name);
      });
      if (el.tagName === "A") {
        el.setAttribute("target", "_blank");
        el.setAttribute("rel", "noreferrer noopener");
      }
    });
    return doc.body.innerHTML;
  } catch {
    return "";
  }
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
  const [expanded,     setExpanded]     = useState({});
  const [descriptions, setDescriptions] = useState({});

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

  // 點擊卡片展開/收合詳細資訊；description 是唯一需要額外打一次 API 的欄位，
  // 第一次展開時才 lazy 抓，之後切換只是單純的 UI 狀態，不重打
  const toggleExpand = async (issueKey) => {
    setExpanded(prev => ({ ...prev, [issueKey]: !prev[issueKey] }));
    if (!descriptions[issueKey]) {
      setDescriptions(prev => ({ ...prev, [issueKey]: { loading:true, html:null, error:false } }));
      const data = await jiraFetch("issueDescription", { issueKey }, null, accessToken);
      setDescriptions(prev => ({
        ...prev,
        [issueKey]: data.error
          ? { loading:false, html:null, error:true }
          : { loading:false, html:data.descriptionHtml ?? null, error:false },
      }));
    }
  };

  const st = (issue) => statusStyle(issue.statusCategory ?? "new");

  return (
    <div style={{ animation:"fadeIn 0.25s ease" }}>
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:24 }}>
        <div>
          <h2 style={{ fontSize:20, fontWeight:500, color:C.text, margin:"0 0 4px" }}>Jira 子任務</h2>
          {epicId
            ? <p style={{ fontSize:13, color:C.textMid, margin:0 }}>Epic：<span style={{ fontFamily:"'DM Mono',monospace", color:C.accent }}>{epicId}</span></p>
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
          <div style={{ width:28, height:28, border:`3px solid ${C.accentBorder}`, borderTopColor:C.accent,
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
          <div style={{ display:"grid", gridTemplateColumns:"120px 1fr 160px 140px 20px",
            gap:12, padding:"6px 16px", fontSize:11, fontWeight:500,
            color:C.textLight, letterSpacing:"0.08em", textTransform:"uppercase" }}>
            <span>Issue</span><span>名稱</span><span>負責人</span><span>狀態</span><span/>
          </div>
          {issues.map(issue => {
            const s = st(issue);
            const trans = transitions[issue.key] ?? [];
            const isOpen = activeKey===issue.key;
            const isUpdating = !!updating[issue.key];
            // Issue 徽章逾期變色：用偏灰、不飽和的磚紅，跟月曆的做法一樣避免太刺眼
            const isIssueOverdue = issue.dueDate && issue.statusCategory !== "done" && daysUntil(issue.dueDate) < 0;
            return (
              <div key={issue.key} onClick={()=>toggleExpand(issue.key)}
                style={{ background:C.white, border:`1px solid ${C.border}`,
                borderRadius:12, padding:"12px 16px", position:"relative", cursor:"pointer" }}>
                <div style={{ display:"grid", gridTemplateColumns:"120px 1fr 160px 140px 20px",
                  gap:12, alignItems:"center" }}>
                  {/* Key */}
                  <a href={`https://aiello-eng.atlassian.net/browse/${issue.key}`}
                    target="_blank" rel="noreferrer" onClick={e=>e.stopPropagation()}
                    title={isIssueOverdue ? `已逾期（到期日：${fmtDate(issue.dueDate)}）` : undefined}
                    style={{ fontSize:12, fontWeight:500, textDecoration:"none",
                      fontFamily:"'DM Mono',monospace",
                      // 逾期直接沿用儀表板既有的警示紅（跟刪除垃圾桶 hover 同一組變數），視覺一致
                      color: isIssueOverdue ? "var(--red)" : "#0052cc",
                      background: isIssueOverdue ? "var(--red-subtle)" : "#e9f0ff",
                      border: isIssueOverdue ? "1px solid var(--red)" : "1px solid #b3c7f7",
                      borderRadius:6, padding:"3px 8px",
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
                    <button onClick={(e)=>{e.stopPropagation(); openDropdown(issue.key);}} disabled={isUpdating}
                      style={{ display:"flex", alignItems:"center", gap:6, padding:"5px 10px",
                        borderRadius:8, border:`1px solid ${s.color}44`,
                        background:s.bg, color:s.color, fontSize:12, fontWeight:500,
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
                                fontWeight:500, background:ts.bg, color:ts.color,
                                whiteSpace:"nowrap" }}>{t.name}</span>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                  {/* Chevron indicator */}
                  <div style={{ display:"flex", alignItems:"center", justifyContent:"center" }}>
                    <Ico name="chevronR" size={14} color="var(--text-subtle)"
                      style={{ transform: expanded[issue.key] ? "rotate(90deg)" : "none", transition:"transform 0.2s" }}/>
                  </div>
                </div>

                {expanded[issue.key] && (
                  <div style={{ marginTop:12, paddingTop:12, borderTop:`1px solid ${C.border}`,
                    display:"flex", flexDirection:"column", gap:12 }}>
                    <div style={{ display:"flex", flexWrap:"wrap", gap:8 }}>
                      <span style={{ padding:"3px 10px", borderRadius:7, fontSize:11, fontWeight:500,
                        background:C.bg, color:C.textMid, border:`1px solid ${C.border}` }}>{issue.type || "—"}</span>
                      {issue.priority && (
                        <span style={{ display:"inline-flex", alignItems:"center", gap:4, padding:"3px 10px",
                          borderRadius:7, fontSize:11, fontWeight:500, background:C.bg, color:C.textMid,
                          border:`1px solid ${C.border}` }}>
                          {issue.priorityIconUrl && <img src={issue.priorityIconUrl} width={12} height={12} alt=""/>}
                          {issue.priority}
                        </span>
                      )}
                    </div>

                    <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit, minmax(150px,1fr))",
                      gap:8, fontSize:12, color:C.textMid }}>
                      <div><span style={{ color:C.textLight }}>到期日：</span>{fmtDate(issue.dueDate)}</div>
                      <div><span style={{ color:C.textLight }}>建立時間：</span>{fmtDate(issue.created)}</div>
                      <div><span style={{ color:C.textLight }}>更新時間：</span>{fmtDate(issue.updated)}</div>
                      <div><span style={{ color:C.textLight }}>報告人：</span>{issue.reporter ?? "—"}</div>
                    </div>

                    {issue.subtasks?.length > 0 && (
                      <div>
                        <div style={{ fontSize:11, fontWeight:500, color:C.textLight, marginBottom:6,
                          textTransform:"uppercase", letterSpacing:"0.06em" }}>子任務</div>
                        <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
                          {issue.subtasks.map(sub => {
                            const subS = statusStyle(sub.statusCategory ?? "new");
                            return (
                              <div key={sub.key} style={{ display:"flex", alignItems:"center", gap:8, fontSize:12 }}>
                                <span style={{ fontFamily:"'DM Mono',monospace", color:"#0052cc",
                                  background:"#e9f0ff", border:"1px solid #b3c7f7", borderRadius:6,
                                  padding:"2px 6px", whiteSpace:"nowrap" }}>{sub.key}</span>
                                <span style={{ flex:1, color:C.text }}>{sub.summary}</span>
                                <span style={{ padding:"2px 8px", borderRadius:6, fontSize:11, fontWeight:500,
                                  background:subS.bg, color:subS.color, whiteSpace:"nowrap" }}>{sub.status}</span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    <div>
                      <div style={{ fontSize:11, fontWeight:500, color:C.textLight, marginBottom:6,
                        textTransform:"uppercase", letterSpacing:"0.06em" }}>描述</div>
                      {descriptions[issue.key]?.loading && (
                        <div style={{ fontSize:12, color:C.textLight }}>載入中…</div>
                      )}
                      {descriptions[issue.key]?.error && (
                        <div style={{ fontSize:12, color:C.red }}>無法讀取描述內容，請稍後再試。</div>
                      )}
                      {!descriptions[issue.key]?.loading && !descriptions[issue.key]?.error && (
                        descriptions[issue.key]?.html
                          ? <div className="jira-desc-html"
                              dangerouslySetInnerHTML={{ __html: sanitizeJiraHtml(descriptions[issue.key].html) }}/>
                          : <div style={{ fontSize:12, color:C.textLight }}>（無描述內容）</div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
          <div style={{ fontSize:12, color:C.textLight, textAlign:"right", marginTop:4 }}>
            共 {issues.length} 筆子任務・點擊狀態標籤可切換
          </div>
        </div>
      )}

      <div style={{ marginTop:24 }}>
        <NavRow onBack={onBack} onNext={onNext} nextLabel="下一步：任務紀錄 →" nextColor={C.accent}/>
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
  const [filterMode, setFilterMode] = useState("all"); // all | active | done
  const [sortByDate, setSortByDate] = useState(false);
  const [expanded, setExpanded] = useState({}); // task.id -> bool，收合列表沿用 Jira 子任務頁的展開互動

  const toggleSelect = (id) => setSelectedIds(prev => {
    const next = new Set(prev);
    next.has(id) ? next.delete(id) : next.add(id);
    return next;
  });

  const toggleExpand = (id) => setExpanded(prev => ({ ...prev, [id]: !prev[id] }));

  // 篩選只影響顯示，全選／批次刪除都改成只作用在目前看得到的這份清單，避免篩選後「全選」
  // 誤刪到被篩掉、畫面上看不到的任務。已完成的任務在「全部」篩選下永遠沉到清單最下面；
  // 排序開關只決定「進行中」跟「已完成」各自內部要不要按到期日排。
  const visibleTasks = useMemo(() => {
    let list = filterMode==="active" ? tasks.filter(t=>!t.completed)
      : filterMode==="done" ? tasks.filter(t=>t.completed)
      : tasks;
    if (sortByDate) {
      const dateKey = (t) => t.type==="period" ? t.period_start : t.deadline;
      list = [...list].sort((a,b) => {
        const ka=dateKey(a), kb=dateKey(b);
        if (!ka && !kb) return 0;
        if (!ka) return 1;
        if (!kb) return -1;
        return ka.localeCompare(kb);
      });
    }
    if (filterMode==="all") list = [...list].sort((a,b)=> (a.completed===b.completed)?0:a.completed?1:-1);
    return list;
  }, [tasks, filterMode, sortByDate]);

  const isAllSelected = visibleTasks.length > 0 && visibleTasks.every(t=>selectedIds.has(t.id));
  const toggleSelectAll = () => setSelectedIds(isAllSelected ? new Set() : new Set(visibleTasks.map(t => t.id)));

  const addTask = () => {
    const t = { ...newTask(), project_id:projectId };
    onTasksChange([...tasks, t]);
    setExpanded(prev => ({ ...prev, [t.id]: true })); // 新增的任務預設展開，方便直接填寫
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
        url:t.url||"", is_internal:t.is_internal??true, completed:t.completed??false,
      });
    }, 800);
  };

  return (
    <div style={{ animation:"fadeIn 0.25s ease" }}>
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:selectedIds.size>0?12:24 }}>
        <div>
          <h2 style={{ fontSize:20, fontWeight:500, color:C.text, margin:"0 0 4px" }}>任務紀錄</h2>
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
          <button onClick={addTask} style={{ background:C.accent, color:"#fff", border:"none",
            borderRadius:10, padding:"9px 18px", fontSize:13, fontWeight:500,
            cursor:"pointer", fontFamily:"inherit", boxShadow:`0 2px 8px ${C.accent}40` }}>+ 新增任務</button>
        </div>
      </div>

      {/* 篩選 + 排序 */}
      {tasks.length > 0 && (
        <div style={{ display:"flex", flexWrap:"wrap", alignItems:"center", justifyContent:"space-between",
          gap:12, marginBottom:16 }}>
          <div style={{ display:"flex", gap:8 }}>
            {[{ v:"all", text:"全部" }, { v:"active", text:"進行中" }, { v:"done", text:"已完成" }].map(({ v, text }) => (
              <button key={v} onClick={()=>setFilterMode(v)}
                style={{ padding:"6px 14px", borderRadius:20, fontFamily:"inherit", fontSize:12, fontWeight:400,
                  cursor:"pointer", transition:"all 0.15s",
                  border:`1px solid ${filterMode===v?C.accent:C.border}`,
                  background:filterMode===v?C.accent:C.white, color:filterMode===v?"#fff":C.textMid }}>
                {text}
              </button>
            ))}
          </div>
          <button onClick={()=>setSortByDate(v=>!v)}
            style={{ display:"flex", alignItems:"center", gap:6, padding:"6px 14px", borderRadius:8,
              fontFamily:"inherit", fontSize:12, cursor:"pointer", transition:"all 0.15s",
              border:`1px solid ${sortByDate?C.accent:C.border}`,
              background:sortByDate?C.accentLight:C.white, color:sortByDate?C.accent:C.textMid }}>
            <Ico name="sort" size={13} color="currentColor"/>依到期日排序
          </button>
        </div>
      )}

      {/* 批次操作列 */}
      {selectedIds.size > 0 && (
        <div style={{ display:"flex", alignItems:"center", gap:12, padding:"10px 16px",
          background:C.accentLight, border:`1px solid ${C.accentBorder}`, borderRadius:12, marginBottom:16 }}>
          <span style={{ fontSize:13, color:C.accent, fontWeight:400 }}>已選取 {selectedIds.size} 筆</span>
          <button onClick={removeSelected}
            style={{ marginLeft:"auto", padding:"6px 16px", background:C.red, color:"#fff", border:"none",
              borderRadius:8, fontSize:13, fontWeight:500, cursor:"pointer", fontFamily:"inherit" }}>
            <><Ico name="trash" size={13} color="currentColor"/> 刪除選取（{selectedIds.size}）</>
          </button>
        </div>
      )}

      {tasks.length===0 ? (
        <div style={{ textAlign:"center", padding:"50px 0", color:C.textLight }}>
          <div style={{ marginBottom:10 }}><Ico name="clipboardList" size={32} color="var(--text-subtle)"/></div>
          <div style={{ fontSize:14, fontWeight:400 }}>尚無任務，點擊右上角「新增任務」開始</div>
        </div>
      ) : visibleTasks.length===0 ? (
        <div style={{ textAlign:"center", padding:"50px 0", color:C.textLight }}>
          <div style={{ marginBottom:10 }}><Ico name="clipboardList" size={32} color="var(--text-subtle)"/></div>
          <div style={{ fontSize:14, fontWeight:400 }}>{filterMode==="done"?"還沒有已完成的任務":"目前沒有進行中的任務"}</div>
        </div>
      ) : (
        <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
          {visibleTasks.map((task, idx) => {
            const isSelected = selectedIds.has(task.id);
            const isOpen = !!expanded[task.id];
            const dueRaw = task.type==="period" ? task.period_end : task.deadline;
            const isTaskOverdue = !task.completed && dueRaw && daysUntil(dueRaw) < 0;
            const dateLabel = task.type==="period"
              ? (task.period_start && task.period_end ? `${fmtDate(task.period_start)} – ${fmtDate(task.period_end)}` : "尚未設定期間")
              : (task.deadline ? fmtDate(task.deadline) : "尚未設定期限");
            return (
            <Card key={task.id} onClick={()=>toggleExpand(task.id)}
              style={{ padding:20, cursor:"pointer", border:`1px solid ${isSelected ? C.accentBorder : C.border}`, background:isSelected ? C.accentLight : C.white, opacity:task.completed?0.6:1, transition:"opacity 0.15s" }}>
              <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", gap:12, marginBottom:isOpen?16:0 }}>
                <div style={{ display:"flex", alignItems:"center", gap:10, flex:1 }}>
                  {/* 完成狀態 */}
                  <button onClick={(e)=>{e.stopPropagation(); updateTask(task.id,"completed",!task.completed);}}
                    title={task.completed?"標記為進行中":"標記為已完成"}
                    style={{ width:20, height:20, borderRadius:"50%", flexShrink:0, cursor:"pointer", padding:0,
                      border:`2px solid ${task.completed?C.green:C.borderMid}`,
                      background:task.completed?C.green:C.white,
                      display:"flex", alignItems:"center", justifyContent:"center" }}>
                    {task.completed && <Ico name="check" size={12} color="#fff" strokeWidth={3}/>}
                  </button>
                  {/* Checkbox */}
                  <div onClick={(e)=>{e.stopPropagation(); toggleSelect(task.id);}}
                    style={{ width:18, height:18, borderRadius:5, flexShrink:0, cursor:"pointer",
                      border:`2px solid ${isSelected ? C.accent : C.borderMid}`,
                      background:isSelected ? C.accent : C.white,
                      display:"flex", alignItems:"center", justifyContent:"center" }}>
                    {isSelected && <span style={{ color:"#fff", fontSize:11, lineHeight:1 }}>✓</span>}
                  </div>
                  <span style={{ fontSize:11, fontWeight:500, color:C.textLight, minWidth:24 }}>#{idx+1}</span>
                  <input value={task.name} onChange={e=>updateTask(task.id,"name",e.target.value)}
                    onClick={e=>e.stopPropagation()}
                    placeholder="任務名稱" style={{ ...baseInput, fontSize:15, fontWeight:400, padding:"8px 12px",
                      textDecoration:task.completed?"line-through":"none", color:task.completed?"var(--text-subtle)":C.text }}
                    onFocus={e=>(e.target.style.borderColor=C.accent)} onBlur={e=>(e.target.style.borderColor=C.border)}/>
                </div>
                <div style={{ display:"flex", alignItems:"center", gap:12, flexShrink:0 }}>
                  {/* 收合時也看得到的到期日摘要，逾期會標紅 */}
                  <span style={{ fontSize:12, color: isTaskOverdue ? C.red : C.textLight, fontWeight:isTaskOverdue?500:400,
                    whiteSpace:"nowrap", display:"flex", alignItems:"center", gap:4 }}>
                    <Ico name={task.type==="period"?"repeat":"pin"} size={12} color="currentColor"/>
                    {dateLabel}{isTaskOverdue && "（逾期）"}
                  </span>
                  <Ico name="chevronR" size={14} color="var(--text-subtle)"
                    style={{ transform: isOpen ? "rotate(90deg)" : "none", transition:"transform 0.2s", flexShrink:0 }}/>
                  <button onClick={(e)=>{e.stopPropagation(); removeTask(task.id);}}
                    style={{ background:"none", border:`1px solid ${C.border}`, borderRadius:7, padding:"5px 10px",
                      cursor:"pointer", fontSize:13, color:C.textLight, transition:"all 0.15s", fontFamily:"inherit", flexShrink:0 }}
                    onMouseEnter={e=>{ e.currentTarget.style.background="var(--red-subtle)"; e.currentTarget.style.borderColor="var(--red)"; e.currentTarget.style.color="var(--red)"; }}
                    onMouseLeave={e=>{ e.currentTarget.style.background="none"; e.currentTarget.style.borderColor=C.border; e.currentTarget.style.color=C.textLight; }}><Ico name="trash" size={14} color="currentColor"/></button>
                </div>
              </div>

              {isOpen && (
              <div onClick={e=>e.stopPropagation()}>
              <div style={{ marginBottom:14 }}>
                <label style={{ display:"block", fontSize:11, letterSpacing:1.5, color:C.textMid, textTransform:"uppercase", marginBottom:6, fontWeight:400 }}>內容概述</label>
                <textarea value={task.description} onChange={e=>updateTask(task.id,"description",e.target.value)}
                  placeholder="描述任務的目標、範圍或相關說明…" rows={3}
                  style={{ ...baseInput, resize:"vertical", minHeight:80 }}
                  onFocus={e=>(e.target.style.borderColor=C.accent)} onBlur={e=>(e.target.style.borderColor=C.border)}/>
              </div>

              {/* Type toggle */}
              <div style={{ marginBottom:14 }}>
                <label style={{ display:"block", fontSize:11, letterSpacing:1.5, color:C.textMid, textTransform:"uppercase", marginBottom:8, fontWeight:400 }}>類型</label>
                <div style={{ display:"flex", gap:8 }}>
                  {[{ v:"deadline", ico:"pin", text:"期限" }, { v:"period", ico:"repeat", text:"週期" }].map(({ v, ico, text }) => (
                    <button key={v} onClick={()=>updateTask(task.id,"type",v)}
                      style={{ padding:"7px 18px", borderRadius:8, fontFamily:"inherit", fontSize:13, fontWeight:400,
                        cursor:"pointer", transition:"all 0.15s",
                        border:`1.5px solid ${task.type===v?C.accent:C.border}`,
                        background:task.type===v?C.accent:C.white, color:task.type===v?"#fff":C.textMid,
                        display:"flex", alignItems:"center", gap:5 }}>
                      <Ico name={ico} size={13} color="currentColor"/>{text}
                    </button>
                  ))}
                </div>
              </div>

              {/* Date fields */}
              {task.type==="deadline" ? (
                <div style={{ marginBottom:14 }}>
                  <label style={{ display:"block", fontSize:11, letterSpacing:1.5, color:C.textMid, textTransform:"uppercase", marginBottom:7, fontWeight:400 }}>截止日期</label>
                  <input type="date" value={task.deadline||""} onChange={e=>updateTask(task.id,"deadline",e.target.value)}
                    style={{ ...baseInput, width:"auto" }}
                    onFocus={e=>(e.target.style.borderColor=C.amber)} onBlur={e=>(e.target.style.borderColor=C.border)}/>
                </div>
              ) : (
                <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:16, marginBottom:14 }}>
                  <div>
                    <label style={{ display:"block", fontSize:11, letterSpacing:1.5, color:C.green, textTransform:"uppercase", marginBottom:7, fontWeight:400 }}>開始日期</label>
                    <input type="date" value={task.period_start||""} onChange={e=>updateTask(task.id,"period_start",e.target.value)}
                      style={{ ...baseInput, borderColor:C.border, background:C.greenLight }}
                      onFocus={e=>(e.target.style.borderColor=C.green)} onBlur={e=>(e.target.style.borderColor=C.border)}/>
                  </div>
                  <div>
                    <label style={{ display:"block", fontSize:11, letterSpacing:1.5, color:C.purple, textTransform:"uppercase", marginBottom:7, fontWeight:400 }}>結束日期</label>
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
                <label style={{ display:"block", fontSize:11, letterSpacing:1.5, color:C.textMid, textTransform:"uppercase", marginBottom:7, fontWeight:400 }}>相關連結（選填）</label>
                <input type="url" value={task.url||""} onChange={e=>updateTask(task.id,"url",e.target.value)}
                  placeholder="https://…" style={baseInput}
                  onFocus={e=>(e.target.style.borderColor=C.accent)} onBlur={e=>(e.target.style.borderColor=C.border)}/>
                {task.url && !task.url.startsWith("http") && <div style={{ marginTop:5, fontSize:11, color:C.red }}>⚠️ 請確認連結以 http 或 https 開頭</div>}
                {task.url && task.url.startsWith("http") && (
                  <a href={task.url} target="_blank" rel="noreferrer"
                    style={{ display:"inline-flex", alignItems:"center", gap:4, marginTop:8,
                      fontSize:12, color:C.accent, textDecoration:"none", fontWeight:400 }}>↗ 開啟連結</a>
                )}
              </div>

              {/* 客戶可見度 toggle */}
              <div style={{ marginTop:18, paddingTop:16, borderTop:`1px solid ${C.border}`,
                display:"flex", alignItems:"center", justifyContent:"space-between" }}>
                <div>
                  <div style={{ fontSize:12, fontWeight:400, color:C.text }}>對客戶公開</div>
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
              </div>
              )}
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
  const [showEbConsolePush, setShowEbConsolePush] = useState(false);
  const [projSub,       setProjSub]       = useState(null);
  const [subLoading,    setSubLoading]    = useState(false);
  const [jiraBoot, setJiraBoot] = useState({ open:false, step:"idle", epicKey:"", epicUrl:"", created:0, failed:[], issueTypeName:"", reporterName:"", errorMsg:"" });
  const saveTimer = useRef(null);
  // Guards the autosave effect below against firing on mount, before the user has actually
  // touched anything (2026-07-28). Without this, the effect's guaranteed first run - which
  // happens on every mount regardless of whether any state changed - would call onUpdate with
  // whatever snapshot happened to be in props at that moment. If someone else had saved a newer
  // edit to this same project in the meantime and this tab was just sitting open (e.g. Jim
  // monitoring the dashboard without editing), that first-run save would silently push the
  // stale snapshot back and clobber the other person's edit. Real incident, not theoretical -
  // see docs/todo.md #10. This only skips the truly-empty first run; the later re-fire caused by
  // the DB refresh below (merging fresh basic/faq/batch2Checked) still goes through normally,
  // since that one is a deliberate, real change.
  const didMountRef = useRef(false);

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
    if (!didMountRef.current) {
      didMountRef.current = true;
      return;
    }
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
  // ACA 首次被選上、方案還沒設定過時，直接預設帶入 Original——避免「未選方案」跟「選 Original」
  // 在畫面上長期並存成兩種容易混淆的狀態（2026-09-04，Jim 確認舊專案本質上都是 Original）。
  // 取消勾選 ACA 不會清空 acaPlan，跟其他產品欄位（例如取消 AVA 不會清空 avaUnits）的既有慣例一致。
  const toggleProduct = useCallback((p) => setInfo(prev => {
    const turningOn = !prev.products.includes(p);
    const products = turningOn ? [...prev.products, p] : prev.products.filter(x=>x!==p);
    const acaPlan = (p==="ACA" && turningOn && !prev.acaPlan) ? "Original" : prev.acaPlan;
    return { ...prev, products, acaPlan };
  }), [setInfo]);
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

      // Step 4: 依選擇產品批次建立子任務（含去重）
      const taskRes = await jiraFetch("createTasks", {}, { epicKey, hotelName, issueTypeName, reporterAccountId, products: info.products }, session?.access_token);
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

  const { hasAva, hasAca, hasGw, hasTmsp, hasIptv } = getFlags(info.products, info.integrations);
  const jiraTaskCount = (hasAva ? 51 : 0) + (hasAca ? (hasAva ? 4 : 5) : 0) || 51;
  const canBatch1 = hasAva||hasAca||hasGw||hasTmsp, canBatch2 = hasAva||hasGw;
  const activeFaq = FAQ_ITEMS.filter(item => item!==FAQ_TV_ITEM||hasIptv);

  const basicCount = hasAva ? BASIC_ITEMS.filter(k => basicChecked[k]).length : 0;
  const acaCount   = hasAca && basicChecked[ACA_ITEM] ? 1 : 0;
  const tmspCount  = hasTmsp && basicChecked[TMSP_ITEM] ? 1 : 0;
  const faqCount   = (hasAva||hasGw) ? Object.entries(faqChecked).filter(([k,v])=>v&&(k!==FAQ_TV_ITEM||hasIptv)).length : 0;
  const b2Count    = hasAva ? BATCH2_ITEMS.filter(it=>batch2Checked[it]).length : 0;
  const gwCount    = hasGw  && batch2Checked[GW_ITEM] ? 1 : 0;
  const totalItems = calcTotal(info.products, info.integrations);
  const totalPct   = totalItems===0 ? 0 : Math.round(((basicCount+acaCount+tmspCount+faqCount+b2Count+gwCount)/totalItems)*100);

  // Steps: 0=info, 1=batch1, 2=batch2, 3=jira, 4=tasks, 5=overview
  const STEPS = ["專案資訊","第一批資料","第二批資料","Jira 子任務","任務紀錄","總覽"];

  const LockScreen = ({ msg }) => (
    <div style={{ textAlign:"center", padding:"60px 0", color:C.textLight }}>
      <div style={{ marginBottom:14 }}><Ico name="lock" size={36} color="var(--text-subtle)"/></div>
      <div style={{ fontSize:15, fontWeight:400, color:C.textMid, marginBottom:20 }}>{msg}</div>
      <button onClick={()=>setStep(0)} style={{ background:C.accent, color:"#fff", border:"none",
        borderRadius:10, padding:"10px 22px", fontSize:13, fontWeight:500,
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
          <div style={{ width:26, height:26, borderRadius:7, background:C.accent,
            display:"flex", alignItems:"center", justifyContent:"center" }}><AielloLogo size={16}/></div>
          <span style={{ fontSize:15, fontWeight:500, color:C.text }}>{info.name||"新專案"}</span>
          {info.hotelId && <span style={{ fontSize:12, color:C.textLight, fontFamily:"'DM Mono',monospace" }}>#{info.hotelId}</span>}
        </div>
        <div style={{ fontSize:13, color:C.textMid, background:C.bg, border:`1px solid ${C.border}`,
          borderRadius:8, padding:"5px 14px", fontFamily:"'DM Mono',monospace", fontWeight:400,
          display:"flex", alignItems:"center", gap:8 }}>
          <span style={{ color:totalPct===100?C.green:C.accent }}>{totalPct}%</span> 完成
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
          const tip    = i===1?"請先選購 AVA、ACA 或 GW":"請先選購 AVA 或 GW";
          return (
            <button key={i} onClick={()=>!locked&&setStep(i)} title={locked?tip:""}
              style={{ padding:"14px 18px", background:"none", border:"none", fontFamily:"inherit",
                borderBottom:`2.5px solid ${step===i?C.accent:"transparent"}`,
                color:locked?C.border:step===i?C.accent:C.textLight,
                cursor:locked?"not-allowed":"pointer", fontSize:13,
                fontWeight:step===i?700:500, transition:"all 0.15s",
                display:"flex", alignItems:"center", gap:7 }}>
              <span style={{ width:20, height:20, borderRadius:"50%", display:"inline-flex",
                alignItems:"center", justifyContent:"center", fontSize:11, fontWeight:500,
                background:locked?C.bg:step===i?C.accentLight:C.bg,
                border:`1.5px solid ${locked?C.border:step===i?C.accent:C.border}`,
                color:locked?C.border:step===i?C.accent:C.textLight }}>
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
                <h2 style={{ fontSize:20, fontWeight:500, color:C.text, margin:"0 0 5px" }}>專案基本資訊</h2>
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
                <label style={{ display:"block", fontSize:11, letterSpacing:1.5, color:C.textMid, textTransform:"uppercase", marginBottom:7, fontWeight:400 }}>負責人（PIC）</label>
                <datalist id="pic-list">{allPics.map(p=><option key={p} value={p}/>)}</datalist>
                <input list="pic-list" value={info.pic} onChange={e=>setInfo(p=>({ ...p, pic:e.target.value }))}
                  placeholder="輸入負責人姓名，若不在清單內將自動新增" style={baseInput}
                  onFocus={e=>(e.target.style.borderColor=C.green)} onBlur={e=>(e.target.style.borderColor=C.border)}/>
                {info.pic&&!allPics.includes(info.pic)&&<div style={{ marginTop:6, fontSize:12, color:C.green }}>✦ 將新增「{info.pic}」至 PIC 清單</div>}
              </div>
              <FInput label="地址" value={info.address} onChange={v=>setInfo(p=>({ ...p, address:v }))} placeholder="例：台北市中山區南京東路一段"/>
              <div style={{ marginBottom:18 }}>
                <label style={{ display:"block", fontSize:11, letterSpacing:1.5, color:C.textMid, textTransform:"uppercase", marginBottom:7, fontWeight:400 }}>所在國家</label>
                <div style={{ display:"flex", flexWrap:"wrap", gap:8, marginBottom:10 }}>
                  {COUNTRIES.map(c=><Chip key={c} label={c} active={info.region===c} color={C.accent} onClick={()=>setInfo(p=>({ ...p, region:c, regionOther:c!=="其他"?"":p.regionOther }))}/>)}
                </div>
                {info.region==="其他"&&<input type="text" value={info.regionOther} onChange={e=>setInfo(p=>({ ...p, regionOther:e.target.value }))}
                  placeholder="請輸入國家／地區名稱" style={{ ...baseInput, borderColor:C.accent }}/>}
              </div>
              <div style={{ marginBottom:18 }}>
                <label style={{ display:"block", fontSize:11, letterSpacing:1.5, color:C.textMid, textTransform:"uppercase", marginBottom:7, fontWeight:400 }}>Jira Epic 連結</label>
                <input type="url" value={info.jiraEpic} onChange={e=>setInfo(p=>({ ...p, jiraEpic:e.target.value }))}
                  placeholder="https://your-domain.atlassian.net/browse/EPIC-123" style={baseInput}
                  onFocus={e=>(e.target.style.borderColor="#0052cc")} onBlur={e=>(e.target.style.borderColor=C.border)}/>
                {info.jiraEpic&&!info.jiraEpic.startsWith("http")&&<div style={{ marginTop:6, fontSize:12, color:C.red }}>⚠️ 連結格式不正確</div>}
                {info.jiraEpic&&info.jiraEpic.startsWith("http")&&<a href={info.jiraEpic} target="_blank" rel="noreferrer" style={{ display:"inline-flex", alignItems:"center", gap:4, marginTop:6, fontSize:12, color:"#0052cc", textDecoration:"none", fontWeight:400 }}>↗ 開啟 Jira Epic</a>}

                {/* Bootstrap 按鈕：僅在 jiraEpic 為空且有飯店名稱時顯示 */}
                {!info.jiraEpic && info.name.trim() && (
                  <div style={{ marginTop:12, padding:"13px 15px", background:"var(--accent-subtle)",
                    border:"1px solid var(--accent-border)", borderRadius:10 }}>
                    <div style={{ fontSize:13, color:"var(--text-mid)", marginBottom:8, lineHeight:1.6 }}>
                      尚未建立 Jira Epic。點擊下方按鈕可自動建立 Epic 並依選擇的產品匯入標準子任務。
                    </div>
                    {info.products.length === 0 ? (
                      <div style={{ fontSize:12, color:"var(--amber)", marginBottom:10 }}>
                        ⚠ 請先至「專案資訊」選擇購置產品，再建立 Jira Epic。
                      </div>
                    ) : (
                      <div style={{ fontSize:12, color:"var(--text-subtle)", marginBottom:10 }}>
                        將依選擇的產品建立 <strong style={{ color:"var(--text)" }}>{jiraTaskCount} 筆</strong> 子任務（{info.products.join(" / ")}）
                      </div>
                    )}
                    <button onClick={()=>setJiraBoot(p=>({ ...p, open:true, step:"idle" }))}
                      disabled={info.products.length === 0}
                      style={{ display:"inline-flex", alignItems:"center", gap:7, padding:"7px 15px",
                        background:info.products.length === 0 ? "var(--border)" : "#0052cc",
                        color: info.products.length === 0 ? "var(--text-subtle)" : "#fff",
                        border:"none", borderRadius:8,
                        fontSize:13, fontWeight:400,
                        cursor: info.products.length === 0 ? "not-allowed" : "pointer",
                        fontFamily:"inherit" }}>
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
                        <h3 style={{ fontSize:17, fontWeight:500, color:"var(--text)", margin:0 }}>建立 Jira Epic 與任務</h3>
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
                          子任務：<strong style={{ color:"var(--text)" }}>{jiraTaskCount} 筆</strong>（含指定 assignee）<br/>
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
                              borderRadius:8, fontSize:13, fontWeight:400, cursor:"pointer", fontFamily:"inherit" }}>確認建立</button>
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
                          <div style={{ fontSize:13, fontWeight:400, color:"var(--green)", marginBottom:12 }}>
                            ✓ Epic&nbsp;
                            <a href={jiraBoot.epicUrl} target="_blank" rel="noreferrer"
                              style={{ color:"#0052cc", textDecoration:"none", fontWeight:500 }}>{jiraBoot.epicKey}</a>&nbsp;已建立
                          </div>
                          <div style={{ width:28, height:28, border:"3px solid var(--accent-border)", borderTopColor:"var(--accent)",
                            borderRadius:"50%", animation:"spin 0.8s linear infinite", margin:"0 auto 12px" }}/>
                          <div style={{ fontSize:13, color:"var(--text-mid)" }}>正在建立 {jiraTaskCount} 筆子任務，請稍候（約 15 秒）…</div>
                          {jiraBoot.issueTypeName && (
                            <div style={{ marginTop:8, fontSize:11, color:"var(--text-subtle)" }}>
                              Issue type：<code style={{ background:"var(--surface-raised)", padding:"1px 6px", borderRadius:4 }}>{jiraBoot.issueTypeName}</code>
                              {jiraBoot.reporterName && <> Reporter：<code style={{ background:"var(--surface-raised)", padding:"1px 6px", borderRadius:4 }}>{jiraBoot.reporterName}</code></>}
                            </div>
                          )}
                        </div>
                      )}

                      {/* 完成 */}
                      {jiraBoot.step==="done" && (
                        <div>
                          <div style={{ padding:"12px 14px", background:"var(--green-subtle)",
                            border:"1px solid var(--green)", borderRadius:8, marginBottom:14 }}>
                            <div style={{ fontSize:14, fontWeight:400, color:"var(--green)", marginBottom:4 }}>✓ 建立完成</div>
                            <div style={{ fontSize:12, color:"var(--text-mid)" }}>
                              Epic：<a href={jiraBoot.epicUrl} target="_blank" rel="noreferrer"
                                style={{ color:"#0052cc", fontWeight:500, textDecoration:"none" }}>{jiraBoot.epicKey}</a>
                               子任務：{jiraBoot.created} 筆已建立
                            </div>
                          </div>
                          {jiraBoot.failed.length>0 && (
                            <div style={{ padding:"10px 12px", background:"var(--red-subtle)",
                              border:"1px solid var(--red)", borderRadius:8, marginBottom:14 }}>
                              <div style={{ fontSize:12, fontWeight:400, color:"var(--red)", marginBottom:8 }}>
                                ⚠️ {jiraBoot.failed.length} 筆建立失敗
                              </div>
                              {jiraBoot.failed[0]?.msg && (
                                <div style={{ marginBottom:8, padding:"7px 10px", background:"var(--surface)",
                                  border:"1px solid var(--border)", borderRadius:6,
                                  fontSize:11, color:"var(--text-mid)", fontFamily:"'DM Mono',monospace",
                                  wordBreak:"break-all", lineHeight:1.6 }}>
                                  <span style={{ color:"var(--red)", fontWeight:400 }}>Jira 錯誤：</span>
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
                                borderRadius:8, fontSize:13, fontWeight:400, cursor:"pointer", fontFamily:"inherit" }}>完成</button>
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
                              <span style={{ color:"var(--red)", fontWeight:400 }}>錯誤詳情：</span>{jiraBoot.errorMsg}
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
                {PRODUCTS.map(p=><Chip key={p} label={p} active={info.products.includes(p)} color={PRODUCT_COLORS[p]||C.accent} onClick={()=>toggleProduct(p)}/>)}
              </div>
              {/* AVA only → blue box */}
              {info.products.includes("AVA")&&!info.products.includes("AVT")&&(
                <div style={{ background:C.accentLight, border:`1px solid ${C.accentBorder}`, borderRadius:12, padding:16 }}>
                  <div style={{ fontSize:11, color:C.accent, letterSpacing:1.5, textTransform:"uppercase", marginBottom:12, fontWeight:500 }}>AVA 機台數量</div>
                  <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:16 }}>
                    <FInput label="裝機數量" value={info.avaUnits} onChange={v=>setInfo(p=>({ ...p, avaUnits:v }))} placeholder="例：50" type="number"/>
                    <FInput label="備品機台數量" value={info.avaSpare} onChange={v=>setInfo(p=>({ ...p, avaSpare:v }))} placeholder="例：5" type="number"/>
                    <FInput label="裝機房間數" value={info.installingRooms} onChange={v=>setInfo(p=>({ ...p, installingRooms:v }))} placeholder="例：50" type="number"/>
                  </div>
                </div>
              )}
              {/* AVT（含 AVA+AVT）→ orange box */}
              {info.products.includes("AVT")&&(
                <div style={{ background:C.accentLight, border:`1px solid ${C.accentBorder}`, borderRadius:12, padding:16 }}>
                  {info.products.includes("AVA")&&(
                    <>
                      <div style={{ fontSize:11, color:C.accent, letterSpacing:1.5, textTransform:"uppercase", marginBottom:12, fontWeight:500 }}>AVA 機台數量</div>
                      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:16, marginBottom:16 }}>
                        <FInput label="裝機數量" value={info.avaUnits} onChange={v=>setInfo(p=>({ ...p, avaUnits:v }))} placeholder="例：50" type="number"/>
                        <FInput label="備品機台數量" value={info.avaSpare} onChange={v=>setInfo(p=>({ ...p, avaSpare:v }))} placeholder="例：5" type="number"/>
                        <FInput label="裝機房間數" value={info.installingRooms} onChange={v=>setInfo(p=>({ ...p, installingRooms:v }))} placeholder="例：50" type="number"/>
                      </div>
                      <div style={{ borderTop:`1px solid ${C.accentBorder}`, marginBottom:16 }}/>
                    </>
                  )}
                  <div style={{ fontSize:11, color:C.accent, letterSpacing:1.5, textTransform:"uppercase", marginBottom:12, fontWeight:500 }}>AVT 機台數量</div>
                  <div style={{ maxWidth:"50%" }}>
                    <FInput label="裝機數量" value={info.avtUnits} onChange={v=>setInfo(p=>({ ...p, avtUnits:v }))} placeholder="例：30" type="number"/>
                  </div>
                </div>
              )}
              {/* ACA → same style box. 方案是單選 pill，直接沿用購置產品/串接功能已經在用的 Chip
                  元件，只是 onClick 改成直接指定值（不是 toggleArr 的多選邏輯）。 */}
              {info.products.includes("ACA")&&(
                <div style={{ background:C.accentLight, border:`1px solid ${C.accentBorder}`, borderRadius:12, padding:16, marginTop: (info.products.includes("AVA")||info.products.includes("AVT")) ? 16 : 0 }}>
                  <div style={{ fontSize:11, color:C.accent, letterSpacing:1.5, textTransform:"uppercase", marginBottom:12, fontWeight:500 }}>ACA 設定</div>
                  {/* 50/50 兩欄，跟 TMSP 房間數/最大空間數那個 grid 同一套版型；兩個 label 各自佔
                      第一列自然對齊，alignItems:"center" 讓第二列較矮的方案 pill 群跟較高的線路數
                      輸入框沿水平中線對齊，不用猜像素偏移量。 */}
                  <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:16, alignItems:"center" }}>
                    <label style={{ display:"block", fontSize:11, letterSpacing:1.4, color:"var(--text-subtle)", textTransform:"uppercase", fontWeight:400 }}>線路數</label>
                    <label style={{ display:"block", fontSize:11, letterSpacing:1.4, color:"var(--text-subtle)", textTransform:"uppercase", fontWeight:400 }}>ACA 方案</label>
                    <input type="number" value={info.acaLines} onChange={e=>setInfo(p=>({ ...p, acaLines:e.target.value }))}
                      placeholder="例：4" style={baseInput}
                      onFocus={e=>(e.target.style.borderColor="var(--accent)")}
                      onBlur={e=>(e.target.style.borderColor="var(--border)")}/>
                    <div style={{ display:"flex", flexWrap:"wrap", gap:10 }}>
                      {ACA_PLANS.map(plan=><Chip key={plan} label={plan} active={info.acaPlan===plan} color={C.accent} onClick={()=>setInfo(p=>({ ...p, acaPlan:plan }))}/>)}
                    </div>
                  </div>
                </div>
              )}
              {/* TMSP → blue box, same style as AVA/AVT/ACA */}
              {info.products.includes("TMSP")&&(
                <div style={{ background:C.accentLight, border:`1px solid ${C.accentBorder}`, borderRadius:12, padding:16, marginTop: (info.products.includes("AVA")||info.products.includes("AVT")||info.products.includes("ACA")) ? 16 : 0 }}>
                  <div style={{ fontSize:11, color:C.accent, letterSpacing:1.5, textTransform:"uppercase", marginBottom:12, fontWeight:500 }}>TMSP 空間數量</div>
                  {/* TMSP 房間數 is independent from AVA's installingRooms and from tmspMaxSpaces
                      (license/space cap) - see docs/todo.md room-count design discussion. Software
                      and hardware room counts can legitimately differ even when both AVA and TMSP
                      are selected on the same project (separate contracts). */}
                  <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:16, maxWidth:"100%" }}>
                    <FInput label="TMSP 房間數" value={info.tmspRoomCount} onChange={v=>setInfo(p=>({ ...p, tmspRoomCount:v }))} placeholder="例：50" type="number"/>
                    <FInput label="最大空間數" value={info.tmspMaxSpaces} onChange={v=>setInfo(p=>({ ...p, tmspMaxSpaces:v }))} placeholder="例：20" type="number"/>
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
                      <label style={{ display:"block", fontSize:11, letterSpacing:1.5, color:C.purple, textTransform:"uppercase", marginBottom:6, fontWeight:400 }}>{intg} 備註說明</label>
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
                    <label style={{ display:"block", fontSize:11, letterSpacing:1.5, color:C.textMid, textTransform:"uppercase", marginBottom:7, fontWeight:400 }}>上線日期</label>
                    <input type="date" value={info.launchDate} onChange={e=>setInfo(p=>({ ...p, launchDate:e.target.value }))}
                      style={baseInput} onFocus={e=>(e.target.style.borderColor=C.accent)} onBlur={e=>(e.target.style.borderColor=C.border)}/>
                  </div>
                  <div>
                    <label style={{ display:"block", fontSize:11, letterSpacing:1.5, color:C.green, textTransform:"uppercase", marginBottom:7, fontWeight:400 }}>第一批資料期限</label>
                    <input type="date" value={info.batch1Deadline} onChange={e=>setInfo(p=>({ ...p, batch1Deadline:e.target.value }))}
                      style={{ ...baseInput, borderColor:info.launchDate&&info.batch1Deadline&&info.batch1Deadline>info.launchDate?C.red:C.border, background:C.greenLight }}
                      onFocus={e=>(e.target.style.borderColor=C.green)} onBlur={e=>(e.target.style.borderColor=info.launchDate&&info.batch1Deadline&&info.batch1Deadline>info.launchDate?C.red:C.border)}/>
                  </div>
                  <div>
                    <label style={{ display:"block", fontSize:11, letterSpacing:1.5, color:C.purple, textTransform:"uppercase", marginBottom:7, fontWeight:400 }}>第二批資料期限</label>
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
                  onFocus={e=>(e.target.style.borderColor=C.accent)} onBlur={e=>(e.target.style.borderColor=C.border)}/>
                <div style={{ marginTop:6, fontSize:11, color:C.textLight }}>
                  💡 輸入 <code style={{ background:C.bg, padding:"1px 5px", borderRadius:4, fontSize:11 }}>[顯示文字](https://網址)</code> 可在總覽頁顯示為超連結
                </div>
              </div>
            </Card>
            <NavRow onNext={()=>setStep(1)} nextLabel="下一步：第一批資料 →" nextColor={C.accent}/>
          </div>
        )}

        {/* Step 1: 第一批資料 */}
        {step===1&&(
          <div style={{ animation:"fadeIn 0.25s ease" }}>
            {!canBatch1?<LockScreen msg="請先選購 AVA、ACA、GW 或 TMSP 以開啟第一批資料"/>:(
              <>
                <div style={{ marginBottom:24 }}>
                  <h2 style={{ fontSize:20, fontWeight:500, color:C.text, margin:"0 0 6px" }}>第一批資料</h2>
                  <div style={{ display:"flex", alignItems:"center", gap:10, marginTop:4 }}>
                    <span style={{ fontSize:11, background:C.greenLight, color:C.green, border:`1px solid ${C.green}44`, borderRadius:6, padding:"2px 10px", fontWeight:500 }}>第一批</span>
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
                {hasTmsp&&(
                  <Card>
                    <SectionCount title="TMS Pro 設定" checked={tmspCount} total={1} color={PRODUCT_COLORS.TMSP}/>
                    <div style={{ marginBottom:8 }}>
                      <CheckRow label={TMSP_ITEM} checked={!!basicChecked[TMSP_ITEM]} onChange={()=>toggleCheck(setBasicChecked, TMSP_ITEM, "basic_checked")} color={PRODUCT_COLORS.TMSP}/>
                      <NoteArea value={basicNotes[TMSP_ITEM]||""} onChange={v=>setBasicNotes(p=>({ ...p, [TMSP_ITEM]:v }))} focusColor={PRODUCT_COLORS.TMSP}/>
                    </div>
                    <SheetLink value={sheetLinks[TMSP_LINK_KEY]||""} onChange={v=>setSheetLinks(p=>({ ...p, [TMSP_LINK_KEY]:v }))} color={PRODUCT_COLORS.TMSP}/>
                  </Card>
                )}
                {(hasAva||hasGw)&&(
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
                    <h2 style={{ fontSize:20, fontWeight:500, color:C.text, margin:0 }}>第二批資料</h2>
                    <div style={{ border:"1px solid var(--border)", borderRadius:8, padding:"4px 12px", background:"var(--surface-raised)" }}>
                      <span style={{ fontSize:16, fontWeight:500, color:C.purple, fontFamily:"'DM Mono',monospace" }}>{b2Count+gwCount}</span>
                      <span style={{ fontSize:12, color:"var(--text-subtle)" }}>/{(hasAva?BATCH2_ITEMS.length:0)+(hasGw?1:0)}</span>
                    </div>
                  </div>
                  <div style={{ display:"flex", alignItems:"center", gap:10, marginTop:8 }}>
                    <span style={{ fontSize:11, background:C.purpleLight, color:C.purple, border:`1px solid ${C.purple}44`, borderRadius:6, padding:"2px 10px", fontWeight:500 }}>第二批</span>
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
                          {isDone && <span style={{ color:"#fff", fontSize:10, fontWeight:500 }}>✓</span>}
                        </div>
                        <span style={{ fontSize:14, fontWeight:400, color:"var(--text)", flex:1 }}>{item}</span>
                        {!isDone && <span style={{ fontSize:10, color:"var(--text-subtle)", fontWeight:400 }}>待完成</span>}
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
                          {isDone && <span style={{ color:"#fff", fontSize:10, fontWeight:500 }}>✓</span>}
                        </div>
                        <span style={{ fontSize:14, fontWeight:400, color:"var(--text)", flex:1 }}>{GW_ITEM}</span>
                        <span style={{ fontSize:10, color:"var(--prod-gw)", background:"var(--amber-subtle)",
                          border:"1px solid var(--amber)", borderRadius:5, padding:"2px 8px", fontWeight:400 }}>GW</span>
                        {!isDone && <span style={{ fontSize:10, color:"var(--text-subtle)", fontWeight:400, marginLeft:4 }}>待完成</span>}
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
            <NavRow onBack={()=>setStep(3)} onNext={()=>setStep(5)} nextLabel="查看總覽 →" nextColor={C.accent}/>
          </div>
        )}

        {/* Step 5: 總覽 */}
        {step===5&&(
          <div style={{ animation:"fadeIn 0.25s ease" }}>
            <div style={{ marginBottom:24 }}>
              <div style={{ display:"flex", alignItems:"flex-start", justifyContent:"space-between", gap:12 }}>
                <div>
                  <h2 style={{ fontSize:20, fontWeight:500, color:C.text, margin:"0 0 5px" }}>專案總覽</h2>
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
                  border:`1px solid ${projSub&&(projSub.subscribed_projects||[]).includes(project.id)?C.accentBorder:C.border}`,
                  background:projSub&&(projSub.subscribed_projects||[]).includes(project.id)?C.accentLight:C.bg,
                  color:projSub&&(projSub.subscribed_projects||[]).includes(project.id)?C.accent:C.textMid,
                  fontSize:13, fontFamily:"inherit", transition:"all 0.15s" }}>
                  {projSub&&(projSub.subscribed_projects||[]).includes(project.id)
                  ?<><Ico name="bell" size={13} color="currentColor"/> 已訂閱提醒</>
                  :<><Ico name="bellOff" size={13} color="currentColor"/> 訂閱此專案提醒</>}
                </button>
              </div>
            </div>
            <Card>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:12 }}>
                <span style={{ fontSize:13, color:C.textMid, fontWeight:400 }}>整體完成度</span>
                <span style={{ fontSize:26, fontWeight:500, fontFamily:"'DM Mono',monospace", color:totalPct===100?C.green:C.accent }}>{totalPct}%</span>
              </div>
              <div style={{ height:10, background:C.bg, borderRadius:5, overflow:"hidden" }}>
                <div style={{ height:"100%", borderRadius:5, width:`${totalPct}%`, transition:"width 0.8s ease",
                  background:totalPct===100?C.green:`linear-gradient(90deg,${C.accent},${C.purple})` }}/>
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
                      <div style={{ fontSize:10, color, letterSpacing:1.5, textTransform:"uppercase", marginBottom:2, fontWeight:500 }}>{label}</div>
                      <div style={{ fontSize:15, fontWeight:500, color:C.text, fontFamily:"'DM Mono',monospace" }}>{date||"—"}</div>
                      <div style={{ fontSize:11, color:C.textMid, marginTop:2 }}>{sub}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
            <div style={{ display:"flex", gap:14, marginBottom:20, flexWrap:"wrap" }}>
              {hasAva&&<ProgressCard label="基礎設定資料表" checked={basicCount} total={BASIC_ITEMS.length} color={C.green}/>}
              {hasAca&&<ProgressCard label="ACA 設定" checked={acaCount} total={1} color={PRODUCT_COLORS.ACA}/>}
              {hasTmsp&&<ProgressCard label="TMS Pro 設定" checked={tmspCount} total={1} color={PRODUCT_COLORS.TMSP}/>}
              {(hasAva||hasGw)&&<ProgressCard label="FAQ 資料表" checked={faqCount} total={activeFaq.length} color={C.amber}/>}
              {(hasAva||hasGw)&&<ProgressCard label="第二批資料" checked={b2Count+gwCount} total={(hasAva?BATCH2_ITEMS.length:0)+(hasGw?1:0)} color={C.purple}/>}
            </div>
            {info.name&&(
              <Card>
                <div style={{ fontSize:11, letterSpacing:2, color:C.accent, textTransform:"uppercase", marginBottom:16, fontWeight:500, display:"flex", alignItems:"center", gap:6 }}><Ico name="clipboardList" size={13} color="currentColor"/>專案資訊</div>
                <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"10px 28px" }}>
                  {/* Hotel ID 獨立格：帶複製按鈕 */}
                  {info.hotelId&&(
                    <div style={{ padding:"10px 0", borderBottom:`1px solid ${C.border}` }}>
                      <div style={{ fontSize:11, color:C.textLight, letterSpacing:1, textTransform:"uppercase", marginBottom:4, fontWeight:400 }}>Hotel ID</div>
                      <div style={{ display:"flex", alignItems:"center", gap:6 }}>
                        <div style={{ fontSize:14, color:C.text, fontWeight:400 }}>{info.hotelId}</div>
                        <button
                          onClick={(e)=>{
                            navigator.clipboard.writeText(info.hotelId);
                            const btn = e.currentTarget;
                            btn.style.color = "var(--green)";
                            setTimeout(()=>{ btn.style.color = ""; }, 1500);
                          }}
                          title="複製 Hotel ID"
                          style={{ display:"flex", alignItems:"center", justifyContent:"center", background:"none", border:"none", cursor:"pointer", padding:3, borderRadius:4, color:C.textLight, transition:"color 0.2s" }}>
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <rect x="9" y="9" width="13" height="13" rx="2"/>
                            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                          </svg>
                        </button>
                      </div>
                    </div>
                  )}
                  {[
                    ["飯店名稱",info.name],
                    ["負責人（PIC）",info.pic||"—"],["地址",info.address],
                    ["所在國家",info.region==="其他"?(info.regionOther||"其他"):info.region],
                    ["上線日期",info.launchDate||"—"],
                    ["購置產品",info.products.join("、")||"—"],
                    ["串接功能",info.integrations.join("、")||"無"],
                    info.products.includes("AVA")&&["AVA 裝機 / 備品 / 房間數",`${info.avaUnits||"—"} 台 / ${info.avaSpare||"—"} 台 / ${info.installingRooms||"—"} 房`],
                    info.products.includes("AVT")&&["AVT 裝機台數",`${info.avtUnits||"—"} 台`],
                    info.products.includes("TMSP")&&["TMSP 房間數 / 最大空間數",`${info.tmspRoomCount||"—"} 房 / ${info.tmspMaxSpaces||"—"} 間`],
                  ].filter(Boolean).map(([k,v])=>(
                    <div key={k} style={{ padding:"10px 0", borderBottom:`1px solid ${C.border}` }}>
                      <div style={{ fontSize:11, color:C.textLight, letterSpacing:1, textTransform:"uppercase", marginBottom:4, fontWeight:400 }}>{k}</div>
                      <div style={{ fontSize:14, color:C.text, fontWeight:400 }}>{v||"—"}</div>
                    </div>
                  ))}
                  {/* 第一批/第二批資料期限固定同一列：拉出主要 grid 之外、自己包一個 2 欄子
                      grid 並用 gridColumn:"1 / -1" 佔滿整列寬度，這樣不管前面有幾個條件式欄位
                      （AVA/AVT/TMSP 有無選擇會讓前面項目數量變動），這兩個永遠緊鄰同一列，
                      不會被前面的奇偶數量意外拆到兩列。 */}
                  <div style={{ gridColumn:"1 / -1", display:"grid", gridTemplateColumns:"1fr 1fr", gap:"10px 28px" }}>
                    {[
                      ["第一批資料期限",info.batch1Deadline||"—"],
                      ["第二批資料期限",info.batch2Deadline||"—"],
                    ].map(([k,v])=>(
                      <div key={k} style={{ padding:"10px 0", borderBottom:`1px solid ${C.border}` }}>
                        <div style={{ fontSize:11, color:C.textLight, letterSpacing:1, textTransform:"uppercase", marginBottom:4, fontWeight:400 }}>{k}</div>
                        <div style={{ fontSize:14, color:C.text, fontWeight:400 }}>{v||"—"}</div>
                      </div>
                    ))}
                  </div>
                  {info.jiraEpic&&(
                    <div style={{ padding:"10px 0", borderBottom:`1px solid ${C.border}` }}>
                      <div style={{ fontSize:11, color:C.textLight, letterSpacing:1, textTransform:"uppercase", marginBottom:4, fontWeight:400 }}>Jira Epic</div>
                      <a href={info.jiraEpic} target="_blank" rel="noreferrer"
                        style={{ fontSize:13, color:"#0052cc", textDecoration:"none", fontWeight:400,
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
                    <div style={{ fontSize:11, color:C.textLight, letterSpacing:1, textTransform:"uppercase", marginBottom:6, fontWeight:400 }}>其餘功能需求或備注</div>
                    <RichText text={info.notes} style={{ fontSize:13, color:C.textMid }}/>
                  </div>
                )}
                {info.integrations.some(k=>info.integrationNotes[k])&&(
                  <div style={{ marginTop:14, padding:14, background:C.purpleLight, borderRadius:10, border:`1px solid ${C.purple}33` }}>
                    <div style={{ fontSize:11, color:C.purple, letterSpacing:1, textTransform:"uppercase", marginBottom:10, fontWeight:500 }}>串接功能備註</div>
                    {info.integrations.filter(k=>info.integrationNotes[k]).map(k=>(
                      <div key={k} style={{ marginBottom:10, paddingBottom:10, borderBottom:`1px solid ${C.purple}22` }}>
                        <div style={{ fontSize:11, fontWeight:500, color:C.purple, marginBottom:4 }}>{k}</div>
                        <RichText text={info.integrationNotes[k]} style={{ fontSize:13, color:C.textMid }}/>
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            )}
            {/* 飯店填寫表單連結：拉出成獨立卡片（而不是塞進「專案資訊」的兩欄格子裡），格式比照
                其他卡片，一個表單一列，用 Grid 固定欄寬取代原生 table；長網址一樣靠 ScrollFadeText
                單行捲動+溢出才淡出，取代手動去 Supabase 複製 project id（Jim, 2026-08-13）。
                同一把 project.id 當連結權杖，裡面的分頁依 products 各自顯示/隱藏，所以只要有
                AVA / GuestWeb / TMS Pro / SiteChat / ACA 任一項，就該顯示這張卡；複選時對應的列會
                自動同時出現，不需要額外處理。ACA 是獨立表單（不是 AVA basic settings 的分頁），
                2026-08-27 上線後補上這一列（Jim）。 */}
            {info.name && (info.products.includes("AVA") || info.products.includes("GW") || info.products.includes("TMSP") || info.products.includes("SiteChat") || info.products.includes("ACA")) && (
              <Card>
                <div style={{ fontSize:11, letterSpacing:2, color:C.accent, textTransform:"uppercase", marginBottom:16, fontWeight:500, display:"flex", alignItems:"center", gap:6 }}><Ico name="link" size={13} color="currentColor"/>飯店填寫表單連結</div>
                {[
                  (info.products.includes("AVA") || info.products.includes("GW") || info.products.includes("TMSP")) && {
                    key:"basic", label:"基礎設定", url:`${AVA_FORM_BASE_URL}?p=${project.id}`,
                    copyTitle:"複製表單連結", openTitle:"在新分頁開啟表單",
                  },
                  info.products.includes("AVA") && {
                    key:"ui", label:"介面設定", url:avaUiSettingsUrl(project.id),
                    copyTitle:"複製 UI 設定表單連結", openTitle:"在新分頁開啟 UI 設定表單",
                  },
                  info.products.includes("ACA") && {
                    key:"aca", label:"ACA 設定", url:acaFormUrl(project.id),
                    copyTitle:"複製 ACA 設定表單連結", openTitle:"在新分頁開啟 ACA 設定表單",
                  },
                  info.products.includes("SiteChat") && {
                    key:"sitechat", label:"SiteChat 設定", url:sitechatFormUrl(project.id),
                    copyTitle:"複製 SiteChat 設定表單連結", openTitle:"在新分頁開啟 SiteChat 設定表單",
                  },
                ].filter(Boolean).map(({ key, label, url, copyTitle, openTitle })=>(
                  <div key={key} style={{ display:"grid", gridTemplateColumns:"92px 1fr auto", alignItems:"center", gap:10, padding:"10px 0", borderBottom:`1px solid ${C.border}` }}>
                    <span style={{ fontSize:12, color:C.textLight, whiteSpace:"nowrap" }}>{label}</span>
                    <ScrollFadeText style={{ fontSize:13, color:C.text, fontWeight:400, fontFamily:"'DM Mono',monospace" }}>
                      {url}
                    </ScrollFadeText>
                    <div style={{ display:"flex", alignItems:"center", gap:2 }}>
                      <button
                        onClick={(e)=>{
                          navigator.clipboard.writeText(url);
                          const btn = e.currentTarget;
                          btn.style.color = "var(--green)";
                          setTimeout(()=>{ btn.style.color = ""; }, 1500);
                        }}
                        title={copyTitle}
                        style={{ display:"flex", alignItems:"center", justifyContent:"center", background:"none", border:"none", cursor:"pointer", padding:3, borderRadius:4, color:C.textLight, transition:"color 0.2s" }}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <rect x="9" y="9" width="13" height="13" rx="2"/>
                          <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                        </svg>
                      </button>
                      <a href={url} target="_blank" rel="noreferrer"
                        title={openTitle}
                        style={{ display:"flex", alignItems:"center", justifyContent:"center", padding:3, color:C.textLight, textDecoration:"none" }}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
                          <polyline points="15 3 21 3 21 9"/>
                          <line x1="10" y1="14" x2="21" y2="3"/>
                        </svg>
                      </a>
                    </div>
                  </div>
                ))}
              </Card>
            )}
            {/* SiteChat → eb-console 推送：內部限定，不做在對外開放的 SiteChat 表單裡（Jim，
                2026-08-27 明確交代）。一次性設定，推送前強制人工審核（開面板看預覽，不是打開就送），
                避免飯店端頻繁改動觸發連動更新；歷史紀錄讀 `sitechat_ebconsole_pushes`（內部限定表，
                無 anon policy）。實際打 API 的 `ebconsole-proxy` Edge Function 待內部規格文件到位後
                才會接上，面板目前先把預覽/審核/歷史紀錄搭好，「確認推送」按鈕先停用。 */}
            {info.name && info.products.includes("SiteChat") && (
              <Card>
                <div style={{ fontSize:11, letterSpacing:2, color:C.accent, textTransform:"uppercase", marginBottom:16, fontWeight:500, display:"flex", alignItems:"center", gap:6 }}><Ico name="send" size={13} color="currentColor"/>SiteChat → eb-console</div>
                <div style={{ fontSize:13, color:C.textMid, marginBottom:14, lineHeight:1.6 }}>把這個專案的 SiteChat 問候語與主題色彩推送到內部 eb-console，推送前會先顯示預覽供人工審核。</div>
                <button onClick={()=>setShowEbConsolePush(true)}
                  style={{ display:"inline-flex", alignItems:"center", gap:5,
                    fontSize:12, color:"var(--accent)", textDecoration:"none", fontWeight:400,
                    background:"var(--accent-subtle)", border:"1px solid var(--accent-border)",
                    borderRadius:6, padding:"4px 10px", fontFamily:"inherit", cursor:"pointer" }}>
                  <Ico name="send" size={12} color="currentColor"/> 開啟推送面板
                </button>
              </Card>
            )}
            {/* Batch 1 checklists */}
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:16, marginBottom:16 }}>
              {hasAva&&(
                <OvCard title="基礎設定資料表" color={C.green} linkKey="basic" sheetLinks={sheetLinks}>
                  {BASIC_ITEMS.map(item=><OvCheckRow key={item} label={item} checked={basicChecked[item]} note={basicNotes[item]} color={C.green}/>)}
                </OvCard>
              )}
              {(hasAva||hasGw)&&(
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
              {hasTmsp&&(
                <OvCard title="TMS Pro 設定" color={PRODUCT_COLORS.TMSP} linkKey={TMSP_LINK_KEY} sheetLinks={sheetLinks}>
                  <OvCheckRow label={TMSP_ITEM} checked={basicChecked[TMSP_ITEM]} note={basicNotes[TMSP_ITEM]} color={PRODUCT_COLORS.TMSP}/>
                </OvCard>
              )}
            </div>
            {/* Batch 2 */}
            {(hasAva||hasGw)&&(
              <div style={{ background:C.white, border:"1px solid var(--border)", borderRadius:12, padding:16, marginBottom:16 }}>
                <div style={{ fontSize:11, letterSpacing:1.5, color:C.purple, textTransform:"uppercase", marginBottom:14, fontWeight:500 }}>第二批資料</div>
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
                <div style={{ fontSize:11, letterSpacing:1.5, color:C.accent, textTransform:"uppercase", marginBottom:14, fontWeight:500 }}>任務紀錄（{tasks.length} 項）</div>
                <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
                  {tasks.map((task,idx)=>(
                    <div key={task.id} style={{ padding:"12px 14px", background:C.bg, borderRadius:10, border:`1px solid ${C.border}` }}>
                      <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:task.description?6:0 }}>
                        <span style={{ fontSize:11, fontWeight:500, color:C.textLight }}>#{idx+1}</span>
                        <span style={{ fontSize:13, fontWeight:400, color:C.text }}>{task.name||"（未命名任務）"}</span>
                        <span style={{ marginLeft:"auto", fontSize:10, background:task.type==="deadline"?C.amberLight:C.greenLight,
                          color:task.type==="deadline"?C.amber:C.green,
                          border:`1px solid ${task.type==="deadline"?C.amber+"44":C.green+"44"}`,
                          borderRadius:5, padding:"2px 8px", fontWeight:400, whiteSpace:"nowrap", display:"inline-flex", alignItems:"center", gap:4 }}>
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
      {showEbConsolePush && (
        <SiteChatEbConsolePanel
          projectId={project.id}
          session={session}
          onClose={()=>setShowEbConsolePush(false)}/>
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
        <h1 style={{ fontSize:20, fontWeight:500, color:"var(--text)", margin:"0 0 6px" }}>專案交付中心</h1>
        <p style={{ fontSize:13, color:"var(--text-mid)", margin:"0 0 28px" }}>輸入公司 email 以收取登入連結</p>
        {!sent ? (<>
          <input type="email" value={email} onChange={e=>setEmail(e.target.value)}
            placeholder="your@aiello.ai"
            style={{ ...baseInput, marginBottom:12, textAlign:"center" }}
            onKeyDown={e=>e.key==="Enter"&&!e.nativeEvent.isComposing&&send()}
            onFocus={e=>(e.target.style.borderColor="var(--accent)")}
            onBlur={e=>(e.target.style.borderColor="var(--border)")}/>
          {err && <div style={{ fontSize:12, color:"var(--red)", marginBottom:8 }}>{err}</div>}
          <button onClick={send} disabled={loading||!email.trim()}
            style={{ width:"100%", padding:"10px 0", background:email.trim()?"var(--accent)":"var(--border)",
              color:email.trim()?"#fff":"var(--text-subtle)", border:"none", borderRadius:8,
              fontSize:14, fontWeight:400, cursor:email.trim()?"pointer":"default", fontFamily:"inherit" }}>
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
            <div style={{ fontSize:15, fontWeight:500, color:"var(--text)" }}>個人設定</div>
            <div style={{ fontSize:12, color:"var(--text-mid)", marginTop:2 }}>Jira 連線與帳號管理</div>
          </div>
          <button onClick={onClose} style={{ background:"none", border:"1px solid var(--border)",
            borderRadius:8, padding:"4px 10px", cursor:"pointer", fontSize:16,
            color:"var(--text-mid)", fontFamily:"inherit" }}>✕</button>
        </div>
        <div style={{ flex:1, overflowY:"auto", padding:20 }}>
          <div style={{ marginBottom:18 }}>
            <label style={{ display:"block", fontSize:11, letterSpacing:1.4, color:"var(--text-subtle)",
              textTransform:"uppercase", marginBottom:6, fontWeight:400 }}>顯示名稱</label>
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
              textTransform:"uppercase", marginBottom:6, fontWeight:400 }}>Jira Email</label>
            <input type="email" value={jiraEmail} onChange={e=>setJiraEmail(e.target.value)}
              placeholder="your@aiello.ai" style={baseInput}
              onFocus={e=>(e.target.style.borderColor="var(--accent)")}
              onBlur={e=>(e.target.style.borderColor="var(--border)")}/>
          </div>
          <div style={{ marginBottom:24 }}>
            <label style={{ display:"block", fontSize:11, letterSpacing:1.4, color:"var(--text-subtle)",
              textTransform:"uppercase", marginBottom:6, fontWeight:400 }}>Jira API Token</label>
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
              border:"none", borderRadius:8, fontSize:13, fontWeight:400,
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
  const [eggFired,       setEggFired]       = useState(false); // 🥚 Konami code overlay
  const [logoEggFired,   setLogoEggFired]   = useState(false); // 🥚 連點 logo 7 下 overlay
  const [jimMode,        setJimMode]        = useState(() => localStorage.getItem("hotel-dash-jim-mode") === "1"); // 🥚 jim mode
  const [eggUnlockCount, setEggUnlockCount] = useState(0); // 🥚 by-user 彩蛋解鎖數，全解鎖皇冠徽章用
  const logoClickRef = useRef({ count:0, lastTime:0 });
  // Auth
  const [session,      setSession]      = useState(null);
  const [profile,      setProfile]      = useState(null);
  const [authLoading,  setAuthLoading]  = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const saveTimer = useRef({});
  // Per-project snapshot of the last { project, progress } payload (uiToDb shape) actually sent to
  // Supabase, keyed by project id (2026-08-05, todo #10 fix). handleUpdate diffs against this
  // instead of blindly re-sending every column on every save - see handleUpdate for why. Seeded on
  // initial load and on handleNew's insert; updated after every successful save.
  const lastSavedRef = useRef({});

  // ── Auth state ───────────────────────────────────────────────
  useEffect(() => {
    sb.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session) { loadProfile(session.user.id); initEggUnlocksForUser(session.user.email); }
      else setAuthLoading(false);
    });
    const { data: { subscription } } = sb.auth.onAuthStateChange((_, session) => {
      setSession(session);
      if (session) { loadProfile(session.user.id); initEggUnlocksForUser(session.user.email); }
      else { setProfile(null); setAuthLoading(false); }
    });
    return () => subscription.unsubscribe();
  }, []);

  // 🥚 Konami code（↑↑↓↓←→←→BA）：全站任何頁面都能觸發，跟 AI 面板開關無關。
  // 目前只放了一個示範用的全螢幕 overlay，內容/動畫自己改（render 區塊搜尋 eggFired）。
  useEffect(() => {
    let idx = 0;
    const onKey = (e) => {
      const expected = KONAMI_SEQUENCE[idx];
      const matched = e.key === expected || e.key.toLowerCase() === expected;
      if (matched) {
        idx++;
        if (idx === KONAMI_SEQUENCE.length) {
          idx = 0;
          setEggFired(true);
          recordEggUnlock("konami");
          setTimeout(() => setEggFired(false), 4000);
        }
      } else {
        idx = (e.key === KONAMI_SEQUENCE[0]) ? 1 : 0;
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // 🥚 連點 header logo 7 下：兩次點擊間隔超過 1.2 秒就重置計數，避免平常隨手點一兩下誤觸。
  const handleLogoClick = () => {
    const now = Date.now();
    const ref = logoClickRef.current;
    if (now - ref.lastTime > 1200) ref.count = 0;
    ref.count++;
    ref.lastTime = now;
    if (ref.count >= 7) {
      ref.count = 0;
      setLogoEggFired(true);
      recordEggUnlock("logoclick");
      setTimeout(() => setLogoEggFired(false), 4000);
    }
  };

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

  // 🥚 lumos / nox 橋接：把真正的 setTheme 接到 module-level 的 applyThemeEgg，
  // 讓 EASTER_EGGS（module-level 陣列，摸不到這個元件的 state）能觸發真實的主題切換。
  useEffect(() => {
    applyThemeEgg = (t) => setTheme(t);
    return () => { applyThemeEgg = () => {}; };
  }, []);

  // 🥚 jim mode：CSS class（html.jim-mode-effect，見 GLOBAL_CSS）+ localStorage 持久化，
  // 一份 state 同時驅動主題換膚跟下面 DebugHud 的顯示/隱藏。
  useEffect(() => {
    document.documentElement.classList.toggle("jim-mode-effect", jimMode);
    localStorage.setItem("hotel-dash-jim-mode", jimMode ? "1" : "0");
  }, [jimMode]);

  useEffect(() => {
    toggleJimModeEgg = () => setJimMode(p => !p);
    return () => { toggleJimModeEgg = () => {}; };
  }, []);

  // 🥚 由 recordEggUnlock/initEggUnlocksForUser 呼叫，讓皇冠徽章能即時反應新解鎖的彩蛋數量。
  useEffect(() => {
    notifyEggUnlockChange = (count) => setEggUnlockCount(count);
    return () => { notifyEggUnlockChange = () => {}; };
  }, []);

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
          tasksByProject[t.project_id].push({ id:t.id, project_id:t.project_id, name:t.name||"", description:t.description||"", type:t.type||"deadline", deadline:t.deadline||"", period_start:t.period_start||"", period_end:t.period_end||"", url:t.url||"", is_internal:t.is_internal??true, completed:t.completed??false });
        });
        const projs = (rows??[]).map(r=>({ ...dbToUi(r,progMap[r.id]), tasks:tasksByProject[r.id]||[] }));
        setProjects(projs);
        setAllTasks(taskRows??[]);
        // Seed the diff baseline with what's actually in the DB right now, so the first edit in a
        // session only sends the column(s) that actually change (todo #10 fix).
        lastSavedRef.current = Object.fromEntries(projs.map(p => [p.id, uiToDb(p)]));
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
      // Seed the diff baseline for this brand-new row (todo #10 fix) - without this, the first
      // handleUpdate call would diff against {} and treat every column as "changed", which is
      // harmless (just one redundant full write) but unnecessary now that we have the real values.
      lastSavedRef.current[proj.id] = { project, progress };
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
        const last = lastSavedRef.current[updated.id] || {};
        const lastProject  = last.project  || {};
        const lastProgress = last.progress || {};

        // ── projects 表：只送真的變動的欄位（2026-08-05, todo #10）───────────────
        // 舊寫法是不管改了哪個欄位都整包 upsert(project)，AVA basic settings 也會寫
        // 同一張表的部分欄位（products/installing_rooms/ava_units/... 等，見該站
        // syncToSupabase() 的 ovMap）。整包覆蓋等於「這個分頁打開當下看到的舊值」
        // 隨時可能把另一邊剛存好的新值蓋掉，這正是 Jim 實際遇到的事故（AVA basic
        // settings 對應資料看起來消失）的根因。改成只送真正變動的欄位後，沒碰過的
        // 欄位不會出現在這次的 UPDATE payload 裡，自然不會覆蓋別人剛存的值。
        const projectDiff = {};
        Object.keys(project).forEach(k => {
          if (k === "id") return;
          if (JSON.stringify(project[k]) !== JSON.stringify(lastProject[k])) projectDiff[k] = project[k];
        });
        if (Object.keys(projectDiff).length > 0) {
          const { error:e1 } = await sb.from("projects").update(projectDiff).eq("id", project.id);
          if (e1) throw e1;
        }

        // ── project_progress 的 notes/連結欄位：改走單一 key 原子更新 RPC ──────────
        // 這四個欄位本身是 JSONB map（key 是 checklist 項目/連結名稱），舊寫法整包
        // upsert 這四個欄位，兩人同時改同一個 JSONB 欄位裡的不同 key 時後寫入的會把
        // 整包蓋過去。改用 update_progress_field RPC（跟既有的 update_check_item 同
        // 一套模式，見該 RPC 定義）逐 key 原子合併，只送這次真的變動的 key。
        const noteFields = ["basic_notes","faq_notes","batch2_notes","sheet_links"];
        for (const field of noteFields) {
          const curObj  = progress[field]     || {};
          const prevObj = lastProgress[field] || {};
          const keys = new Set([...Object.keys(curObj), ...Object.keys(prevObj)]);
          for (const key of keys) {
            if ((curObj[key] ?? "") !== (prevObj[key] ?? "")) {
              const { error:e2 } = await sb.rpc("update_progress_field", {
                p_project_id: project.id, p_field: field, p_key: key, p_value: curObj[key] ?? "",
              });
              if (e2) throw e2;
            }
          }
        }

        lastSavedRef.current[updated.id] = { project, progress };
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
  const allPics = useMemo(()=>[...new Set([...PIC_OPTIONS, ...projects.map(p=>p.info.pic).filter(Boolean)])].sort(),[projects]);

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
      <div style={{ width:40, height:40, border:`3px solid ${C.accentBorder}`, borderTopColor:C.accent,
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
              <div onClick={handleLogoClick} style={{ width:36, height:36, borderRadius:9, background:"var(--accent)",
                display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0, cursor:"pointer" }}><AielloLogo size={22}/></div>
              <div>
                <div style={{ fontSize:15, fontWeight:500, color:"var(--text)", lineHeight:1.2, fontFamily:"'Inter',sans-serif" }}>Hotel Project Dashboard</div>
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
                style={{ height:36, display:"flex", alignItems:"center", gap:9, position:"relative",
                  background:"var(--surface-raised)", border:"1px solid var(--border)",
                  borderRadius:10, padding:"0 12px 0 5px", cursor:"pointer",
                  fontFamily:"inherit", transition:"all 0.12s" }}
                onMouseEnter={e=>{ e.currentTarget.style.borderColor="var(--accent)"; }}
                onMouseLeave={e=>{ e.currentTarget.style.borderColor="var(--border)"; }}>
                {/* 🥚 全彩蛋達成皇冠徽章 — 2026-08-21，刻意跳脫系統既有的 CSS variable 配色/
                    極簡風格（不管淺色深色主題都是同一個金色皇冠），純靜態、歪斜疊在右上角。
                    只在 eggUnlockCount 等於彩蛋總數時 render；點擊噴 confetti，stopPropagation
                    避免同時觸發外層按鈕的 setShowSettings。 */}
                {eggUnlockCount === EGG_REGISTRY.length && (
                  <div onClick={e=>{ e.stopPropagation(); triggerConfetti(); }}
                    title="全彩蛋達成 👑"
                    style={{ position:"absolute", top:-10, right:-6, fontSize:22, lineHeight:1,
                      transform:"rotate(30deg)", filter:"drop-shadow(0 2px 3px rgba(0,0,0,0.35))",
                      cursor:"pointer", zIndex:1 }}>
                    👑
                  </div>
                )}
                <div style={{ width:26, height:26, borderRadius:"50%", flexShrink:0,
                  background:"var(--accent)", display:"flex", alignItems:"center",
                  justifyContent:"center", fontSize:12, fontWeight:500, color:"#fff" }}>
                  {(profile?.display_name || session?.user?.email || "?")[0].toUpperCase()}
                </div>
                <div style={{ textAlign:"left" }}>
                  <div style={{ fontSize:13, fontWeight:400, color:"var(--text)", lineHeight:1.3 }}>
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
                  borderRadius:9, padding:"0 18px", fontSize:13, fontWeight:400,
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
                  borderBottom:`2.5px solid ${page===id?C.accent:"transparent"}`,
                  color:page===id?C.accent:C.textLight, cursor:"pointer",
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
            cursor:"pointer", color:C.red, fontWeight:500, fontSize:16, padding:0, lineHeight:1 }}>×</button>
        </div>
      )}

      {/* AI Panel */}
      {showAi && <AiPanel projects={projects} allTasks={allTasks} onClose={()=>setShowAi(false)}/>}

      {/* 🥚 Konami code overlay — 示範用，內容/動畫自己改 */}
      {eggFired && (
        <div style={{ position:"fixed", inset:0, zIndex:99999, display:"flex", alignItems:"center",
          justifyContent:"center", background:"rgba(0,0,0,0.6)", animation:"fadeIn 0.2s ease", pointerEvents:"none" }}>
          <div style={{ textAlign:"center", color:"#fff", animation:"fadeIn 0.3s ease" }}>
            <div style={{ fontSize:44, marginBottom:10 }}>🎉</div>
            <div style={{ fontSize:20, fontWeight:500 }}>你很厲害但也很閒...</div>
          </div>
        </div>
      )}

      {/* 🥚 連點 logo 7 下 overlay */}
      {logoEggFired && (
        <div style={{ position:"fixed", inset:0, zIndex:99999, display:"flex", alignItems:"center",
          justifyContent:"center", background:"rgba(0,0,0,0.6)", animation:"fadeIn 0.2s ease", pointerEvents:"none" }}>
          <div style={{ textAlign:"center", color:"#fff", animation:"fadeIn 0.3s ease" }}>
            <div style={{ fontSize:44, marginBottom:10 }}>😡</div>
            <div style={{ fontSize:24, fontWeight:600 }}>為什麼還要上班！！！</div>
          </div>
        </div>
      )}

      {/* 🥚 jim mode debug HUD */}
      {jimMode && <DebugHud projects={projects} allTasks={allTasks}/>}

      {/* Content */}
      {isDetailView
        ? <ProjectDetail project={activeProject} isNew={isNew} onUpdate={handleUpdate} onBack={()=>setView("home")} onDelete={handleDelete} allPics={allPics} session={session} profile={profile}/>
        : page==="calendar"
          ? <CalendarPage projects={projects} allTasks={allTasks} accessToken={session?.access_token} onTaskAdded={(task, isEdit) => {
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
