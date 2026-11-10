/* =========================================================
   ExxaSoft — Cliente mínimo de la API de Zoho Mail (v2)
   Renueva el access token con el refresh token (dura una hora)
   y envía correos desde la cuenta configurada. El token se
   guarda en memoria y se renueva un minuto antes de expirar.
   ========================================================= */
"use strict";

class ZohoError extends Error {}

class ZohoMail {
  constructor(opts) {
    this.clientId = opts.clientId;
    this.clientSecret = opts.clientSecret;
    this.refreshToken = opts.refreshToken;
    this.accountId = opts.accountId;
    this.accountsDomain = (opts.accountsDomain || "https://accounts.zoho.com").replace(/\/$/, "");
    this.mailDomain = (opts.mailDomain || "https://mail.zoho.com").replace(/\/$/, "");
    this.fetch = opts.fetch || globalThis.fetch;
    this.token = null;
    this.expiresAt = 0;
    this.pending = null; // evita pedir varios tokens a la vez
  }

  async request(url, init) {
    try {
      return await this.fetch(url, Object.assign({ signal: AbortSignal.timeout(15000) }, init));
    } catch (err) {
      throw new ZohoError("Sin conexión con Zoho: " + err.message);
    }
  }

  async accessToken() {
    if (this.token && Date.now() < this.expiresAt - 60000) return this.token;
    if (!this.pending) {
      this.pending = this.renewToken().finally(() => { this.pending = null; });
    }
    return this.pending;
  }

  async renewToken() {
    const params = new URLSearchParams({
      refresh_token: this.refreshToken,
      client_id: this.clientId,
      client_secret: this.clientSecret,
      grant_type: "refresh_token"
    });
    const res = await this.request(this.accountsDomain + "/oauth/v2/token?" + params, { method: "POST" });
    const data = await res.json().catch(() => ({}));
    // Zoho responde 200 incluso con credenciales inválidas; el error viene en "error"
    if (!res.ok || !data.access_token) {
      throw new ZohoError("No se pudo renovar el token: " + (data.error || res.status));
    }
    this.token = data.access_token;
    this.expiresAt = Date.now() + (Number(data.expires_in) || 3600) * 1000;
    return this.token;
  }

  async send({ from, to, subject, html }) {
    const token = await this.accessToken();
    const res = await this.request(this.mailDomain + "/api/accounts/" + this.accountId + "/messages", {
      method: "POST",
      headers: { "Authorization": "Zoho-oauthtoken " + token, "Content-Type": "application/json" },
      body: JSON.stringify({ fromAddress: from, toAddress: to, subject: subject, content: html, mailFormat: "html" })
    });
    if (!res.ok) {
      // Un token revocado antes de tiempo obliga a pedir uno nuevo en el siguiente envío
      if (res.status === 401) this.token = null;
      const text = await res.text().catch(() => "");
      throw new ZohoError("Zoho rechazó el envío (" + res.status + "): " + text.slice(0, 300));
    }
  }
}

module.exports = { ZohoMail, ZohoError };
