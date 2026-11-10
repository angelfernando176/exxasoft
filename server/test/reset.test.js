"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const reset = require("../reset");

test("genera códigos de 8 caracteres sin 0/O/1/I", () => {
  for (let i = 0; i < 50; i++) {
    const code = reset.generateCode();
    assert.equal(code.length, 8);
    assert.match(code, /^[A-HJ-NP-Z2-9]{8}$/);
  }
});

test("hashCode es determinístico e ignora mayúsculas/minúsculas", () => {
  const a = reset.hashCode("ab3dEFGH");
  const b = reset.hashCode("AB3DEFGH");
  assert.equal(a, b);
  assert.notEqual(a, reset.hashCode("ZZZZZZZZ"));
});

test("hashesMatch compara en tiempo constante y detecta diferencias", () => {
  const h1 = reset.hashCode("CODE1234");
  const h2 = reset.hashCode("CODE1234");
  const h3 = reset.hashCode("OTRO5678");
  assert.equal(reset.hashesMatch(h1, h2), true);
  assert.equal(reset.hashesMatch(h1, h3), false);
});

test("normalizeEmail recorta espacios y pasa a minúsculas", () => {
  assert.equal(reset.normalizeEmail("  Ana@Ejemplo.com  "), "ana@ejemplo.com");
  assert.equal(reset.normalizeEmail(42), "");
});

test("normalizeCode recorta espacios y pasa a mayúsculas", () => {
  assert.equal(reset.normalizeCode(" ab3defgh "), "AB3DEFGH");
  assert.equal(reset.normalizeCode(null), "");
});

test("buildResetEmail escapa el correo y muestra el código", () => {
  const mail = reset.buildResetEmail("<b>ana</b>@ejemplo.com", "AB3DEFGH");
  assert.match(mail.subject, /Eco/);
  assert.ok(mail.html.includes("AB3DEFGH"));
  assert.ok(mail.html.includes("&lt;b&gt;"));
  assert.ok(!mail.html.includes("<b>ana</b>@ejemplo.com"));
});
