(function initOpenTennisData(root, factory) {
  const api = factory();

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }

  if (root) {
    root.OPEN_TENNIS_DATA = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function createDataModel() {
  const MATCH_STATUSES = Object.freeze({
    PROGRAMADO: "programado",
    JUGADO: "jugado",
    PENDIENTE: "pendiente",
    REPROGRAMADO: "reprogramado",
    WO_J1: "wo_j1",
    WO_J2: "wo_j2",
    WO_AMBOS: "wo_ambos",
    SUSPENDIDO: "suspendido"
  });

  const STATUS_LABELS = Object.freeze({
    [MATCH_STATUSES.PROGRAMADO]: "Programado",
    [MATCH_STATUSES.JUGADO]: "Jugado",
    [MATCH_STATUSES.PENDIENTE]: "Pendiente",
    [MATCH_STATUSES.REPROGRAMADO]: "Reprogramado",
    [MATCH_STATUSES.WO_J1]: "W/O Jugador 1",
    [MATCH_STATUSES.WO_J2]: "W/O Jugador 2",
    [MATCH_STATUSES.WO_AMBOS]: "W/O ambos",
    [MATCH_STATUSES.SUSPENDIDO]: "Suspendido"
  });

  function normalizeText(value) {
    return String(value || "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[\u200B-\u200D\uFEFF]/g, "")
      .replace(/\u00a0/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function slug(value) {
    return normalizeText(value)
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
  }

  function normalizePlayerKey(player) {
    return slug(player);
  }

  function createLegacyPairKey(player1, player2) {
    return [normalizePlayerKey(player1), normalizePlayerKey(player2)]
      .filter(Boolean)
      .sort()
      .join("|");
  }

  function createMatchId(match) {
    const season = slug(match && match.season) || "sin-temporada";
    const week = slug(match && match.week) || "sin-semana";
    const category = slug(match && match.category) || "sin-categoria";
    const players = [
      normalizePlayerKey(match && match.player1),
      normalizePlayerKey(match && match.player2)
    ].filter(Boolean).sort();

    return [season, `s${week}`, category, ...players].join("-");
  }

  function resolveMatchId(match) {
    const explicitId = slug(match && match.matchId);
    return explicitId || createMatchId(match);
  }

  function normalizeStatus(value) {
    const normalizedText = normalizeText(value);

    if (/w\s*\/?\s*o/.test(normalizedText)) {
      if (normalizedText.includes("ambos")) return MATCH_STATUSES.WO_AMBOS;
      if (/jugador\s*1|j1/.test(normalizedText)) return MATCH_STATUSES.WO_J1;
      if (/jugador\s*2|j2/.test(normalizedText)) return MATCH_STATUSES.WO_J2;
    }

    const status = normalizedText
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "");

    if (!status) return MATCH_STATUSES.PROGRAMADO;
    if (status.includes("jugado") || status.includes("finalizado")) return MATCH_STATUSES.JUGADO;
    if (status.includes("reprogram") || status.includes("posterg")) return MATCH_STATUSES.REPROGRAMADO;
    if (status.includes("pendiente")) return MATCH_STATUSES.PENDIENTE;
    if (status.includes("suspend")) return MATCH_STATUSES.SUSPENDIDO;
    if (status.includes("wo_ambos") || status.includes("w_o_ambos")) return MATCH_STATUSES.WO_AMBOS;
    if (status.includes("wo_j1") || status.includes("w_o_j1")) return MATCH_STATUSES.WO_J1;
    if (status.includes("wo_j2") || status.includes("w_o_j2")) return MATCH_STATUSES.WO_J2;
    if (status.includes("programado")) return MATCH_STATUSES.PROGRAMADO;

    return MATCH_STATUSES.PROGRAMADO;
  }

  function statusLabel(status) {
    const normalized = Object.values(MATCH_STATUSES).includes(status)
      ? status
      : normalizeStatus(status);

    return STATUS_LABELS[normalized] || STATUS_LABELS[MATCH_STATUSES.PROGRAMADO];
  }

  function findDuplicateMatchIds(matches) {
    const seen = new Set();
    const duplicates = new Set();

    (matches || []).forEach(match => {
      const id = resolveMatchId(match);
      if (seen.has(id)) duplicates.add(id);
      seen.add(id);
    });

    return Array.from(duplicates).sort();
  }

  return Object.freeze({
    MATCH_STATUSES,
    STATUS_LABELS,
    normalizeText,
    normalizePlayerKey,
    createLegacyPairKey,
    createMatchId,
    resolveMatchId,
    normalizeStatus,
    statusLabel,
    findDuplicateMatchIds
  });
});
