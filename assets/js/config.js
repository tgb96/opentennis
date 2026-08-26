// Fuente única de configuración para todas las pantallas.
// Las propiedades planas se conservan para no romper integraciones existentes.
(function configureOpenTennis(root) {
  const SHEET_BASE_URL =
    "https://docs.google.com/spreadsheets/d/e/2PACX-1vR4Uc2YiXkim8OTwSbwK4AYfC1oWWNTX1TCE4RXFyzaK5azjuaHx4nWT1v6Ubiq2Lm9kpYFTJmY6C1d/pub";

  const fixtureUrl = `${SHEET_BASE_URL}?gid=0&single=true&output=csv`;
  const registroUrl = `${SHEET_BASE_URL}?gid=1046180821&single=true&output=csv`;
  const rankingsUrl = `${SHEET_BASE_URL}?gid=1249404240&single=true&output=csv`;

  root.OPEN_TENNIS_CONFIG = Object.freeze({
    SEASON: "2026",
    TIME_ZONE: "America/Santiago",
    FIXTURE_URL: fixtureUrl,
    REGISTRO_URL: registroUrl,
    RANKINGS_URL: rankingsUrl,
    DATA: Object.freeze({
      fixtureUrl,
      registroUrl,
      rankingsUrl
    }),
    SHEET_COLUMNS: Object.freeze({
      fixtureMatchId: 9,
      registroLegacyKey: 21,
      registroMatchId: 22
    })
  });
})(window);
