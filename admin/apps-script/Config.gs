var ADMIN_CONFIG = Object.freeze({
  SEASON: "2026",
  TIME_ZONE: "America/Santiago",
  FIXTURE_GID: 0,
  REGISTRO_GID: 1046180821,
  RANKINGS_GID: 1249404240,
  AUDIT_SHEET_NAME: "Admin Auditoría",
  SPREADSHEET_ID_PROPERTY: "SPREADSHEET_ID",
  ADMIN_EMAILS_PROPERTY: "ADMIN_EMAILS",
  UNDO_WINDOW_MINUTES: 10,
  REGISTRO_COLUMN_COUNT: 23,
  PUBLIC_DATA_URLS: Object.freeze({
    FIXTURE: "https://docs.google.com/spreadsheets/d/e/2PACX-1vR4Uc2YiXkim8OTwSbwK4AYfC1oWWNTX1TCE4RXFyzaK5azjuaHx4nWT1v6Ubiq2Lm9kpYFTJmY6C1d/pub?gid=0&single=true&output=csv",
    REGISTRO: "https://docs.google.com/spreadsheets/d/e/2PACX-1vR4Uc2YiXkim8OTwSbwK4AYfC1oWWNTX1TCE4RXFyzaK5azjuaHx4nWT1v6Ubiq2Lm9kpYFTJmY6C1d/pub?gid=1046180821&single=true&output=csv",
    RANKINGS: "https://docs.google.com/spreadsheets/d/e/2PACX-1vR4Uc2YiXkim8OTwSbwK4AYfC1oWWNTX1TCE4RXFyzaK5azjuaHx4nWT1v6Ubiq2Lm9kpYFTJmY6C1d/pub?gid=1249404240&single=true&output=csv"
  }),
  SCHEDULE_TYPES: Object.freeze({
    OFICIAL: "oficial",
    ADELANTADO: "adelantado",
    REPROGRAMADO: "reprogramado",
    RECUPERACION: "recuperacion"
  }),
  COLUMNS: Object.freeze({
    FIXTURE: Object.freeze({
      WEEK: 0,
      COURT: 1,
      TURN: 2,
      CATEGORY: 3,
      PLAYER_1: 4,
      PLAYER_2: 5,
      DATE: 6,
      STATUS: 7,
      NOTES: 8,
      MATCH_ID: 9,
      ORIGINAL_DATE: 10,
      ORIGINAL_COURT: 11,
      ORIGINAL_TURN: 12,
      SCHEDULE_TYPE: 13,
      ROUND: 14
    }),
    REGISTRO: Object.freeze({
      DATE: 0,
      PLAYER_1: 1,
      PLAYER_2: 2,
      PENDING: 3,
      NOTES: 4,
      SET_1_PLAYER_1: 5,
      SET_1_PLAYER_2: 6,
      SET_2_PLAYER_1: 7,
      SET_2_PLAYER_2: 8,
      STB_PLAYER_1: 9,
      STB_PLAYER_2: 10,
      SETS_PLAYER_1: 11,
      SETS_PLAYER_2: 12,
      WINNER: 13,
      LOSER: 14,
      RESULT_TYPE: 15,
      RESULT_WEB: 16,
      POINTS_PLAYER_1: 17,
      POINTS_PLAYER_2: 18,
      POINTS_WINNER: 19,
      POINTS_LOSER: 20,
      LEGACY_KEY: 21,
      MATCH_ID: 22
    })
  })
});
