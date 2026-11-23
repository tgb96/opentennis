const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

test("el regreso al club comparte encabezado sin una segunda barra", () => {
  const html = fs.readFileSync(path.join(__dirname, "..", "admin/apps-script/Index.html"), "utf8");
  const header = html.match(/<header class="topbar">([\s\S]*?)<\/header>/)[1];
  assert.match(header, /aria-label="Volver al club"/);
  assert.match(header, /href="https:\/\/opentennis\.cl\/index\.html" target="_top"/);
  assert.match(header, /id="refreshButton"/);
  assert.doesNotMatch(html, /class="club-return-nav"/);
  assert.equal((html.match(/class="club-return-link"/g) || []).length, 1);
});

test("un resultado nuevo propone hoy aunque exista un registro pendiente con fecha antigua", () => {
  const client = fs.readFileSync(path.join(__dirname, "..", "admin/apps-script/Client.html"), "utf8");
  assert.match(client, /var hasSavedFinalResult = finalStatuses\.indexOf\(match\.status\) >= 0;/);
  assert.match(client, /var suggestedDate = isFinalSelection && !hasSavedFinalResult/);
  assert.match(client, /\? todayForInput\(\)/);
  assert.doesNotMatch(client, /!match\.record && \["jugado"/);
  assert.match(client, /timeZone: "America\/Santiago"/);
  assert.doesNotMatch(client, /scheduledDateIsFuture/);
});

test("el administrador 2027 separa el uso semanal de la estructura avanzada", () => {
  const html = fs.readFileSync(path.join(__dirname, "..", "admin/apps-script/Index.html"), "utf8");
  const client = fs.readFileSync(path.join(__dirname, "..", "admin/apps-script/Season2027Client.html"), "utf8");
  const styles = fs.readFileSync(path.join(__dirname, "..", "admin/apps-script/Styles.html"), "utf8");
  assert.match(html, /data-2027-work-mode="daily" aria-current="page"/);
  assert.match(html, /data-2027-work-mode="advanced"/);
  assert.match(html, /Base protegida/);
  assert.match(client, /workspaceMode: "daily"/);
  assert.match(styles, /season-2027-panel:not\(\.is-advanced\) \.admin-advanced-only/);
});

test("el administrador conserva cuatro vistas y reemplaza por coordinar por pendientes", () => {
  const html = fs.readFileSync(path.join(__dirname, "..", "admin/apps-script/Index.html"), "utf8");
  assert.match(html, /data-view="week"[^>]*>Esta semana</);
  assert.match(html, /data-view="pending"[^>]*>Pendientes</);
  assert.match(html, /data-view="upcoming"[^>]*>Programados</);
  assert.match(html, /data-view="all"[^>]*>Todos</);
  assert.doesNotMatch(html, /data-view="recent"|>Resultados<|>Por coordinar</);
});

test("el buscador reconoce ambos jugadores sin importar orden, tildes o mayúsculas", () => {
  const client = fs.readFileSync(path.join(__dirname, "..", "admin/apps-script/Client.html"), "utf8");
  const normalizeSource = client.slice(client.indexOf("function normalize"), client.indexOf("function matchesPlayerQuery"));
  const matcherSource = client.slice(client.indexOf("function matchesPlayerQuery"), client.indexOf("function setText"));
  const context = vm.createContext({ String });
  vm.runInContext(normalizeSource + matcherSource, context);
  const match = { player1: "Ángelo Basualto", player2: "Claudio Aedo" };

  assert.equal(context.matchesPlayerQuery(match, "angelo claudio"), true);
  assert.equal(context.matchesPlayerQuery(match, "AEDO BASUALTO"), true);
  assert.equal(context.matchesPlayerQuery(match, "Claudio Ángelo"), true);
  assert.equal(context.matchesPlayerQuery(match, "Ángelo Daniel"), false);
  assert.match(client, /query \? true : matchBelongsToView\(match\)/);
  assert.match(client, /!query \|\| !isAlreadyRegistered/);
  assert.match(client, /if \(normalize\(state\.query\)\) setView\("all"\)/);
});
