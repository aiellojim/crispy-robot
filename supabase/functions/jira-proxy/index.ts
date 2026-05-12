// supabase/functions/jira-proxy/index.ts
// 部署指令：supabase functions deploy jira-proxy

const JIRA_BASE   = Deno.env.get("JIRA_BASE_URL")!;   // https://aiello-eng.atlassian.net
const JIRA_EMAIL  = Deno.env.get("JIRA_EMAIL")!;       // jim@aiello.ai
const JIRA_TOKEN  = Deno.env.get("JIRA_API_TOKEN")!;   // ATATT3x...

const authHeader = "Basic " + btoa(`${JIRA_EMAIL}:${JIRA_TOKEN}`);

const corsHeaders = {
  "Access-Control-Allow-Origin":  "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const url    = new URL(req.url);
  const action = url.searchParams.get("action");

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

  // ── POST /transition ───────────────────────────────────────────────────────
  // 執行狀態轉換
  if (req.method === "POST" && action === "transition") {
    const { issueKey, transitionId } = await req.json();
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

    // Jira transition 成功回傳 204 No Content
    if (res.status === 204 || res.ok) {
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
    const { epicId, hotelName, hotelId, products, integrations, avaUnits, avaSpare } = await req.json();
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

    const table = {
      type: "table",
      attrs: { isNumberColumnEnabled: false, layout: "default" },
      content: rows,
    };

    // 附加到現有 description 後面
    const existingContent = existingDesc?.content ?? [];
    const newContent = [
      ...existingContent,
      { type: "paragraph", content: [{ type: "text", text: " " }] }, // 空行分隔
      { type: "heading", attrs: { level: 3 }, content: [{ type: "text", text: "儀表板專案資訊" }] },
      table,
    ];

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

  return new Response(JSON.stringify({ error: "unknown action" }), {
    status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
