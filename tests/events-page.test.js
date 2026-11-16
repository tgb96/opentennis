const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const eventsPage = require("../assets/js/events-page.js");
const data = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "data", "actividades-2026.json"), "utf8"));

test("el interclub finalizado aparece en Torneos e interclubes pasados", () => {
  const view = eventsPage.render(data, "2026-11-16");
  assert.equal(view.upcomingCount, 0);
  assert.equal(view.pastCount, 1);
  assert.match(view.upcomingHtml, /No hay próximos torneos o interclubes publicados/);
  assert.match(view.pastHtml, /Interclub vs FacuTenis/);
  assert.match(view.pastHtml, /7–7/);
  assert.match(view.pastHtml, /torneo\.html\?id=interclub-facutenis-2026-11-07/);
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
