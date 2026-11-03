const test = require("node:test");
const assert = require("node:assert/strict");
const events = require("../assets/js/season-events.js");

test("la resolución alcanza los ocho partidos de Felipe", () => {
  assert.equal(events.WITHDRAWAL.date, "29/10/2026");
  assert.equal(events.WITHDRAWAL.matchIds.filter(id => id.includes("angelo-basualto")).length, 1);
  assert.equal(new Set(events.WITHDRAWAL.matchIds.filter(id => id.startsWith("2026-"))).size, 8);
});

test("un partido pendiente se transforma en W/O para el rival", () => {
  const match = {
    matchId: "2026-s1-a-felipe-reyes-jose-astete",
    player1: "Jose Astete",
    player2: "Felipe Reyes",
    status: "por_coordinar"
  };
  const resolved = events.applyToPersonalMatches([match])[0];
  assert.equal(resolved.status, "jugado");
  assert.equal(resolved.record.winner, "Jose Astete");
  assert.equal(resolved.record.pointsPlayer1, 3);
  assert.equal(resolved.record.resultWeb, "Ganador Jose Astete por W/O 6-0 6-0");
});

test("los tres resultados reales quedan archivados sin alterar la clasificación", () => {
  const archived = events.archivedForPlayers("Tomás Gómez", "Felipe Reyes");
  assert.deepEqual(archived.map(match => [match.date, match.score]), [["17/10/2026", "6-0, 6-2"]]);
});

test("Felipe queda último con cero puntos y ocho partidos", () => {
  const ranking = events.applyToRankings(events.RANKING_A.map((row, index) => ({
    category: "A",
    position: index + 1,
    player: row[0],
    points: row[0] === "Felipe Reyes" ? 9 : row[1] - 3,
    played: row[0] === "Felipe Reyes" ? 3 : row[2] - (events.WITHDRAWAL.archived.some(match => [match.player1, match.player2].includes(row[0])) ? 0 : 1)
  })));
  const felipe = ranking.find(row => row.player === "Felipe Reyes");
  const jose = ranking.find(row => row.player === "José Astete");
  assert.deepEqual([felipe.position, felipe.points, felipe.played], [9, 0, 8]);
  assert.deepEqual([jose.position, jose.points, jose.played], [1, 15, 5]);
});
