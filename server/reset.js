/* =========================================================
   ExxaSoft — Lógica del restablecimiento de contraseña (Eco)
   Genera el código de 8 caracteres, arma el correo y valida
   el código + la nueva contraseña antes de fijarla.
   ========================================================= */
"use strict";

const crypto = require("node:crypto");

/* Sin 0/O/1/I: evita confusiones al transcribir el código a mano */
const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const CODE_LENGTH = 8;
const CODE_TTL_MS = 15 * 60 * 1000;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function generateCode() {
  let code = "";
  for (let i = 0; i < CODE_LENGTH; i++) {
    code += CODE_ALPHABET[crypto.randomInt(CODE_ALPHABET.length)];
  }
  return code;
}

function hashCode(code) {
  return crypto.createHash("sha256").update(code.toUpperCase()).digest("hex");
}

/* Comparación en tiempo constante: evita filtrar por timing cuánto del hash coincide */
function hashesMatch(a, b) {
  const bufA = Buffer.from(a, "hex");
  const bufB = Buffer.from(b, "hex");
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

function normalizeEmail(email) {
  return typeof email === "string" ? email.trim().toLowerCase().slice(0, 200) : "";
}

function normalizeCode(code) {
  return typeof code === "string" ? code.trim().toUpperCase().slice(0, CODE_LENGTH) : "";
}

function escapeHtml(s) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

function buildResetEmail(email, code) {
  const safeEmail = escapeHtml(email);
  return {
    subject: "Código para restablecer tu contraseña — Eco",
    html:
      '<div style="font-family:Arial,sans-serif;font-size:14px;color:#14263B">' +
      "<h2 style=\"margin:0 0 12px\">Restablecer contraseña</h2>" +
      "<p>Recibimos una solicitud para restablecer la contraseña de la cuenta " + safeEmail + ".</p>" +
      '<p style="font-size:28px;font-weight:700;letter-spacing:4px;background:#F5F7F9;padding:16px;text-align:center">' + code + "</p>" +
      "<p>Ingresa este código en el sitio junto con tu nueva contraseña. Vence en 15 minutos.</p>" +
      "<p style=\"color:#4A5B70;font-size:12px\">Si no fuiste vos, ignora este correo: tu contraseña actual sigue funcionando.</p>" +
      "</div>"
  };
}

module.exports = {
  CODE_TTL_MS,
  EMAIL_RE,
  generateCode,
  hashCode,
  hashesMatch,
  normalizeEmail,
  normalizeCode,
  buildResetEmail
};
