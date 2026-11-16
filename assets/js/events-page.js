(function initEventsPage(root, factory) {
  const clubEvents = typeof module !== "undefined" && module.exports
    ? require("./club-events.js")
    : root && root.OPEN_TENNIS_CLUB_EVENTS;
  const api = factory(clubEvents);
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (root) root.OPEN_TENNIS_EVENTS_PAGE = api;
})(typeof window !== "undefined" ? window : null, function createEventsPage(clubEvents) {
  "use strict";

  function escapeHtml(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }

  function bracketCapacity(participantCount) {
    const count = Math.max(2, Number(participantCount) || 2);
    let capacity = 2;
    while (capacity < count) capacity *= 2;
    return capacity;
  }

  function tournamentSummary(event) {
    const participants = Array.isArray(event.participants) ? event.participants.length : Number(event.participantCount || 0);
    const capacity = Number(event.bracketSize) || bracketCapacity(participants || 2);
    return {
      participants,
      capacity,
      byes: Math.max(0, capacity - participants)
    };
  }

  function splitEvents(value, now) {
    const data = clubEvents ? clubEvents.parse(value) : (value || { events: [] });
    const upcoming = [];
    const past = [];

    (data.events || []).forEach(event => {
      const eventPhase = clubEvents ? clubEvents.phase(event, now) : "archived";
      if (eventPhase === "hidden") return;
      if (eventPhase === "upcoming" && event.status !== "completed") upcoming.push(event);
      else past.push(event);
    });

    upcoming.sort((a, b) => String(a.eventDate).localeCompare(String(b.eventDate)));
    past.sort((a, b) => String(b.eventDate).localeCompare(String(a.eventDate)));
    return { upcoming, past };
  }

  function resultBadge(match) {
    if (!match.result) return "";
    const won = match.result === "Ganó";
    return `<span class="events-result ${won ? "is-win" : "is-loss"}">${won ? "Victoria" : "Derrota"}</span>`;
  }

  function interclubDetails(event) {
    const matches = (event.matches || []).map(match => `<li>
      <span>${escapeHtml(match.externalPlayer)} <i>vs</i> ${escapeHtml(match.clubPlayer)}</span>
      <span class="events-match-status">${match.score ? `<b>${escapeHtml(match.score)}</b>` : ""}${resultBadge(match)}</span>
    </li>`).join("");
    return `<div class="events-detail-block">
      <h4>Resultados de los partidos</h4>
      <p class="events-detail-note">Marcador acumulado: rival–Open Tennis</p>
      <ol class="events-results-list">${matches}</ol>
    </div>`;
  }

  function bracketHtml(event) {
    const rounds = Array.isArray(event.rounds) ? event.rounds : [];
    if (!rounds.length) return "";
    return `<div class="events-bracket" aria-label="Cuadro de eliminación directa">${rounds.map(round => `<section>
      <h4>${escapeHtml(round.name || round.label || "Ronda")}</h4>
      <div>${(round.matches || []).map(match => `<article class="events-bracket-match">
        <span class="${match.winner === match.player1 ? "is-winner" : ""}">${escapeHtml(match.player1 || "BYE")}</span>
        <span class="${match.winner === match.player2 ? "is-winner" : ""}">${escapeHtml(match.player2 || "BYE")}</span>
        ${match.score ? `<small>${escapeHtml(match.score)}</small>` : ""}
      </article>`).join("")}</div>
    </section>`).join("")}</div>`;
  }

  function tournamentDetails(event) {
    const summary = tournamentSummary(event);
    return `<div class="events-detail-block">
      <div class="events-tournament-stats">
        <span><b>${summary.participants}</b> participantes</span>
        <span><b>${summary.capacity}</b> posiciones</span>
        <span><b>${summary.byes}</b> byes</span>
      </div>
      ${event.champion ? `<p class="events-champion">🏆 Campeón: <strong>${escapeHtml(event.champion)}</strong></p>` : ""}
      ${bracketHtml(event)}
    </div>`;
  }

  function logoHtml(event) {
    if (event.type !== "interclub") return `<span class="events-type-icon" aria-hidden="true">🏆</span>`;
    return `<span class="events-logos">
      <img src="${escapeHtml(event.externalLogo || "assets/events/logo-facutenis.png")}" alt="">
      <b>VS</b>
      <img src="${escapeHtml(event.clubLogo || "assets/img/logo-open-tennis.png")}" alt="">
    </span>`;
  }

  function eventCard(event, isUpcoming) {
    const isTournament = event.type === "tournament" || event.type === "knockout";
    const label = isTournament ? "Torneo" : "Interclub";
    const detail = isTournament ? tournamentDetails(event) : interclubDetails(event);
    return `<details class="events-card ${isTournament ? "is-tournament" : "is-interclub"}">
      <summary>
        ${logoHtml(event)}
        <span class="events-card-copy">
          <small>${escapeHtml(label)} · ${escapeHtml(isUpcoming ? "Próximo" : "Finalizado")}</small>
          <strong>${escapeHtml(event.shortTitle || event.title)}</strong>
          <span>${escapeHtml(event.dateLabel || event.eventDate || "")}${event.finalResult ? ` · ${escapeHtml(event.finalResult)}` : ""}</span>
        </span>
        <span class="events-card-action">Ver</span>
      </summary>
      <div class="events-card-body">
        ${event.venue ? `<p>📍 ${escapeHtml(event.venue)}</p>` : ""}
        ${event.finalScore ? `<div class="events-final"><span>Resultado final</span><strong>${escapeHtml(event.finalScore)}</strong><small>${escapeHtml(event.finalLabel || "")}</small></div>` : ""}
        ${detail}
      </div>
    </details>`;
  }

  function render(value, now) {
    const grouped = splitEvents(value, now);
    return {
      upcomingHtml: grouped.upcoming.length
        ? grouped.upcoming.map(event => eventCard(event, true)).join("")
        : `<div class="events-empty"><span>📅</span><strong>No hay próximos eventos publicados</strong><p>Los nuevos torneos e interclubes aparecerán aquí.</p></div>`,
      pastHtml: grouped.past.length
        ? grouped.past.map(event => eventCard(event, false)).join("")
        : `<div class="events-empty"><span>🏆</span><strong>Aún no hay eventos archivados</strong></div>`,
      upcomingCount: grouped.upcoming.length,
      pastCount: grouped.past.length
    };
  }

  return { bracketCapacity, tournamentSummary, splitEvents, render };
});
