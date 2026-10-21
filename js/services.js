/* =========================================================
   ExxaSoft — Panal interactivo de servicios
   ========================================================= */
(function () {
  "use strict";

  var SERVICES = [
    {
      name: "Software a medida",
      text: "Sistemas diseñados alrededor de tus procesos reales, no al revés. Construimos solo lo que aporta valor a tu operación."
    },
    {
      name: "Aplicaciones móviles",
      text: "Apps para Android e iOS, estables y fáciles de usar, conectadas con tus sistemas y pensadas para tus usuarios."
    },
    {
      name: "Desarrollo web",
      text: "Sitios, portales y sistemas web responsive que funcionan en cualquier navegador, computadora o celular."
    },
    {
      name: "Análisis de requisitos",
      text: "Levantamos y ordenamos tus requerimientos para que el proyecto arranque con un alcance claro y sin sorpresas."
    },
    {
      name: "Datos e información",
      text: "Bases de datos, reportes y gestión de la información para que tomes decisiones con datos confiables."
    },
    {
      name: "Integración y soporte",
      text: "Conectamos tu software con otros servicios y lo acompañamos con mantenimiento y soporte continuo."
    }
  ];

  /* Vecinas de cada servicio en el panal (índices de data-service) */
  var NEIGHBORS = {
    0: [2, 4], 1: [3, 5], 2: [0, 3], 3: [2, 1], 4: [0, 5], 5: [4, 1]
  };

  var buttons = document.querySelectorAll("[data-service]");
  var comb = document.querySelector(".comb");
  var detail = document.querySelector(".service-detail");
  var nameEl = document.getElementById("service-name");
  var textEl = document.getElementById("service-text");
  if (!buttons.length || !nameEl || !textEl) return;

  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var current = null;

  function cellOf(index) {
    var btn = buttons[index];
    return btn ? btn.parentElement : null;
  }

  function ping(cell, delay) {
    if (!cell) return;
    setTimeout(function () {
      cell.classList.remove("ping");
      void cell.offsetWidth;             // reinicia la animación
      cell.classList.add("ping");
    }, delay);
  }

  /* Onda: primero las vecinas directas, luego el resto del panal */
  function ripple(index) {
    if (reduceMotion) return;
    var near = NEIGHBORS[index] || [];
    near.forEach(function (n) { ping(cellOf(n), 120); });
    for (var i = 0; i < buttons.length; i++) {
      if (i !== index && near.indexOf(i) === -1) ping(cellOf(i), 280);
    }
  }

  function select(btn, animate) {
    if (btn === current) return;
    var index = Number(btn.getAttribute("data-service"));
    var item = SERVICES[index];
    if (!item) return;
    current = btn;

    buttons.forEach(function (b) { b.setAttribute("aria-pressed", String(b === btn)); });
    nameEl.textContent = item.name;
    textEl.textContent = item.text;

    if (!animate) return;
    if (comb) comb.classList.add("is-charged");
    if (detail) {
      detail.classList.remove("is-updated");
      void detail.offsetWidth;
      detail.classList.add("is-updated");
    }
    ripple(index);

    /* Pulso en la malla de fondo desde la celda elegida */
    if (typeof window.exxaHexPulse === "function") {
      var r = btn.getBoundingClientRect();
      window.exxaHexPulse(r.left + r.width / 2, r.top + r.height / 2);
    }
  }

  buttons.forEach(function (btn) {
    btn.setAttribute("aria-pressed", "false");
    btn.addEventListener("click", function () { select(btn, true); });
    btn.addEventListener("focus", function () { select(btn, true); });
    btn.addEventListener("mouseenter", function () {
      if (window.matchMedia("(hover: hover)").matches) select(btn, true);
    });
  });

  /* El núcleo deja de "cargarse" cuando el puntero sale del panal */
  if (comb) {
    comb.addEventListener("mouseleave", function () { comb.classList.remove("is-charged"); });
  }

  select(buttons[0], false);
})();
