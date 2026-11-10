/* =========================================================
   ExxaSoft — Formulario de contacto
   Valida los datos y los envía al servicio de contacto
   (carpeta server/), que los reenvía por Zoho Mail.
   La dirección del servicio está en el atributo data-endpoint
   del formulario.
   ========================================================= */
(function () {
  "use strict";

  var form = document.getElementById("contact-form");
  if (!form) return;

  var TO = "fernando.escobar@exxasoft.com";
  var EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
  var status = document.getElementById("cf-status");
  var button = form.querySelector('button[type="submit"]');
  var sending = false;

  function setStatus(msg, ok) {
    status.textContent = msg;
    status.className = "form-status " + (ok ? "is-ok" : "is-error");
  }

  function check(input, valid) {
    input.setAttribute("aria-invalid", String(!valid));
    return valid;
  }

  function setBusy(busy) {
    sending = busy;
    button.disabled = busy;
    button.setAttribute("aria-busy", String(busy));
    button.textContent = busy ? "Enviando…" : "Enviar mensaje";
  }

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    if (sending) return;

    var name = form.elements.name;
    var email = form.elements.email;
    var service = form.elements.service;
    var message = form.elements.message;

    var okName = check(name, name.value.trim().length >= 2);
    var okEmail = check(email, EMAIL_RE.test(email.value.trim()));
    var okMsg = check(message, message.value.trim().length >= 10);

    if (!okName) { setStatus("Escribe tu nombre.", false); name.focus(); return; }
    if (!okEmail) { setStatus("Escribe un correo válido para poder responderte.", false); email.focus(); return; }
    if (!okMsg) { setStatus("Cuéntanos un poco más en el mensaje (mínimo 10 caracteres).", false); message.focus(); return; }

    setBusy(true);
    setStatus("", true);

    fetch(form.getAttribute("data-endpoint") || "/api/contacto", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: name.value.trim(),
        email: email.value.trim(),
        service: service.value,
        message: message.value.trim(),
        website: form.elements.website.value
      })
    })
      .then(function (res) {
        return res.json().catch(function () { return {}; }).then(function (data) {
          if (res.ok && data.ok) {
            form.reset();
            setStatus("¡Gracias! Recibimos tu mensaje y te responderemos pronto.", true);
          } else {
            setStatus(data.error || "No pudimos enviar tu mensaje. Escríbenos directamente a " + TO + ".", false);
          }
        });
      })
      .catch(function () {
        setStatus("No pudimos conectar con el servidor. Escríbenos directamente a " + TO + ".", false);
      })
      .then(function () { setBusy(false); });
  });

  /* Quitar la marca de error mientras el visitante corrige */
  form.addEventListener("input", function (e) {
    if (e.target.getAttribute("aria-invalid") === "true") {
      e.target.removeAttribute("aria-invalid");
    }
  });
})();
