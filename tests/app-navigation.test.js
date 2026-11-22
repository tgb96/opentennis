const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const appSource = fs.readFileSync(
  path.join(__dirname, "..", "assets", "js", "app.js"),
  "utf8"
);
const matchesSource = fs.readFileSync(
  path.join(__dirname, "..", "partidos.html"),
  "utf8"
);
const appCssSource = fs.readFileSync(
  path.join(__dirname, "..", "assets", "css", "app.css"),
  "utf8"
);
const publicPages = [
  "index.html", "partidos.html", "tablas.html", "eventos.html", "torneo.html",
  "competencia.html", "resultados-2025.html", "reglas.html", "reglas-2027.html", "marcador.html"
];

test("el doble atrás se limita a la aplicación instalada en Android", () => {
  assert.match(appSource, /isStandalone\(\) && isAndroid/);
  assert.doesNotMatch(appSource, /isStandalone\(\) \|\| isTouchDevice/);
});

test("el segundo atrás no recorre todo el historial previo", () => {
  assert.match(appSource, /setTimeout\(\(\) => window\.history\.back\(\), 0\)/);
  assert.doesNotMatch(appSource, /history\.go\(-window\.history\.length\)/);
});

test("la navegación interna reemplaza la entrada base de la PWA", () => {
  assert.match(appSource, /window\.location\.replace\(destination\)/);
  assert.match(appSource, /pendingNavigation = destination\.href/);
});

test("todas las páginas públicas muestran el actualizador general", () => {
  publicPages.forEach(file => {
    const html = fs.readFileSync(path.join(__dirname, "..", file), "utf8");
    assert.match(html, /assets\/js\/app\.js\?v=34/, file);
  });
  assert.match(appSource, /id = 'appGlobalRefresh'/);
  assert.match(appSource, /Actualizar toda la aplicación/);
});

test("la actualización general conserva preferencias y renueva solo las copias de la app", () => {
  assert.match(appSource, /key\.startsWith\(DATA_CACHE_PREFIX\)/);
  assert.match(appSource, /key\.startsWith\('open-tennis-'\)/);
  assert.match(appSource, /key !== ACTIVE_CACHE_NAME/);
  assert.match(appSource, /registration\.update\(\)/);
  assert.match(appSource, /window\.fetch\(checkUrl\.href, \{ cache: 'no-store' \}\)/);
  assert.doesNotMatch(appSource, /localStorage\.clear\(\)/);
  assert.doesNotMatch(appSource, /registration\.unregister\(\)/);
});

test("la próxima fecha se recalcula al retomar la aplicación o cambiar el día", () => {
  assert.match(matchesSource, /function actualizarProgramacionSiCambioElDia/);
  assert.match(matchesSource, /visibilitychange/);
  assert.match(matchesSource, /window\.addEventListener\("focus"/);
  assert.match(matchesSource, /obtenerSemanaProxima\(publicRows\)/);
});

test("la programación completa separa y ordena una fecha extraordinaria", () => {
  assert.match(matchesSource, /function agruparProgramacionPorJornada/);
  assert.match(matchesSource, /Fecha extra · \$\{fecha\}/);
  assert.match(matchesSource, /agruparProgramacionPorJornada\(filas, mapaSemanas\)/);
  assert.match(matchesSource, /normalizar\(fila\.tipoProgramacion\) === "recuperacion"/);
  assert.match(matchesSource, /\? etiquetaJornadaProgramacion\(\[fila\], mapaSemanas\)/);
  assert.match(matchesSource, /tieneProgramacionExplicita/);
});

test("el calendario personal conserva la fecha canónica de cada semana", () => {
  assert.match(matchesSource, /function completarMapaSemanasCanonicas/);
  assert.match(matchesSource, /const oficiales = filasSemana\.filter/);
  assert.match(matchesSource, /: etiquetaSemana\(fila\.semana, mapaSemanas\)/);
});

test("las tarjetas no repiten estados administrativos", () => {
  assert.match(matchesSource, /isAdministrativeStatusNote\(obs\)\) return ""/);
  assert.match(matchesSource, /!\["oficial", "reprogramado"\]\.includes\(type\)/);
});

test("Partidos elimina rótulos repetidos cuando ya existe un jugador seleccionado", () => {
  assert.match(matchesSource, /select id="publicPlayerSelect" aria-label="Mi jugador"/);
  assert.doesNotMatch(matchesSource, /<label>Mi jugador/);
  assert.match(matchesSource, /id="personalResultsBlock" class="bloque personal-results-block"/);
  assert.match(matchesSource, /classList\.toggle\("has-selected-player", Boolean\(publicPlayerSelect\.value\)\)/);
});

test("Partidos excluye de Mi jugador a quienes se retiraron", () => {
  assert.match(matchesSource, /\.filter\(jugadorPersonalDisponible\)/);
  assert.match(matchesSource, /withdrawalForPlayer\(player\)/);
  assert.match(matchesSource, /localStorage\.removeItem\(PERSONAL_PLAYER_KEY\)/);
});

test("el historial del próximo rival conserva contraste dentro de la tarjeta verde", () => {
  assert.match(appCssSource, /\.next-h2h \.h2h-competition-group \{[^}]*background:rgba\(5,45,34/);
  assert.match(appCssSource, /\.next-h2h \.h2h-competition-group \.next-h2h-matches li \{ color:#f2f7f4; \}/);
});
