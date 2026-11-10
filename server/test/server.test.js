"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { createServer } = require("../index");
const { ZohoError } = require("../zoho");

const ORIGIN = "https://exxasoft.com";
const valid = { name: "Ana Pérez", email: "ana@ejemplo.com", service: "Software a medida", message: "Necesito un sistema de inventario." };

/* Levanta el servicio en un puerto libre con un Zoho simulado */
async function start(t, mailer) {
  const server = createServer({ env: { ALLOWED_ORIGINS: ORIGIN }, mailer: mailer });
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  t.after(() => server.close());
  const base = "http://127.0.0.1:" + server.address().port;
  return (body, extra) => fetch(base + "/api/contacto", Object.assign({
    method: "POST",
    headers: { "Content-Type": "application/json", "Origin": ORIGIN, "X-Forwarded-For": "203.0.113.7" },
    body: typeof body === "string" ? body : JSON.stringify(body)
  }, extra));
}

function fakeMailer(fail) {
  const sent = [];
  return { sent: sent, send: async (m) => { if (fail) throw new ZohoError("caído"); sent.push(m); } };
}

test("envía la consulta y escapa el HTML del visitante", async (t) => {
  const mailer = fakeMailer();
  const post = await start(t, mailer);
  const res = await post(Object.assign({}, valid, { message: "Hola <script>alert(1)</script>\nsegunda línea" }));
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), { ok: true });
  assert.equal(res.headers.get("access-control-allow-origin"), ORIGIN);

  assert.equal(mailer.sent.length, 1);
  const m = mailer.sent[0];
  assert.equal(m.to, "fernando.escobar@exxasoft.com");
  assert.equal(m.subject, "Consulta web: Software a medida — Ana Pérez");
  assert.ok(m.html.includes("&lt;script&gt;"));
  assert.ok(!m.html.includes("<script>"));
  assert.ok(m.html.includes("<br>segunda línea"));
  assert.ok(m.html.includes("203.0.113.7"));
});

test("rechaza datos inválidos con un mensaje para el visitante", async (t) => {
  const mailer = fakeMailer();
  const post = await start(t, mailer);
  const res = await post(Object.assign({}, valid, { email: "no-es-correo" }));
  assert.equal(res.status, 422);
  assert.match((await res.json()).error, /correo válido/);
  assert.equal((await post("{roto")).status, 400);
  assert.equal(mailer.sent.length, 0);
});

test("el campo trampa responde ok sin enviar nada", async (t) => {
  const mailer = fakeMailer();
  const post = await start(t, mailer);
  const res = await post(Object.assign({}, valid, { website: "http://spam.example" }));
  assert.equal(res.status, 200);
  assert.equal(mailer.sent.length, 0);
});

test("limita a 5 envíos por IP cada 10 minutos", async (t) => {
  const mailer = fakeMailer();
  const post = await start(t, mailer);
  for (let i = 0; i < 5; i++) assert.equal((await post(valid)).status, 200);
  assert.equal((await post(valid)).status, 429);
  assert.equal(mailer.sent.length, 5);
});

test("si Zoho falla responde 502 con el correo de respaldo", async (t) => {
  const post = await start(t, fakeMailer(true));
  const res = await post(valid);
  assert.equal(res.status, 502);
  assert.match((await res.json()).error, /fernando\.escobar@exxasoft\.com/);
});

test("sin credenciales configuradas responde 503", async (t) => {
  const post = await start(t, null);
  assert.equal((await post(valid)).status, 503);
});

test("responde la consulta previa de CORS solo a los dominios permitidos", async (t) => {
  const post = await start(t, fakeMailer());
  const ok = await post(undefined, { method: "OPTIONS", body: undefined });
  assert.equal(ok.status, 204);
  assert.equal(ok.headers.get("access-control-allow-origin"), ORIGIN);
  const other = await post(undefined, { method: "OPTIONS", body: undefined, headers: { Origin: "https://otro.com" } });
  assert.equal(other.headers.get("access-control-allow-origin"), null);
});

/* ---------- Reseteo de contraseña (Eco) ---------- */

function fakeSupabaseAdmin(users, nowFn) {
  const clock = nowFn || Date.now;
  const rows = [];
  const passwords = {};
  return {
    rows: rows,
    passwords: passwords,
    findUserByEmail: async (email) => users.find((u) => u.email.toLowerCase() === email.toLowerCase()) || null,
    invalidatePendingResets: async (userId) => {
      rows.forEach((r) => { if (r.user_id === userId && !r.used_at) r.used_at = new Date().toISOString(); });
    },
    insertPasswordReset: async (row) => { rows.push(Object.assign({ id: "r" + (rows.length + 1), used_at: null }, row)); },
    findPendingReset: async (email) => {
      const now = clock();
      return rows.find((r) => r.email === email && !r.used_at && new Date(r.expires_at).getTime() > now) || null;
    },
    setUserPassword: async (userId, password) => { passwords[userId] = password; },
    markResetUsed: async (id) => { const r = rows.find((x) => x.id === id); if (r) r.used_at = new Date().toISOString(); }
  };
}

async function startReset(t, opts) {
  const server = createServer(Object.assign({ env: { ALLOWED_ORIGINS: ORIGIN } }, opts));
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  t.after(() => server.close());
  const base = "http://127.0.0.1:" + server.address().port;
  return function call(path, body, extra) {
    return fetch(base + path, Object.assign({
      method: body === undefined ? "GET" : "POST",
      headers: { "Content-Type": "application/json", "Origin": ORIGIN, "X-Forwarded-For": "203.0.113.7" },
      body: body === undefined ? undefined : JSON.stringify(body)
    }, extra));
  };
}

test("solicitar reseteo envía un código de 8 caracteres solo si el correo existe", async (t) => {
  const mailer = fakeMailer();
  const supabaseAdmin = fakeSupabaseAdmin([{ id: "u1", email: "ana@ejemplo.com" }]);
  const call = await startReset(t, { mailer: mailer, supabaseAdmin: supabaseAdmin });

  const res = await call("/api/reset/solicitar", { email: "ana@ejemplo.com" });
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), { ok: true });
  assert.equal(mailer.sent.length, 1);
  assert.match(mailer.sent[0].html, /[A-HJ-NP-Z2-9]{8}/);
  assert.equal(supabaseAdmin.rows.length, 1);

  const res2 = await call("/api/reset/solicitar", { email: "nadie@ejemplo.com" });
  assert.equal(res2.status, 200);
  assert.deepEqual(await res2.json(), { ok: true });
  assert.equal(mailer.sent.length, 1);
});

test("solicitar reseteo invalida el código anterior al pedir uno nuevo", async (t) => {
  const supabaseAdmin = fakeSupabaseAdmin([{ id: "u1", email: "ana@ejemplo.com" }]);
  const call = await startReset(t, { mailer: fakeMailer(), supabaseAdmin: supabaseAdmin });
  await call("/api/reset/solicitar", { email: "ana@ejemplo.com" });
  await call("/api/reset/solicitar", { email: "ana@ejemplo.com" });
  assert.equal(supabaseAdmin.rows.filter((r) => !r.used_at).length, 1);
});

test("estado del reseteo: pending true solo con un código vigente", async (t) => {
  const supabaseAdmin = fakeSupabaseAdmin([{ id: "u1", email: "ana@ejemplo.com" }]);
  const call = await startReset(t, { mailer: fakeMailer(), supabaseAdmin: supabaseAdmin });
  assert.deepEqual(await (await call("/api/reset/estado?email=ana@ejemplo.com")).json(), { pending: false });
  await call("/api/reset/solicitar", { email: "ana@ejemplo.com" });
  assert.deepEqual(await (await call("/api/reset/estado?email=ana@ejemplo.com")).json(), { pending: true });
});

test("confirmar reseteo fija la nueva contraseña con el código correcto", async (t) => {
  const mailer = fakeMailer();
  const supabaseAdmin = fakeSupabaseAdmin([{ id: "u1", email: "ana@ejemplo.com" }]);
  const call = await startReset(t, { mailer: mailer, supabaseAdmin: supabaseAdmin });
  await call("/api/reset/solicitar", { email: "ana@ejemplo.com" });
  const code = mailer.sent[0].html.match(/[A-HJ-NP-Z2-9]{8}/)[0];

  const res = await call("/api/reset/confirmar", {
    email: "ana@ejemplo.com", code: code.toLowerCase(), newPassword: "clave-nueva-1", newPasswordConfirm: "clave-nueva-1"
  });
  assert.equal(res.status, 200);
  assert.equal(supabaseAdmin.passwords.u1, "clave-nueva-1");
  assert.equal(supabaseAdmin.rows[0].used_at !== null, true);

  const reused = await call("/api/reset/confirmar", {
    email: "ana@ejemplo.com", code: code, newPassword: "otra-clave-2", newPasswordConfirm: "otra-clave-2"
  });
  assert.equal(reused.status, 400);
});

test("confirmar reseteo rechaza código incorrecto, vencido o contraseñas que no coinciden", async (t) => {
  const mailer = fakeMailer();
  const supabaseAdmin = fakeSupabaseAdmin([{ id: "u1", email: "ana@ejemplo.com" }]);
  const call = await startReset(t, { mailer: mailer, supabaseAdmin: supabaseAdmin });
  await call("/api/reset/solicitar", { email: "ana@ejemplo.com" });

  assert.equal((await call("/api/reset/confirmar", {
    email: "ana@ejemplo.com", code: "ZZZZZZZZ", newPassword: "clave-nueva-1", newPasswordConfirm: "clave-nueva-1"
  })).status, 400);

  const code = mailer.sent[0].html.match(/[A-HJ-NP-Z2-9]{8}/)[0];
  assert.equal((await call("/api/reset/confirmar", {
    email: "ana@ejemplo.com", code: code, newPassword: "clave-nueva-1", newPasswordConfirm: "distinta"
  })).status, 422);
  assert.equal((await call("/api/reset/confirmar", {
    email: "ana@ejemplo.com", code: code, newPassword: "abc", newPasswordConfirm: "abc"
  })).status, 422);
});

test("reseteo responde 503 sin supabaseAdmin configurado", async (t) => {
  const call = await startReset(t, { mailer: fakeMailer() });
  assert.equal((await call("/api/reset/solicitar", { email: "ana@ejemplo.com" })).status, 503);
  assert.equal((await call("/api/reset/confirmar", {
    email: "ana@ejemplo.com", code: "AAAAAAAA", newPassword: "clave-nueva-1", newPasswordConfirm: "clave-nueva-1"
  })).status, 503);
});

test("limita los intentos de solicitar y confirmar el reseteo", async (t) => {
  const supabaseAdmin = fakeSupabaseAdmin([{ id: "u1", email: "ana@ejemplo.com" }]);
  const call = await startReset(t, { mailer: fakeMailer(), supabaseAdmin: supabaseAdmin });
  for (let i = 0; i < 5; i++) assert.equal((await call("/api/reset/solicitar", { email: "ana@ejemplo.com" })).status, 200);
  assert.equal((await call("/api/reset/solicitar", { email: "ana@ejemplo.com" })).status, 429);

  for (let i = 0; i < 10; i++) {
    await call("/api/reset/confirmar", { email: "ana@ejemplo.com", code: "ZZZZZZZZ", newPassword: "clave-nueva-1", newPasswordConfirm: "clave-nueva-1" });
  }
  assert.equal((await call("/api/reset/confirmar", {
    email: "ana@ejemplo.com", code: "ZZZZZZZZ", newPassword: "clave-nueva-1", newPasswordConfirm: "clave-nueva-1"
  })).status, 429);
});

test("limita las consultas de estado del reseteo", async (t) => {
  const supabaseAdmin = fakeSupabaseAdmin([{ id: "u1", email: "ana@ejemplo.com" }]);
  const call = await startReset(t, { mailer: fakeMailer(), supabaseAdmin: supabaseAdmin });
  for (let i = 0; i < 20; i++) {
    assert.equal((await call("/api/reset/estado?email=ana@ejemplo.com")).status, 200);
  }
  assert.equal((await call("/api/reset/estado?email=ana@ejemplo.com")).status, 429);
});

test("un código vencido se rechaza aunque no se haya usado", async (t) => {
  const mailer = fakeMailer();
  let clock = Date.parse("2026-01-01T00:00:00Z");
  const nowFn = () => clock;
  const call = await startReset(t, { mailer: mailer, supabaseAdmin: fakeSupabaseAdmin([{ id: "u1", email: "ana@ejemplo.com" }], nowFn), now: nowFn });

  await call("/api/reset/solicitar", { email: "ana@ejemplo.com" });
  const code = mailer.sent[0].html.match(/[A-HJ-NP-Z2-9]{8}/)[0];

  clock += 16 * 60 * 1000;
  assert.deepEqual(await (await call("/api/reset/estado?email=ana@ejemplo.com")).json(), { pending: false });

  const res = await call("/api/reset/confirmar", {
    email: "ana@ejemplo.com", code: code, newPassword: "clave-nueva-1", newPasswordConfirm: "clave-nueva-1"
  });
  assert.equal(res.status, 400);
});
