(function initSeasonPlatform(root, factory) {
  const api = factory();
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (root) root.OPEN_TENNIS_SEASON_PLATFORM = api;
})(typeof window !== "undefined" ? window : null, function createSeasonPlatform() {
  "use strict";

  const API_URL = "https://script.google.com/macros/s/AKfycbwnxIT7cghusgUzXzJNZCqN0fYPJWL_aFUQaWKTk4H-ksraaSBQ_NmZZgeXjwm0m3Et2g/exec?api=competitions";

  function escapeHtml(value) {
    return String(value == null ? "" : value).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }

  function normalize(value) {
    return String(value || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, " ").trim();
  }

  function parsePayload(value) {
    if (!value) return { version: "2027.1", players: [], competitions: [], matches: [] };
    const parsed = typeof value === "string" ? JSON.parse(value) : value;
    return parsed && parsed.data ? parsed.data : parsed;
  }

  function fetchPublic() {
    return fetch(`${API_URL}&v=${Date.now()}`, { cache: "no-store" })
      .then(response => { if (!response.ok) throw new Error("No se pudo cargar la temporada 2027"); return response.json(); })
      .then(parsePayload)
      .catch(() => ({ version: "2027.1", players: [], competitions: [], matches: [] }));
  }

  function playerMap(data) {
    return Object.fromEntries((data.players || []).map(player => [player.id, player]));
  }

  function competitionUrl(competition, view) {
    const page = competition.type === "tournament" || competition.type === "interclub" ? "torneo.html" : "competencia.html";
    return `${page}?id=${encodeURIComponent(competition.id)}${view ? `&vista=${encodeURIComponent(view)}` : ""}`;
  }

  function competitionLinksHtml(data, view) {
    const ladders = (data.competitions || []).filter(competition => competition.type === "ladder");
    if (!ladders.length) return "";
    return `<section class="modern-season-links" aria-label="Escalerillas publicadas">
      <span>Temporada 2027</span>
      <div>${ladders.map(competition => `<a href="${escapeHtml(competitionUrl(competition, view))}"><strong>${escapeHtml(competition.name)}</strong><small>${escapeHtml(competition.edition || competition.season || "2027")}</small></a>`).join("")}</div>
    </section>`;
  }

  function mountCompetitionLinks(target, view) {
    const element = typeof target === "string" ? document.getElementById(target) : target;
    if (!element) return Promise.resolve(null);
    return fetchPublic().then(data => {
      const html = competitionLinksHtml(data, view);
      element.innerHTML = html;
      element.hidden = !html;
      return data;
    });
  }

  function formatDate(value) {
    if (!value) return "Fecha por coordinar";
    const parts = String(value).split("-");
    if (parts.length !== 3) return value;
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  }

  function ladderScheduleHtml(competition, matches, players) {
    const grouped = new Map();
    const categories = Object.fromEntries((competition.categories || []).map(category => [category.id, category.name]));
    matches.filter(match => match.competitionId === competition.id).sort((a, b) => String(a.officialDate).localeCompare(String(b.officialDate)) || Number(a.week) - Number(b.week)).forEach(match => {
      const key = match.officialDate || `semana-${match.week}`;
      if (!grouped.has(key)) grouped.set(key, []);
      grouped.get(key).push(match);
    });
    if (!grouped.size) return '<div class="events-empty"><strong>Programación en preparación</strong><p>La organización todavía no publica el sorteo.</p></div>';
    return `<div class="modern-schedule">${Array.from(grouped.entries()).map(([date, rows]) => `<section>
      <header><div><span>Semana ${escapeHtml(rows[0].week || "—")}</span><h3>${escapeHtml(formatDate(date))}</h3></div><b>${rows.length}</b></header>
      <div>${rows.map(match => {
        const first = players[match.player1Id] ? players[match.player1Id].name : "Por definir";
        const second = players[match.player2Id] ? players[match.player2Id].name : "Por definir";
        const moved = match.date && match.officialDate && match.date !== match.officialDate;
        const currentDate = match.status === "jugado" ? `Jugado el ${formatDate(match.date)}` : match.status === "por_coordinar" ? "Por coordinar" : moved ? `Nueva fecha ${formatDate(match.date)}` : "";
        const status = /^cancelado|^anulado/.test(match.status || "") ? "Sin efecto" : match.score || (match.status === "jugado" ? "Jugado" : match.status === "por_coordinar" ? "Por coordinar" : "Programado");
        return `<article class="modern-match ${match.status === "jugado" ? "is-played" : ""}"><span><small>${escapeHtml(categories[match.categoryId] || match.categoryId)} · Cancha ${escapeHtml(match.court || "—")} · ${escapeHtml(match.turn || "Horario por definir")}</small><strong>${escapeHtml(first)} <i>vs</i> ${escapeHtml(second)}</strong>${currentDate ? `<em>${escapeHtml(currentDate)}</em>` : ""}</span><b>${escapeHtml(status)}</b></article>`;
      }).join("")}</div>
    </section>`).join("")}</div>`;
  }

  function ladderRankingsHtml(competition) {
    const rankings = competition.rankings || [];
    if (!rankings.length) return '<div class="events-empty"><strong>Tabla en preparación</strong></div>';
    return `<div class="modern-rankings">${rankings.map(category => `<section><header><h3>${escapeHtml(category.name)}</h3></header><div class="modern-ranking-head"><span>#</span><span>Jugador</span><span>PTS</span><span>PJ</span></div>${category.rows.map(row => `<article><b>${row.position}</b><strong>${escapeHtml(row.playerName)}</strong><span>${row.points}</span><span>${row.played}</span></article>`).join("")}</section>`).join("")}</div>`;
  }

  function headToHeadRows(data) {
    const players = playerMap(data);
    return (data.matches || []).filter(match => match.status === "jugado" && match.countsForH2h && match.player1Id && match.player2Id).map(match => ({
      matchId: match.id,
      competitionId: match.competitionId,
      player1Id: match.player1Id,
      player2Id: match.player2Id,
      player1: players[match.player1Id] ? players[match.player1Id].name : match.player1Id,
      player2: players[match.player2Id] ? players[match.player2Id].name : match.player2Id,
      winnerId: match.winnerId,
      score: match.score,
      date: match.date
    }));
  }

  function renderLadderPage(data, competitionId, requestedView) {
    const competition = (data.competitions || []).find(item => item.id === competitionId && item.type === "ladder");
    if (!competition) return { title: "Competición no disponible", html: '<div class="events-empty"><strong>Esta escalerilla aún no está publicada.</strong></div>' };
    const players = playerMap(data);
    const matches = (data.matches || []).filter(match => match.competitionId === competition.id);
    const view = ["programacion", "tabla", "h2h"].includes(requestedView) ? requestedView : "programacion";
    const content = view === "tabla"
      ? ladderRankingsHtml(competition)
      : (view === "h2h"
        ? '<section class="modern-h2h" id="modernH2h"><p class="event-detail-loading">Cargando historial 2025–2027…</p></section>'
        : ladderScheduleHtml(competition, matches, players));
    return {
      title: competition.name,
      html: `<article class="modern-competition-page">
        <header><div><span>${escapeHtml(competition.edition || "Temporada 2027")}</span><h1>${escapeHtml(competition.name)}</h1><p>${escapeHtml(matches.length)} partidos · ${escapeHtml(competition.categories.length)} categorías</p></div><b>${competition.published ? "Publicada" : "Borrador"}</b></header>
        <nav><a class="${view === "programacion" ? "is-active" : ""}" href="competencia.html?id=${encodeURIComponent(competition.id)}&vista=programacion">Programación</a><a class="${view === "tabla" ? "is-active" : ""}" href="competencia.html?id=${encodeURIComponent(competition.id)}&vista=tabla">Tablas</a><a class="${view === "h2h" ? "is-active" : ""}" href="competencia.html?id=${encodeURIComponent(competition.id)}&vista=h2h">Cara a Cara</a><a href="reglas-2027.html">Reglamento</a></nav>
        ${content}
      </article>`,
      h2h: headToHeadRows(data)
    };
  }

  function tournamentEvent(competition, data) {
    const players = playerMap(data);
    const matches = (data.matches || []).filter(match => match.competitionId === competition.id);
    const maxRound = Math.max(1, ...matches.map(match => Number(match.round || 0)));
    const rounds = Array.from({ length: maxRound }, (_, index) => ({
      name: index + 1 === maxRound ? "Final" : `Ronda ${index + 1}`,
      matches: matches.filter(match => Number(match.round) === index + 1).map(match => ({
        player1: players[match.player1Id] ? players[match.player1Id].name : (match.player1Id ? match.player1Id : "BYE"),
        player2: players[match.player2Id] ? players[match.player2Id].name : (match.player2Id ? match.player2Id : "BYE"),
        winner: players[match.winnerId] ? players[match.winnerId].name : "",
        score: match.score
      }))
    }));
    const finalMatch = matches.find(match => Number(match.round) === maxRound);
    return {
      id: competition.id,
      type: "tournament",
      title: competition.name,
      shortTitle: competition.name,
      editionLabel: competition.edition || "Torneo Open Tennis",
      publishedFrom: "2026-01-01",
      eventDate: competition.startDate || "2027-01-01",
      featuredUntil: competition.status === "completed" ? competition.startDate || "2027-12-31" : "2027-12-31",
      dateLabel: formatDate(competition.startDate),
      status: competition.status === "completed" ? "completed" : "upcoming",
      participantCount: competition.entries.length,
      participants: competition.entries.map(entry => players[entry.playerId]).filter(Boolean),
      champion: finalMatch && players[finalMatch.winnerId] ? players[finalMatch.winnerId].name : "",
      rounds
    };
  }

  function mergeActivities(localValue, publicData) {
    const local = typeof localValue === "string" ? JSON.parse(localValue) : (localValue || { events: [] });
    const dynamic = (publicData.competitions || []).filter(competition => competition.type === "tournament").map(competition => tournamentEvent(competition, publicData));
    return { season: "2026–2027", events: (local.events || []).concat(dynamic) };
  }

  return { API_URL, normalize, parsePayload, fetchPublic, competitionUrl, competitionLinksHtml, mountCompetitionLinks, renderLadderPage, headToHeadRows, tournamentEvent, mergeActivities };
});
