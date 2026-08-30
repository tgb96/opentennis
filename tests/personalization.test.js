const test = require("node:test");
const assert = require("node:assert/strict");
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
    { player1: "Diana", player2: "Ana", status: "jugado", record: { date: "20/8/2026" } }
  ];
  const summary = personal.playerSummary("Ana", matches, [{ player: "Ana", position: 2, points: 6 }], new Date(2026, 7, 27));
  assert.equal(summary.upcoming.player2, "Bea");
  assert.equal(summary.pending.length, 1);
  assert.equal(summary.recent.player1, "Diana");
  assert.equal(summary.ranking.position, 2);
});

test("crea un enlace de marcador precargado", () => {
  const url = personal.markerUrl({ category: "D", player1: "María José", player2: "Sara", matchId: "partido-1" });
  assert.match(url, /categoria=D/);
  assert.match(url, /j1=Mar%C3%ADa\+Jos%C3%A9/);
  assert.match(url, /partido=partido-1/);
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
