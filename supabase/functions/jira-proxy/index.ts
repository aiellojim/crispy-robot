// supabase/functions/jira-proxy/index.ts
// 部署指令：supabase functions deploy jira-proxy

const JIRA_BASE   = Deno.env.get("JIRA_BASE_URL")!;
const JIRA_EMAIL  = Deno.env.get("JIRA_EMAIL")!;
const JIRA_TOKEN  = Deno.env.get("JIRA_API_TOKEN")!;

const corsHeaders = {
  "Access-Control-Allow-Origin":  "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, x-user-token",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const url    = new URL(req.url);
  const action = url.searchParams.get("action");

  // ── 解析使用者身份，查詢個人 Jira credentials ─────────────────
  const userToken   = req.headers.get("x-user-token");
  let effectiveEmail = JIRA_EMAIL;
  let effectiveToken = JIRA_TOKEN;
  let currentUserId: string | null = null;
  let currentUserName: string | null = null;

  if (userToken) {
    const SUPA_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPA_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    try {
      const userRes = await fetch(`${SUPA_URL}/auth/v1/user`, {
        headers: { Authorization: `Bearer ${userToken}`, apikey: SUPA_KEY },
      });
      if (userRes.ok) {
        const userData = await userRes.json();
        currentUserId = userData.id;
        const profileRes = await fetch(
          `${SUPA_URL}/rest/v1/user_profiles?id=eq.${currentUserId}&select=jira_email,jira_token,display_name`,
          { headers: { Authorization: `Bearer ${SUPA_KEY}`, apikey: SUPA_KEY } }
        );
        if (profileRes.ok) {
          const profiles = await profileRes.json();
          const p = profiles[0];
          if (p?.jira_email && p?.jira_token) {
            effectiveEmail = p.jira_email;
            effectiveToken = p.jira_token;
          }
          currentUserName = p?.display_name ?? null;
        }
      }
    } catch (_) { /* fallback to env var */ }
  }

  const authHeader = "Basic " + btoa(`${effectiveEmail.trim()}:${effectiveToken.trim()}`);

  // credentials 缺失時提早回傳清楚的錯誤
  if (!effectiveEmail || !effectiveToken) {
    return new Response(JSON.stringify({ error: "Missing Jira credentials. Please set JIRA_EMAIL and JIRA_API_TOKEN secrets, or fill in your personal Jira token in settings." }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // ── GET /issues?epicId=AHP-123 ─────────────────────────────────────────────
  // 取得 Epic 底下所有子任務
  if (req.method === "GET" && action === "issues") {
    const epicId = url.searchParams.get("epicId");
    if (!epicId) {
      return new Response(JSON.stringify({ error: "epicId required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // JQL: 只用 parent 查詢，避免 "Epic Link" 在新版 Jira 觸發 410
    const jql    = `parent = ${epicId} ORDER BY created ASC`;
    const fields = ["summary","status","assignee","issuetype","priority"];
    const apiUrl = `${JIRA_BASE}/rest/api/3/search/jql`;

    const res = await fetch(apiUrl, {
      method: "POST",
      headers: { Authorization: authHeader, Accept: "application/json", "Content-Type": "application/json" },
      body: JSON.stringify({ jql, fields, maxResults: 100 }),
    });
    const data = await res.json();

    if (!res.ok) {
      // 永遠回傳 200，把 Jira 錯誤包在 body 裡，避免前端因 4xx/5xx 無法讀取
      return new Response(JSON.stringify({ error: data }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 整理回傳格式
    const issues = (data.issues ?? []).map((issue: any) => ({
      id:       issue.id,
      key:      issue.key,
      summary:  issue.fields.summary,
      status:   issue.fields.status?.name ?? "",
      statusCategory: issue.fields.status?.statusCategory?.key ?? "new",
      assignee: issue.fields.assignee?.displayName ?? null,
      type:     issue.fields.issuetype?.name ?? "",
    }));

    return new Response(JSON.stringify({ issues }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // ── GET /transitions?issueKey=AHP-456 ─────────────────────────────────────
  // 取得某 issue 可用的狀態轉換清單
  if (req.method === "GET" && action === "transitions") {
    const issueKey = url.searchParams.get("issueKey");
    if (!issueKey) {
      return new Response(JSON.stringify({ error: "issueKey required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const res  = await fetch(`${JIRA_BASE}/rest/api/3/issue/${issueKey}/transitions`, {
      headers: { Authorization: authHeader, Accept: "application/json" },
    });
    const data = await res.json();

    const transitions = (data.transitions ?? []).map((t: any) => ({
      id:             t.id,
      name:           t.to?.name ?? t.name,
      statusCategory: t.to?.statusCategory?.key ?? "new",
    }));

    return new Response(JSON.stringify({ transitions }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  if (req.method === "POST" && action === "transition") {
    const { issueKey, transitionId, fromStatus, toStatus, projectId } = await req.json();
    if (!issueKey || !transitionId) {
      return new Response(JSON.stringify({ error: "issueKey and transitionId required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const res = await fetch(`${JIRA_BASE}/rest/api/3/issue/${issueKey}/transitions`, {
      method:  "POST",
      headers: {
        Authorization:  authHeader,
        "Content-Type": "application/json",
        Accept:         "application/json",
      },
      body: JSON.stringify({ transition: { id: transitionId } }),
    });

    if (res.status === 204 || res.ok) {
      // 非同步寫入 action log（不阻塞回應）
      if (currentUserId) {
        const SUPA_URL = Deno.env.get("SUPABASE_URL")!;
        const SUPA_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
        fetch(`${SUPA_URL}/rest/v1/jira_action_log`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${SUPA_KEY}`,
            apikey: SUPA_KEY,
            "Content-Type": "application/json",
            Prefer: "return=minimal",
          },
          body: JSON.stringify({
            user_id:      currentUserId,
            display_name: currentUserName,
            issue_key:    issueKey,
            from_status:  fromStatus  ?? null,
            to_status:    toStatus    ?? null,
            project_id:   projectId   ?? null,
          }),
        }).catch(() => {});
      }
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const err = await res.json().catch(() => ({}));
    return new Response(JSON.stringify({ error: err }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // ── POST /updateDescription ────────────────────────────────────────────────
  // 在 Epic description 後附加儀表板專案資訊表格（ADF 格式）
  if (req.method === "POST" && action === "updateDescription") {
    const { epicId, hotelName, hotelId, products, integrations, avaUnits, avaSpare, avtUnits } = await req.json();
    if (!epicId) {
      return new Response(JSON.stringify({ error: "epicId required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 先取得現有 description
    const getRes = await fetch(`${JIRA_BASE}/rest/api/3/issue/${epicId}?fields=description`, {
      headers: { Authorization: authHeader, Accept: "application/json" },
    });
    const getData = await getRes.json();
    const existingDesc = getData.fields?.description ?? null;

    // 建立 ADF 表格
    const makeCell = (text: string, isHeader = false) => ({
      type: isHeader ? "tableHeader" : "tableCell",
      attrs: {},
      content: [{ type: "paragraph", content: [{ type: "text", text: text || "—" }] }],
    });

    const makeRow = (cells: any[]) => ({ type: "tableRow", content: cells });

    const rows = [
      makeRow([makeCell("欄位", true), makeCell("內容", true)]),
      makeRow([makeCell("飯店名稱"), makeCell(hotelName || "—")]),
      makeRow([makeCell("Hotel ID"),  makeCell(hotelId   || "—")]),
      makeRow([makeCell("購置產品"),  makeCell((products     ?? []).join("・") || "—")]),
      makeRow([makeCell("串接功能"),  makeCell((integrations ?? []).join("・") || "—")]),
    ];

    // 只有 AVA 存在才加台數列
    if ((products ?? []).includes("AVA")) {
      rows.push(makeRow([makeCell("AVA 裝機台數"), makeCell(avaUnits ? `${avaUnits} 台` : "—")]));
      rows.push(makeRow([makeCell("AVA 備品台數"), makeCell(avaSpare ? `${avaSpare} 台` : "—")]));
    }
    if ((products ?? []).includes("AVT")) {
      rows.push(makeRow([makeCell("AVT 裝機台數"), makeCell(avtUnits ? `${avtUnits} 台` : "—")]));
    }

    const table = {
      type: "table",
      attrs: { isNumberColumnEnabled: false, layout: "default" },
      content: rows,
    };

    const ANCHOR_TEXT = "儀表板專案資訊";
    const existingContent: any[] = existingDesc?.content ?? [];

    // 找到錨點 heading 的位置
    const anchorIndex = existingContent.findIndex(
      (node: any) =>
        node.type === "heading" &&
        node.content?.some((c: any) => c.type === "text" && c.text === ANCHOR_TEXT)
    );

    let newContent: any[];

    if (anchorIndex !== -1) {
      // 錨點已存在 → 找 heading 後緊接的 table 節點並只替換它，其餘節點全部保留
      const tableIndex = anchorIndex + 1 < existingContent.length &&
        existingContent[anchorIndex + 1].type === "table"
          ? anchorIndex + 1
          : -1;

      if (tableIndex !== -1) {
        // 只換 table，heading 前後的內容完整保留
        newContent = [
          ...existingContent.slice(0, tableIndex),
          table,
          ...existingContent.slice(tableIndex + 1),
        ];
      } else {
        // heading 後面沒有緊接 table（格式異常）→ 在 heading 後插入 table
        newContent = [
          ...existingContent.slice(0, anchorIndex + 1),
          table,
          ...existingContent.slice(anchorIndex + 1),
        ];
      }
    } else {
      // 錨點不存在 → 在現有內容後新增空行 + heading + table
      newContent = [
        ...existingContent,
        { type: "paragraph", content: [{ type: "text", text: " " }] },
        { type: "heading", attrs: { level: 3 }, content: [{ type: "text", text: ANCHOR_TEXT }] },
        table,
      ];
    }

    const putRes = await fetch(`${JIRA_BASE}/rest/api/3/issue/${epicId}`, {
      method: "PUT",
      headers: {
        Authorization:  authHeader,
        "Content-Type": "application/json",
        Accept:         "application/json",
      },
      body: JSON.stringify({
        fields: {
          description: { type: "doc", version: 1, content: newContent },
        },
      }),
    });

    if (putRes.status === 204 || putRes.ok) {
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const putErr = await putRes.json().catch(() => ({}));
    return new Response(JSON.stringify({ error: putErr }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // ── GET /searchUser?query=DisplayName ────────────────────────────────────
  // 依顯示名稱搜尋 Jira 使用者，回傳 accountId
  if (req.method === "GET" && action === "searchUser") {
    const query = url.searchParams.get("query");
    if (!query) {
      return new Response(JSON.stringify({ error: "query required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const res = await fetch(
      `${JIRA_BASE}/rest/api/3/user/search?query=${encodeURIComponent(query)}&maxResults=10`,
      { headers: { Authorization: authHeader, Accept: "application/json" } }
    );
    const data = await res.json();
    if (!res.ok) {
      return new Response(JSON.stringify({ error: data }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const users = (Array.isArray(data) ? data : []).map((u: any) => ({
      accountId:   u.accountId,
      displayName: u.displayName,
    }));
    return new Response(JSON.stringify({ users }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // ── GET /getIssueTypes ────────────────────────────────────────────────────
  // 取得 AHP 專案可用的 issue type 清單（從 project endpoint 取）
  if (req.method === "GET" && action === "getIssueTypes") {
    const res = await fetch(`${JIRA_BASE}/rest/api/3/project/AHP`, {
      headers: { Authorization: authHeader, Accept: "application/json" },
    });
    const data = await res.json();
    if (!res.ok) {
      return new Response(JSON.stringify({ error: data }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const types = (data.issueTypes ?? []).map((t: any) => ({
      id:   t.id,
      name: t.name,
    }));
    return new Response(JSON.stringify({ types }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // ── POST /createEpic ──────────────────────────────────────────────────────
  if (req.method === "POST" && action === "createEpic") {
    const { hotelName, reporterAccountId } = await req.json();
    if (!hotelName) {
      return new Response(JSON.stringify({ error: "hotelName required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const epicFields: any = {
      project:           { key: "AHP" },
      summary:           hotelName,
      issuetype:         { name: "Epic" },
      customfield_10011: hotelName,
    };
    if (reporterAccountId) epicFields.reporter = { accountId: reporterAccountId };

    const res = await fetch(`${JIRA_BASE}/rest/api/3/issue`, {
      method: "POST",
      headers: { Authorization: authHeader, "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ fields: epicFields }),
    });
    const data = await res.json();
    if (!res.ok) {
      return new Response(JSON.stringify({ error: data }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    return new Response(JSON.stringify({
      epicKey: data.key,
      epicUrl: `${JIRA_BASE}/browse/${data.key}`,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  // ── POST /createTasks ─────────────────────────────────────────────────────
  // issueTypeName：由前端查 getIssueTypes 後傳入正確名稱
  if (req.method === "POST" && action === "createTasks") {
    const { epicKey, hotelName, issueTypeName, reporterAccountId, products } = await req.json();
    if (!epicKey || !hotelName || !issueTypeName) {
      return new Response(JSON.stringify({ error: "epicKey, hotelName and issueTypeName required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const MKT  = "712020:fa956668-e333-44c6-861f-bb0f050bccc7";
    const ALAN = "5d6e20bb8f0aa30dba0b02d7";

    const TEMPLATES: Record<string, { s: string; a?: string }[]> = {
      AVA: [
      { s: "(TAC)({{N}}) Portal Creation (建立)" },
      { s: "(TAC) {{N}} (Portal) Room number creation(房間建立)" },
      { s: "(BE) {{N}} (Portal) Amenity list import(備品匯入)" },
      { s: "(PJM) {{N}} (Portal) Account application(帳號申請)" },
      { s: "(PJM) {{N}} (Portal) TMS Pro Plan enable(方案啟動)" },
      { s: "(TSC) {{N}} (Portal) TMS Pro Space Creation(空間建立) (Max:100)" },
      { s: "(PJM) {{N}} (Staff app) function enable(功能啟動)" },
      { s: "(TAC) {{N}} (Telegram) Telegram setting(Telegram設定) (Don't support)" },
      { s: "(PJM) {{N}} (AVA) UI language setting(UI語言設定)" },
      { s: "(PJM) {{N}} (AVA) Wake up word setting(喚醒詞設定)" },
      { s: "(PJM) {{N}} (AVA) Music function setting(音樂功能設定) (BT Music)" },
      { s: "(PJM) {{N}} (AVA) Button ICON setting(按鍵ICON設定)" },
      { s: "(TAC) {{N}} (AVA) Welcome message(歡迎詞)" },
      { s: "(PJM) {{N}} (AVA) Welcome screen setting(歡迎畫面設定)" },
      { s: "(TAC) {{N}} (AVA) FAQ import(FAQ匯入) (Default)" },
      { s: "(PJM) {{N}} (AVA) Amenity list import(備品清單匯入)" },
      { s: "(PJM) {{N}} (AVA) Surrounding import(周邊匯入)" },
      { s: "(MKT) {{N}} (IC) Introduction Card Preparation(小卡準備) (Aiello)", a: MKT },
      { s: "(CS) {{N}} (IC) Introduction Card Voice Command Preparation(小卡語音指令準備) (Aiello)" },
      { s: "(PJM) {{N}} (AVA) Portal task support setting(後台任務支援設定)" },
      { s: "(PJM) {{N}} (AVA) DND/MUR.UI setting(DND/MUR.UI設定)" },
      { s: "(TAC) {{N}} (AVA) DND/MUR.Service setting(DND/MUR.Service setting)" },
      { s: "(PJM) {{N}} (AVA) Showcase setting(Showcase設定)" },
      { s: "(PJM) {{N}} (AVA) Promotion.setting(Promotion.設定) (Max:" },
      { s: "(PJM) {{N}} (AVA) Simple card view setting(圖文展示設定)" },
      { s: "(PJM) {{N}} (AVA) Amenity Button content setting(備品按鈕內容設定)" },
      { s: "(PJM) {{N}} (AVA) Repair Button content setting(維修按鈕內容設定)" },
      { s: "(PJM) {{N}} (AVA) Amenity Button UI setting(備品按鈕UI設定)" },
      { s: "(PJM) {{N}} (AVA) Repair Button UI setting(維修按鈕UI設定)" },
      { s: "(PJM) {{N}} (AVA) Pop-up QR code setting.NLU(Pop-up QR code 設定.NLU) (Max:" },
      { s: "(TSC) {{N}} (AVA) Pop-up QR code setting.APK(Pop-up QR code 設定.APK) (Max:" },
      { s: "(PJM) {{N}} (AVA) Pop-up QR code setting.UI(Pop-up QR code 設定.UI) (Max:" },
      { s: "(TAC) {{N}} (AVA) Auto screen off time customize setting(自動關屏時間自定義設置)" },
      { s: "(TAC) {{N}} (AVA) Auto check out setting(自動重啟設定)" },
      { s: "(TAC) {{N}} (AVA) WiFI config(WiFI 配置)" },
      { s: "(PJM) {{N}} (AVA) Device Shipping(裝置出貨)" },
      { s: "(PJM) {{N}} (AVA) Adapter Plug Shipping(變壓器插腳出貨)", a: ALAN },
      { s: "(PJM) {{N}} (AVA) Shipment S/N Providing(Overseas)(海外AVA出貨序號提供)", a: ALAN },
      { s: "(TSC) {{N}} (AVA) Phone(PBX) integration(Phone(PBX)對接)" },
      { s: "(PJM) {{N}} (AVA) Phone Button UI & Service setting(通話按鈕UI&服務設定)" },
      { s: "(TSC) {{N}} (AVA) Phone shortcut button setting(電話快捷鍵設定)" },
      { s: "(TSC) {{N}} (AVA) IPTV Integration(TV對接) (Don't support)" },
      { s: "(PJM) {{N}} (AVA) FAQ-TV channel import(FAQ-電視頻道表匯入) (Don't support)" },
      { s: "(TSC) {{N}} (AVA) RCU integration(RCU對接)" },
      { s: "(TAC) {{N}} (AVA) IOT Ctrl button language setting(IOT控制按鈕設定)" },
      { s: "(TSC) {{N}} (Portal) PMS integration(PMS對接)" },
      { s: "(TSC) {{N}} (Portal) TMS integration(TMS對接) (Don't support)" },
      { s: "(TSC) {{N}} (Portal) Others integration(PMS對接)" },
      { s: "(PJM) {{N}} (Doc) Acceptance Form/Training/Delivery Note(驗收單/教育訓練/交貨單)" },
      { s: "(PJM) {{N}} (Doc) Customized Customer Specification Table Update(客製客規表更新)" },
      { s: "(PJM) {{N}} (Doc) Acceptance Form Update(驗收單更新)" },
      ],
      ACA: [
        { s: "(TAC)({{N}}) Portal Creation (建立)" },
        { s: "(BE)({{N}}) ACA 基礎設定 (測試用分機)" },
        { s: "(BE)({{N}}) ACA 語音開單設定 (POC)" },
        { s: "(BE)({{N}}) KMS 使用者權限設定" },
        { s: "(BE)({{N}}) 新增測試分機" },
      ],
    };

    const created: string[] = [];
    const PRODUCT_ORDER = ["AVA", "AVT", "ACA", "TMSP", "GW", "KMS"];
    const productList: string[] = (Array.isArray(products) && products.length > 0 ? products : ["AVA"])
      .slice()
      .sort((a: string, b: string) => {
        const ai = PRODUCT_ORDER.indexOf(a);
        const bi = PRODUCT_ORDER.indexOf(b);
        return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi);
      });
    const seen = new Set<string>();
    const tasksToCreate = productList
      .flatMap((p: string) => TEMPLATES[p] ?? [])
      .filter((t: { s: string; a?: string }) => {
        if (seen.has(t.s)) return false;
        seen.add(t.s);
        return true;
      });

    const failed: { summary: string; msg: any }[] = [];

    for (const tmpl of tasksToCreate) {
      const summary = tmpl.s.replace(/\{\{N\}\}/g, hotelName);
      const fields: any = {
        project:          { key: "AHP" },
        summary,
        issuetype:        { name: issueTypeName },
        customfield_10014: epicKey,
      };
      if (tmpl.a) fields.assignee = { accountId: tmpl.a };
      if (reporterAccountId) fields.reporter = { accountId: reporterAccountId };

      const r = await fetch(`${JIRA_BASE}/rest/api/3/issue`, {
        method: "POST",
        headers: { Authorization: authHeader, "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ fields }),
      });
      const d = await r.json();
      if (r.ok) {
        created.push(d.key);
      } else {
        failed.push({ summary, msg: d?.errors ?? d?.errorMessages ?? d });
      }
    }

    return new Response(JSON.stringify({
      created: created.length,
      total: tasksToCreate.length,
      failed,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  return new Response(JSON.stringify({ error: "unknown action" }), {
    status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
