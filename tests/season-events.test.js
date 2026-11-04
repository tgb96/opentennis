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

test("completa el octavo registro aunque no exista todavía en la hoja", () => {
  const records = events.applyToTableRecords([], [{
    matchId: "2026-s15-a-felipe-reyes-nicolas-collao",
    jugador1: "Felipe Reyes",
    jugador2: "Nicolás Collao"
  }]);
  assert.equal(records.length, 1);
  assert.equal(records[0].ganador, "Nicolás Collao");
  assert.equal(records[0].resultadoWeb, "Ganador Nicolás Collao por W/O 6-0 6-0");
  assert.deepEqual([records[0].setsJ1, records[0].setsJ2, records[0].ptsJ1, records[0].ptsJ2], [0, 2, 0, 3]);
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

test("corrige la categoría cuando la tabla la llama CATEGORIA A", () => {
  const ranking = events.applyToRankings([
    { categoria: "CATEGORIA A", posicion: "1", jugador: "Jose Astete", puntos: "12", jugados: "4" },
    { categoria: "CATEGORIA A", posicion: "2", jugador: "Felipe Reyes", puntos: "9", jugados: "3" },
    { categoria: "CATEGORIA A", posicion: "3", jugador: "Nicolás Collao", puntos: "8", jugados: "4" }
  ]);
  assert.deepEqual(ranking.map(row => [row.jugador, row.puntos, row.jugados, row.posicion]), [
    ["Jose Astete", "15", "5", "1"],
    ["Nicolás Collao", "11", "5", "2"],
    ["Felipe Reyes", "0", "8", "3"]
  ]);
});

test("mantiene a Felipe último si la hoja ya tiene 0 puntos y 8 jugados", () => {
  const ranking = events.applyToRankings([
    { category: "A", position: 1, player: "Felipe Reyes", points: 0, played: 8 },
    { category: "A", position: 2, player: "Claudio Aedo", points: 4, played: 5 }
  ]);
  assert.equal(ranking[0].player, "Claudio Aedo");
  assert.deepEqual([ranking[1].player, ranking[1].position, ranking[1].points, ranking[1].played], ["Felipe Reyes", 2, 0, 8]);
});
