(function initSeasonEvents(root, factory) {
  const api = factory();
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (root) root.OPEN_TENNIS_EVENTS = api;
})(typeof window !== "undefined" ? window : null, function createSeasonEvents() {
  "use strict";

  const WITHDRAWAL = Object.freeze({
    player: "Felipe Reyes",
    category: "A",
    date: "29/10/2026",
    label: "Renunció al club",
    matchIds: Object.freeze([
      "2026-s1-a-felipe-reyes-jose-astete",
      "2026-s2-a-claudio-aedo-felipe-reyes",
      "2026-s5-a-angelo-basualto-felipe-reyes",
      "2026-s8-a-felipe-reyes-luis-flores",
      "2026-s9-a-felipe-reyes-tomas-gomez",
      "2026-s11-a-felipe-reyes-marcelo-lopez",
      "2026-s12-a-diego-fossa-felipe-reyes",
      "2026-s15-a-felipe-reyes-nicolas-collao"
    ]),
    archived: Object.freeze([
      { matchId: "2026-s8-a-felipe-reyes-luis-flores", date: "11/07/2026", player1: "Felipe Reyes", player2: "Luis Flores", winner: "Felipe Reyes", score: "6-1, 6-1" },
      { matchId: "2026-s9-a-felipe-reyes-tomas-gomez", date: "17/10/2026", player1: "Felipe Reyes", player2: "Tomás Gómez", winner: "Felipe Reyes", score: "6-0, 6-2" },
      { matchId: "2026-s11-a-felipe-reyes-marcelo-lopez", date: "24/10/2026", player1: "Felipe Reyes", player2: "Marcelo López", winner: "Felipe Reyes", score: "6-1, 6-1" }
    ])
  });

  const RANKING_A = Object.freeze([
    ["José Astete", 15, 5], ["Nicolás Collao", 11, 5], ["Diego Fossa", 9, 3],
    ["Angelo Basualto", 9, 4], ["Tomás Gómez", 7, 3], ["Marcelo López", 6, 6],
    ["Luis Flores", 5, 5], ["Claudio Aedo", 4, 5], ["Felipe Reyes", 0, 8]
  ]);

  function key(value) {
    return String(value || "").toLowerCase().normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, " ").trim();
  }

  function categoryCode(row) {
    const value = String(row && (row.category || row.categoria) || "").toUpperCase().trim();
    const match = value.match(/(?:CATEGORIA\s+)?([A-D])$/);
    return match ? match[1] : value;
  }

  function matchIdOf(match) {
    return String(match && (match.matchId || match.id) || "").trim().toLowerCase();
  }

  function resolutionForMatch(matchOrId) {
    const id = typeof matchOrId === "string" ? matchOrId.toLowerCase() : matchIdOf(matchOrId);
    if (!WITHDRAWAL.matchIds.includes(id)) return null;
    const match = typeof matchOrId === "object" ? matchOrId : null;
    if (!match) return { date: WITHDRAWAL.date, player: WITHDRAWAL.player };
    const player1 = match.player1 || match.jugador1;
    const player2 = match.player2 || match.jugador2;
    const winner = key(player1) === key(WITHDRAWAL.player) ? player2 : player1;
    return { date: WITHDRAWAL.date, player: WITHDRAWAL.player, winner, loser: WITHDRAWAL.player };
  }

  function archivedForMatch(matchOrId) {
    const id = typeof matchOrId === "string" ? matchOrId.toLowerCase() : matchIdOf(matchOrId);
    return WITHDRAWAL.archived.find(item => item.matchId === id) || null;
  }

  function archivedForPlayers(player, rival) {
    const wanted = [key(player), key(rival)].sort().join("|");
    return WITHDRAWAL.archived.filter(item => [key(item.player1), key(item.player2)].sort().join("|") === wanted);
  }

  function applyToPersonalMatches(matches) {
    return (matches || []).map(match => {
      const resolution = resolutionForMatch(match);
      if (!resolution) return match;
      const player1Wins = key(match.player1) !== key(WITHDRAWAL.player);
      return Object.assign({}, match, {
        status: "jugado",
        record: Object.assign({}, match.record || {}, {
          date: WITHDRAWAL.date,
          player1: match.player1,
          player2: match.player2,
          pending: "",
          notes: "Resolución directiva por renuncia al club",
          winner: resolution.winner,
          loser: WITHDRAWAL.player,
          resultType: "W/O",
          resultWeb: `Ganador ${resolution.winner} por W/O 6-0 6-0`,
          pointsPlayer1: player1Wins ? 3 : 0,
          pointsPlayer2: player1Wins ? 0 : 3,
          matchId: match.matchId
        })
      });
    });
  }

  function applyToRankings(rankings) {
    const source = (rankings || []).slice();
    const categoryA = source.filter(row => categoryCode(row) === "A");
    const felipe = categoryA.find(row => key(row.player || row.jugador) === key(WITHDRAWAL.player));
    if (!felipe) return source;
    const alreadyResolved = Number(felipe.played || felipe.jugados) >= 8 && Number(felipe.points || felipe.puntos) === 0;

    const alreadyPlayed = new Set(WITHDRAWAL.archived.flatMap(match => [key(match.player1), key(match.player2)]));
    const adjusted = categoryA.map(row => {
      const playerKey = key(row.player || row.jugador);
      const oldPosition = Number(row.position || row.posicion || 999);
      const oldPoints = Number(row.points || row.puntos || 0);
      const oldPlayed = Number(row.played || row.jugados || 0);
      const isFelipe = playerKey === key(WITHDRAWAL.player);
      const points = alreadyResolved ? oldPoints : (isFelipe ? 0 : oldPoints + 3);
      const played = alreadyResolved ? oldPlayed : (isFelipe ? 8 : oldPlayed + (alreadyPlayed.has(playerKey) ? 0 : 1));
      return Object.assign({}, row, { points, played, _previousPosition: oldPosition });
    }).sort((a, b) => {
      const aIsFelipe = key(a.player || a.jugador) === key(WITHDRAWAL.player);
      const bIsFelipe = key(b.player || b.jugador) === key(WITHDRAWAL.player);
      if (aIsFelipe !== bIsFelipe) return aIsFelipe ? 1 : -1;
      return Number(b.points) - Number(a.points) || a._previousPosition - b._previousPosition;
    })
      .map((row, index) => {
        const position = index + 1;
        const clean = Object.assign({}, row, { position, posicion: String(position), puntos: String(row.points), jugados: String(row.played) });
        delete clean._previousPosition;
        return clean;
      });

    let aIndex = 0;
    return source.map(row => categoryCode(row) === "A" ? adjusted[aIndex++] : row);
  }

  function applyToTableRecords(records, fixture) {
    const source = (records || []).slice();
    const existingIds = new Set(source.map(record => matchIdOf(record)).filter(Boolean));

    (fixture || []).forEach(match => {
      const resolution = resolutionForMatch(match);
      const matchId = matchIdOf(match);
      if (!resolution || existingIds.has(matchId)) return;
      const player1 = match.jugador1 || match.player1;
      const player2 = match.jugador2 || match.player2;
      source.push({
        matchId,
        jugador1: player1,
        jugador2: player2,
        _j1: key(player1),
        _j2: key(player2)
      });
      existingIds.add(matchId);
    });

    return source.map(record => {
      const resolution = resolutionForMatch(record);
      if (!resolution) return record;
      const player1 = record.jugador1 || record.player1;
      const player2 = record.jugador2 || record.player2;
      const player1Wins = key(player1) !== key(WITHDRAWAL.player);
      return Object.assign({}, record, {
        fecha: WITHDRAWAL.date, pendiente: "", _pendiente: "",
        observaciones: "Resolución directiva · renuncia al club",
        s1j1: player1Wins ? "6" : "0", s1j2: player1Wins ? "0" : "6",
        s2j1: player1Wins ? "6" : "0", s2j2: player1Wins ? "0" : "6",
        stbj1: "", stbj2: "", setsJ1: player1Wins ? 2 : 0, setsJ2: player1Wins ? 0 : 2,
        ganador: resolution.winner, perdedor: WITHDRAWAL.player, tipo: "W/O",
        resultadoWeb: `Ganador ${resolution.winner} por W/O 6-0 6-0`,
        ptsJ1: player1Wins ? 3 : 0, ptsJ2: player1Wins ? 0 : 3,
        _ganador: key(resolution.winner)
      });
    });
  }

  function withdrawalForPlayer(player) {
    return key(player) === key(WITHDRAWAL.player) ? WITHDRAWAL : null;
  }

  return { WITHDRAWAL, RANKING_A, key, resolutionForMatch, archivedForMatch, archivedForPlayers, applyToPersonalMatches, applyToRankings, applyToTableRecords, withdrawalForPlayer };
});
