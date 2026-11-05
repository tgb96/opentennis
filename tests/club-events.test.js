const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const clubEvents = require("../assets/js/club-events.js");

const data = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "data", "actividades-2026.json"), "utf8"));
const interclub = data.events[0];

test("el interclub se destaca del 5 al 11 y luego se archiva", () => {
  assert.equal(clubEvents.phase(interclub, "2026-11-04"), "hidden");
  assert.equal(clubEvents.phase(interclub, "2026-11-05"), "upcoming");
  assert.equal(clubEvents.phase(interclub, "2026-11-07"), "upcoming");
  assert.equal(clubEvents.phase(interclub, "2026-11-08"), "followup");
  assert.equal(clubEvents.phase(interclub, "2026-11-11"), "followup");
  assert.equal(clubEvents.phase(interclub, "2026-11-12"), "archived");
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
  assert.deepEqual(clubEvents.findPlayerMatch(interclub, "Tomás Gómez"), interclub.matches[4]);
  assert.equal(clubEvents.findPlayerMatch(interclub, "José Astete").clubPlayer, "Jose Astete");
  assert.equal(clubEvents.findPlayerMatch(interclub, "Christian Linares").clubPlayer, "Cristhian Linares");
  assert.equal(clubEvents.findPlayerMatch(interclub, "Felipe Reyes"), null);

  const view = clubEvents.renderHome(data, "Tomás Gómez", "2026-11-05");
  assert.match(view.featuredHtml, /Tu partido interclub/);
  assert.match(view.featuredHtml, /13:30/);
  assert.match(view.featuredHtml, /Rodrigo Vega vs Tomás Gómez/);
  assert.match(view.dialogHtml, /is-player/);
});

test("no altera la escalerilla y admite resultados posteriores", () => {
  const source = fs.readFileSync(path.join(__dirname, "..", "assets", "js", "club-events.js"), "utf8");
  assert.doesNotMatch(source, /FIXTURE_URL|REGISTRO_URL|RANKINGS_URL|applyToRankings/);
  assert.deepEqual(clubEvents.resultStats(interclub), { total: 14, completed: 0, clubWins: 0 });

  const withResult = JSON.parse(JSON.stringify(interclub));
  withResult.matches[0].result = "6-4, 6-3";
  withResult.matches[0].winner = "Angelo Basualto";
  assert.deepEqual(clubEvents.resultStats(withResult), { total: 14, completed: 1, clubWins: 1 });
});

test("genera un calendario con fecha, lugar y nombre correctos", () => {
  const calendar = clubEvents.calendarText(interclub);
  assert.match(calendar, /BEGIN:VCALENDAR/);
  assert.match(calendar, /SUMMARY:FacuTenis vs Open Tennis Huechuraba/);
  assert.match(calendar, /DTSTART:20261107T160000Z/);
  assert.match(calendar, /Caletera Ote\. Gral\. San Martín 8521/);
});

test("desde el 12 queda visible dentro del archivo de actividades", () => {
  const view = clubEvents.renderHome(data, "Tomás Gómez", "2026-11-12");
  assert.equal(view.featuredHtml, "");
  assert.match(view.archiveHtml, /Actividades del club/);
  assert.match(view.archiveHtml, /Nuestro primer interclub/);
  assert.match(view.dialogHtml, /Programación de partidos/);
});
