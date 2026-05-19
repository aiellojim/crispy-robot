// supabase/functions/send-email/index.ts
// 部署指令：supabase functions deploy send-email
// 每日 UTC 01:00（台灣 09:00）由 pg_cron 觸發
// 提醒對象與時機：沿用前端「通知設定」的 subscribed_projects 和 notify_days_before
// 涵蓋：專案到期日（第一批、第二批、上線日）+ 任務截止日 / 週期開始與結束

const RESEND_KEY = Deno.env.get("RESEND_API_KEY")!;
const SUPA_URL   = Deno.env.get("SUPABASE_URL")!;
const SUPA_KEY   = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const DASHBOARD  = "https://hotel-dashboard-aiellojims-projects.vercel.app";
const FROM       = "Aiello 儀表板 <onboarding@resend.dev>"; // 測試用；正式換成 dashboard@aiello.ai

const corsHeaders = {
  "Access-Control-Allow-Origin":  "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

async function supaFetch(path: string) {
  const res = await fetch(`${SUPA_URL}${path}`, {
    headers: { Authorization: `Bearer ${SUPA_KEY}`, apikey: SUPA_KEY },
  });
  return res.json();
}

async function sendEmail(to: string, subject: string, html: string) {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${RESEND_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: FROM, to: [to], subject, html }),
  });
  return { ok: res.ok, data: await res.json() };
}

function emailHtml(projectName: string, type: string, date: string, daysLeft: number) {
  const urgency = daysLeft === 0 ? "今天到期" : `還有 ${daysLeft} 天到期`;
  const color   = daysLeft === 0 ? "#DC2626" : daysLeft === 1 ? "#B45309" : "#5E6AD2";
  const icon    = daysLeft === 0 ? "⚠️" : "📅";
  return `<!DOCTYPE html>
<html lang="zh-TW">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#F5F5F5;font-family:'Noto Sans TC',sans-serif;">
  <div style="max-width:520px;margin:40px auto;background:#fff;border-radius:12px;overflow:hidden;border:1px solid #E5E5E5;">
    <div style="background:#5E6AD2;padding:24px 32px;">
      <p style="margin:0;color:#fff;font-size:12px;opacity:0.75;letter-spacing:1px;text-transform:uppercase;">Aiello 專案交付中心</p>
      <h1 style="margin:8px 0 0;color:#fff;font-size:20px;font-weight:700;">${icon} ${type}提醒</h1>
    </div>
    <div style="padding:28px 32px;">
      <p style="margin:0 0 16px;font-size:15px;color:#111;line-height:1.7;">
        <strong>${projectName}</strong> 的 <strong>${type}</strong>
        <strong style="color:${color};"> ${urgency}</strong>。
      </p>
      <div style="background:#F5F5F5;border-radius:8px;padding:14px 18px;margin-bottom:24px;">
        <p style="margin:0;font-size:12px;color:#6B6B6B;letter-spacing:0.5px;">日期</p>
        <p style="margin:4px 0 0;font-size:20px;font-weight:700;color:#111;font-family:monospace;">${date}</p>
      </div>
      <a href="${DASHBOARD}" style="display:inline-block;padding:11px 22px;background:#5E6AD2;color:#fff;border-radius:8px;text-decoration:none;font-size:14px;font-weight:600;">前往儀表板 →</a>
    </div>
    <div style="padding:14px 32px;border-top:1px solid #E5E5E5;font-size:11px;color:#A3A3A3;">
      此通知依你在儀表板設定的提醒偏好自動發送。如要調整，請至儀表板「🔔 通知設定」。
    </div>
  </div>
</body>
</html>`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // ── 並行取得所有資料 ──────────────────────────────────────
    const [subscriptions, projects, tasks, profiles, authData] = await Promise.all([
      supaFetch("/rest/v1/push_subscriptions?select=*"),
      supaFetch("/rest/v1/projects?select=*"),
      supaFetch("/rest/v1/tasks?select=*"),
      supaFetch("/rest/v1/user_profiles?select=*"),
      supaFetch("/auth/v1/admin/users?per_page=1000"),
    ]);
    const authUsers: any[] = authData.users ?? [];

    const sent:    { sub: string; project: string; type: string; to: string }[] = [];
    const errors:  { sub: string; project: string; type: string; error: any  }[] = [];
    const skipped: string[] = [];

    for (const sub of subscriptions) {
      if (!sub.subscribed_projects?.length) continue;
      const daysBeforePref: number = sub.notify_days_before ?? 0;

      // ── 查找使用者 email ──────────────────────────────────
      let recipientEmail: string | null = null;
      if (sub.user_id) {
        const profile = profiles.find((p: any) => p.id === sub.user_id);
        recipientEmail = profile?.jira_email || null;
        if (!recipientEmail) {
          const au = authUsers.find((u: any) => u.id === sub.user_id);
          recipientEmail = au?.email ?? null;
        }
      }
      if (!recipientEmail && sub.pic_name) {
        const profile = profiles.find((p: any) => p.display_name === sub.pic_name);
        if (profile) {
          recipientEmail = profile.jira_email || null;
          if (!recipientEmail) {
            const au = authUsers.find((u: any) => u.id === profile.id);
            recipientEmail = au?.email ?? null;
          }
        }
      }
      if (!recipientEmail) {
        skipped.push(`${sub.pic_name || sub.id}（找不到 email）`);
        continue;
      }

      // ── 掃描已訂閱的專案 ──────────────────────────────────
      for (const projectId of sub.subscribed_projects) {
        const project = projects.find((p: any) => p.id === projectId);
        if (!project) continue;

        // 專案層級到期日
        const deadlines: { date: string; type: string }[] = [
          { date: project.batch1_deadline, type: "第一批資料期限" },
          { date: project.batch2_deadline, type: "第二批資料期限" },
          { date: project.launch_date,     type: "上線日" },
        ].filter(d => !!d.date);

        // 任務層級日期
        const projectTasks = (tasks as any[]).filter(t => t.project_id === projectId);
        for (const task of projectTasks) {
          if (!task.name) continue;
          if (task.type === "deadline" && task.deadline) {
            deadlines.push({ date: task.deadline, type: `任務：${task.name}` });
          }
          if (task.type === "period") {
            if (task.period_start) deadlines.push({ date: task.period_start, type: `任務開始：${task.name}` });
            if (task.period_end)   deadlines.push({ date: task.period_end,   type: `任務結束：${task.name}` });
          }
        }

        // ── 比對提醒條件並寄信 ────────────────────────────
        for (const { date, type } of deadlines) {
          const daysLeft = Math.ceil((new Date(date).getTime() - today.getTime()) / 86400000);
          if (daysLeft !== daysBeforePref) continue;

          const subject = daysLeft === 0
            ? `⚠️ 今天到期：${project.name} ${type}`
            : `📅 提醒：${project.name} ${type} 還有 ${daysLeft} 天`;

          const result = await sendEmail(recipientEmail, subject, emailHtml(project.name, type, date, daysLeft));
          if (result.ok) {
            sent.push({ sub: sub.pic_name || sub.id, project: project.name, type, to: recipientEmail });
          } else {
            errors.push({ sub: sub.pic_name || sub.id, project: project.name, type, error: result.data });
          }
        }
      }
    }

    return new Response(
      JSON.stringify({
        sent: sent.length, errors: errors.length, skipped: skipped.length,
        detail: { sent, errors, skipped },
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({ error: err.message ?? String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
