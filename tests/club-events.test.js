const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const clubEvents = require("../assets/js/club-events.js");

const data = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "data", "actividades-2026.json"), "utf8"));
const interclub = data.events[0];

test("el interclub se destaca del 5 al 15 y luego queda en el archivo", () => {
  assert.equal(clubEvents.phase(interclub, "2026-11-04"), "hidden");
  assert.equal(clubEvents.phase(interclub, "2026-11-05"), "upcoming");
  assert.equal(clubEvents.phase(interclub, "2026-11-07"), "upcoming");
  assert.equal(clubEvents.phase(interclub, "2026-11-08"), "followup");
  assert.equal(clubEvents.phase(interclub, "2026-11-15"), "followup");
  assert.equal(clubEvents.phase(interclub, "2026-11-16"), "archived");
});

test("la programación tiene catorce partidos en cuatro bloques", () => {
  const groups = clubEvents.groupedMatches(interclub);
  assert.equal(interclub.matches.length, 14);
  assert.deepEqual(groups.map(group => [group.time, group.matches.length]), [
    ["13:00", 4], ["13:30", 2], ["14:15", 4], ["14:45", 4]
  ]);
  assert.equal(new Set(interclub.matches.map(match => match.id)).size, 14);
});

test("personaliza la tarjeta con el partido del jugador elegido", () => {
  assert.equal(clubEvents.findPlayerMatch(interclub, "Tomás Gómez").id, "ic05");
  assert.equal(clubEvents.findPlayerMatch(interclub, "José Astete").clubPlayer, "Jose Astete");
  assert.equal(clubEvents.findPlayerMatch(interclub, "Christian Linares").clubPlayer, "Cristhian Linares");
  assert.equal(clubEvents.findPlayerMatch(interclub, "Felipe Reyes"), null);

  const view = clubEvents.renderHome(data, "Tomás Gómez", "2026-11-05");
  assert.match(view.featuredHtml, /Tu partido interclub/);
  assert.match(view.featuredHtml, /13:30/);
  assert.match(view.featuredHtml, /Rodrigo Vega vs Tomás Gómez/);
  assert.match(view.dialogHtml, /is-player/);
});

test("registra el empate sin alterar la escalerilla ni inventar marcadores", () => {
  const source = fs.readFileSync(path.join(__dirname, "..", "assets", "js", "club-events.js"), "utf8");
  assert.doesNotMatch(source, /FIXTURE_URL|REGISTRO_URL|RANKINGS_URL|applyToRankings/);
  assert.deepEqual(clubEvents.resultStats(interclub), { total: 14, completed: 14, clubWins: 7 });
  assert.equal(interclub.finalResult, "Empate 7–7");
  assert.equal(interclub.finalScore, "7–7");
  assert.ok(interclub.matches.every(match => ["Ganó", "Perdió"].includes(match.result)));
  assert.deepEqual(interclub.matches.map(match => match.clubPlayer), [
    "Cristhian Linares", "Aníbal Valenzuela", "Constanza Núñez", "Angelo Basualto",
    "Jose Astete", "Marcelo López", "Tomás Gómez", "Genaro Espinoza",
    "Javier González", "Claudio Aedo", "Daniel Vega", "Hernán Bravo",
    "Nicolás Collao", "Matías Arellano"
  ]);
  assert.deepEqual(interclub.matches.map(match => match.score), [
    "1–0", "1–1", "2–1", "3–1", "3–2", "4–2", "5–2",
    "6–2", "7–2", "7–3", "7–4", "7–5", "7–6", "7–7"
  ]);

  const view = clubEvents.renderHome(data, "Tomás Gómez", "2026-11-08");
  assert.match(view.featuredHtml, /Finalizado/);
  assert.doesNotMatch(view.featuredHtml, /Hasta el 11 de noviembre/);
  assert.match(view.featuredHtml, /club-event-final-score/);
  assert.match(view.featuredHtml, />7–7</);
  assert.match(view.featuredHtml, /club-event-player-result is-loss">Derrota/);
  assert.doesNotMatch(view.featuredHtml, /Remontada final|Del 5–7 al 7–7/);
  assert.doesNotMatch(view.dialogHtml, /Orden de los resultados/);
  assert.match(view.dialogHtml, /club-event-results-order/);
  assert.match(view.dialogHtml, /club-event-match is-win/);
  assert.match(view.dialogHtml, /club-event-match-result is-win">Victoria/);
  assert.match(view.dialogHtml, /club-event-match-result is-loss">Derrota/);
  assert.doesNotMatch(view.dialogHtml, /<b>Tu partido<\/b>/);
  assert.match(view.dialogHtml, /Omar Álvarez[\s\S]*Cristhian Linares<\/span>[\s\S]*club-event-score[\s\S]*1–0[\s\S]*Derrota/);
  assert.ok(view.dialogHtml.indexOf("Cristhian Linares") < view.dialogHtml.indexOf("Aníbal Valenzuela"));
  assert.ok(view.dialogHtml.indexOf("Nicolás Collao") < view.dialogHtml.indexOf("Matías Arellano"));
  assert.equal((view.dialogHtml.match(/club-event-match is-win/g) || []).length, 7);
  assert.match(view.dialogHtml, /Marcador acumulado: FacuTenis–Open Tennis/);
  assert.match(view.archiveHtml, /Interclubes del club/);
  assert.match(view.archiveHtml, /Empate 7–7/);
});

test("genera un calendario con fecha, lugar y nombre correctos", () => {
  const calendar = clubEvents.calendarText(interclub);
  assert.match(calendar, /BEGIN:VCALENDAR/);
  assert.match(calendar, /SUMMARY:FacuTenis vs Open Tennis Huechuraba/);
  assert.match(calendar, /DTSTART:20261107T160000Z/);
  assert.match(calendar, /Caletera Ote\. Gral\. San Martín 8521/);
});

test("desde el 16 permanece solamente en el archivo de interclubes", () => {
  const view = clubEvents.renderHome(data, "Tomás Gómez", "2026-11-16");
  assert.equal(view.featuredHtml, "");
  assert.match(view.archiveHtml, /Interclubes del club/);
  assert.match(view.archiveHtml, /FacuTenis vs Open Tennis Huechuraba/);
  assert.match(view.archiveHtml, /Empate 7–7/);
  assert.match(view.dialogHtml, /Resultados de los partidos/);
});
