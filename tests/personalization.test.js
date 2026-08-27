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
