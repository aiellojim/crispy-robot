// scripts/ebconsole-push-agent.mjs
//
// 常駐輪詢代理：在你已連 VPN／內網的電腦上跑這支，負責真正把 SiteChat 的問候語＋主題色彩推
// 送到內部 eb-console（https://eb-admin.aiello.ai）。
//
// 為什麼要這樣做（2026-09-01）：Supabase Edge Function 沒有固定的對外 IP，而 eb-admin.aiello.ai
// 的防火牆只允許內網連線（實測是 TCP connect timeout，防火牆層級直接丟包，不是應用層的
// 401/403），所以「打 eb-admin」這一步沒辦法放在 Edge Function 裡執行，只能放在一台真的在內網
// 上的機器——這支 script 就是那台機器上跑的東西。
//
// 運作方式：hotel-dashboard 的「確認推送」按鈕只會在 `sitechat_ebconsole_pushes` insert 一筆
// status='pending' 的列（不呼叫任何 Edge Function，RLS 本身就限制只有 @aiello.ai 帳號能寫）。
// 這支 script 定期輪詢這張表，認領（claim）最舊的一筆 pending 任務，實際去查 Supabase 拿這個
// 專案的設定、打 GET/POST 給 eb-admin，把結果寫回同一筆列。
//
// 失敗處理刻意分兩種（Jim 2026-09-01 有問「斷線後會不會自動恢復」，這是針對這個問題設計的）：
//   1. 網路層失敗（fetch 本身丟出例外，例如電腦離開內網、eb-admin 連不到）→ 判定是「暫時性」，
//      把任務退回 pending（不是 error），下一輪輪詢連線恢復的話會自動重試，不需要人工介入。
//   2. 應用層失敗（eb-admin 真的回應了，但是 404/400/其他非 200）→ 判定是「確定性」失敗，
//      標記 error 並記下回應內容，不會自動重試（重試也不會變好，八成是資料設定有問題，需要人工
//      修正後從 hotel-dashboard 重新按一次「確認推送」）。
//   3. 額外保險：如果這支 script 自己在處理到一半當掉，任務會卡在 processing 狀態；每輪輪詢也會
//      順便把「claimed_at 超過 2 分鐘還沒完成」的 processing 任務撿回來退回 pending，避免卡死。
//
// 執行方式：
//   1. 在 hotel-dashboard 專案根目錄建立 .env（已被 .gitignore 排除，不會進 git），內容：
//        SUPABASE_URL=https://yqoingcpcryrcpnhkjzu.supabase.co
//        SUPABASE_SERVICE_ROLE_KEY=<Supabase 專案設定 → API → service_role key>
//        EB_ADMIN_API_KEY=<eb-admin 的 X-API-Key>
//      （SUPABASE_SERVICE_ROLE_KEY 是很高權限的密鑰，等同繞過所有 RLS，只放在這台本機的 .env、
//      絕對不要提交進 git 或分享出去。）
//   2. Node 20.6+ 可以直接用 --env-file 讀取 .env，不需要另外裝 dotenv：
//        node --env-file=.env scripts/ebconsole-push-agent.mjs
//   3. 讓它留在背景一直跑（例如開一個終端機分頁常駐，或用 pm2/launchd 排成開機自動啟動）。
//      Ctrl+C 隨時可以停掉，停掉期間新的推送任務會停在 pending，等下次啟動再處理，不會遺失。

const SUPA_URL = process.env.SUPABASE_URL;
const SUPA_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const EB_ADMIN_BASE = process.env.EB_ADMIN_BASE_URL || "https://eb-admin.aiello.ai";
const EB_ADMIN_API_KEY = process.env.EB_ADMIN_API_KEY;
const POLL_INTERVAL_MS = Number(process.env.POLL_INTERVAL_MS || 5000);
const STALE_PROCESSING_MS = 2 * 60 * 1000;

if (!SUPA_URL || !SUPA_SERVICE_KEY || !EB_ADMIN_API_KEY) {
  console.error("缺少必要環境變數：SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY / EB_ADMIN_API_KEY，檢查 .env 或啟動指令是否帶 --env-file=.env");
  process.exit(1);
}

const supaHeaders = {
  Authorization: `Bearer ${SUPA_SERVICE_KEY}`,
  apikey: SUPA_SERVICE_KEY,
  "Content-Type": "application/json",
};

// 跟 ebconsole-proxy（Edge Function 版本，現已不再實際使用，但邏輯保留對照）同一份對照表，
// 兩邊如果之後要改欄位對應，記得一起改，避免兩份邏輯長期漂移出不同結果。
const COLOR_KEY_MAP = [
  ["--brand", "accentColor"],
  ["--header-bg", "headerBg"],
  ["--header-title", "headerText"],
  ["--header-icon", "headerIconColor"],
  ["--header-status", "headerSubText"],
  ["--welcome-bg", "preConnectBg"],
  ["--welcome-start", "preConnectBtnBg"],
  ["--welcome-title", "preConnectText"],
  ["--welcome-subtitle", "preConnectSubText"],
  ["--canvas-bg", "chatBg"],
  ["--card-bg", "welcomeBg"],
  ["--card-title", "welcomeText"],
  ["--card-body", "welcomeBodyText"],
  ["--botmsg-bg", "botBubbleBg"],
  ["--botmsg-text", "botBubbleText"],
  ["--botmsg-name", "botNameColor"],
  ["--input-toolbar", "inputAreaBg"],
  ["--input-field", "inputBg"],
  ["--input-send", "sendBtnBg"],
  ["--input-text", "inputText"],
  ["--input-placeholder", "inputPlaceholder"],
  ["--input-border", "inputAreaBorder"],
  ["--launcher-bg", "launcherBg"],
  ["--launcher-icon", "launcherIconColor"],
  ["--hint-bg", "hintBubbleBg"],
  ["--hint-text", "hintBubbleText"],
];
const LOCALE_MAP = { en: "en-US", zh: "zh-TW", ja: "ja-JP" };

function extractFirstHex(value) {
  if (!value) return null;
  const m = String(value).match(/#[0-9a-fA-F]{6}\b/);
  return m ? m[0] : null;
}

function buildWidgetColors(theme, existing) {
  const merged = { ...(existing && typeof existing === "object" ? existing : {}) };
  for (const [siteChatKey, ebKey] of COLOR_KEY_MAP) {
    const raw = theme?.[siteChatKey];
    if (!raw) continue;
    const hex = siteChatKey === "--welcome-bg" ? extractFirstHex(raw) : (/^#[0-9a-fA-F]{6}$/.test(raw) ? raw : null);
    if (hex) merged[ebKey] = hex;
  }
  return merged;
}

function buildLocaleDict(perLang, existing) {
  const merged = existing && typeof existing === "object" ? { ...existing } : {};
  if (perLang) {
    for (const [siteChatLang, ebLocale] of Object.entries(LOCALE_MAP)) {
      if (perLang[siteChatLang]) merged[ebLocale] = perLang[siteChatLang];
    }
  }
  return merged;
}

function asObjectOrEmpty(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

async function supaFetch(path, init = {}) {
  const res = await fetch(`${SUPA_URL}${path}`, { ...init, headers: { ...supaHeaders, ...(init.headers || {}) } });
  return res;
}

// 把逾時卡住的 processing 任務退回 pending（agent 中途當掉的保險）。
async function reclaimStaleJobs() {
  const cutoff = new Date(Date.now() - STALE_PROCESSING_MS).toISOString();
  const res = await supaFetch(
    `/rest/v1/sitechat_ebconsole_pushes?status=eq.processing&claimed_at=lt.${encodeURIComponent(cutoff)}`,
    { method: "PATCH", headers: { Prefer: "return=representation" }, body: JSON.stringify({ status: "pending", claimed_at: null }) }
  );
  if (res.ok) {
    const rows = await res.json().catch(() => []);
    if (rows.length) console.log(`[reclaim] ${rows.length} 筆卡住的 processing 任務退回 pending`);
  }
}

// 認領最舊的一筆 pending 任務；用 status=eq.pending 當 WHERE 條件做原子更新，
// 回傳陣列非空才代表真的搶到（就算之後多開一台 agent 也不會搶同一筆）。
async function claimNextJob() {
  const listRes = await supaFetch(`/rest/v1/sitechat_ebconsole_pushes?status=eq.pending&order=pushed_at.asc&limit=1&select=id,project_id`);
  const candidates = await listRes.json().catch(() => []);
  if (!candidates.length) return null;
  const job = candidates[0];
  const claimRes = await supaFetch(
    `/rest/v1/sitechat_ebconsole_pushes?id=eq.${job.id}&status=eq.pending`,
    { method: "PATCH", headers: { Prefer: "return=representation" }, body: JSON.stringify({ status: "processing", claimed_at: new Date().toISOString() }) }
  );
  const claimed = await claimRes.json().catch(() => []);
  return claimed.length ? claimed[0] : null;
}

async function finishJob(id, status, payload, response) {
  await supaFetch(`/rest/v1/sitechat_ebconsole_pushes?id=eq.${id}`, {
    method: "PATCH",
    body: JSON.stringify({ status, payload: payload ?? {}, response: response ?? "" }),
  });
}

// 網路層失敗（fetch 直接丟例外）→ 退回 pending，讓下一輪自動重試；不寫死 error。
async function revertToPending(id) {
  await supaFetch(`/rest/v1/sitechat_ebconsole_pushes?id=eq.${id}`, {
    method: "PATCH",
    body: JSON.stringify({ status: "pending", claimed_at: null }),
  });
}

async function processJob(job) {
  const projectId = job.project_id;
  console.log(`[process] 開始處理 project_id=${projectId}`);

  const [projRes, settingsRes] = await Promise.all([
    supaFetch(`/rest/v1/projects?id=eq.${projectId}&select=hotel_id`),
    supaFetch(`/rest/v1/sitechat_settings?project_id=eq.${projectId}&select=bot_name,bot_icon_url,theme,greeting`),
  ]);
  const projRows = await projRes.json().catch(() => []);
  const settingsRows = await settingsRes.json().catch(() => []);
  const hotelId = projRows?.[0]?.hotel_id ?? "";
  const settings = settingsRows?.[0];

  if (!hotelId) return finishJob(job.id, "error", null, "這個專案還沒填 Hotel ID，無法對應 eb-console 的 kms_org_name");
  if (!settings) return finishJob(job.id, "error", null, "這個專案還沒有 SiteChat 設定可以推送");

  const kmsOrgName = hotelId;
  let getRes;
  try {
    getRes = await fetch(`${EB_ADMIN_BASE}/api/admin/settings/by-kms-org?kms_org_name=${encodeURIComponent(kmsOrgName)}`, {
      headers: { "X-API-Key": EB_ADMIN_API_KEY },
    });
  } catch (e) {
    console.warn(`[process] GET eb-admin 網路層失敗（${e.message}），退回 pending 等下一輪重試`);
    return revertToPending(job.id);
  }

  if (getRes.status === 404) return finishJob(job.id, "error", null, `eb-console 找不到 kms_org_name = "${kmsOrgName}" 對應的組織`);
  if (!getRes.ok) return finishJob(job.id, "error", null, `GET by-kms-org 失敗：HTTP ${getRes.status}`);
  const current = await getRes.json().catch(() => ({}));

  const botNamePerLang = settings.bot_name && typeof settings.bot_name === "object" ? settings.bot_name : {};
  const greeting = settings.greeting && typeof settings.greeting === "object" ? settings.greeting : {};
  const welcomePerLang = {};
  const hintPerLang = {};
  for (const lang of Object.keys(LOCALE_MAP)) {
    if (greeting[lang]?.welcome) welcomePerLang[lang] = greeting[lang].welcome;
    if (greeting[lang]?.hint) hintPerLang[lang] = greeting[lang].hint;
  }

  const payload = {
    kms_org_name: kmsOrgName,
    bot_name: buildLocaleDict(botNamePerLang, asObjectOrEmpty(current.bot_name)),
    welcome_message: buildLocaleDict(welcomePerLang, asObjectOrEmpty(current.welcome_message)),
    widget_hint_text: buildLocaleDict(hintPerLang, asObjectOrEmpty(current.widget_hint_text)),
    widget_custom_colors: buildWidgetColors(settings.theme ?? {}, asObjectOrEmpty(current.widget_custom_colors)),
  };
  if (settings.bot_icon_url) payload.bot_icon_url = settings.bot_icon_url;
  else if (typeof current.bot_icon_url === "string") payload.bot_icon_url = current.bot_icon_url;

  let postRes;
  try {
    postRes = await fetch(`${EB_ADMIN_BASE}/api/admin/settings/by-kms-org`, {
      method: "POST",
      headers: { "X-API-Key": EB_ADMIN_API_KEY, "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  } catch (e) {
    console.warn(`[process] POST eb-admin 網路層失敗（${e.message}），退回 pending 等下一輪重試`);
    return revertToPending(job.id);
  }
  const postBody = await postRes.text();

  if (!postRes.ok) return finishJob(job.id, "error", payload, `HTTP ${postRes.status}: ${postBody}`);

  console.log(`[process] project_id=${projectId} 推送成功`);
  return finishJob(job.id, "success", payload, postBody);
}

async function pollOnce() {
  try {
    await reclaimStaleJobs();
    const job = await claimNextJob();
    if (job) await processJob(job);
  } catch (e) {
    console.error("[poll] 未預期錯誤，本輪跳過：", e);
  }
}

async function main() {
  console.log(`ebconsole-push-agent 啟動，每 ${POLL_INTERVAL_MS}ms 輪詢一次，Ctrl+C 停止`);
  // eslint-disable-next-line no-constant-condition
  while (true) {
    await pollOnce();
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
  }
}

main();
