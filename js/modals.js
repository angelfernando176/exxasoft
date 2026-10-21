/* =========================================================
   ExxaSoft — Ventanas modales, pestañas e ingreso "Mi cuenta"
   ========================================================= */
(function () {
  "use strict";

  /* ---------- Modales (<dialog>) ---------- */
  function openDialog(id) {
    var dlg = document.getElementById(id);
    if (!dlg) return;
    if (typeof dlg.showModal === "function") {
      dlg.showModal();
    } else {
      dlg.setAttribute("open", "");
    }
    var first = dlg.querySelector("input, a[href], button:not(.modal-close)");
    if (first) first.focus();
  }

  function closeDialog(dlg) {
    if (!dlg) return;
    if (typeof dlg.close === "function") dlg.close();
    else dlg.removeAttribute("open");
  }

  document.querySelectorAll("[data-open]").forEach(function (btn) {
    btn.addEventListener("click", function () {
      openDialog(btn.getAttribute("data-open"));
    });
  });

  document.querySelectorAll("[data-close]").forEach(function (el) {
    el.addEventListener("click", function () {
      closeDialog(el.closest("dialog"));
    });
  });

  /* Cerrar al hacer clic fuera del contenido */
  document.querySelectorAll("dialog.modal").forEach(function (dlg) {
    dlg.addEventListener("click", function (e) {
      if (e.target === dlg) closeDialog(dlg);
    });
  });

  /* Abrir "Mi cuenta" al llegar desde otra página con #mi-cuenta */
  if (window.location.hash === "#mi-cuenta") openDialog("dlg-login");

  /* ---------- Pestañas Misión / Visión ---------- */
  var tabs = Array.prototype.slice.call(document.querySelectorAll('[role="tab"]'));

  function activateTab(tab, focus) {
    tabs.forEach(function (t) {
      var selected = t === tab;
      t.setAttribute("aria-selected", String(selected));
      t.tabIndex = selected ? 0 : -1;
      var panel = document.getElementById(t.getAttribute("aria-controls"));
      if (panel) panel.hidden = !selected;
    });
    if (focus) tab.focus();
  }

  tabs.forEach(function (tab, i) {
    tab.addEventListener("click", function () { activateTab(tab, false); });
    tab.addEventListener("keydown", function (e) {
      var next = null;
      if (e.key === "ArrowRight") next = tabs[(i + 1) % tabs.length];
      if (e.key === "ArrowLeft") next = tabs[(i - 1 + tabs.length) % tabs.length];
      if (next) { e.preventDefault(); activateTab(next, true); }
    });
  });

  /* Enlaces del menú "ExxaSoft > Misión / Visión" */
  document.querySelectorAll("[data-tab]").forEach(function (link) {
    link.addEventListener("click", function () {
      var tab = document.getElementById("tab-" + link.getAttribute("data-tab"));
      if (tab) activateTab(tab, false);
    });
  });

  /* ---------- Mostrar / ocultar contraseña ---------- */
  var passToggle = document.querySelector(".pass-toggle");
  var passInput = document.getElementById("lg-pass");
  if (passToggle && passInput) {
    passToggle.addEventListener("click", function () {
      var show = passInput.type === "password";
      passInput.type = show ? "text" : "password";
      passToggle.textContent = show ? "Ocultar" : "Ver";
      passToggle.setAttribute("aria-pressed", String(show));
      passToggle.setAttribute("aria-label", show ? "Ocultar contraseña" : "Mostrar contraseña");
    });
  }

  /* ---------- Formulario de ingreso ---------- */
  var loginForm = document.getElementById("login-form");
  var loginStatus = document.getElementById("lg-status");
  var EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

  function setStatus(msg, ok) {
    loginStatus.textContent = msg;
    loginStatus.className = "form-status " + (ok ? "is-ok" : "is-error");
  }

  /*
   * Punto de conexión con el servidor de cuentas.
   * Reemplaza el cuerpo de esta función por una llamada real, por ejemplo:
   *   return fetch("/api/login", { method: "POST", headers: {"Content-Type": "application/json"},
   *                                body: JSON.stringify({ email: email, password: password }) });
   * Nunca guardes contraseñas en el navegador ni las valides solo en JavaScript.
   */
  function authenticate(email, password) {
    return Promise.reject(new Error("pending-backend"));
  }

  if (loginForm) {
    loginForm.addEventListener("submit", function (e) {
      e.preventDefault();
      var email = document.getElementById("lg-email");
      var pass = document.getElementById("lg-pass");

      email.setAttribute("aria-invalid", String(!EMAIL_RE.test(email.value.trim())));
      pass.setAttribute("aria-invalid", String(pass.value.length < 6));

      if (!EMAIL_RE.test(email.value.trim())) {
        setStatus("Escribe un correo válido, por ejemplo nombre@empresa.com.", false);
        email.focus();
        return;
      }
      if (pass.value.length < 6) {
        setStatus("La contraseña debe tener al menos 6 caracteres.", false);
        pass.focus();
        return;
      }

      setStatus("Verificando…", true);
      authenticate(email.value.trim(), pass.value)
        .then(function () {
          setStatus("Ingreso correcto. Redirigiendo…", true);
        })
        .catch(function () {
          setStatus("El portal de clientes aún no está habilitado. Escríbenos a fernando.escobar@exxasoft.com para acceder.", false);
        });
    });
  }
})();
