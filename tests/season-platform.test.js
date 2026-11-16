const test = require("node:test");
const assert = require("node:assert/strict");
const platform = require("../assets/js/season-platform.js");
const identities = require("../assets/js/player-identities.js");

const data = {
  players: [
    { id: "jugador-maria-jose", name: "María José Valladares", aliases: "M.José Valladares", active: true },
    { id: "jugador-cata", name: "Catalina Valladares", aliases: "", active: true }
  ],
  competitions: [{ id: "esc-1", type: "ladder", name: "Apertura 2027", edition: "2027-1", published: true, categories: [{ id: "d", name: "Damas" }], rankings: [] }],
  matches: [
    { id: "m1", competitionId: "esc-1", player1Id: "jugador-maria-jose", player2Id: "jugador-cata", winnerId: "jugador-cata", status: "jugado", countsForH2h: true, score: "6-4 6-4", date: "2027-03-06" },
    { id: "m2", competitionId: "esc-1", player1Id: "jugador-maria-jose", player2Id: "", status: "bye", countsForH2h: false }
  ]
};

test("la app enlaza las escalerillas 2027 a programación, tablas y Cara a Cara", () => {
  assert.match(platform.competitionLinksHtml(data, "programacion"), /competencia\.html\?id=esc-1&amp;vista=programacion/);
  const view = platform.renderLadderPage(data, "esc-1", "h2h");
  assert.match(view.html, /Programación/);
  assert.match(view.html, /Cara a Cara/);
  assert.match(view.html, /reglas-2027\.html/);
  assert.equal(view.h2h.length, 1);
});

test("los alias administrados mantienen la identidad histórica 2025–2027", () => {
  identities.registerPlayers(data.players);
  assert.equal(identities.idForName("M.José Valladares"), "jugador-maria-jose");
  assert.equal(identities.samePlayer("M.José Valladares", "María José Valladares"), true);
});

