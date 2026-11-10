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

  /* Proyecto Supabase de Eco; el anon/publishable key es seguro en cliente (RLS en el backend). */
  var ECO_SUPABASE_URL = "https://jtrrqbnxhxxqjcpizjuy.supabase.co";
  var ECO_SUPABASE_ANON_KEY = "sb_publishable_snBSbyTIkIU8_qQdsw_SpQ_6p5UDuxS";

  function setStatus(msg, ok) {
    loginStatus.textContent = msg;
    loginStatus.className = "form-status " + (ok ? "is-ok" : "is-error");
  }

  function authenticateEco(email, password) {
    return fetch(ECO_SUPABASE_URL + "/auth/v1/token?grant_type=password", {
      method: "POST",
      headers: { "Content-Type": "application/json", "apikey": ECO_SUPABASE_ANON_KEY },
      body: JSON.stringify({ email: email, password: password })
    }).then(function (res) {
      return res.json().catch(function () { return {}; }).then(function (data) {
        if (!res.ok) throw new Error((data && (data.error_description || data.msg)) || "invalid-credentials");
        return data;
      });
    });
  }

  var resetBase = loginForm ? (loginForm.getAttribute("data-reset-base") || "/api/reset") : "/api/reset";

  /*
   * El backend siempre responde 200 y solo envía el código de reseteo cuando hay
   * una cuenta real detrás. Evita exponer qué correos están registrados (enumeración de usuarios).
   */
  function requestEcoPasswordReset(email) {
    return fetch(resetBase + "/solicitar", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: email })
    }).then(function (res) {
      if (!res.ok) throw new Error("reset-failed");
    });
  }

  /*
   * Punto de conexión con el servidor de cuentas.
   * Übenplay aún no tiene backend: reemplaza esta rama por una llamada real cuando exista, por ejemplo:
   *   return fetch("/api/login", { method: "POST", headers: {"Content-Type": "application/json"},
   *                                body: JSON.stringify({ email: email, password: password }) });
   * Nunca guardes contraseñas en el navegador ni las valides solo en JavaScript.
   */
  function authenticate(email, password, product) {
    if (product === "eco") return authenticateEco(email, password);
    return Promise.reject(new Error("pending-backend"));
  }

  /* ---------- Olvidé mi contraseña ---------- */
  var forgotLink = document.getElementById("lg-forgot");
  var forgotPanel = document.getElementById("forgot-panel");
  var forgotEmailEl = document.getElementById("forgot-email");
  var forgotStatus = document.getElementById("forgot-status");
  var forgotConfirm = document.getElementById("forgot-confirm");
  var forgotCancel = document.getElementById("forgot-cancel");

  function setForgotStatus(msg, ok) {
    forgotStatus.textContent = msg;
    forgotStatus.className = "form-status " + (ok ? "is-ok" : "is-error");
  }

  if (forgotLink && forgotPanel) {
    forgotLink.addEventListener("click", function () {
      var email = document.getElementById("lg-email");
      if (!EMAIL_RE.test(email.value.trim())) {
        email.setAttribute("aria-invalid", "true");
        setStatus("Escribe tu correo arriba antes de recuperar la contraseña.", false);
        email.focus();
        return;
      }
      forgotEmailEl.textContent = email.value.trim();
      setForgotStatus("", true);
      forgotPanel.hidden = false;
    });
  }

  if (forgotCancel && forgotPanel) {
    forgotCancel.addEventListener("click", function () {
      forgotPanel.hidden = true;
      setForgotStatus("", true);
    });
  }

  /* ---------- Restablecer contraseña (código pendiente) ---------- */
  var loginFields = document.getElementById("login-fields");
  var resetPanel = document.getElementById("reset-panel");
  var resetEmailEl = document.getElementById("reset-email");
  var resetCodeEl = document.getElementById("reset-code");
  var resetPassEl = document.getElementById("reset-pass");
  var resetPassConfirmEl = document.getElementById("reset-pass-confirm");
  var resetStatus = document.getElementById("reset-status");
  var resetConfirm = document.getElementById("reset-confirm");

  function setResetStatus(msg, ok) {
    resetStatus.textContent = msg;
    resetStatus.className = "form-status " + (ok ? "is-ok" : "is-error");
  }

  if (resetConfirm && resetPanel) {
    resetConfirm.addEventListener("click", function () {
      var email = resetEmailEl.textContent;
      var code = resetCodeEl.value.trim();
      var newPassword = resetPassEl.value;
      var newPasswordConfirm = resetPassConfirmEl.value;

      if (code.length !== 8) {
        setResetStatus("El código debe tener 8 caracteres.", false);
        resetCodeEl.focus();
        return;
      }
      if (newPassword.length < 6) {
        setResetStatus("La nueva contraseña debe tener al menos 6 caracteres.", false);
        resetPassEl.focus();
        return;
      }
      if (newPassword !== newPasswordConfirm) {
        setResetStatus("Las contraseñas no coinciden.", false);
        resetPassConfirmEl.focus();
        return;
      }

      setResetStatus("Guardando…", true);
      fetch(resetBase + "/confirmar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email,
          code: code,
          newPassword: newPassword,
          newPasswordConfirm: newPasswordConfirm
        })
      }).then(function (res) {
        return res.json().catch(function () { return {}; }).then(function (data) {
          if (!res.ok) throw new Error((data && data.error) || "reset-failed");
        });
      }).then(function () {
        setResetStatus("Contraseña actualizada. Ingresa de nuevo con tu nueva contraseña.", true);
        resetCodeEl.value = "";
        resetPassEl.value = "";
        resetPassConfirmEl.value = "";
        resetPanel.hidden = true;
        if (loginFields) loginFields.hidden = false;
      }).catch(function (err) {
        setResetStatus(err && err.message ? err.message : "No pudimos actualizar la contraseña. Intenta de nuevo.", false);
      });
    });
  }

  if (forgotConfirm && forgotPanel) {
    forgotConfirm.addEventListener("click", function () {
      var productInput = loginForm.querySelector('input[name="lg-product"]:checked');
      var product = productInput ? productInput.value : "ubenplay";
      var email = forgotEmailEl.textContent;

      if (product !== "eco") {
        setForgotStatus("El portal de clientes aún no está habilitado. Escríbenos a fernando.escobar@exxasoft.com para acceder.", false);
        return;
      }

      setForgotStatus("Enviando…", true);
      requestEcoPasswordReset(email)
        .then(function () {
          setForgotStatus("Si el correo está registrado, recibirás un código para restablecer tu contraseña.", true);
        })
        .catch(function () {
          setForgotStatus("No pudimos enviar el correo. Intenta de nuevo en unos minutos.", false);
        });
    });
  }

  if (loginForm) {
    loginForm.addEventListener("submit", function (e) {
      e.preventDefault();
      var email = document.getElementById("lg-email");
      var pass = document.getElementById("lg-pass");
      var productInput = loginForm.querySelector('input[name="lg-product"]:checked');
      var product = productInput ? productInput.value : "ubenplay";

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

      var trimmedEmail = email.value.trim();

      function doLogin() {
        authenticate(trimmedEmail, pass.value, product)
          .then(function () {
            setStatus("Ingreso correcto. Redirigiendo…", true);
          })
          .catch(function () {
            if (product === "eco") {
              setStatus("Correo o contraseña incorrectos.", false);
            } else {
              setStatus("El portal de clientes aún no está habilitado. Escríbenos a fernando.escobar@exxasoft.com para acceder.", false);
            }
          });
      }

      if (product === "eco") {
        fetch(resetBase + "/estado?email=" + encodeURIComponent(trimmedEmail))
          .then(function (res) { return res.json(); })
          .then(function (data) {
            if (data && data.pending) {
              if (loginFields) loginFields.hidden = true;
              if (resetPanel) resetPanel.hidden = false;
              if (resetEmailEl) resetEmailEl.textContent = trimmedEmail;
              setResetStatus("", true);
              return;
            }
            doLogin();
          })
          .catch(function () {
            doLogin();
          });
      } else {
        doLogin();
      }
    });
  }
})();
