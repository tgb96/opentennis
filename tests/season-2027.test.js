const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const appsScriptDirectory = path.join(__dirname, "..", "admin", "apps-script");
const Utilities = {
  getUuid: () => "12345678-abcd",
  formatDate: date => [date.getFullYear(), String(date.getMonth() + 1).padStart(2, "0"), String(date.getDate()).padStart(2, "0")].join("-")
};
const context = vm.createContext({ Date, Object, String, Number, Math, RegExp, Error, Array, JSON, Utilities });
for (const fileName of ["Config.gs", "ResultEngine.gs", "Season2027.gs"]) {
  vm.runInContext(fs.readFileSync(path.join(appsScriptDirectory, fileName), "utf8"), context, { filename: fileName });
}

function players(prefix, count) {
  return Array.from({ length: count }, (_, index) => ({ id: `${prefix}-${index + 1}`, name: `${prefix} ${index + 1}` }));
}

test("la programación 2027 reparte todas las categorías y nunca duplica un jugador el mismo día", () => {
  const schedule = context.admin2027BuildLadderSchedule_({
    startDate: "2027-03-06",
    courts: ["1", "2"],
    turns: ["12:00", "13:45", "15:30", "17:15", "19:00"],
    seed: "prueba estable",
    categories: [
      { id: "a", name: "A", players: players("A", 8), format: "unica", order: 1 },
      { id: "b", name: "B", players: players("B", 6), format: "unica", order: 2 },
      { id: "d", name: "Damas", players: players("D", 5), format: "ida_vuelta", order: 3 }
    ]
  });
  assert.equal(schedule.matches.length, 63);
  assert.ok(schedule.weeks >= 10);
  const playerDates = new Set();
  for (const match of schedule.matches) {
    for (const playerId of [match.player1Id, match.player2Id]) {
      const key = `${playerId}|${match.currentDate}`;
      assert.equal(playerDates.has(key), false, `${playerId} fue programado dos veces el ${match.currentDate}`);
      playerDates.add(key);
    }
  }
  for (const categoryId of ["a", "b", "d"]) {
    const weeks = schedule.matches.filter(match => match.categoryId === categoryId).map(match => match.week);
    assert.ok(Math.max(...weeks) - Math.min(...weeks) >= Math.floor((schedule.weeks - 1) / 2), `${categoryId} no quedó distribuida en el periodo`);
  }
});

test("el cuadro acepta 13 jugadores, crea 3 byes y no los cuenta como partidos reales", () => {
  const bracket = context.admin2027BuildBracket_({ competitionId: "torneo-13", participants: players("J", 13), seed: "sorteo" });
  assert.equal(bracket.capacity, 16);
  assert.equal(bracket.byes, 3);
  assert.equal(bracket.matches.length, 15);
  assert.equal(bracket.matches.filter(match => match.status === "bye").length, 3);
  assert.equal(bracket.matches.filter(match => match.status === "bye").every(match => Boolean(match.winner)), true);
});

test("el motor 2027 aplica 2–1 en super tie-break y no suma sus puntos como games", () => {
  const result = context.admin2027CalculateResult_({
    resultType: "jugado", set1Player1: 6, set1Player2: 3, set2Player1: 4, set2Player2: 6, stbPlayer1: 10, stbPlayer2: 7
  }, "Uno", "Dos");
  assert.deepEqual(Array.from(result.points), [2, 1]);
  assert.deepEqual(Array.from(result.setsWon), [1, 1]);
  assert.equal(Number(result.set1[0]) + Number(result.set2[0]), 10);
  assert.equal(context.admin2027ScoreText_(result), "6-3 4-6 10-7");
});

test("el motor 2027 convierte W/O en 6-0 6-0 y retiro en el puntaje definido", () => {
  const walkover = context.admin2027CalculateResult_({ resultType: "wo_j2" }, "Uno", "Dos");
  assert.deepEqual(Array.from(walkover.points), [3, 0]);
  assert.equal(context.admin2027ScoreText_(walkover), "W/O 6-0 6-0");
  const retirement = context.admin2027CalculateResult_({
    resultType: "retiro_j2", set1Player1: 3, set1Player2: 6, set2Player1: 2, set2Player2: 1
  }, "Uno", "Dos");
  assert.deepEqual(Array.from(retirement.points), [2, 1]);
  assert.match(context.admin2027ScoreText_(retirement), /^Retiro /);
});

