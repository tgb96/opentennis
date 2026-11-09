(function initClubEvents(root, factory) {
  const api = factory();
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (root) root.OPEN_TENNIS_CLUB_EVENTS = api;
})(typeof window !== "undefined" ? window : null, function createClubEvents() {
  "use strict";

  const TIME_ZONE = "America/Santiago";
  const PLAYER_ALIASES = Object.freeze({
    "jose astete": "jose astete",
    "josé astete": "jose astete",
    "christian linares": "cristhian linares"
  });

  function normalize(value) {
    return String(value || "").toLowerCase().normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, " ").trim();
  }

  function playerKey(value) {
    const raw = normalize(value);
    return PLAYER_ALIASES[raw] || raw;
  }

  function escapeHtml(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }

  function parse(value) {
    if (!value) return { season: "2026", events: [] };
    if (typeof value === "object") return value;
    try { return JSON.parse(String(value)); } catch (error) { return { season: "2026", events: [] }; }
  }

  function dateKey(value) {
    if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
    const date = value instanceof Date ? value : new Date(value || Date.now());
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: TIME_ZONE, year: "numeric", month: "2-digit", day: "2-digit"
    }).formatToParts(date);
    const values = Object.fromEntries(parts.map(part => [part.type, part.value]));
    return `${values.year}-${values.month}-${values.day}`;
  }

  function phase(event, now) {
    const today = dateKey(now);
    if (!event || today < event.publishedFrom) return "hidden";
    if (today <= event.eventDate) return "upcoming";
    if (today <= event.featuredUntil) return "followup";
    return "archived";
  }

  function findPlayerMatch(event, player) {
    const key = playerKey(player);
    if (!key || !event) return null;
    return (event.matches || []).find(match => playerKey(match.clubPlayer) === key) || null;
  }

  function groupedMatches(event) {
    const groups = new Map();
    (event && event.matches || []).forEach(match => {
      if (!groups.has(match.time)) groups.set(match.time, []);
      groups.get(match.time).push(match);
    });
    return Array.from(groups.entries())
      .sort(([timeA], [timeB]) => timeA.localeCompare(timeB))
      .map(([time, matches]) => ({ time, matches }));
  }

  function resultStats(event) {
    const matches = event && event.matches || [];
    const completed = matches.filter(match => match.result).length;
    const clubWins = matches.filter(match => match.result && playerKey(match.winner) === playerKey(match.clubPlayer)).length;
    return { total: matches.length, completed, clubWins };
  }

  function logoLockup(event) {
    const externalLogo = event.externalLogo || "assets/events/logo-facutenis.png";
    const clubLogo = event.clubLogo && !/assets\/icons\/icon-512\.png/.test(event.clubLogo)
      ? event.clubLogo
      : "assets/img/logo-open-tennis.png";
    return `<div class="club-event-logos" aria-label="FacuTenis versus Open Tennis Huechuraba">
      <img class="club-event-logo club-event-logo-facu" src="${escapeHtml(externalLogo)}" alt="Logo FacuTenis">
      <strong>VS</strong>
      <img class="club-event-logo club-event-logo-open" src="${escapeHtml(clubLogo)}" alt="Logo Open Tennis Huechuraba">
    </div>`;
  }

  function playerMatchHtml(match, eventPhase) {
    if (!match) return "";
    const result = match.result
      ? `<span class="club-event-player-result">Resultado: ${escapeHtml(match.result)}</span>`
      : (eventPhase === "followup" ? '<span class="club-event-player-result is-pending">Resultado por registrar</span>' : "");
    return `<div class="club-event-player-match">
      <span>Tu partido interclub</span>
      <strong><time>${escapeHtml(match.time)}</time> · ${escapeHtml(match.externalPlayer)} vs ${escapeHtml(match.clubPlayer)}</strong>
      ${result}
    </div>`;
  }

  function cardHtml(event, player, eventPhase) {
    const match = findPlayerMatch(event, player);
    const stats = resultStats(event);
    const kicker = eventPhase === "followup" ? "Resultados del interclub" : "Interclub de visita";
    const badge = eventPhase === "followup" ? "Hasta el 11 de noviembre" : "Este sábado";
    const status = eventPhase === "followup"
      ? (stats.completed === stats.total && event.finalResult
        ? event.finalResult
        : (stats.completed ? `${stats.completed} de ${stats.total} resultados registrados` : "Resultados por registrar"))
      : `${stats.total} partidos · 4 bloques`;
    return `<article class="club-event-card" data-club-event-id="${escapeHtml(event.id)}">
      <div class="club-event-card-top">
        ${logoLockup(event)}
        <span class="club-event-badge">${escapeHtml(badge)}</span>
      </div>
      <span class="club-event-kicker">${escapeHtml(kicker)}</span>
      <h3>FacuTenis vs Open Tennis</h3>
      <p class="club-event-meta">📅 ${escapeHtml(event.dateLabel)} · ${escapeHtml(event.timeLabel)}</p>
      <p class="club-event-meta">📍 ${escapeHtml(event.venue)} · Chicureo, Colina</p>
      ${eventPhase === "followup" && event.finalResult ? `<p class="club-event-status"><strong>Resultado final · ${escapeHtml(event.finalResult)}</strong></p>` : ""}
      ${match ? playerMatchHtml(match, eventPhase) : (eventPhase === "followup" && event.finalResult ? "" : `<p class="club-event-status">${escapeHtml(status)}</p>`)}
      <button class="club-event-open" type="button" data-club-event-open="${escapeHtml(event.id)}">${eventPhase === "followup" ? "Ver resultados y programación" : "Ver información y programación"}</button>
    </article>`;
  }

  function matchHtml(match, player, eventPhase) {
    const selected = playerKey(match.clubPlayer) === playerKey(player);
    const result = match.result
      ? `<strong class="club-event-match-result">${escapeHtml(match.result)}</strong>`
      : (eventPhase === "followup" ? '<span class="club-event-match-result is-pending">Resultado por registrar</span>' : "");
    return `<li class="club-event-match${selected ? " is-player" : ""}">
      <span>${escapeHtml(match.externalPlayer)} <i>vs</i> ${escapeHtml(match.clubPlayer)}</span>
      ${selected ? '<b>Tu partido</b>' : ""}
      ${result}
    </li>`;
  }

  function dialogHtml(event, player, eventPhase) {
    const match = findPlayerMatch(event, player);
    const schedule = eventPhase === "upcoming"
      ? groupedMatches(event).map(group => `<section class="club-event-block">
          <h4>${escapeHtml(group.time)}</h4>
          <ul>${group.matches.map(item => matchHtml(item, player, eventPhase)).join("")}</ul>
        </section>`).join("")
      : `<section class="club-event-block club-event-results-order">
          <h4>Orden de los resultados</h4>
          <ul>${(event.matches || []).map(item => matchHtml(item, player, eventPhase)).join("")}</ul>
        </section>`;
    const dialogId = `clubEventDialog-${event.id}`;
    return `<dialog class="club-event-dialog" id="${escapeHtml(dialogId)}" data-club-event-dialog="${escapeHtml(event.id)}" aria-labelledby="${escapeHtml(dialogId)}-title">
      <div class="club-event-dialog-shell">
        <button class="club-event-close" type="button" data-club-event-close aria-label="Cerrar">×</button>
        <header class="club-event-dialog-header">
          ${logoLockup(event)}
          <div><span>${escapeHtml(event.editionLabel)}</span><h2 id="${escapeHtml(dialogId)}-title">${escapeHtml(event.title)}</h2></div>
        </header>
        <div class="club-event-dialog-grid">
          <div class="club-event-detail-main">
            ${match ? playerMatchHtml(match, eventPhase) : ""}
            <div class="club-event-facts">
              <p><strong>📅 Fecha</strong><span>${escapeHtml(event.dateLabel)} · ${escapeHtml(event.timeLabel)}</span></p>
              <p><strong>📍 Lugar</strong><span>${escapeHtml(event.address)}</span></p>
              <p><strong>👕 Vestimenta</strong><span>${escapeHtml(event.dressCode)}</span></p>
              <p><strong>🎾 Formato</strong><span>${event.format.map(item => escapeHtml(item)).join(" ")}</span></p>
            </div>
            <div class="club-event-actions">
              <a href="${escapeHtml(event.mapsUrl)}" target="_blank" rel="noopener noreferrer">Cómo llegar</a>
              <button type="button" data-club-event-calendar="${escapeHtml(event.id)}">Agregar al calendario</button>
            </div>
            <div class="club-event-schedule"><h3>${eventPhase === "upcoming" ? "Programación de partidos" : "Resultados de los partidos"}</h3>${schedule}</div>
          </div>
          <figure class="club-event-poster"><img src="${escapeHtml(event.poster)}" alt="Afiche oficial del interclub FacuTenis versus Open Tennis Huechuraba"></figure>
        </div>
      </div>
    </dialog>`;
  }

  function archiveHtml(events) {
    if (!events.length) return "";
    return `<details class="club-events-archive">
      <summary><span><small>Historia del club</small>Actividades del club</span><b>${events.length}</b></summary>
      <div class="club-events-archive-list">${events.map(event => `<button type="button" data-club-event-open="${escapeHtml(event.id)}">
        <img src="${escapeHtml(event.clubLogo)}" alt=""><span><strong>${escapeHtml(event.editionLabel)}</strong><small>${escapeHtml(event.dateLabel)} · ${escapeHtml(event.title)}</small></span>
      </button>`).join("")}</div>
    </details>`;
  }

  function renderHome(value, player, now) {
    const data = parse(value);
    const featured = data.events.find(event => ["upcoming", "followup"].includes(phase(event, now)));
    const archived = data.events.filter(event => phase(event, now) === "archived");
    const visibleEvents = data.events.filter(event => phase(event, now) !== "hidden");
    return {
      featuredHtml: featured ? cardHtml(featured, player, phase(featured, now)) : "",
      archiveHtml: archiveHtml(archived),
      dialogHtml: visibleEvents.map(event => dialogHtml(event, player, phase(event, now))).join(""),
      selectedEvent: featured || archived[0] || null
    };
  }

  function compactUtc(value) {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? "" : date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
  }

  function calendarText(event) {
    return [
      "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Open Tennis Huechuraba//Actividades//ES",
      "BEGIN:VEVENT", `UID:${event.id}@opentennis.cl`, `DTSTAMP:${compactUtc(new Date())}`,
      `DTSTART:${compactUtc(event.startDateTime)}`, `DTEND:${compactUtc(event.endDateTime)}`,
      `SUMMARY:${event.title}`, `LOCATION:${event.address}`,
      `DESCRIPTION:${event.dateLabel}. ${event.timeLabel}. ${event.dressCode}`,
      "END:VEVENT", "END:VCALENDAR"
    ].join("\r\n");
  }

  return { parse, dateKey, phase, playerKey, findPlayerMatch, groupedMatches, resultStats, renderHome, calendarText };
});
