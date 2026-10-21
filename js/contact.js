/* =========================================================
   ExxaSoft — Formulario de contacto
   Sin servidor: valida los datos y abre el correo del visitante
   con el mensaje ya redactado. Para enviar desde el servidor,
   reemplaza la parte "mailto" por una llamada a tu API.
   ========================================================= */
(function () {
  "use strict";

  var form = document.getElementById("contact-form");
  if (!form) return;

  var TO = "fernando.escobar@exxasoft.com";
  var EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
  var status = document.getElementById("cf-status");

  function setStatus(msg, ok) {
    status.textContent = msg;
    status.className = "form-status " + (ok ? "is-ok" : "is-error");
  }

  function check(input, valid) {
    input.setAttribute("aria-invalid", String(!valid));
    return valid;
  }

  form.addEventListener("submit", function (e) {
    e.preventDefault();

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

    var subject = "Consulta web: " + service.value;
    var bodyText =
      "Nombre: " + name.value.trim() + "\n" +
      "Correo: " + email.value.trim() + "\n" +
      "Interés: " + service.value + "\n\n" +
      message.value.trim();

    window.location.href = "mailto:" + TO +
      "?subject=" + encodeURIComponent(subject) +
      "&body=" + encodeURIComponent(bodyText);

    setStatus("Abrimos tu aplicación de correo con el mensaje listo. Solo presiona Enviar.", true);
  });

  /* Quitar la marca de error mientras el visitante corrige */
  form.addEventListener("input", function (e) {
    if (e.target.getAttribute("aria-invalid") === "true") {
      e.target.removeAttribute("aria-invalid");
    }
  });
})();
