/* =========================================================
   ExxaSoft — Malla hexagonal interactiva del fondo del inicio
   - Las celdas cercanas al puntero se iluminan.
   - Pulsos de "datos" encienden celdas al azar y viajan a sus vecinas.
   - Respeta "reducir movimiento": solo dibuja la malla fija.
   ========================================================= */
(function () {
  "use strict";

  var canvas = document.querySelector(".hero-canvas");
  if (!canvas || !canvas.getContext) return;

  var hero = canvas.parentElement;
  var ctx = canvas.getContext("2d");
  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  var R = 30;                        // radio del hexágono (px)
  var HW = Math.sqrt(3) * R;         // ancho de un hexágono "punta arriba"
  var VS = 1.5 * R;                  // separación vertical entre filas
  var REACH = 170;                   // alcance de la luz del puntero (px)

  var TEAL = "14, 111, 124";
  var HONEY = "229, 160, 13";
  var INK = "20, 38, 59";

  var cells = [];
  var width = 0, height = 0, dpr = 1;
  var mouse = { x: -9999, y: -9999, active: false };
  var running = false, visible = true, lastSpark = 0;

  /* ---- Construcción de la malla ---- */
  function build() {
    var rect = hero.getBoundingClientRect();
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    width = rect.width;
    height = rect.height;
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    cells = [];
    var rows = Math.ceil(height / VS) + 2;
    var cols = Math.ceil(width / HW) + 2;
    for (var r = -1; r < rows; r++) {
      for (var c = -1; c < cols; c++) {
        cells.push({
          x: c * HW + (r % 2 ? HW / 2 : 0),
          y: r * VS,
          row: r,
          col: c,
          glow: 0,          // brillo por el puntero
          spark: 0,         // brillo por pulso de datos
          sparkColor: TEAL
        });
      }
    }
    draw();
  }

  function hexPath(x, y, rad) {
    ctx.beginPath();
    for (var i = 0; i < 6; i++) {
      var a = Math.PI / 180 * (60 * i - 90);
      var px = x + rad * Math.cos(a);
      var py = y + rad * Math.sin(a);
      if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    }
    ctx.closePath();
  }

  /* ---- Dibujo de un cuadro ---- */
  function draw() {
    ctx.clearRect(0, 0, width, height);
    ctx.lineWidth = 1;

    for (var i = 0; i < cells.length; i++) {
      var cell = cells[i];

      // Malla base
      hexPath(cell.x, cell.y, R - 1.5);
      ctx.strokeStyle = "rgba(" + INK + ", .07)";
      ctx.stroke();

      // Luz del puntero
      if (cell.glow > 0.01) {
        hexPath(cell.x, cell.y, R - 1.5);
        ctx.fillStyle = "rgba(" + TEAL + "," + (cell.glow * 0.10) + ")";
        ctx.fill();
        ctx.strokeStyle = "rgba(" + TEAL + "," + (cell.glow * 0.55) + ")";
        ctx.lineWidth = 1.2;
        ctx.stroke();
        ctx.lineWidth = 1;
      }

      // Pulso de datos
      if (cell.spark > 0.01) {
        hexPath(cell.x, cell.y, R - 1.5);
        ctx.fillStyle = "rgba(" + cell.sparkColor + "," + (cell.spark * 0.22) + ")";
        ctx.fill();
        ctx.strokeStyle = "rgba(" + cell.sparkColor + "," + (cell.spark * 0.7) + ")";
        ctx.stroke();
      }
    }
  }

  /* ---- Pulsos: encienden una celda y se propagan a una vecina ---- */
  function neighbor(cell) {
    var odd = Math.abs(cell.row % 2) === 1;
    var options = [
      [0, -1], [0, 1],
      [-1, odd ? 0 : -1], [-1, odd ? 1 : 0],
      [1, odd ? 0 : -1], [1, odd ? 1 : 0]
    ];
    var pick = options[Math.floor(Math.random() * options.length)];
    var row = cell.row + pick[0], col = cell.col + pick[1];
    for (var i = 0; i < cells.length; i++) {
      if (cells[i].row === row && cells[i].col === col) return cells[i];
    }
    return null;
  }

  function spark(cell, color, hops) {
    if (!cell) return;
    cell.spark = 1;
    cell.sparkColor = color;
    if (hops > 0) {
      setTimeout(function () { spark(neighbor(cell), color, hops - 1); }, 140);
    }
  }

  /* ---- Bucle de animación ---- */
  function tick(time) {
    if (!running) return;

    if (time - lastSpark > 700) {
      lastSpark = time;
      var start = cells[Math.floor(Math.random() * cells.length)];
      spark(start, Math.random() < 0.35 ? HONEY : TEAL, 4);
    }

    for (var i = 0; i < cells.length; i++) {
      var cell = cells[i];
      var target = 0;
      if (mouse.active) {
        var dx = cell.x - mouse.x, dy = cell.y - mouse.y;
        var d = Math.sqrt(dx * dx + dy * dy);
        if (d < REACH) target = 1 - d / REACH;
      }
      cell.glow += (target - cell.glow) * 0.18;
      cell.spark *= 0.94;
    }

    draw();
    requestAnimationFrame(tick);
  }

  function start() {
    if (running || reduceMotion || !visible || document.hidden) return;
    running = true;
    requestAnimationFrame(tick);
  }

  function stop() { running = false; }

  /* ---- Eventos ---- */
  hero.addEventListener("pointermove", function (e) {
    var rect = hero.getBoundingClientRect();
    mouse.x = e.clientX - rect.left;
    mouse.y = e.clientY - rect.top;
    mouse.active = true;
  });
  hero.addEventListener("pointerleave", function () { mouse.active = false; });

  var resizeTimer;
  window.addEventListener("resize", function () {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(build, 150);
  });

  document.addEventListener("visibilitychange", function () {
    if (document.hidden) stop(); else start();
  });

  // Solo anima mientras el inicio está en pantalla
  if ("IntersectionObserver" in window) {
    new IntersectionObserver(function (entries) {
      visible = entries[0].isIntersecting;
      if (visible) start(); else stop();
    }).observe(hero);
  }

  /* Permite que otros scripts lancen un pulso desde un punto de la pantalla */
  window.exxaHexPulse = function (clientX, clientY) {
    if (reduceMotion || !cells.length) return;
    var rect = hero.getBoundingClientRect();
    var x = clientX - rect.left, y = clientY - rect.top;
    var best = null, bestD = Infinity;
    for (var i = 0; i < cells.length; i++) {
      var dx = cells[i].x - x, dy = cells[i].y - y, d = dx * dx + dy * dy;
      if (d < bestD) { bestD = d; best = cells[i]; }
    }
    for (var k = 0; k < 3; k++) spark(best, HONEY, 5);
  };

  build();
  start();
})();
