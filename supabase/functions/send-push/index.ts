// supabase/functions/send-push/index.ts
// 部署指令：supabase functions deploy send-push

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL      = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const VAPID_PUBLIC_KEY  = Deno.env.get("VAPID_PUBLIC_KEY")!;
const VAPID_PRIVATE_KEY = Deno.env.get("VAPID_PRIVATE_KEY")!;
const VAPID_MAILTO      = Deno.env.get("VAPID_MAILTO")!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// ── helpers ────────────────────────────────────────────────────────────────
function b64uDecode(str: string): Uint8Array {
  const pad = "=".repeat((4 - str.length % 4) % 4);
  return Uint8Array.from(atob((str + pad).replace(/-/g, "+").replace(/_/g, "/")), c => c.charCodeAt(0));
}

function b64uEncode(buf: Uint8Array | ArrayBuffer): string {
  return btoa(String.fromCharCode(...new Uint8Array(buf)))
    .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

// ── VAPID JWT ──────────────────────────────────────────────────────────────
async function getPrivateKey(): Promise<CryptoKey> {
  // Public key from web-push is uncompressed EC point: 0x04 || x(32 bytes) || y(32 bytes)
  const pub = b64uDecode(VAPID_PUBLIC_KEY);
  const x = b64uEncode(pub.slice(1, 33));
  const y = b64uEncode(pub.slice(33, 65));

  return crypto.subtle.importKey(
    "jwk",
    { kty: "EC", crv: "P-256", d: VAPID_PRIVATE_KEY, x, y, ext: true },
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["sign"]
  );
}

async function buildVapidJwt(audience: string): Promise<string> {
  const enc = new TextEncoder();
  const h = b64uEncode(enc.encode(JSON.stringify({ alg: "ES256", typ: "JWT" })));
  const p = b64uEncode(enc.encode(JSON.stringify({
    aud: audience,
    exp: Math.floor(Date.now() / 1000) + 43200,
    sub: VAPID_MAILTO,
  })));
  const input = `${h}.${p}`;
  const key = await getPrivateKey();
  const sig = await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, key, enc.encode(input));
  return `${input}.${b64uEncode(sig)}`;
}

// ── Web Push sender ────────────────────────────────────────────────────────
async function sendPush(
  sub: { endpoint: string; p256dh: string; auth: string },
  payload: { title: string; body: string; tag?: string }
): Promise<number> {
  const url      = new URL(sub.endpoint);
  const audience = `${url.protocol}//${url.host}`;
  const jwt      = await buildVapidJwt(audience);

  const res = await fetch(sub.endpoint, {
    method: "POST",
    headers: {
      "Content-Type":  "application/octet-stream",
      "Authorization": `vapid t=${jwt},k=${VAPID_PUBLIC_KEY}`,
      "TTL":           "86400",
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    console.error(`Push failed ${res.status}:`, await res.text());
  }
  return res.status;
}

// ── Main ───────────────────────────────────────────────────────────────────
Deno.serve(async () => {
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);

  const { data: subs, error } = await supabase.from("push_subscriptions").select("*");
  if (error || !subs?.length) {
    return new Response(JSON.stringify({ sent: 0 }), { status: 200 });
  }

  const { data: projects } = await supabase
    .from("projects")
    .select("id, name, launch_date, batch1_deadline, batch2_deadline");

  const { data: tasks } = await supabase
    .from("tasks")
    .select("id, project_id, name, type, deadline, period_start, period_end");

  let totalSent = 0;

  for (const sub of subs) {
    const notifyDays: number   = sub.notify_days_before ?? 0;
    const subscribed: string[] = sub.subscribed_projects ?? [];
    const messages: { title: string; body: string; tag: string }[] = [];

    const checkDate = (projName: string, projId: string, dateStr: string | null, label: string) => {
      if (!dateStr || !subscribed.includes(projId)) return;
      const target = new Date(dateStr + "T00:00:00Z");
      const diffDays = Math.round((target.getTime() - today.getTime()) / 86400000);
      if (diffDays !== notifyDays) return;
      messages.push({
        title: `📅 ${projName}`,
        body:  `${label}${notifyDays === 0 ? "就是今天" : `在 ${notifyDays} 天後到期`}`,
        tag:   `${projId}-${label}`,
      });
    };

    for (const proj of projects ?? []) {
      checkDate(proj.name, proj.id, proj.launch_date,     "上線日");
      checkDate(proj.name, proj.id, proj.batch1_deadline, "第一批資料期限");
      checkDate(proj.name, proj.id, proj.batch2_deadline, "第二批資料期限");
    }

    for (const task of tasks ?? []) {
      const proj = (projects ?? []).find(p => p.id === task.project_id);
      if (!proj) continue;
      if (task.type === "deadline") {
        checkDate(proj.name, proj.id, task.deadline, `任務「${task.name}」`);
      } else {
        checkDate(proj.name, proj.id, task.period_start, `任務「${task.name}」開始日`);
        checkDate(proj.name, proj.id, task.period_end,   `任務「${task.name}」結束日`);
      }
    }

    for (const msg of messages) {
      const status = await sendPush(
        { endpoint: sub.endpoint, p256dh: sub.p256dh, auth: sub.auth },
        msg
      );
      if (status < 300) totalSent++;
    }
  }

  return new Response(JSON.stringify({ sent: totalSent }), { status: 200 });
});
