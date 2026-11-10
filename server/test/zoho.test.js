"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { ZohoMail, ZohoError } = require("../zoho");

/* fetch simulado: responde según la URL y guarda cada llamada */
function fakeFetch(handlers) {
  const calls = [];
  const fn = async (url, init) => {
    calls.push({ url: String(url), init: init });
    const h = handlers.find((x) => String(url).includes(x.match));
    const r = typeof h.reply === "function" ? h.reply(calls.length) : h.reply;
    return new Response(JSON.stringify(r.body || {}), { status: r.status || 200 });
  };
  fn.calls = calls;
  return fn;
}

const opts = (fetch) => ({ clientId: "id", clientSecret: "secret", refreshToken: "rt", accountId: "123", fetch: fetch });

test("renueva el token una vez y lo reutiliza en envíos seguidos", async () => {
  const fetch = fakeFetch([
    { match: "/oauth/v2/token", reply: { body: { access_token: "AT1", expires_in: 3600 } } },
    { match: "/messages", reply: { body: { status: { code: 200 } } } }
  ]);
  const zoho = new ZohoMail(opts(fetch));
  await zoho.send({ from: "a@exxasoft.com", to: "b@exxasoft.com", subject: "s", html: "<p>h</p>" });
  await zoho.send({ from: "a@exxasoft.com", to: "b@exxasoft.com", subject: "s", html: "<p>h</p>" });

  const tokenCalls = fetch.calls.filter((c) => c.url.includes("/oauth/v2/token"));
  assert.equal(tokenCalls.length, 1);
  assert.match(tokenCalls[0].url, /grant_type=refresh_token/);

  const send = fetch.calls.find((c) => c.url.includes("/messages"));
  assert.equal(send.url, "https://mail.zoho.com/api/accounts/123/messages");
  assert.equal(send.init.headers.Authorization, "Zoho-oauthtoken AT1");
  assert.deepEqual(JSON.parse(send.init.body), {
    fromAddress: "a@exxasoft.com", toAddress: "b@exxasoft.com", subject: "s", content: "<p>h</p>", mailFormat: "html"
  });
});

test("falla con ZohoError si Zoho rechaza el refresh token aunque responda 200", async () => {
  const fetch = fakeFetch([{ match: "/oauth/v2/token", reply: { body: { error: "invalid_code" } } }]);
  const zoho = new ZohoMail(opts(fetch));
  await assert.rejects(zoho.send({ from: "a", to: "b", subject: "s", html: "h" }), (err) => {
    assert.ok(err instanceof ZohoError);
    assert.match(err.message, /invalid_code/);
    return true;
  });
});

test("tras un 401 pide un token nuevo en el siguiente envío", async () => {
  const fetch = fakeFetch([
    { match: "/oauth/v2/token", reply: (n) => ({ body: { access_token: "AT" + n, expires_in: 3600 } }) },
    { match: "/messages", reply: (n) => (n === 2 ? { status: 401, body: { status: { code: 401 } } } : { body: {} }) }
  ]);
  const zoho = new ZohoMail(opts(fetch));
  await assert.rejects(zoho.send({ from: "a", to: "b", subject: "s", html: "h" }), ZohoError);
  await zoho.send({ from: "a", to: "b", subject: "s", html: "h" });
  assert.equal(fetch.calls.filter((c) => c.url.includes("/oauth/v2/token")).length, 2);
});

test("convierte un fallo de red en ZohoError", async () => {
  const zoho = new ZohoMail(opts(async () => { throw new TypeError("fetch failed"); }));
  await assert.rejects(zoho.send({ from: "a", to: "b", subject: "s", html: "h" }), ZohoError);
});
