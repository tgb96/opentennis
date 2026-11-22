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
  "torneo.html",
  "competencia.html",
  "reglas.html",
  "reglas-2027.html",
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

test("el reglamento sale del menú principal y queda después del Cara a Cara en Inicio", () => {
  for (const file of publicPages) {
    const html = fs.readFileSync(path.join(root, file), "utf8");
    assert.doesNotMatch(html, /data-page="reglas\.html"/, file);
  }
  const matches = fs.readFileSync(path.join(root, "partidos.html"), "utf8");
  const home = fs.readFileSync(path.join(root, "index.html"), "utf8");
  const personalization = fs.readFileSync(path.join(root, "assets", "js", "personalization.js"), "utf8");
  const rules = fs.readFileSync(path.join(root, "reglas.html"), "utf8");
  assert.doesNotMatch(matches, /championship-rules-link/);
  assert.doesNotMatch(home, /class="home-rules-shortcut"/);
  assert.match(personalization, /class="home-rules-shortcut home-rules-in-profile"/);
  assert.match(personalization, /Reglamento de la Escalerilla 2026/);
  assert.match(rules, /class="rules-return-link" href="index\.html"/);
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

test("el marcador explica que es una guía y no registra resultados oficiales", () => {
  const html = fs.readFileSync(path.join(root, "marcador.html"), "utf8");
  const css = fs.readFileSync(path.join(root, "assets", "css", "scoreboard.css"), "utf8");
  assert.match(html, /Guía para arbitrar partidos/);
  assert.match(html, /no está conectado con los resultados oficiales del club/);
  assert.match(html, /class="scoreboard-info" role="note"/);
  assert.match(css, /body\.match-active \.scoreboard-info/);
});

test("el marcador destaca sacador y cambio de lado sin mezclar información secundaria", () => {
  const html = fs.readFileSync(path.join(root, "marcador.html"), "utf8");
  assert.match(html, /id="serverBallA"[^>]*>🎾<\/span>/);
  assert.match(html, /id="serverBallB"[^>]*>🎾<\/span>/);
  assert.match(html, /id="statusPriorityLine"/);
  assert.match(html, /function getSideChangeStatus\(state\)/);
  assert.match(html, /return state\.points\[0\] \+ state\.points\[1\] === 0 \? "primary" : "secondary"/);
  assert.match(html, /priority-badge server-priority/);
  assert.match(html, /priority-badge side-priority/);
  assert.match(html, /Cambio de lado en este game/);
  assert.doesNotMatch(html, /id="changeAlert"/);
});

test("el marcador reserva nombres completos para el título y primeros nombres para el tanteo", () => {
  const html = fs.readFileSync(path.join(root, "marcador.html"), "utf8");
  const css = fs.readFileSync(path.join(root, "assets", "css", "scoreboard.css"), "utf8");
  assert.match(html, /function fitMatchBannerTitle\(\)/);
  assert.match(css, /\.match-banner-names\s*\{[^}]*white-space:\s*nowrap !important;/s);
  assert.match(html, /if \(normalized\.startsWith\("maria jose "\)\)\s*\{\s*return "María José";/s);
  assert.match(html, /return parts\[0\];/);
  assert.doesNotMatch(html, /lastInitial/);
  assert.match(html, /Set 3 · STB/);
  assert.match(css, /\.status-priority\.has-side-change/);
});
