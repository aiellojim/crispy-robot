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

    // JQL: 找到屬於此 Epic 的所有 issue
    const jql      = encodeURIComponent(`"Epic Link" = ${epicId} OR parent = ${epicId} ORDER BY created ASC`);
    const fields   = "summary,status,assignee,issuetype,priority";
    const apiUrl   = `${JIRA_BASE}/rest/api/3/search?jql=${jql}&fields=${fields}&maxResults=100`;

    const res = await fetch(apiUrl, {
      headers: { Authorization: authHeader, Accept: "application/json" },
    });
    const data = await res.json();

    if (!res.ok) {
      return new Response(JSON.stringify({ error: data }), {
        status: res.status, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 整理回傳格式
    const issues = (data.issues ?? []).map((issue: any) => ({
      id:       issue.id,
      key:      issue.key,
      summary:  issue.fields.summary,
      status:   issue.fields.status?.name ?? "",
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
      id:   t.id,
      name: t.to?.name ?? t.name,
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
      status: res.status, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  return new Response(JSON.stringify({ error: "unknown action" }), {
    status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
