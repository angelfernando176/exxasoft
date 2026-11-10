/* =========================================================
   ExxaSoft — Lógica del formulario de contacto
   Valida los datos, limita los envíos por IP y arma el correo.
   ========================================================= */
"use strict";

const SERVICES = new Set([
  "Software a medida",
  "Aplicación móvil",
  "Sitio o sistema web",
  "Análisis de requisitos",
  "Información sobre Eco",
  "Información sobre ÜBENPLAY",
  "Otro"
]);
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/* Devuelve { fields } con los datos limpios o { error } con el mensaje para el visitante */
function validate(data) {
  const text = (key, limit) => (typeof data[key] === "string" ? data[key].trim().slice(0, limit) : "");
  const fields = {
    name: text("name", 100),
    email: text("email", 200),
    service: text("service", 60),
    message: text("message", 5000)
  };
  if (fields.name.length < 2) return { error: "Escribe tu nombre." };
  if (!EMAIL_RE.test(fields.email)) return { error: "Escribe un correo válido para poder responderte." };
  if (!SERVICES.has(fields.service)) fields.service = "Otro";
  if (fields.message.length < 10) return { error: "Cuéntanos un poco más en el mensaje (mínimo 10 caracteres)." };
  return { fields };
}

/* Límite de envíos por IP para que nadie use el formulario para mandar correos masivos */
function rateLimiter(limit, windowMs) {
  const hits = new Map();
  return function isLimited(ip, now) {
    const recent = (hits.get(ip) || []).filter((t) => now - t < windowMs);
    if (recent.length >= limit) {
      hits.set(ip, recent);
      return true;
    }
    recent.push(now);
    hits.set(ip, recent);
    return false;
  };
}

function escapeHtml(s) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

function buildEmail(f, ip) {
  const e = {};
  Object.keys(f).forEach((k) => { e[k] = escapeHtml(f[k]); });
  return {
    subject: "Consulta web: " + f.service + " — " + f.name,
    html:
      '<div style="font-family:Arial,sans-serif;font-size:14px;color:#14263B">' +
      '<h2 style="margin:0 0 12px">Nueva consulta desde exxasoft.com</h2>' +
      "<p><strong>Nombre:</strong> " + e.name + "<br>" +
      '<strong>Correo:</strong> <a href="mailto:' + e.email + '">' + e.email + "</a><br>" +
      "<strong>Interés:</strong> " + e.service + "</p>" +
      '<p style="padding:12px;background:#F5F7F9;border-left:3px solid #E5A00D">' + e.message.replace(/\n/g, "<br>") + "</p>" +
      '<p style="color:#4A5B70;font-size:12px">Enviado desde el formulario del sitio · IP ' + escapeHtml(ip) + "</p>" +
      "</div>"
  };
}

module.exports = { validate, rateLimiter, buildEmail };
