const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const eventsPage = require("../assets/js/events-page.js");
const data = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "data", "actividades-2026.json"), "utf8"));

test("el archivo muestra el interclub y el primer torneo del club", () => {
  const view = eventsPage.render(data, "2026-11-16");
  assert.equal(view.upcomingCount, 0);
  assert.equal(view.pastCount, 2);
  assert.match(view.upcomingHtml, /No hay próximos torneos o interclubes publicados/);
  assert.match(view.pastHtml, /Interclub vs FacuTenis/);
  assert.match(view.pastHtml, /7–7/);
  assert.match(view.pastHtml, /torneo\.html\?id=interclub-facutenis-2026-11-07/);
  assert.match(view.pastHtml, /Torneo Singles Abril-Mayo 2026/);
  assert.match(view.pastHtml, /Campeón: José Astete/);
  assert.match(view.pastHtml, /torneo\.html\?id=torneo-singles-abril-mayo-2026/);
  assert.doesNotMatch(view.pastHtml, /<details/);
  assert.doesNotMatch(view.pastHtml, /Resultados de los partidos/);
});

test("la tarjeta abre una página oficial con toda la información del interclub", () => {
  const view = eventsPage.renderDetail(data, "interclub-facutenis-2026-11-07", "Tomás Gómez", "2026-11-16");
  assert.equal(view.title, "Interclub vs FacuTenis");
  assert.match(view.html, /Nuestro primer interclub/);
  assert.match(view.html, /Resultado final/);
  assert.match(view.html, /7–7/);
  assert.match(view.html, /Resultados de los partidos/);
  assert.match(view.html, /Rodrigo Vega <i>vs<\/i> Tomás Gómez/);
  assert.match(view.html, /club-event-match-result is-loss">Derrota/);
});

test("los cuadros admiten cualquier cantidad de participantes con byes automáticos", () => {
  assert.equal(eventsPage.bracketCapacity(3), 4);
  assert.equal(eventsPage.bracketCapacity(5), 8);
  assert.equal(eventsPage.bracketCapacity(13), 16);
  assert.equal(eventsPage.bracketCapacity(21), 32);
  assert.equal(eventsPage.bracketCapacity(33), 64);
  assert.deepEqual(eventsPage.tournamentSummary({ participantCount: 13 }), {
    participants: 13,
    capacity: 16,
    byes: 3
  });
});

test("el primer torneo conserva cruces y campeón sin incorporarse al Cara a Cara", () => {
  const tournament = data.events.find(event => event.id === "torneo-singles-abril-mayo-2026");
  assert.ok(tournament);
  assert.equal(tournament.countsForH2H, false);
  assert.equal(tournament.participants.length, 18);
  assert.equal(tournament.rounds.length, 5);
  assert.equal(tournament.champion, "José Astete");
  assert.equal(tournament.runnerUp, "Nicolás Collao");

  const view = eventsPage.renderDetail(data, tournament.id, "", "2026-11-16");
  assert.equal(view.title, "Torneo Singles Abril-Mayo 2026");
  assert.match(view.html, /Primer torneo del club/);
  assert.match(view.html, /José Astete/);
  assert.match(view.html, /Nicolás Collao/);
  assert.match(view.html, /Fase previa/);
  assert.match(view.html, /Octavos de final/);
  assert.match(view.html, /Cuartos de final/);
  assert.match(view.html, /Semifinales/);
  assert.match(view.html, /Final/);
  assert.match(view.html, /Jaime Valdebenito/);
  assert.match(view.html, /Daniel Vega/);
  assert.match(view.html, /6-1, 6-3/);
  assert.match(view.html, /W\/O/);
  assert.match(view.html, /Marcador no disponible/);
  assert.match(view.html, /no se incorporan al Cara a Cara/);
  assert.match(view.html, /events-preliminary-grid/);
  assert.match(view.html, /events-bracket-round/);
  assert.match(view.html, /events-connector-in/);
  assert.match(view.html, /is-pair-start/);
  assert.match(view.html, /is-pair-end/);
  assert.match(view.html, /is-champion-path/);
  assert.match(view.html, /is-champion-branch/);
});
