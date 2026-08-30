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
      resultWeb: String(row[16] || "").trim(), matchId: String(row[22] || "").trim()
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

  function playerSummary(player, matches, rankings, now) {
    const key = normalize(player);
    const mine = matches.filter(match => normalize(match.player1) === key || normalize(match.player2) === key);
    const today = new Date(now || new Date());
    today.setHours(0, 0, 0, 0);
    const upcoming = mine.filter(match => match.status === "programado" && parseDate(match.date) && parseDate(match.date) >= today)
      .sort((a, b) => parseDate(a.date) - parseDate(b.date))[0] || null;
    const pending = mine.filter(match => ["por_coordinar", "suspendido"].includes(match.status));
    const recent = mine.filter(match => match.status === "jugado" && match.record && parseDate(match.record.date))
      .sort((a, b) => parseDate(b.record.date) - parseDate(a.record.date))[0] || null;
    const ranking = rankings.find(row => normalize(row.player) === key) || null;
    const category = ranking ? ranking.category : (mine.find(match => match.category) || {}).category || "";
    const categoryRanking = rankings
      .filter(row => row.category === category)
      .sort((a, b) => a.position - b.position);
    return { upcoming, pending, recent, ranking, category, categoryRanking, total: mine.length };
  }

  function opponent(match, player) {
    return normalize(match.player1) === normalize(player) ? match.player2 : match.player1;
  }

  function markerUrl(match) {
    if (!match) return "marcador.html";
    const params = new URLSearchParams({ categoria: match.category, j1: match.player1, j2: match.player2, partido: match.matchId || "" });
    return "marcador.html?" + params.toString();
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

  async function boot() {
    if (typeof document === "undefined" || !document.getElementById("myOpenTennis")) return;
    const config = window.OPEN_TENNIS_CONFIG;
    const section = document.getElementById("myOpenTennis");
    const select = document.getElementById("myPlayerSelect");
    const content = document.getElementById("myOpenTennisContent");
    try {
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
        const playerParam = encodeURIComponent(player);
        const tableRows = categoryPreview(summary.categoryRanking, player);
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
            <a class="home-card-link" href="partidos.html?jugador=${playerParam}&vista=pending">Ver partidos por coordinar</a>
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
              <a class="home-heading-link" href="tablas.html?jugador=${playerParam}">Ver completa</a>
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
            <h2>${next ? escapeHtml(player) + " vs " + escapeHtml(opponent(next, player)) : "No hay una próxima fecha confirmada"}</h2>
            <p>${next ? `Semana ${escapeHtml(next.week)} · ${escapeHtml(next.date)} · Cancha ${escapeHtml(next.court)} · ${escapeHtml(next.turn)}` : "Puedes revisar tus partidos por coordinar."}</p>
            <div class="personal-actions">
              <a href="partidos.html?jugador=${playerParam}">Ver mis partidos</a>
            </div>
          </article>
          <div class="home-personal-grid">
            ${pendingHtml}
            ${rankingHtml}
          </div>`;
      }

      select.addEventListener("change", () => render(select.value));
      const saved = localStorage.getItem(STORAGE_KEY) || "";
      if (players.includes(saved)) select.value = saved;
      render(select.value);
      section.classList.remove("loading");
    } catch (error) {
      content.innerHTML = '<p class="personal-empty">No pudimos cargar tus datos. Intenta nuevamente en unos minutos.</p>';
    }
  }

  if (typeof window !== "undefined") window.addEventListener("DOMContentLoaded", boot);
  return { parseCsv, parseFixture, parseRecords, parseRankings, joinMatches, playerSummary, markerUrl, STORAGE_KEY };
});
