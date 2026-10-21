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

  var buttons = document.querySelectorAll("[data-service]");
  var nameEl = document.getElementById("service-name");
  var textEl = document.getElementById("service-text");
  if (!buttons.length || !nameEl || !textEl) return;

  function select(btn) {
    var item = SERVICES[Number(btn.getAttribute("data-service"))];
    if (!item) return;
    buttons.forEach(function (b) { b.setAttribute("aria-pressed", String(b === btn)); });
    nameEl.textContent = item.name;
    textEl.textContent = item.text;
  }

  buttons.forEach(function (btn) {
    btn.setAttribute("aria-pressed", "false");
    btn.addEventListener("click", function () { select(btn); });
    btn.addEventListener("mouseenter", function () {
      if (window.matchMedia("(hover: hover)").matches) select(btn);
    });
  });

  select(buttons[0]);
})();
