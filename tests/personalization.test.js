const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const personal = require("../assets/js/personalization.js");

test("lee rankings por categoría", () => {
  const rows = personal.parseRankings("CATEGORIA A,,,\nN°,Jugador,Puntos,Jugados\n1,Ana,9,3\n,,,\nCATEGORIA D,,,\n1,Bea,6,2");
  assert.deepEqual(rows, [
    { category: "A", position: 1, player: "Ana", points: 9, played: 3 },
    { category: "D", position: 1, player: "Bea", points: 6, played: 2 }
  ]);
});

test("resume próximo partido, pendientes y ranking de un jugador", () => {
  const matches = [
    { player1: "Ana", player2: "Bea", date: "28/8/2026", status: "programado", week: "2" },
    { player1: "Ana", player2: "Carla", date: "21/8/2026", status: "por_coordinar" },
    { player1: "Diana", player2: "Ana", status: "jugado", record: { date: "20/8/2026", winner: "Ana", loser: "Diana" } }
  ];
  const summary = personal.playerSummary("Ana", matches, [{ player: "Ana", category: "B", position: 2, points: 6, played: 1 }], new Date(2026, 7, 27));
  assert.equal(summary.upcoming.player2, "Bea");
  assert.equal(summary.pending.length, 1);
  assert.equal(summary.recent.player1, "Diana");
  assert.equal(summary.ranking.position, 2);
  assert.equal(summary.played, 1);
  assert.equal(summary.wins, 1);
  assert.equal(summary.losses, 0);
  assert.equal(summary.total, 3);
  assert.equal(summary.zone.text, "Ascenso directo");
});

test("calcula récord, últimos tres resultados y zona sin contar un W/O de ambos", () => {
  const matches = [
    { player1: "Ana", player2: "Bea", status: "jugado", record: { date: "20/8/2026", winner: "Ana", loser: "Bea", resultWeb: "Ganador Ana 6-2 6-3" } },
    { player1: "Carla", player2: "Ana", status: "jugado", record: { date: "21/8/2026", winner: "Carla", loser: "Ana", resultWeb: "Ganador Carla 6-4 6-4" } },
    { player1: "Ana", player2: "Diana", status: "jugado", record: { date: "22/8/2026", resultType: "W/O", resultWeb: "W/O ambos" } },
    { player1: "Eva", player2: "Ana", status: "jugado", record: { date: "23/8/2026", winner: "Ana", loser: "Eva", resultWeb: "Ganador Ana 7-5 6-4" } },
    { player1: "Ana", player2: "Fran", status: "programado", date: "30/8/2026" }
  ];
  const rankings = [
    { player: "Ana", category: "A", position: 7, points: 6, played: 3 },
    { player: "Otra", category: "A", position: 1, points: 9, played: 3 },
    { player: "Otra 2", category: "A", position: 2, points: 8, played: 3 },
    { player: "Otra 3", category: "A", position: 3, points: 7, played: 3 },
    { player: "Otra 4", category: "A", position: 4, points: 6, played: 3 },
    { player: "Otra 5", category: "A", position: 5, points: 5, played: 3 },
    { player: "Otra 6", category: "A", position: 6, points: 4, played: 3 },
    { player: "Otra 8", category: "A", position: 8, points: 2, played: 3 },
    { player: "Otra 9", category: "A", position: 9, points: 1, played: 3 }
  ];

  const summary = personal.playerSummary("Ana", matches, rankings, new Date(2026, 7, 24));
  assert.equal(summary.played, 3);
  assert.equal(summary.wins, 2);
  assert.equal(summary.losses, 1);
  assert.equal(summary.recentResults.length, 3);
  assert.equal(summary.recentResults[0].record.date, "23/8/2026");
  assert.equal(summary.zone.text, "Repechaje descenso");
});

test("define todas las zonas del torneo", () => {
  assert.equal(personal.playerZone("A", 1, 9).text, "Líder actual");
  assert.equal(personal.playerZone("A", 8, 9).text, "Descenso directo");
  assert.equal(personal.playerZone("B", 3, 10).text, "Repechaje a A");
  assert.equal(personal.playerZone("C", 2, 8).text, "Ascenso directo");
  assert.equal(personal.playerZone("D", 2, 5).text, "Zona media");
});

test("crea un enlace de marcador precargado", () => {
  const url = personal.markerUrl({ category: "D", player1: "María José", player2: "Sara", matchId: "partido-1" });
  assert.match(url, /categoria=D/);
  assert.match(url, /j1=Mar%C3%ADa\+Jos%C3%A9/);
  assert.match(url, /partido=partido-1/);
});

test("usa rutas limpias en la versión publicada de prueba", () => {
  assert.equal(personal.pageUrl("partidos.html", "/app"), "/partidos");
  assert.equal(personal.pageUrl("tablas.html", "/partidos"), "/tablas");
  assert.equal(personal.markerUrl(null, "/app"), "/marcador");
});

test("mantiene rutas html en la versión oficial y local", () => {
  assert.equal(personal.pageUrl("partidos.html", "/index.html"), "partidos.html");
  assert.equal(personal.pageUrl("tablas.html", "/"), "tablas.html");
});

test("no reutiliza el resultado de la ida en el partido de vuelta", () => {
  const fixture = personal.parseFixture([
    "Semana,Cancha,Turno,Categoría,Jugador 1,Jugador 2,Fecha,Estado,Observaciones,ID partido,Fecha oficial,Cancha oficial,Turno oficial,Tipo programación,Ronda",
    "3,2,1 (12:00-13:30),D,María José Valladares,Catalina Valladares,06/06/2026,,,ida-3,06/06/2026,2,1 (12:00-13:30),oficial,Ida",
    "10,2,1 (12:00-13:30),D,Catalina Valladares,María José Valladares,26/09/2026,,,vuelta-10,26/09/2026,2,1 (12:00-13:30),oficial,Vuelta"
  ].join("\n"));
  const records = personal.parseRecords([
    "Fecha,Jugador 1,Jugador 2,Pendiente,Observaciones,S1 J1,S1 J2,S2 J1,S2 J2,STB J1,STB J2,Sets J1,Sets J2,Ganador,Perdedor,Tipo resultado,Resultado web,PTS J1,PTS J2,PTS Ganador,PTS Perdedor,Clave interna,ID partido",
    "6/6/2026,María José Valladares,Catalina Valladares,,,,,,,,,,,Catalina Valladares,,,Ganador Catalina Valladares,,,,,,ida-3"
  ].join("\n"));
  const matches = personal.joinMatches(fixture, records);
  const summary = personal.playerSummary("Catalina Valladares", matches, [], new Date(2026, 7, 30));

  assert.equal(matches[0].status, "jugado");
  assert.equal(matches[1].status, "programado");
  assert.equal(summary.upcoming.week, "10");
});

test("no duplica un pendiente de la ida en la vuelta", () => {
  const fixture = personal.parseFixture([
    "Semana,Cancha,Turno,Categoría,Jugador 1,Jugador 2,Fecha,Estado,Observaciones,ID partido,Fecha oficial,Cancha oficial,Turno oficial,Tipo programación,Ronda",
    "6,2,2 (13:45-15:15),D,Catalina Valladares,Loreto Pezoa,27/06/2026,,,ida-6,27/06/2026,2,2 (13:45-15:15),oficial,Ida",
    "14,2,1 (12:00-13:30),D,Loreto Pezoa,Catalina Valladares,24/10/2026,,,vuelta-14,24/10/2026,2,1 (12:00-13:30),oficial,Vuelta"
  ].join("\n"));
  const records = personal.parseRecords([
    "Fecha,Jugador 1,Jugador 2,Pendiente,Observaciones,S1 J1,S1 J2,S2 J1,S2 J2,STB J1,STB J2,Sets J1,Sets J2,Ganador,Perdedor,Tipo resultado,Resultado web,PTS J1,PTS J2,PTS Ganador,PTS Perdedor,Clave interna,ID partido",
    "27/6/2026,Catalina Valladares,Loreto Pezoa,si,Postergado,,,,,,,,,,,,,,,,,,ida-6"
  ].join("\n"));
  const summary = personal.playerSummary("Catalina Valladares", personal.joinMatches(fixture, records), [], new Date(2026, 7, 30));

  assert.equal(summary.pending.length, 1);
  assert.equal(summary.pending[0].week, "6");
});

test("una nueva programación explícita reemplaza el pendiente anterior", () => {
  const fixture = personal.parseFixture([
    "Semana,Cancha,Turno,Categoría,Jugador 1,Jugador 2,Fecha,Estado,Observaciones,ID partido,Fecha oficial,Cancha oficial,Turno oficial,Tipo programación,Ronda",
    "9,1,1 (12:00-13:30),A,Ana,Bea,12/09/2026,Programado,,partido-9,01/08/2026,1,1 (12:00-13:30),reprogramado,Única"
  ].join("\n"));
  const records = personal.parseRecords([
    "Fecha,Jugador 1,Jugador 2,Pendiente,Observaciones,S1 J1,S1 J2,S2 J1,S2 J2,STB J1,STB J2,Sets J1,Sets J2,Ganador,Perdedor,Tipo resultado,Resultado web,PTS J1,PTS J2,PTS Ganador,PTS Perdedor,Clave interna,ID partido",
    "1/8/2026,Ana,Bea,si,Postergado,,,,,,,,,,,,,,,,,,partido-9"
  ].join("\n"));
  const summary = personal.playerSummary("Ana", personal.joinMatches(fixture, records), [], new Date(2026, 7, 30));

  assert.equal(summary.pending.length, 0);
  assert.equal(summary.upcoming.week, "9");
});

test("suma el historial 2025 frente al próximo rival", () => {
  const historical = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "data", "resultados-2025.json"), "utf8"));
  const summary = personal.headToHeadSummary("Tomás Gómez", "Felipe Reyes", [], historical);

  assert.equal(summary.total, 1);
  assert.equal(summary.playerWins, 0);
  assert.equal(summary.rivalWins, 1);
  assert.deepEqual(summary.last, {
    season: "2025",
    winner: "Felipe Reyes",
    score: "6-3, 3-6, 10-8"
  });
});
