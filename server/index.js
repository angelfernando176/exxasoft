/* =========================================================
   ExxaSoft — Servicio del formulario de contacto
   POST /api/contacto  recibe el formulario y lo envía por Zoho Mail
   GET  /api/salud     comprobación para el balanceador

   Variables de entorno (ver .env.example):
     ZOHO_CLIENT_ID, ZOHO_CLIENT_SECRET, ZOHO_REFRESH_TOKEN, ZOHO_ACCOUNT_ID
     ZOHO_ACCOUNTS_DOMAIN, ZOHO_MAIL_DOMAIN   según la región de la cuenta
     MAIL_FROM, MAIL_TO                       remitente (cuenta de Zoho) y destino
     ALLOWED_ORIGINS                          dominios que pueden usar el servicio
     PORT
   ========================================================= */
"use strict";

const http = require("node:http");
const { ZohoMail, ZohoError } = require("./zoho");
const { validate, rateLimiter, buildEmail } = require("./contacto");
const { SupabaseAdmin, SupabaseAdminError } = require("./supabase-admin");
const reset = require("./reset");

const MAX_BODY = 20 * 1024;

function mailerFromEnv(env) {
  const required = ["ZOHO_CLIENT_ID", "ZOHO_CLIENT_SECRET", "ZOHO_REFRESH_TOKEN", "ZOHO_ACCOUNT_ID"];
  const missing = required.filter((k) => !env[k]);
  if (missing.length) {
    console.error("Faltan variables de entorno: " + missing.join(", "));
    return null;
  }
  return new ZohoMail({
    clientId: env.ZOHO_CLIENT_ID,
    clientSecret: env.ZOHO_CLIENT_SECRET,
    refreshToken: env.ZOHO_REFRESH_TOKEN,
    accountId: env.ZOHO_ACCOUNT_ID,
    accountsDomain: env.ZOHO_ACCOUNTS_DOMAIN,
    mailDomain: env.ZOHO_MAIL_DOMAIN
  });
}

function supabaseAdminFromEnv(env) {
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error("Faltan variables de entorno: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY");
    return null;
  }
  return new SupabaseAdmin({ url: env.SUPABASE_URL, serviceRoleKey: env.SUPABASE_SERVICE_ROLE_KEY });
}

function createServer(opts) {
  const env = opts.env || {};
  const mailer = opts.mailer;
  const supabaseAdmin = opts.supabaseAdmin;
  const now = opts.now || Date.now;
  const to = env.MAIL_TO || "fernando.escobar@exxasoft.com";
  const from = env.MAIL_FROM || to;
  const origins = (env.ALLOWED_ORIGINS || "https://exxasoft.com,https://www.exxasoft.com")
    .split(",").map((o) => o.trim()).filter(Boolean);
  const isLimited = rateLimiter(5, 10 * 60 * 1000);
  const isResetRequestLimited = rateLimiter(5, 10 * 60 * 1000);
  const isResetConfirmLimited = rateLimiter(10, 10 * 60 * 1000);
  const isResetEstadoLimited = rateLimiter(20, 10 * 60 * 1000);

  function send(res, status, body) {
    res.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
    res.end(JSON.stringify(body));
  }
  const fail = (res, status, error) => send(res, status, { ok: false, error: error });

  function clientIp(req) {
    // App Platform entrega la IP real en "do-connecting-ip"; detrás de Nginx, en X-Forwarded-For
    const ip = req.headers["do-connecting-ip"] || String(req.headers["x-forwarded-for"] || "").split(",")[0];
    return ip.trim() || req.socket.remoteAddress || "desconocida";
  }

  function readJson(req) {
    return new Promise((resolve) => {
      let size = 0;
      const chunks = [];
      req.on("data", (c) => {
        size += c.length;
        if (size > MAX_BODY) { resolve(null); req.destroy(); return; }
        chunks.push(c);
      });
      req.on("end", () => {
        try { resolve(JSON.parse(Buffer.concat(chunks).toString("utf8"))); } catch (e) { resolve(null); }
      });
      req.on("error", () => resolve(null));
    });
  }

  async function contacto(req, res) {
    const data = await readJson(req);
    if (!data || typeof data !== "object" || Array.isArray(data)) {
      return fail(res, 400, "No pudimos leer el formulario. Intenta de nuevo.");
    }
    // Campo trampa invisible: solo un bot lo llena. Se responde "ok" para no darle pistas.
    if (data.website) return send(res, 200, { ok: true });

    const result = validate(data);
    if (result.error) return fail(res, 422, result.error);

    const ip = clientIp(req);
    if (isLimited(ip, now())) {
      return fail(res, 429, "Recibimos varios mensajes seguidos. Intenta de nuevo en unos minutos.");
    }
    if (!mailer) return fail(res, 503, "El envío no está disponible en este momento.");

    const email = buildEmail(result.fields, ip);
    try {
      await mailer.send({ from: from, to: to, subject: email.subject, html: email.html });
    } catch (err) {
      if (!(err instanceof ZohoError)) throw err;
      console.error("Fallo al enviar la consulta: " + err.message);
      return fail(res, 502, "No pudimos enviar tu mensaje. Escríbenos directamente a " + to + ".");
    }
    send(res, 200, { ok: true });
  }

  async function resetSolicitar(req, res) {
    const data = await readJson(req);
    const email = reset.normalizeEmail(data && data.email);
    if (!reset.EMAIL_RE.test(email)) return fail(res, 422, "Escribe un correo válido.");

    const ip = clientIp(req);
    if (isResetRequestLimited(ip, now()) || isResetRequestLimited("email:" + email, now())) {
      return fail(res, 429, "Ya solicitaste varios códigos seguidos. Intenta de nuevo en unos minutos.");
    }
    if (!supabaseAdmin || !mailer) return fail(res, 503, "El envío no está disponible en este momento.");

    try {
      const user = await supabaseAdmin.findUserByEmail(email);
      if (user) {
        const code = reset.generateCode();
        await supabaseAdmin.invalidatePendingResets(user.id);
        await supabaseAdmin.insertPasswordReset({
          user_id: user.id,
          email: email,
          code_hash: reset.hashCode(code),
          expires_at: new Date(now() + reset.CODE_TTL_MS).toISOString()
        });
        var mail = reset.buildResetEmail(email, code);
        await mailer.send({ from: from, to: email, subject: mail.subject, html: mail.html });
      }
    } catch (err) {
      console.error("Fallo al solicitar el restablecimiento: " + err.message);
      return fail(res, 502, "No pudimos procesar la solicitud. Intenta de nuevo.");
    }
    send(res, 200, { ok: true });
  }

  async function resetEstado(req, res, query) {
    var email = reset.normalizeEmail(query.get("email"));
    if (!reset.EMAIL_RE.test(email)) return fail(res, 422, "Correo inválido.");
    var ip = clientIp(req);
    if (isResetEstadoLimited(ip, now()) || isResetEstadoLimited("email:" + email, now())) {
      return fail(res, 429, "Demasiadas consultas. Intenta de nuevo en unos minutos.");
    }
    if (!supabaseAdmin) return send(res, 200, { pending: false });
    try {
      var pending = await supabaseAdmin.findPendingReset(email);
      send(res, 200, { pending: Boolean(pending) });
    } catch (err) {
      console.error("Fallo al consultar el estado del restablecimiento: " + err.message);
      send(res, 200, { pending: false });
    }
  }

  async function resetConfirmar(req, res) {
    var data = await readJson(req);
    if (!data) return fail(res, 400, "No pudimos leer la solicitud. Intenta de nuevo.");
    var email = reset.normalizeEmail(data.email);
    var code = reset.normalizeCode(data.code);
    var newPassword = typeof data.newPassword === "string" ? data.newPassword : "";
    var newPasswordConfirm = typeof data.newPasswordConfirm === "string" ? data.newPasswordConfirm : "";

    if (!reset.EMAIL_RE.test(email)) return fail(res, 422, "Correo inválido.");
    if (code.length !== 8) return fail(res, 422, "El código debe tener 8 caracteres.");
    if (newPassword.length < 6) return fail(res, 422, "La contraseña debe tener al menos 6 caracteres.");
    if (newPassword !== newPasswordConfirm) return fail(res, 422, "Las contraseñas no coinciden.");

    var ip = clientIp(req);
    if (isResetConfirmLimited(ip, now()) || isResetConfirmLimited("email:" + email, now())) {
      return fail(res, 429, "Demasiados intentos. Intenta de nuevo en unos minutos.");
    }
    if (!supabaseAdmin) return fail(res, 503, "El envío no está disponible en este momento.");

    try {
      var pendingRow = await supabaseAdmin.findPendingReset(email);
      if (!pendingRow || !reset.hashesMatch(pendingRow.code_hash, reset.hashCode(code))) {
        return fail(res, 400, "Código inválido o vencido.");
      }
      await supabaseAdmin.setUserPassword(pendingRow.user_id, newPassword);
      await supabaseAdmin.markResetUsed(pendingRow.id);
    } catch (err) {
      if (!(err instanceof SupabaseAdminError)) throw err;
      console.error("Fallo al confirmar el restablecimiento: " + err.message);
      return fail(res, 502, "No pudimos actualizar la contraseña. Intenta de nuevo.");
    }
    send(res, 200, { ok: true });
  }

  return http.createServer((req, res) => {
    const origin = req.headers.origin;
    if (origin && origins.includes(origin)) {
      res.setHeader("Access-Control-Allow-Origin", origin);
      res.setHeader("Vary", "Origin");
    }
    const url = new URL(req.url || "/", "http://localhost");
    // App Platform's ingress may forward the path with the "/api" prefix kept,
    // stripped, or duplicated depending on routing config; normalize to exactly one.
    const path = url.pathname.replace(/^(\/api)+/, "/api").replace(/^(?!\/api)/, "/api");
    const resetPaths = ["/api/reset/solicitar", "/api/reset/estado", "/api/reset/confirmar"];

    if (url.pathname.endsWith("__debug")) {
      return send(res, 200, { rawUrl: req.url, pathname: url.pathname, normalized: path });
    }

    if (req.method === "OPTIONS" && (path === "/api/contacto" || resetPaths.includes(path))) {
      res.setHeader("Access-Control-Allow-Methods", path === "/api/reset/estado" ? "GET" : "POST");
      res.setHeader("Access-Control-Allow-Headers", "Content-Type");
      res.setHeader("Access-Control-Max-Age", "86400");
      res.writeHead(204);
      return res.end();
    }
    if (req.method === "GET" && path === "/api/salud") return send(res, 200, { ok: true });
    if (req.method === "POST" && path === "/api/contacto") {
      return contacto(req, res).catch((err) => {
        console.error(err);
        if (!res.headersSent) fail(res, 500, "Ocurrió un error inesperado. Intenta de nuevo.");
      });
    }
    if (req.method === "POST" && path === "/api/reset/solicitar") {
      return resetSolicitar(req, res).catch((err) => {
        console.error(err);
        if (!res.headersSent) fail(res, 500, "Ocurrió un error inesperado. Intenta de nuevo.");
      });
    }
    if (req.method === "GET" && path === "/api/reset/estado") {
      return resetEstado(req, res, url.searchParams).catch((err) => {
        console.error(err);
        if (!res.headersSent) fail(res, 500, "Ocurrió un error inesperado. Intenta de nuevo.");
      });
    }
    if (req.method === "POST" && path === "/api/reset/confirmar") {
      return resetConfirmar(req, res).catch((err) => {
        console.error(err);
        if (!res.headersSent) fail(res, 500, "Ocurrió un error inesperado. Intenta de nuevo.");
      });
    }
    fail(res, 404, "No encontrado.");
  });
}

if (require.main === module) {
  const port = Number(process.env.PORT) || 8080;
  createServer({ env: process.env, mailer: mailerFromEnv(process.env), supabaseAdmin: supabaseAdminFromEnv(process.env) })
    .listen(port, () => console.log("Servicio de contacto escuchando en el puerto " + port));
}

module.exports = { createServer };
