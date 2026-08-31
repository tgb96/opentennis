(function initOpenTennisPersonalization(root, factory) {
  const model = typeof module !== "undefined" && module.exports
    ? require("./data-model.js")
    : root && root.OPEN_TENNIS_DATA;
  const api = factory(model);
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (root) root.OPEN_TENNIS_PERSONAL = api;
})(typeof window !== "undefined" ? window : null, function createPersonalization(dataModel) {
  "use strict";

  const STORAGE_KEY = "openTennisPlayerV1";

  function pageUrl(fileName, pathname) {
    const currentPath = pathname !== undefined
      ? String(pathname || "")
      : (typeof location !== "undefined" ? location.pathname : "");
    const usesCleanRoutes = /^\/(?:app|partidos|tablas|resultados-2025|reglas|marcador)\/?$/.test(currentPath);
    return usesCleanRoutes ? "/" + String(fileName).replace(/\.html$/, "") : fileName;
  }

  function parseCsvLine(line) {
    const values = [];
    let value = "";
    let quoted = false;
    for (let index = 0; index < line.length; index++) {
      const character = line[index];
      if (character === '"' && line[index + 1] === '"') {
        value += '"';
        index++;
      } else if (character === '"') {
        quoted = !quoted;
      } else if (character === "," && !quoted) {
        values.push(value);
        value = "";
      } else {
        value += character;
      }
    }
    values.push(value);
    return values;
  }

  function parseCsv(csv) {
    return String(csv || "").trim().split(/\r?\n/).filter(Boolean).map(parseCsvLine);
  }

  function normalize(value) {
    return String(value || "").toLowerCase().normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, " ").trim();
  }

  function parseDate(value) {
    const match = String(value || "").match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})$/);
    return match ? new Date(Number(match[3]), Number(match[2]) - 1, Number(match[1]), 12) : null;
  }

  function exactPairKey(player1, player2) {
    return normalize(player1) + "|" + normalize(player2);
  }

  function parseFixture(csv) {
    const rows = parseCsv(csv).slice(1);
    return rows.map(row => ({
      week: String(row[0] || "").trim(), court: String(row[1] || "").trim(),
      turn: String(row[2] || "").trim(), category: String(row[3] || "").trim(),
      player1: String(row[4] || "").trim(), player2: String(row[5] || "").trim(),
      date: String(row[6] || "").trim(), fixtureStatus: String(row[7] || "").trim(),
      notes: String(row[8] || "").trim(), matchId: String(row[9] || "").trim(),
      originalDate: String(row[10] || row[6] || "").trim(),
      scheduleType: String(row[13] || "oficial").trim(), round: String(row[14] || "").trim()
    })).filter(match => match.player1 && match.player2 && match.player1 !== "-" && match.player2 !== "-");
  }

  function parseRecords(csv) {
    return parseCsv(csv).slice(1).map(row => ({
      date: String(row[0] || "").trim(), player1: String(row[1] || "").trim(),
      player2: String(row[2] || "").trim(), pending: String(row[3] || "").trim(),
      notes: String(row[4] || "").trim(), winner: String(row[13] || "").trim(),
      loser: String(row[14] || "").trim(), resultType: String(row[15] || "").trim(),
      resultWeb: String(row[16] || "").trim(), pointsPlayer1: Number(row[17] || 0),
      pointsPlayer2: Number(row[18] || 0), matchId: String(row[22] || "").trim()
    })).filter(record => record.player1 && record.player2);
  }

  function recordStatus(record) {
    if (!record) return "programado";
    if (record.resultWeb || record.winner) return "jugado";
    if (normalize(record.notes).includes("suspend")) return "suspendido";
    if (record.pending) return "por_coordinar";
    return "programado";
  }

  function fixtureStatus(match) {
    return dataModel ? dataModel.normalizeStatus(match.fixtureStatus || match.notes) : "programado";
  }

  function isExplicitReschedule(match) {
    return Boolean(
      match &&
      match.date &&
      normalize(match.scheduleType || "oficial") !== "oficial" &&
      fixtureStatus(match) === "programado"
    );
  }

  function resolvedStatus(match, record) {
    if (record && (record.resultWeb || record.winner)) return "jugado";
    if (isExplicitReschedule(match)) return "programado";
    if (record) return recordStatus(record);
    return fixtureStatus(match);
  }

  function joinMatches(fixture, records) {
    const byId = new Map();
    const byExactPair = new Map();
    const fixtureExactPairCount = new Map();

    fixture.forEach(match => {
      const key = exactPairKey(match.player1, match.player2);
      fixtureExactPairCount.set(key, (fixtureExactPairCount.get(key) || 0) + 1);
    });

    records.forEach(record => {
      if (record.matchId) byId.set(normalize(record.matchId), record);
      const key = exactPairKey(record.player1, record.player2);
      if (!byExactPair.has(key)) byExactPair.set(key, []);
      byExactPair.get(key).push(record);
    });

    return fixture.map(match => {
      const exactKey = exactPairKey(match.player1, match.player2);
      const candidates = byExactPair.get(exactKey) || [];
      const recordById = match.matchId ? byId.get(normalize(match.matchId)) : null;
      const legacyRecord = fixtureExactPairCount.get(exactKey) === 1 && candidates.length === 1
        ? candidates[0]
        : null;
      const record = recordById || legacyRecord;
      return Object.assign({}, match, { record, status: resolvedStatus(match, record) });
    });
  }

  function parseRankings(csv) {
    const rankings = [];
    let category = "";
    parseCsv(csv).forEach(row => {
      const first = String(row[0] || "").trim();
      const categoryMatch = first.match(/^CATEGORIA\s+([A-D])$/i);
      if (categoryMatch) { category = categoryMatch[1].toUpperCase(); return; }
      if (!/^\d+$/.test(first) || !row[1]) return;
      rankings.push({ category, position: Number(first), player: String(row[1]).trim(), points: Number(row[2] || 0), played: Number(row[3] || 0) });
    });
    return rankings;
  }

  function parseHistoricalResults(value) {
    if (!value) return null;
    if (typeof value === "object") return value;
    try { return JSON.parse(String(value)); } catch (error) { return null; }
  }

  function samePlayers(match, player, rival) {
    const pair = [
      normalize(match && (match.player1 || match.jugador1)),
      normalize(match && (match.player2 || match.jugador2))
    ].sort();
    const expected = [normalize(player), normalize(rival)].sort();
    return pair[0] === expected[0] && pair[1] === expected[1];
  }

  function scoreFromWebResult(result) {
    const match = String(result || "").match(/\d+\s*-\s*\d+(?:\s+\d+\s*-\s*\d+)*/);
    return match ? match[0].replace(/\s*-\s*/g, "-").replace(/\s+/g, ", ") : "Resultado registrado";
  }

  function historicalWinner(match) {
    const sets = [match && match.s1, match && match.s2, match && match.stb].filter(set => Array.isArray(set) && set.length >= 2);
    let player1Sets = 0;
    let player2Sets = 0;
    sets.forEach(set => {
      if (Number(set[0]) > Number(set[1])) player1Sets++;
      else if (Number(set[1]) > Number(set[0])) player2Sets++;
    });
    return player1Sets > player2Sets
      ? (match.player1 || match.jugador1)
      : (match.player2 || match.jugador2);
  }

  function historicalScore(match) {
    return [match && match.s1, match && match.s2, match && match.stb]
      .filter(set => Array.isArray(set) && set.length >= 2)
      .map(set => `${set[0]}-${set[1]}`)
      .join(", ");
  }

  function headToHeadSummary(player, rival, matches, historicalData) {
    if (!player || !rival) return { total: 0, playerWins: 0, rivalWins: 0, last: null };

    const encounters = [];
    const historical = parseHistoricalResults(historicalData);
    if (historical && historical.categorias) {
      Object.values(historical.categorias).flat().forEach(match => {
        if (!samePlayers(match, player, rival)) return;
        encounters.push({
          season: String(historical.temporada || "2025"),
          winner: historicalWinner(match),
          score: historicalScore(match)
        });
      });
    }

    (matches || []).forEach(match => {
      if (match.status !== "jugado" || !match.record || !samePlayers(match, player, rival)) return;
      encounters.push({
        season: "2026",
        winner: match.record.winner,
        score: scoreFromWebResult(match.record.resultWeb)
      });
    });

    const playerKey = normalize(player);
    const rivalKey = normalize(rival);
    const playerWins = encounters.filter(encounter => normalize(encounter.winner) === playerKey).length;
    const rivalWins = encounters.filter(encounter => normalize(encounter.winner) === rivalKey).length;
    return { total: encounters.length, playerWins, rivalWins, last: encounters.length ? encounters[encounters.length - 1] : null };
  }

  function playerSummary(player, matches, rankings, now) {
    const key = normalize(player);
    const mine = matches.filter(match => normalize(match.player1) === key || normalize(match.player2) === key);
    const today = new Date(now || new Date());
    today.setHours(0, 0, 0, 0);
    const upcoming = mine.filter(match => match.status === "programado" && parseDate(match.date) && parseDate(match.date) >= today)
      .sort((a, b) => parseDate(a.date) - parseDate(b.date))[0] || null;
    const pending = mine.filter(match => ["por_coordinar", "suspendido"].includes(match.status));
    const recentResults = mine.filter(match => match.status === "jugado" && match.record && parseDate(match.record.date))
      .sort((a, b) => parseDate(b.record.date) - parseDate(a.record.date));
    const recent = recentResults[0] || null;
    const ranking = rankings.find(row => normalize(row.player) === key) || null;
    const category = ranking ? ranking.category : (mine.find(match => match.category) || {}).category || "";
    const categoryRanking = rankings
      .filter(row => row.category === category)
      .sort((a, b) => a.position - b.position);
    const decidedResults = recentResults.filter(match => match.record && match.record.winner);
    const wins = decidedResults.filter(match => normalize(match.record.winner) === key).length;
    const losses = decidedResults.filter(match => normalize(match.record.loser) === key || normalize(match.record.winner) !== key).length;
    const played = ranking ? ranking.played : decidedResults.length;
    const zone = playerZone(category, ranking && ranking.position, categoryRanking.length);
    return {
      upcoming, pending, recent, recentResults: recentResults.slice(0, 3), ranking,
      category, categoryRanking, total: mine.length, played, wins, losses, zone
    };
  }

  function playerZone(category, position, total) {
    const cat = String(category || "").toUpperCase();
    const place = Number(position);
    const players = Number(total);
    if (!place || !players) return { text: "Sin zona definida", className: "zone-neutral", icon: "•" };

    if (cat === "A") {
      if (place === 1) return { text: "Líder actual", className: "zone-leader", icon: "👑" };
      if (place === players - 2) return { text: "Repechaje descenso", className: "zone-playoff", icon: "↔" };
      if (place >= players - 1) return { text: "Descenso directo", className: "zone-relegation", icon: "↓" };
    }
    if (cat === "B") {
      if (place <= 2) return { text: "Ascenso directo", className: "zone-promotion", icon: "↑" };
      if (place === 3) return { text: "Repechaje a A", className: "zone-playoff", icon: "↔" };
      if (place === players - 2) return { text: "Repechaje descenso", className: "zone-playoff", icon: "↔" };
      if (place >= players - 1) return { text: "Descenso directo", className: "zone-relegation", icon: "↓" };
    }
    if (cat === "C") {
      if (place <= 2) return { text: "Ascenso directo", className: "zone-promotion", icon: "↑" };
      if (place === 3) return { text: "Repechaje a B", className: "zone-playoff", icon: "↔" };
    }
    if (cat === "D" && place === 1) return { text: "Líder actual", className: "zone-leader", icon: "👑" };
    return { text: "Zona media", className: "zone-neutral", icon: "•" };
  }

  function opponent(match, player) {
    return normalize(match.player1) === normalize(player) ? match.player2 : match.player1;
  }

  function markerUrl(match, pathname) {
    const markerPage = pageUrl("marcador.html", pathname);
    if (!match) return markerPage;
    const params = new URLSearchParams({ categoria: match.category, j1: match.player1, j2: match.player2, partido: match.matchId || "" });
    return markerPage + "?" + params.toString();
  }

  function escapeHtml(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function categoryPreview(rows, player) {
    if (rows.length <= 6) return rows;
    const key = normalize(player);
    const selectedIndex = rows.findIndex(row => normalize(row.player) === key);
    const indexes = new Set([0, 1, 2]);
    if (selectedIndex >= 0) {
      indexes.add(Math.max(0, selectedIndex - 1));
      indexes.add(selectedIndex);
      indexes.add(Math.min(rows.length - 1, selectedIndex + 1));
    }
    return Array.from(indexes).sort((a, b) => a - b).map(index => rows[index]);
  }

  function headToHeadHtml(player, rival, summary) {
    if (!summary) {
      return `<div class="next-h2h is-loading"><span>Historial entre ustedes</span><p>Cargando historial…</p></div>`;
    }
    if (!summary.total) {
      return `<div class="next-h2h"><span>Historial frente a ${escapeHtml(rival)}</span><p>Será el primer enfrentamiento registrado entre ustedes.</p></div>`;
    }
    const last = summary.last;
    return `<div class="next-h2h">
      <span>Historial frente a ${escapeHtml(rival)} · 2025–2026</span>
      <div class="next-h2h-score">
        <strong>${escapeHtml(player)} <b>${summary.playerWins}</b></strong>
        <i>—</i>
        <strong><b>${summary.rivalWins}</b> ${escapeHtml(rival)}</strong>
      </div>
      ${last ? `<p>Último cruce · ${escapeHtml(last.season)}: ${escapeHtml(last.winner)} ganó · ${escapeHtml(last.score)}</p>` : ""}
    </div>`;
  }

  function recentResultHtml(match, player) {
    const rival = opponent(match, player);
    const winner = normalize(match.record && match.record.winner);
    const playerKey = normalize(player);
    const isNeutral = !winner;
    const won = winner === playerKey;
    const outcome = isNeutral ? "—" : (won ? "G" : "P");
    const outcomeText = isNeutral ? "Sin ganador" : (won ? "Ganó" : "Perdió");
    const score = normalize(match.record && match.record.resultType).includes("w/o")
      ? (match.record.resultWeb || "W/O")
      : scoreFromWebResult(match.record && match.record.resultWeb);
    return `<li class="recent-result ${isNeutral ? "is-neutral" : (won ? "is-win" : "is-loss")}">
      <strong aria-label="${outcomeText}">${outcome}</strong>
      <div><span>vs ${escapeHtml(rival)}</span><small>${escapeHtml(match.record.date)} · ${escapeHtml(score)}</small></div>
    </li>`;
  }

  async function boot() {
    if (typeof document === "undefined" || !document.getElementById("myOpenTennis")) return;
    const config = window.OPEN_TENNIS_CONFIG;
    const section = document.getElementById("myOpenTennis");
    const select = document.getElementById("myPlayerSelect");
    const content = document.getElementById("myOpenTennisContent");
    try {
      let historicalData = null;
      const historicalPromise = fetch("data/resultados-2025.json")
        .then(response => response.ok ? response.json() : null)
        .catch(() => null);
      const responses = await Promise.all([config.FIXTURE_URL, config.REGISTRO_URL, config.RANKINGS_URL].map(url => fetch(url)));
      if (responses.some(response => !response.ok)) throw new Error("No se pudieron cargar los datos");
      const texts = await Promise.all(responses.map(response => response.text()));
      const matches = joinMatches(parseFixture(texts[0]), parseRecords(texts[1]));
      const rankings = parseRankings(texts[2]);
      const players = Array.from(new Set(matches.flatMap(match => [match.player1, match.player2]))).sort((a, b) => a.localeCompare(b, "es"));
      select.innerHTML = '<option value="">Elige tu nombre</option>' + players.map(player => '<option value="' + player.replace(/"/g, "&quot;") + '">' + player + '</option>').join("");

      function render(player) {
        if (!player) { content.innerHTML = '<p class="personal-empty">Elige tu nombre una sola vez para ver tu próximo rival, posición y pendientes.</p>'; return; }
        localStorage.setItem(STORAGE_KEY, player);
        const summary = playerSummary(player, matches, rankings, new Date());
        const next = summary.upcoming;
        const nextRival = next ? opponent(next, player) : "";
        const headToHead = next ? (historicalData ? headToHeadSummary(player, nextRival, matches, historicalData) : null) : null;
        const playerParam = encodeURIComponent(player);
        const matchesPage = pageUrl("partidos.html");
        const tablesPage = pageUrl("tablas.html");
        const tableRows = categoryPreview(summary.categoryRanking, player);
        const seasonHtml = `
          <section class="home-info-card season-card" aria-labelledby="seasonHomeTitle">
            <div class="home-card-heading season-heading">
              <div>
                <span class="home-card-kicker">Tu temporada 2026</span>
                <h3 id="seasonHomeTitle">Resumen personal</h3>
              </div>
              <span class="player-zone ${escapeHtml(summary.zone.className)}">${escapeHtml(summary.zone.icon)} ${escapeHtml(summary.zone.text)}</span>
            </div>
            <div class="season-metrics">
              <div><span>Jugados / total</span><strong>${summary.played} / ${summary.total}</strong></div>
              <div><span>Récord</span><strong>${summary.wins}-${summary.losses}</strong></div>
            </div>
            <div class="recent-results-block">
              <span class="recent-results-title">Últimos tres resultados</span>
              ${summary.recentResults.length
                ? `<ul class="recent-results-list">${summary.recentResults.map(match => recentResultHtml(match, player)).join("")}</ul>`
                : `<p class="recent-results-empty">Aún no tienes resultados registrados esta temporada.</p>`}
            </div>
          </section>`;
        const pendingHtml = summary.pending.length ? `
          <section class="home-info-card pending-card" aria-labelledby="pendingHomeTitle">
            <div class="home-card-heading">
              <div>
                <span class="home-card-kicker">Necesitan acuerdo</span>
                <h3 id="pendingHomeTitle">Partidos por coordinar</h3>
              </div>
              <strong class="home-count">${summary.pending.length}</strong>
            </div>
            <ul class="pending-match-list">
              ${summary.pending.map(match => `
                <li>
                  <div><span>vs</span> <strong>${escapeHtml(opponent(match, player))}</strong></div>
                  <small>Semana ${escapeHtml(match.week || "—")}${match.originalDate || match.date ? ` · Fecha original ${escapeHtml(match.originalDate || match.date)}` : ""}</small>
                </li>`).join("")}
            </ul>
            <a class="home-card-link" href="${matchesPage}?jugador=${playerParam}&vista=pending">Ver partidos por coordinar</a>
          </section>` : `
          <section class="home-info-card pending-card pending-clear">
            <span class="home-card-kicker">Coordinación al día</span>
            <h3>No tienes partidos por coordinar</h3>
          </section>`;
        const rankingHtml = summary.categoryRanking.length ? `
          <section class="home-info-card category-card" aria-labelledby="categoryHomeTitle">
            <div class="home-card-heading">
              <div>
                <span class="home-card-kicker">Tu categoría</span>
                <h3 id="categoryHomeTitle">Tabla Categoría ${escapeHtml(summary.category)}</h3>
              </div>
              <a class="home-heading-link" href="${tablesPage}?jugador=${playerParam}">Ver completa</a>
            </div>
            <div class="mini-ranking" role="table" aria-label="Resumen de la tabla de la categoría ${escapeHtml(summary.category)}">
              <div class="mini-ranking-head" role="row">
                <span role="columnheader">Pos.</span><span role="columnheader">Jugador</span><span role="columnheader">Pts.</span><span role="columnheader">PJ</span>
              </div>
              ${tableRows.map(row => `
                <div class="mini-ranking-row${normalize(row.player) === normalize(player) ? " is-player" : ""}" role="row">
                  <span role="cell">#${row.position}</span>
                  <strong role="cell">${escapeHtml(row.player)}</strong>
                  <span role="cell">${row.points}</span>
                  <span role="cell">${row.played}</span>
                </div>`).join("")}
            </div>
          </section>` : "";
        content.innerHTML = `
          <div class="personal-stats">
            <div><span>Categoría</span><strong>${summary.category ? escapeHtml(summary.category) : "—"}</strong></div>
            <div><span>Posición</span><strong>${summary.ranking ? "#" + summary.ranking.position : "—"}</strong></div>
            <div><span>Puntos</span><strong>${summary.ranking ? summary.ranking.points : "—"}</strong></div>
            <div><span>Por coordinar</span><strong>${summary.pending.length}</strong></div>
          </div>
          <article class="next-match-card">
            <span class="personal-kicker">${next ? "Tu próximo partido" : "Tu calendario"}</span>
            <h2>${next ? escapeHtml(player) + " vs " + escapeHtml(nextRival) : "No hay una próxima fecha confirmada"}</h2>
            <p>${next ? `Semana ${escapeHtml(next.week)} · ${escapeHtml(next.date)} · Cancha ${escapeHtml(next.court)} · ${escapeHtml(next.turn)}` : "Puedes revisar tus partidos por coordinar."}</p>
            ${next ? headToHeadHtml(player, nextRival, headToHead) : ""}
            <div class="personal-actions">
              <a href="${matchesPage}?jugador=${playerParam}">Ver mis partidos</a>
            </div>
          </article>
          <div class="home-personal-grid">
            ${seasonHtml}
            ${pendingHtml}
            ${rankingHtml}
          </div>`;
      }

      select.addEventListener("change", () => render(select.value));
      const saved = localStorage.getItem(STORAGE_KEY) || "";
      if (players.includes(saved)) select.value = saved;
      render(select.value);
      section.classList.remove("loading");
      historicalPromise.then(data => {
        historicalData = data;
        if (select.value) render(select.value);
      });
    } catch (error) {
      content.innerHTML = '<p class="personal-empty">No pudimos cargar tus datos. Intenta nuevamente en unos minutos.</p>';
    }
  }

  if (typeof window !== "undefined") window.addEventListener("DOMContentLoaded", boot);
  return { parseCsv, parseFixture, parseRecords, parseRankings, parseHistoricalResults, joinMatches, playerSummary, playerZone, headToHeadSummary, markerUrl, pageUrl, STORAGE_KEY };
});
