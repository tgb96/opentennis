const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const appsScriptDirectory = path.join(__dirname, "..", "admin", "apps-script");
const context = vm.createContext({ Date, Object, String, Number, Math, RegExp, Error });

for (const fileName of ["Config.gs", "ResultEngine.gs"]) {
  vm.runInContext(
    fs.readFileSync(path.join(appsScriptDirectory, fileName), "utf8"),
    context,
    { filename: fileName }
  );
}

test("calcula un triunfo en dos sets y asigna 3–0", () => {
  const result = context.adminCalculatePlayedResult_({
    player1: "Diego Fossa",
    player2: "Nicolás Collao",
    set1Player1: 7,
    set1Player2: 5,
    set2Player1: 6,
    set2Player2: 4
  });

  assert.equal(result.winner, "Diego Fossa");
  assert.equal(result.loser, "Nicolás Collao");
  assert.equal(result.resultType, "2 sets");
  assert.equal(result.resultWeb, "Ganador Diego Fossa 7-5 6-4");
  assert.deepEqual(Array.from(result.points), [3, 0]);
});

test("calcula super tie-break con el marcador desde la perspectiva del ganador", () => {
  const result = context.adminCalculatePlayedResult_({
    player1: "Daniel Vega",
    player2: "Cristhian Linares",
    set1Player1: 6,
    set1Player2: 2,
    set2Player1: 2,
    set2Player2: 6,
    stbPlayer1: 2,
    stbPlayer2: 10
  });

  assert.equal(result.winner, "Cristhian Linares");
  assert.equal(result.resultType, "Super tie-break");
  assert.equal(result.resultWeb, "Ganador Cristhian Linares 2-6 6-2 10-2");
  assert.deepEqual(Array.from(result.points), [1, 2]);
  assert.deepEqual(Array.from(result.setsWon), [1, 2]);
});

test("rechaza sets y super tie-breaks incompletos", () => {
  assert.throws(() => context.adminRegularSetWinner_(6, 5, "El set"), /no tiene un marcador/);
  assert.throws(() => context.adminSuperTieBreakWinner_(10, 9), /diferencia de 2/);
});

test("W/O del jugador 1 entrega la victoria al jugador 2", () => {
  const result = context.adminCalculateWoResult_({
    player1: "Jugador Uno",
    player2: "Jugador Dos",
    status: "wo_j1"
  });

  assert.equal(result.winner, "Jugador Dos");
  assert.equal(result.loser, "Jugador Uno");
  assert.equal(result.resultWeb, "Ganador Jugador Dos por W/O");
  assert.deepEqual(Array.from(result.points), [0, 3]);
});

test("construye exactamente las 23 columnas del registro", () => {
  const row = context.adminBuildRegistroRow_({
    player1: "Jugador Uno",
    player2: "Jugador Dos",
    date: "26/8/2026",
    matchId: "2026-s1-a-jugador-dos-jugador-uno"
  }, {
    status: "pendiente",
    date: "2026-08-27",
    notes: "Nueva fecha por confirmar"
  });

  assert.equal(row.length, 23);
  assert.equal(row[0], "27/8/2026");
  assert.equal(row[3], "si");
  assert.equal(row[4], "Nueva fecha por confirmar");
  assert.equal(row[21], "jugadoruno|jugadordos");
  assert.equal(row[22], "2026-s1-a-jugador-dos-jugador-uno");
});

test("rechaza fechas inexistentes", () => {
  assert.throws(() => context.adminNormalizeDate_("31/2/2026"), /no es válida/);
});

test("iguala fechas con y sin ceros iniciales", () => {
  assert.equal(context.adminComparableDate_("06/06/2026"), "2026-06-06");
  assert.equal(context.adminComparableDate_("6/6/2026"), "2026-06-06");
  assert.equal(
    context.adminPairDateKey_("María José Valladares", "Catalina Valladares", "6/6/2026"),
    context.adminPairDateKey_("Catalina Valladares", "María José Valladares", "06/06/2026")
  );
});
