"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { SupabaseAdmin, SupabaseAdminError } = require("../supabase-admin");

function fakeFetch(handlers) {
  const calls = [];
  const fn = async (url, init) => {
    calls.push({ url: String(url), init: init });
    const h = handlers.find((x) => String(url).includes(x.match));
    if (!h) throw new Error("sin handler para " + url);
    const r = typeof h.reply === "function" ? h.reply(calls.length) : h.reply;
    return new Response(JSON.stringify(r.body === undefined ? {} : r.body), { status: r.status || 200 });
  };
  fn.calls = calls;
  return fn;
}

const admin = (fetch) => new SupabaseAdmin({ url: "https://proj.supabase.co", serviceRoleKey: "service-role", fetch: fetch });

test("findUserByEmail busca por correo exacto (sin distinguir mayúsculas)", async () => {
  const fetch = fakeFetch([
    { match: "/auth/v1/admin/users", reply: { body: { users: [{ id: "u1", email: "Ana@Ejemplo.com" }] } } }
  ]);
  const user = await admin(fetch).findUserByEmail("ana@ejemplo.com");
  assert.equal(user.id, "u1");
  assert.match(fetch.calls[0].url, /email=ana%40ejemplo\.com/);
  assert.equal(fetch.calls[0].init.headers.apikey, "service-role");
});

test("findUserByEmail responde null si no hay coincidencia", async () => {
  const fetch = fakeFetch([{ match: "/auth/v1/admin/users", reply: { body: { users: [] } } }]);
  assert.equal(await admin(fetch).findUserByEmail("nadie@ejemplo.com"), null);
});

test("setUserPassword llama PUT con la nueva contraseña", async () => {
  const fetch = fakeFetch([{ match: "/auth/v1/admin/users/u1", reply: { body: {} } }]);
  await admin(fetch).setUserPassword("u1", "clave-nueva-123");
  assert.equal(fetch.calls[0].init.method, "PUT");
  assert.deepEqual(JSON.parse(fetch.calls[0].init.body), { password: "clave-nueva-123" });
});

test("setUserPassword lanza SupabaseAdminError si Supabase rechaza", async () => {
  const fetch = fakeFetch([{ match: "/auth/v1/admin/users/u1", reply: { status: 422, body: { msg: "mal" } } }]);
  await assert.rejects(() => admin(fetch).setUserPassword("u1", "x"), SupabaseAdminError);
});

test("insertPasswordReset envía la fila a password_resets", async () => {
  const fetch = fakeFetch([{ match: "/rest/v1/password_resets", reply: { body: {} } }]);
  await admin(fetch).insertPasswordReset({ user_id: "u1", email: "a@b.com", code_hash: "h", expires_at: "x" });
  assert.equal(fetch.calls[0].init.method, "POST");
  assert.deepEqual(JSON.parse(fetch.calls[0].init.body), { user_id: "u1", email: "a@b.com", code_hash: "h", expires_at: "x" });
});

test("findPendingReset solo pide filas sin usar y sin vencer", async () => {
  const fetch = fakeFetch([{ match: "/rest/v1/password_resets", reply: { body: [{ id: "r1" }] } }]);
  const row = await admin(fetch).findPendingReset("a@b.com");
  assert.equal(row.id, "r1");
  assert.match(fetch.calls[0].url, /used_at=is\.null/);
  assert.match(fetch.calls[0].url, /expires_at=gt\./);
});

test("findPendingReset responde null sin filas", async () => {
  const fetch = fakeFetch([{ match: "/rest/v1/password_resets", reply: { body: [] } }]);
  assert.equal(await admin(fetch).findPendingReset("a@b.com"), null);
});

test("markResetUsed hace PATCH por id", async () => {
  const fetch = fakeFetch([{ match: "/rest/v1/password_resets?id=eq.r1", reply: { body: {} } }]);
  await admin(fetch).markResetUsed("r1");
  assert.equal(fetch.calls[0].init.method, "PATCH");
});
