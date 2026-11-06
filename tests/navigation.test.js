const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const publicPages = [
  "index.html",
  "partidos.html",
  "tablas.html",
  "reglas.html",
  "resultados-2025.html",
  "marcador.html"
];

test("el marcador permanece accesible desde toda la navegación pública", () => {
  for (const file of publicPages) {
    const html = fs.readFileSync(path.join(root, file), "utf8");
    assert.match(html, /<a href="marcador\.html" data-page="marcador\.html">[\s\S]*?<span class="nav-label">Marcador<\/span>[\s\S]*?<\/a>/, file);
  }
});

test("las tarjetas de partidos no recuperan el botón Abrir marcador", () => {
  const html = fs.readFileSync(path.join(root, "partidos.html"), "utf8");
  assert.doesNotMatch(html, />Abrir marcador</);
});
