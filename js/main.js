/* =========================================================
   ExxaSoft — Navegación general (todas las páginas)
   ========================================================= */
(function () {
  "use strict";

  var body = document.body;
  var toggle = document.querySelector(".nav-toggle");
  var subToggles = document.querySelectorAll(".sub-toggle");

  /* ---- Año automático en el pie de página ---- */
  document.querySelectorAll(".js-year").forEach(function (el) {
    el.textContent = new Date().getFullYear();
  });

  /* ---- Menú móvil ---- */
  function setMenu(open) {
    body.classList.toggle("nav-open", open);
    if (toggle) {
      toggle.setAttribute("aria-expanded", String(open));
      toggle.setAttribute("aria-label", open ? "Cerrar menú" : "Abrir menú");
    }
  }

  if (toggle) {
    toggle.addEventListener("click", function () {
      setMenu(!body.classList.contains("nav-open"));
    });
  }

  /* ---- Submenús desplegables ---- */
  function closeSubmenus(except) {
    subToggles.forEach(function (btn) {
      if (btn !== except) btn.setAttribute("aria-expanded", "false");
    });
  }

  subToggles.forEach(function (btn) {
    btn.addEventListener("click", function (e) {
      e.stopPropagation();
      var open = btn.getAttribute("aria-expanded") === "true";
      closeSubmenus(btn);
      btn.setAttribute("aria-expanded", String(!open));
    });
  });

  document.addEventListener("click", function (e) {
    if (!e.target.closest(".has-sub")) closeSubmenus(null);
  });

  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape") {
      closeSubmenus(null);
      setMenu(false);
    }
  });

  /* Cerrar menús al elegir un enlace interno */
  document.querySelectorAll(".nav-panel a").forEach(function (link) {
    link.addEventListener("click", function () {
      closeSubmenus(null);
      setMenu(false);
    });
  });

  /* Al pasar a escritorio, cerrar el menú móvil */
  window.addEventListener("resize", function () {
    if (window.innerWidth > 900) setMenu(false);
  });

  /* ---- Resaltar la sección visible en el menú ---- */
  var sections = document.querySelectorAll("main section[id]");
  if ("IntersectionObserver" in window && sections.length) {
    var links = document.querySelectorAll(".menu-link[href^='#']");
    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        links.forEach(function (l) {
          l.classList.toggle("is-active", l.getAttribute("href") === "#" + entry.target.id);
        });
      });
    }, { rootMargin: "-45% 0px -50% 0px" });
    sections.forEach(function (s) { observer.observe(s); });
  }
})();
