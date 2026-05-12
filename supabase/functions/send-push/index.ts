// supabase/functions/send-push/index.ts
// 部署指令：supabase functions deploy send-push

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL        = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const VAPID_PUBLIC_KEY    = Deno.env.get("VAPID_PUBLIC_KEY")!;
const VAPID_PRIVATE_KEY   = Deno.env.get("VAPID_PRIVATE_KEY")!;
const VAPID_MAILTO        = Deno.env.get("VAPID_MAILTO")!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// ── Base64url helpers ──────────────────────────────────────────────────────
function b64uDecode(str: string): Uint8Array {
  const pad = "=".repeat((4 - str.length % 4) % 4);
  return Uint8Array.from(atob((str + pad).replace(/-/g, "+").replace(/_/g, "/")), c => c.charCodeAt(0));
}

function b64uEncode(buf: Uint8Array | ArrayBuffer): string {
  return btoa(String.fromCharCode(...new Uint8Array(buf)))
    .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

// ── VAPID JWT ──────────────────────────────────────────────────────────────
async function getVapidPrivateKey(): Promise<CryptoKey> {
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
  const key = await getVapidPrivateKey();
  const sig = await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, key, enc.encode(input));
  return `${input}.${b64uEncode(sig)}`;
}

// ── RFC 8291 Web Push Encryption ──────────────────────────────────────────
async function encryptPayload(
  plaintext: string,
  p256dhB64u: string,
  authB64u: string
): Promise<{ ciphertext: Uint8Array; serverPublicKey: Uint8Array }> {
  const enc = new TextEncoder();
  const plaintextBytes = enc.encode(plaintext);

  // Decode subscriber keys
  const receiverPublicKeyBytes = b64uDecode(p256dhB64u); // uncompressed P-256 point
  const authSecret = b64uDecode(authB64u);               // 16 bytes

  // Generate ephemeral server key pair
  const serverKeyPair = await crypto.subtle.generateKey(
    { name: "ECDH", namedCurve: "P-256" },
    true,
    ["deriveKey", "deriveBits"]
  );

  // Export server public key as uncompressed point
  const serverPublicKeyRaw = await crypto.subtle.exportKey("raw", serverKeyPair.publicKey);
  const serverPublicKey = new Uint8Array(serverPublicKeyRaw);

  // Import receiver public key
  const receiverPublicKey = await crypto.subtle.importKey(
    "raw",
    receiverPublicKeyBytes,
    { name: "ECDH", namedCurve: "P-256" },
    false,
    []
  );

  // ECDH shared secret
  const sharedSecretBits = await crypto.subtle.deriveBits(
    { name: "ECDH", public: receiverPublicKey },
    serverKeyPair.privateKey,
    256
  );
  const sharedSecret = new Uint8Array(sharedSecretBits);

  // HKDF-Extract: PRK = HMAC-SHA256(auth, sharedSecret)
  const hkdfKey = await crypto.subtle.importKey("raw", authSecret, "HKDF", false, ["deriveBits"]);

  // PRK using HKDF with auth as salt — per RFC 8291 §3.3
  // key_info = "WebPush: info\x00" || receiverPublicKey || serverPublicKey
  const keyInfoLabel = enc.encode("WebPush: info\x00");
  const keyInfo = new Uint8Array(keyInfoLabel.length + receiverPublicKeyBytes.length + serverPublicKey.length);
  keyInfo.set(keyInfoLabel, 0);
  keyInfo.set(receiverPublicKeyBytes, keyInfoLabel.length);
  keyInfo.set(serverPublicKey, keyInfoLabel.length + receiverPublicKeyBytes.length);

  // IKM = HKDF-Extract(auth, sharedSecret)
  const ikmBits = await crypto.subtle.deriveBits(
    { name: "HKDF", hash: "SHA-256", salt: authSecret, info: new Uint8Array(0) },
    await crypto.subtle.importKey("raw", sharedSecret, "HKDF", false, ["deriveBits"]),
    256
  );

  // PRK = HKDF-Extract with key_info
  const prkKey = await crypto.subtle.importKey("raw", ikmBits, "HKDF", false, ["deriveBits"]);

  // Content encryption key (CEK): 16 bytes
  const cekLabel = enc.encode("Content-Encoding: aes128gcm\x00");
  const cekInfo = new Uint8Array(cekLabel.length + 1);
  cekInfo.set(cekLabel);
  cekInfo[cekLabel.length] = 1;
  const cekBits = await crypto.subtle.deriveBits(
    { name: "HKDF", hash: "SHA-256", salt: new Uint8Array(0), info: cekInfo },
    prkKey,
    128
  );

  // Nonce: 12 bytes
  const nonceLabel = enc.encode("Content-Encoding: nonce\x00");
  const nonceInfo = new Uint8Array(nonceLabel.length + 1);
  nonceInfo.set(nonceLabel);
  nonceInfo[nonceLabel.length] = 1;
  const nonceBits = await crypto.subtle.deriveBits(
    { name: "HKDF", hash: "SHA-256", salt: new Uint8Array(0), info: nonceInfo },
    prkKey,
    96
  );
  const nonce = new Uint8Array(nonceBits);

  // Import CEK for AES-GCM
  const cekKey = await crypto.subtle.importKey(
    "raw", cekBits,
    { name: "AES-GCM" },
    false,
    ["encrypt"]
  );

  // Add padding: plaintext + \x02 (delimiter)
  const padded = new Uint8Array(plaintextBytes.length + 1);
  padded.set(plaintextBytes);
  padded[plaintextBytes.length] = 2;

  // Encrypt
  const encrypted = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv: nonce },
    cekKey,
    padded
  );

  // Build aes128gcm content (RFC 8188):
  // salt(16) + record_size(4) + keyid_len(1) + keyid(65) + ciphertext
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const recordSize = plaintextBytes.length + 18; // payload + tag
  const header = new Uint8Array(16 + 4 + 1 + 65);
  header.set(salt, 0);
  // record_size as big-endian uint32
  new DataView(header.buffer).setUint32(16, recordSize, false);
  header[20] = 65; // keyid_len = length of uncompressed P-256 point
  header.set(serverPublicKey, 21);

  const ciphertext = new Uint8Array(header.length + encrypted.byteLength);
  ciphertext.set(header, 0);
  ciphertext.set(new Uint8Array(encrypted), header.length);

  return { ciphertext, serverPublicKey };
}

// ── Web Push sender ────────────────────────────────────────────────────────
async function sendPush(
  sub: { endpoint: string; p256dh: string; auth: string },
  payload: { title: string; body: string; tag?: string }
): Promise<number> {
  const url      = new URL(sub.endpoint);
  const audience = `${url.protocol}//${url.host}`;
  const jwt      = await buildVapidJwt(audience);

  const { ciphertext } = await encryptPayload(
    JSON.stringify(payload),
    sub.p256dh,
    sub.auth
  );

  const res = await fetch(sub.endpoint, {
    method: "POST",
    headers: {
      "Content-Type":      "application/octet-stream",
      "Content-Encoding":  "aes128gcm",
      "Authorization":     `vapid t=${jwt},k=${VAPID_PUBLIC_KEY}`,
      "TTL":               "86400",
    },
    body: ciphertext,
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
