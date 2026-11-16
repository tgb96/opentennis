const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const publicPages = [
  "index.html",
  "partidos.html",
  "tablas.html",
  "eventos.html",
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

test("Torneos e interclubes usa la pestaña abreviada Torneos", () => {
  for (const file of publicPages) {
    const html = fs.readFileSync(path.join(root, file), "utf8");
    assert.match(html, /<a href="eventos\.html" data-page="eventos\.html"[^>]*>[\s\S]*?<span class="nav-label">Torneos<\/span>[\s\S]*?<\/a>/, file);
  }
});

test("el reglamento sale del menú principal y queda dentro de Partidos", () => {
  for (const file of publicPages) {
    const html = fs.readFileSync(path.join(root, file), "utf8");
    assert.doesNotMatch(html, /data-page="reglas\.html"/, file);
  }
  const matches = fs.readFileSync(path.join(root, "partidos.html"), "utf8");
  const rules = fs.readFileSync(path.join(root, "reglas.html"), "utf8");
  assert.match(matches, /class="championship-rules-link" href="reglas\.html"/);
  assert.match(rules, /class="rules-return-link" href="partidos\.html"/);
});

test("las tarjetas de partidos no recuperan el botón Abrir marcador", () => {
  const html = fs.readFileSync(path.join(root, "partidos.html"), "utf8");
  assert.doesNotMatch(html, />Abrir marcador</);
});

test("los resultados del calendario se presentan como Ganó y no como Ganador", () => {
  const html = fs.readFileSync(path.join(root, "partidos.html"), "utf8");
  assert.match(html, /`Ganó \$\{ganadorCorto\}\$\{detalle\} \$\{marcador\}`/);
  assert.doesNotMatch(html, /`Ganador \$\{ganadorCorto\}/);
});

test("el marcador permite escribir nombres que no estén en el listado oficial", () => {
  const html = fs.readFileSync(path.join(root, "marcador.html"), "utf8");
  assert.match(html, /id="customPlayerAInput"/);
  assert.match(html, /id="customPlayerBInput"/);
  assert.match(html, /Otro jugador…/);
  assert.match(html, /const CUSTOM_PLAYER_VALUE = "__custom_player__"/);
  assert.match(html, /function validateSetupPlayers/);
});
