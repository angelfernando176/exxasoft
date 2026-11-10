/* =========================================================
   ExxaSoft — Cliente mínimo de administración de Supabase (Eco)
   Usa la service_role key: solo corre en el servidor, nunca en
   el navegador. Permite buscar usuarios por correo, fijar una
   contraseña nueva y leer/escribir la tabla password_resets
   (bloqueada por RLS para la anon key).
   ========================================================= */
"use strict";

class SupabaseAdminError extends Error {}

class SupabaseAdmin {
  constructor(opts) {
    this.url = (opts.url || "").replace(/\/$/, "");
    this.serviceRoleKey = opts.serviceRoleKey;
    this.fetch = opts.fetch || globalThis.fetch;
  }

  async request(path, init) {
    const headers = Object.assign({
      "apikey": this.serviceRoleKey,
      "Authorization": "Bearer " + this.serviceRoleKey,
      "Content-Type": "application/json"
    }, (init && init.headers) || {});
    let res;
    try {
      res = await this.fetch(this.url + path, Object.assign({ signal: AbortSignal.timeout(15000) }, init, { headers: headers }));
    } catch (err) {
      throw new SupabaseAdminError("Sin conexión con Supabase: " + err.message);
    }
    return res;
  }

  async findUserByEmail(email) {
    const res = await this.request("/auth/v1/admin/users?email=" + encodeURIComponent(email), { method: "GET" });
    if (!res.ok) throw new SupabaseAdminError("No se pudo buscar el usuario (" + res.status + ")");
    const data = await res.json().catch(() => ({}));
    const users = data.users || [];
    return users.find((u) => String(u.email || "").toLowerCase() === email.toLowerCase()) || null;
  }

  async setUserPassword(userId, newPassword) {
    const res = await this.request("/auth/v1/admin/users/" + encodeURIComponent(userId), {
      method: "PUT",
      body: JSON.stringify({ password: newPassword })
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new SupabaseAdminError("No se pudo actualizar la contraseña (" + res.status + "): " + text.slice(0, 300));
    }
  }

  async invalidatePendingResets(userId) {
    const res = await this.request(
      "/rest/v1/password_resets?user_id=eq." + encodeURIComponent(userId) + "&used_at=is.null",
      { method: "PATCH", body: JSON.stringify({ used_at: new Date().toISOString() }) }
    );
    if (!res.ok) throw new SupabaseAdminError("No se pudo invalidar códigos previos (" + res.status + ")");
  }

  async insertPasswordReset(row) {
    const res = await this.request("/rest/v1/password_resets", {
      method: "POST",
      headers: { "Prefer": "return=minimal" },
      body: JSON.stringify(row)
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new SupabaseAdminError("No se pudo guardar el código (" + res.status + "): " + text.slice(0, 300));
    }
  }

  async findPendingReset(email) {
    const nowIso = new Date().toISOString();
    const path = "/rest/v1/password_resets" +
      "?email=eq." + encodeURIComponent(email) +
      "&used_at=is.null" +
      "&expires_at=gt." + encodeURIComponent(nowIso) +
      "&order=created_at.desc&limit=1";
    const res = await this.request(path, { method: "GET" });
    if (!res.ok) throw new SupabaseAdminError("No se pudo consultar el código (" + res.status + ")");
    const rows = await res.json().catch(() => []);
    return rows[0] || null;
  }

  async markResetUsed(id) {
    const res = await this.request("/rest/v1/password_resets?id=eq." + encodeURIComponent(id), {
      method: "PATCH",
      body: JSON.stringify({ used_at: new Date().toISOString() })
    });
    if (!res.ok) throw new SupabaseAdminError("No se pudo marcar el código como usado (" + res.status + ")");
  }
}

module.exports = { SupabaseAdmin, SupabaseAdminError };
