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
