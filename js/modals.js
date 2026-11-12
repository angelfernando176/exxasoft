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

  /* ---------- "Mi cuenta": elegir producto ---------- */
  var ubenSoonBtn = document.getElementById("lg-uben-soon");
  var loginStatus = document.getElementById("lg-status");

  if (ubenSoonBtn && loginStatus) {
    ubenSoonBtn.addEventListener("click", function () {
      loginStatus.textContent = "ÜbenPlay todavía no tiene portal propio. Muy pronto vas a poder ingresar desde acá.";
      loginStatus.className = "form-status is-ok";
    });
  }
})();
