const test = require("node:test");
const assert = require("node:assert/strict");
const data = require("../assets/js/data-model.js");

test("genera el mismo ID aunque se invierta el orden de los jugadores", () => {
  const base = {
    season: "2026",
    week: "9",
    category: "Categoría A",
    player1: "José Astete",
    player2: "Diego Fossa"
  };

  const reversed = {
    ...base,
    player1: base.player2,
    player2: base.player1
  };

  assert.equal(data.createMatchId(base), data.createMatchId(reversed));
  assert.equal(data.createMatchId(base), "2026-s9-categoria-a-diego-fossa-jose-astete");
});

test("respeta un ID explícito y lo normaliza", () => {
  assert.equal(
    data.resolveMatchId({ matchId: " 2026 / Semana 9 / A / Partido 01 " }),
    "2026-semana-9-a-partido-01"
  );
});

test("normaliza los estados admitidos", () => {
  assert.equal(data.normalizeStatus("Partido jugado"), data.MATCH_STATUSES.JUGADO);
  assert.equal(data.normalizeStatus("Postergado"), data.MATCH_STATUSES.REPROGRAMADO);
  assert.equal(data.normalizeStatus("W/O Jugador 1"), data.MATCH_STATUSES.WO_J1);
  assert.equal(data.normalizeStatus("W.O. ambos"), data.MATCH_STATUSES.WO_AMBOS);
  assert.equal(data.normalizeStatus(""), data.MATCH_STATUSES.PROGRAMADO);
});

test("detecta IDs de partido duplicados", () => {
  const matches = [
    { matchId: "partido-1" },
    { matchId: "partido-2" },
    { matchId: "partido-1" }
  ];

  assert.deepEqual(data.findDuplicateMatchIds(matches), ["partido-1"]);
});
