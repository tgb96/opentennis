function doGet() {
  adminAssertAuthorized_();
  var template = HtmlService.createTemplateFromFile("Index");
  template.initialData = adminGetDashboard_();

  return template.evaluate()
    .setTitle("Open Tennis Admin")
    .setFaviconUrl("https://opentennis.cl/assets/icons/admin-icon-512.png")
    .addMetaTag("viewport", "width=device-width, initial-scale=1, viewport-fit=cover");
}

function include(fileName) {
  return HtmlService.createHtmlOutputFromFile(fileName).getContent();
}

function setupAdmin(adminEmail, spreadsheetId) {
  var email = String(adminEmail || "").trim().toLowerCase();
  if (!/^\S+@\S+\.\S+$/.test(email)) {
    throw new Error("Ingresa un correo de administrador válido.");
  }

  var spreadsheet = spreadsheetId
    ? SpreadsheetApp.openById(String(spreadsheetId).trim())
    : SpreadsheetApp.getActiveSpreadsheet();

  if (!spreadsheet) {
    throw new Error("Abre Apps Script desde el Sheets o entrega su ID a setupAdmin.");
  }

  adminEnsureAdminSchema_(spreadsheet);
  var migration = adminPopulateMatchIds_(spreadsheet);
  var scheduling = adminPopulateSchedulingMetadata_(spreadsheet);
  var properties = PropertiesService.getScriptProperties();
  properties.setProperty(ADMIN_CONFIG.SPREADSHEET_ID_PROPERTY, spreadsheet.getId());
  properties.setProperty(ADMIN_CONFIG.ADMIN_EMAILS_PROPERTY, email);
  adminEnsureAuditSheet_(spreadsheet);

  return {
    ok: true,
    spreadsheetName: spreadsheet.getName(),
    adminEmail: email,
    fixtureIdsCreated: migration.fixtureIdsCreated,
    registroIdsCreated: migration.registroIdsCreated,
    schedulingRowsInitialized: scheduling.rowsInitialized
  };
}

function setupSchedulingModel() {
  adminAssertAuthorized_();
  var spreadsheet = adminGetSpreadsheet_();
  adminEnsureAdminSchema_(spreadsheet);
  return adminPopulateSchedulingMetadata_(spreadsheet);
}

function adminEnsureAdminSchema_(spreadsheet) {
  var fixtureSheet = adminGetSheetByGid_(spreadsheet, ADMIN_CONFIG.FIXTURE_GID);
  var registroSheet = adminGetSheetByGid_(spreadsheet, ADMIN_CONFIG.REGISTRO_GID);
  adminEnsureHeader_(fixtureSheet, ADMIN_CONFIG.COLUMNS.FIXTURE.MATCH_ID + 1, "ID partido");
  adminEnsureHeader_(fixtureSheet, ADMIN_CONFIG.COLUMNS.FIXTURE.ORIGINAL_DATE + 1, "Fecha oficial");
  adminEnsureHeader_(fixtureSheet, ADMIN_CONFIG.COLUMNS.FIXTURE.ORIGINAL_COURT + 1, "Cancha oficial");
  adminEnsureHeader_(fixtureSheet, ADMIN_CONFIG.COLUMNS.FIXTURE.ORIGINAL_TURN + 1, "Turno oficial");
  adminEnsureHeader_(fixtureSheet, ADMIN_CONFIG.COLUMNS.FIXTURE.SCHEDULE_TYPE + 1, "Tipo programación");
  adminEnsureHeader_(fixtureSheet, ADMIN_CONFIG.COLUMNS.FIXTURE.ROUND + 1, "Ronda");
  adminEnsureHeader_(registroSheet, ADMIN_CONFIG.COLUMNS.REGISTRO.MATCH_ID + 1, "ID partido");
}

function adminScheduleTypeFromText_(value) {
  var text = adminNormalizeText_(value);
  if (text.indexOf("adelant") >= 0) return ADMIN_CONFIG.SCHEDULE_TYPES.ADELANTADO;
  if (text.indexOf("recuper") >= 0) return ADMIN_CONFIG.SCHEDULE_TYPES.RECUPERACION;
  if (text.indexOf("reprogram") >= 0 || text.indexOf("posterg") >= 0) {
    return ADMIN_CONFIG.SCHEDULE_TYPES.REPROGRAMADO;
  }
  return ADMIN_CONFIG.SCHEDULE_TYPES.OFICIAL;
}

function adminPopulateSchedulingMetadata_(spreadsheet) {
  var fixtureSheet = adminGetSheetByGid_(spreadsheet, ADMIN_CONFIG.FIXTURE_GID);
  var columns = ADMIN_CONFIG.COLUMNS.FIXTURE;
  var rows = fixtureSheet.getDataRange().getDisplayValues();
  var pairOccurrences = {};
  var rowsInitialized = 0;

  rows.slice(1).forEach(function(row) {
    var player1 = String(row[columns.PLAYER_1] || "").trim();
    var player2 = String(row[columns.PLAYER_2] || "").trim();
    if (!player1 || !player2 || player1 === "-" || player2 === "-") return;
    var isDoublesRound = adminNormalizeText_(row[columns.CATEGORY]) === "d";
    var key = adminOrderedPairKey_(player1, player2);
    if (isDoublesRound) pairOccurrences[key] = (pairOccurrences[key] || 0) + 1;
  });

  var pairSeen = {};
  rows.slice(1).forEach(function(row, index) {
    var player1 = String(row[columns.PLAYER_1] || "").trim();
    var player2 = String(row[columns.PLAYER_2] || "").trim();
    if (!player1 || !player2 || player1 === "-" || player2 === "-") return;

    var key = adminOrderedPairKey_(player1, player2);
    var isDoublesRound = adminNormalizeText_(row[columns.CATEGORY]) === "d";
    if (isDoublesRound) pairSeen[key] = (pairSeen[key] || 0) + 1;
    var values = [
      row[columns.ORIGINAL_DATE] || row[columns.DATE],
      row[columns.ORIGINAL_COURT] || row[columns.COURT],
      row[columns.ORIGINAL_TURN] || row[columns.TURN],
      row[columns.SCHEDULE_TYPE] || adminScheduleTypeFromText_(row[columns.NOTES]),
      row[columns.ROUND] || (isDoublesRound && pairOccurrences[key] > 1
        ? (pairSeen[key] === 1 ? "Ida" : "Vuelta")
        : "Única")
    ];
    var changed = values.some(function(value, offset) {
      return !String(row[columns.ORIGINAL_DATE + offset] || "").trim() && String(value || "").trim();
    });
    if (!changed) return;
    fixtureSheet.getRange(index + 2, columns.ORIGINAL_DATE + 1, 1, values.length).setValues([values]);
    rowsInitialized++;
  });

  SpreadsheetApp.flush();
  return { ok: true, rowsInitialized: rowsInitialized };
}

function adminEnsureHeader_(sheet, column, expectedHeader) {
  var cell = sheet.getRange(1, column);
  var currentHeader = String(cell.getDisplayValue() || "").trim();
  if (currentHeader && adminNormalizeText_(currentHeader) !== adminNormalizeText_(expectedHeader)) {
    throw new Error(
      "La columna " + column + " de la hoja " + sheet.getName() +
      " ya contiene el encabezado ‘" + currentHeader + "’. No se modificó."
    );
  }
  if (!currentHeader) cell.setValue(expectedHeader);
}

function adminPopulateMatchIds_(spreadsheet) {
  var fixtureSheet = adminGetSheetByGid_(spreadsheet, ADMIN_CONFIG.FIXTURE_GID);
  var registroSheet = adminGetSheetByGid_(spreadsheet, ADMIN_CONFIG.REGISTRO_GID);
  var matches = adminGetFixtureMatches_(fixtureSheet);
  var records = adminGetRegistroRecords_(registroSheet);
  var matchesById = {};
  var matchesByPair = {};
  var matchesByPairDate = {};
  var recordsByPair = {};
  var recordsByPairDate = {};

  matches.forEach(function(match) {
    if (!matchesById[match.matchId]) matchesById[match.matchId] = [];
    matchesById[match.matchId].push(match.sourceRow);
    if (!matchesByPair[match.pairKey]) matchesByPair[match.pairKey] = [];
    matchesByPair[match.pairKey].push(match);
    if (match.pairDateKey) {
      if (!matchesByPairDate[match.pairDateKey]) matchesByPairDate[match.pairDateKey] = [];
      matchesByPairDate[match.pairDateKey].push(match);
    }
  });

  var duplicateFixtureIds = Object.keys(matchesById).filter(function(matchId) {
    return matchesById[matchId].length > 1;
  });
  if (duplicateFixtureIds.length) {
    var details = duplicateFixtureIds.map(function(matchId) {
      return matchId + " (filas " + matchesById[matchId].join(", ") + ")";
    });
    throw new Error("Hay IDs de partido duplicados en el fixture: " + details.join("; ") + ".");
  }

  records.forEach(function(record) {
    if (!recordsByPair[record.pairKey]) recordsByPair[record.pairKey] = [];
    recordsByPair[record.pairKey].push(record);
    if (record.pairDateKey) {
      if (!recordsByPairDate[record.pairDateKey]) recordsByPairDate[record.pairDateKey] = [];
      recordsByPairDate[record.pairDateKey].push(record);
    }
  });

  var fixtureLastRow = fixtureSheet.getLastRow();
  var fixtureIdValues = fixtureLastRow > 1
    ? fixtureSheet.getRange(2, ADMIN_CONFIG.COLUMNS.FIXTURE.MATCH_ID + 1, fixtureLastRow - 1, 1).getDisplayValues()
    : [];
  var fixtureWrites = [];
  var fixtureIdsCreated = 0;
  matches.forEach(function(match) {
    var index = match.sourceRow - 2;
    if (!String(fixtureIdValues[index][0] || "").trim()) {
      fixtureIdValues[index][0] = match.matchId;
      fixtureWrites.push({ row: match.sourceRow, matchId: match.matchId });
      fixtureIdsCreated++;
    }
  });

  var registroLastRow = registroSheet.getLastRow();
  var registroIdValues = registroLastRow > 1
    ? registroSheet.getRange(2, ADMIN_CONFIG.COLUMNS.REGISTRO.MATCH_ID + 1, registroLastRow - 1, 1).getDisplayValues()
    : [];
  var registroWrites = [];
  var registroIdsCreated = 0;
  records.forEach(function(record) {
    var candidates = matchesByPair[record.pairKey] || [];
    var datedCandidates = record.pairDateKey ? (matchesByPairDate[record.pairDateKey] || []) : [];
    var uniqueRecord = (recordsByPair[record.pairKey] || []).length === 1;
    var uniqueDatedRecord = record.pairDateKey &&
      (recordsByPairDate[record.pairDateKey] || []).length === 1;
    var index = record.sourceRow - 2;
    var resolvedMatch = datedCandidates.length === 1 && uniqueDatedRecord
      ? datedCandidates[0]
      : (candidates.length === 1 && uniqueRecord ? candidates[0] : null);
    if (!record.matchId && resolvedMatch) {
      registroIdValues[index][0] = resolvedMatch.matchId;
      registroWrites.push({ row: record.sourceRow, matchId: resolvedMatch.matchId });
      registroIdsCreated++;
    }
  });

  var combinedIds = {};
  registroIdValues.forEach(function(row, index) {
    var matchId = adminCreateMatchId_({ matchId: row[0] });
    if (!row[0]) return;
    if (!combinedIds[matchId]) combinedIds[matchId] = [];
    combinedIds[matchId].push(index + 2);
  });
  var duplicateRegistroIds = Object.keys(combinedIds).filter(function(matchId) {
    return combinedIds[matchId].length > 1;
  });
  if (duplicateRegistroIds.length) {
    var registroDetails = duplicateRegistroIds.map(function(matchId) {
      return matchId + " (filas " + combinedIds[matchId].join(", ") + ")";
    });
    throw new Error("Hay IDs de partido duplicados en el registro: " + registroDetails.join("; ") + ".");
  }

  fixtureWrites.forEach(function(entry) {
    fixtureSheet.getRange(entry.row, ADMIN_CONFIG.COLUMNS.FIXTURE.MATCH_ID + 1).setValue(entry.matchId);
  });
  registroWrites.forEach(function(entry) {
    registroSheet.getRange(entry.row, ADMIN_CONFIG.COLUMNS.REGISTRO.MATCH_ID + 1).setValue(entry.matchId);
  });
  SpreadsheetApp.flush();

  return {
    fixtureIdsCreated: fixtureIdsCreated,
    registroIdsCreated: registroIdsCreated
  };
}

function addAdminEmail(adminEmail) {
  adminAssertAuthorized_();
  var email = String(adminEmail || "").trim().toLowerCase();
  if (!/^\S+@\S+\.\S+$/.test(email)) throw new Error("Correo no válido.");

  var properties = PropertiesService.getScriptProperties();
  var emails = adminAllowedEmails_();
  if (emails.indexOf(email) < 0) emails.push(email);
  properties.setProperty(ADMIN_CONFIG.ADMIN_EMAILS_PROPERTY, emails.sort().join(","));
  return emails;
}

function getAdminDashboard() {
  adminAssertAuthorized_();
  return adminGetDashboard_();
}

function saveAdminMatch(payload) {
  adminAssertAuthorized_();

  var lock = LockService.getScriptLock();
  lock.waitLock(15000);

  try {
    return adminSaveMatch_(payload || {});
  } finally {
    lock.releaseLock();
  }
}

function adminAssertAuthorized_() {
  var allowed = adminAllowedEmails_();
  if (!allowed.length) {
    throw new Error("El administrador no está configurado. Ejecuta setupAdmin desde Apps Script.");
  }

  var activeEmail = String(Session.getActiveUser().getEmail() || "").trim().toLowerCase();
  if (!activeEmail) {
    throw new Error(
      "Google no pudo identificar tu cuenta. Implementa la aplicación para ejecutarse como el usuario que accede."
    );
  }
  if (allowed.indexOf(activeEmail) < 0) {
    throw new Error("Tu cuenta de Google no tiene acceso a este administrador.");
  }
  return activeEmail;
}

function adminAllowedEmails_() {
  var raw = PropertiesService.getScriptProperties()
    .getProperty(ADMIN_CONFIG.ADMIN_EMAILS_PROPERTY) || "";

  return raw.split(",")
    .map(function(email) { return email.trim().toLowerCase(); })
    .filter(Boolean);
}

function adminGetSpreadsheet_() {
  var spreadsheetId = PropertiesService.getScriptProperties()
    .getProperty(ADMIN_CONFIG.SPREADSHEET_ID_PROPERTY);

  if (!spreadsheetId) {
    throw new Error("Falta configurar el ID del Google Sheets mediante setupAdmin.");
  }
  return SpreadsheetApp.openById(spreadsheetId);
}

function adminGetSheetByGid_(spreadsheet, gid) {
  var sheet = spreadsheet.getSheets().find(function(candidate) {
    return candidate.getSheetId() === gid;
  });

  if (!sheet) throw new Error("No se encontró la hoja con GID " + gid + ".");
  return sheet;
}

function adminToday_() {
  return Utilities.formatDate(new Date(), ADMIN_CONFIG.TIME_ZONE, "d/M/yyyy");
}

function adminGetFixtureMatches_(fixtureSheet) {
  var rows = fixtureSheet.getDataRange().getDisplayValues();
  var columns = ADMIN_CONFIG.COLUMNS.FIXTURE;

  return rows.slice(1).map(function(row, index) {
    var match = {
      sourceRow: index + 2,
      season: ADMIN_CONFIG.SEASON,
      week: String(row[columns.WEEK] || "").trim(),
      court: String(row[columns.COURT] || "").trim(),
      turn: String(row[columns.TURN] || "").trim(),
      category: String(row[columns.CATEGORY] || "").trim(),
      player1: String(row[columns.PLAYER_1] || "").trim(),
      player2: String(row[columns.PLAYER_2] || "").trim(),
      date: String(row[columns.DATE] || "").trim(),
      fixtureStatus: String(row[columns.STATUS] || "").trim(),
      fixtureNotes: String(row[columns.NOTES] || "").trim(),
      matchId: String(row[columns.MATCH_ID] || "").trim(),
      originalDate: String(row[columns.ORIGINAL_DATE] || row[columns.DATE] || "").trim(),
      originalCourt: String(row[columns.ORIGINAL_COURT] || row[columns.COURT] || "").trim(),
      originalTurn: String(row[columns.ORIGINAL_TURN] || row[columns.TURN] || "").trim(),
      scheduleType: String(row[columns.SCHEDULE_TYPE] || "").trim() || adminScheduleTypeFromText_(row[columns.NOTES]),
      round: String(row[columns.ROUND] || "").trim() || "Única"
    };

    match.matchId = adminCreateMatchId_(match);
    match.pairKey = adminOrderedPairKey_(match.player1, match.player2);
    match.pairDateKey = adminPairDateKey_(match.player1, match.player2, match.date);
    return match;
  }).filter(function(match) {
    return match.week && match.turn && match.player1 && match.player2 &&
      match.player1 !== "-" && match.player2 !== "-";
  });
}

function adminGetRegistroRecords_(registroSheet) {
  var rows = registroSheet.getDataRange().getDisplayValues();
  var columns = ADMIN_CONFIG.COLUMNS.REGISTRO;

  return rows.slice(1).map(function(row, index) {
    var record = {
      sourceRow: index + 2,
      date: String(row[columns.DATE] || "").trim(),
      player1: String(row[columns.PLAYER_1] || "").trim(),
      player2: String(row[columns.PLAYER_2] || "").trim(),
      pending: String(row[columns.PENDING] || "").trim(),
      notes: String(row[columns.NOTES] || "").trim(),
      set1Player1: String(row[columns.SET_1_PLAYER_1] || "").trim(),
      set1Player2: String(row[columns.SET_1_PLAYER_2] || "").trim(),
      set2Player1: String(row[columns.SET_2_PLAYER_1] || "").trim(),
      set2Player2: String(row[columns.SET_2_PLAYER_2] || "").trim(),
      stbPlayer1: String(row[columns.STB_PLAYER_1] || "").trim(),
      stbPlayer2: String(row[columns.STB_PLAYER_2] || "").trim(),
      setsPlayer1: Number(row[columns.SETS_PLAYER_1] || 0),
      setsPlayer2: Number(row[columns.SETS_PLAYER_2] || 0),
      winner: String(row[columns.WINNER] || "").trim(),
      loser: String(row[columns.LOSER] || "").trim(),
      resultType: String(row[columns.RESULT_TYPE] || "").trim(),
      resultWeb: String(row[columns.RESULT_WEB] || "").trim(),
      pointsPlayer1: Number(row[columns.POINTS_PLAYER_1] || 0),
      pointsPlayer2: Number(row[columns.POINTS_PLAYER_2] || 0),
      legacyKey: String(row[columns.LEGACY_KEY] || "").trim(),
      matchId: String(row[columns.MATCH_ID] || "").trim()
    };

    record.matchId = record.matchId ? adminCreateMatchId_({ matchId: record.matchId }) : "";
    record.pairKey = adminOrderedPairKey_(record.player1, record.player2);
    record.pairDateKey = adminPairDateKey_(record.player1, record.player2, record.date);
    record.status = adminRecordStatus_(record);
    return record;
  }).filter(function(record) {
    return record.player1 && record.player2;
  });
}

function adminRecordStatus_(record) {
  if (record.resultWeb || record.winner) {
    if (adminNormalizeText_(record.resultType).indexOf("w/o") >= 0 ||
        adminNormalizeText_(record.resultType).indexOf("wo") >= 0) {
      if (!record.winner) return ADMIN_STATUSES.WO_AMBOS;
      return adminNormalizeText_(record.winner) === adminNormalizeText_(record.player2)
        ? ADMIN_STATUSES.WO_J1
        : ADMIN_STATUSES.WO_J2;
    }
    return ADMIN_STATUSES.JUGADO;
  }

  var pendingMarker = adminNormalizeText_(record.pending);
  if (["si", "yes", "pendiente", "reprogramado", "postergado", "suspendido"].indexOf(pendingMarker) >= 0) {
    var normalizedNotes = adminNormalizeStatus_(record.notes);
    return normalizedNotes === ADMIN_STATUSES.PROGRAMADO
      ? ADMIN_STATUSES.POR_COORDINAR
      : normalizedNotes;
  }
  return ADMIN_STATUSES.PROGRAMADO;
}

function adminEffectiveMatchStatus_(match, record) {
  if (record && (record.resultWeb || record.winner)) return record.status;

  var scheduleType = adminNormalizeText_(match && match.scheduleType || "oficial");
  var fixtureStatus = adminNormalizeStatus_(match && (match.fixtureStatus || match.fixtureNotes));
  var hasExplicitReschedule = Boolean(
    match && match.date && scheduleType !== ADMIN_CONFIG.SCHEDULE_TYPES.OFICIAL &&
    fixtureStatus === ADMIN_STATUSES.PROGRAMADO
  );

  if (hasExplicitReschedule) return ADMIN_STATUSES.PROGRAMADO;
  return record ? record.status : fixtureStatus;
}

function adminGetDashboard_() {
  var spreadsheet = adminGetSpreadsheet_();
  var fixtureSheet = adminGetSheetByGid_(spreadsheet, ADMIN_CONFIG.FIXTURE_GID);
  var registroSheet = adminGetSheetByGid_(spreadsheet, ADMIN_CONFIG.REGISTRO_GID);
  var rankingsSheet = adminGetSheetByGid_(spreadsheet, ADMIN_CONFIG.RANKINGS_GID);
  var matches = adminGetFixtureMatches_(fixtureSheet);
  var records = adminGetRegistroRecords_(registroSheet);
  var pairCounts = {};
  var pairDateCounts = {};
  var recordPairDateCounts = {};
  var recordsById = {};
  var recordsByPair = {};
  var recordsByPairDate = {};

  matches.forEach(function(match) {
    pairCounts[match.pairKey] = (pairCounts[match.pairKey] || 0) + 1;
    if (match.pairDateKey) {
      pairDateCounts[match.pairDateKey] = (pairDateCounts[match.pairDateKey] || 0) + 1;
    }
  });

  records.forEach(function(record) {
    if (record.matchId) recordsById[record.matchId] = record;
    recordsByPair[record.pairKey] = record;
    if (record.pairDateKey) {
      recordsByPairDate[record.pairDateKey] = record;
      recordPairDateCounts[record.pairDateKey] = (recordPairDateCounts[record.pairDateKey] || 0) + 1;
    }
  });

  var publicMatches = matches.map(function(match) {
    var record = recordsById[match.matchId] || null;
    if (!record && match.pairDateKey && pairDateCounts[match.pairDateKey] === 1 &&
        recordPairDateCounts[match.pairDateKey] === 1) {
      record = recordsByPairDate[match.pairDateKey] || null;
    }
    if (!record && pairCounts[match.pairKey] === 1) record = recordsByPair[match.pairKey] || null;

    var status = adminEffectiveMatchStatus_(match, record);
    var usesFixtureSchedule = status === ADMIN_STATUSES.PROGRAMADO &&
      record && [ADMIN_STATUSES.POR_COORDINAR, ADMIN_STATUSES.SUSPENDIDO].indexOf(record.status) >= 0;

    return {
      matchId: match.matchId,
      week: match.week,
      court: match.court,
      turn: match.turn,
      category: match.category,
      player1: match.player1,
      player2: match.player2,
      date: match.date,
      originalDate: match.originalDate,
      originalCourt: match.originalCourt,
      originalTurn: match.originalTurn,
      scheduleType: match.scheduleType,
      scheduleTypeLabel: adminScheduleTypeLabel_(match.scheduleType),
      round: match.round,
      status: status,
      statusLabel: adminStatusLabel_(status),
      notes: usesFixtureSchedule ? match.fixtureNotes : (record ? record.notes : match.fixtureNotes),
      resultWeb: record ? record.resultWeb : "",
      record: record ? {
        sourceRow: record.sourceRow,
        date: record.date,
        set1Player1: record.set1Player1,
        set1Player2: record.set1Player2,
        set2Player1: record.set2Player1,
        set2Player2: record.set2Player2,
        stbPlayer1: record.stbPlayer1,
        stbPlayer2: record.stbPlayer2
      } : null
    };
  });

  publicMatches.sort(function(a, b) {
    return Number(a.week) - Number(b.week) ||
      Number(a.court) - Number(b.court) ||
      String(a.turn).localeCompare(String(b.turn), "es");
  });

  var summary = {
    total: publicMatches.length,
    played: 0,
    pending: 0,
    upcoming: 0
  };

  publicMatches.forEach(function(match) {
    if ([ADMIN_STATUSES.JUGADO, ADMIN_STATUSES.WO_J1, ADMIN_STATUSES.WO_J2, ADMIN_STATUSES.WO_AMBOS].indexOf(match.status) >= 0) {
      summary.played++;
    } else if ([ADMIN_STATUSES.POR_COORDINAR, ADMIN_STATUSES.SUSPENDIDO].indexOf(match.status) >= 0) {
      summary.pending++;
    } else {
      summary.upcoming++;
    }
  });

  return {
    season: ADMIN_CONFIG.SEASON,
    spreadsheetName: spreadsheet.getName(),
    generatedAt: Utilities.formatDate(new Date(), ADMIN_CONFIG.TIME_ZONE, "d/M/yyyy HH:mm"),
    today: adminToday_(),
    summary: summary,
    integrity: adminGetIntegrityReport_(fixtureSheet, registroSheet, rankingsSheet),
    matches: publicMatches
  };
}

function adminGetIntegrityReport_(fixtureSheet, registroSheet, rankingsSheet) {
  var fixtureRows = fixtureSheet.getDataRange().getDisplayValues();
  var registroRows = registroSheet.getDataRange().getDisplayValues();
  var rankingRows = rankingsSheet.getDataRange().getDisplayValues();
  var fixtureColumns = ADMIN_CONFIG.COLUMNS.FIXTURE;
  var registroColumns = ADMIN_CONFIG.COLUMNS.REGISTRO;
  var issues = [];
  var fixtureById = {};
  var recordsById = {};
  var categoryPlayers = {};
  var statsByPlayer = {};

  function statsFor(player) {
    var key = adminNormalizeText_(player);
    if (!statsByPlayer[key]) {
      statsByPlayer[key] = { player: String(player || "").trim(), points: 0, played: 0, setDiff: 0, gameDiff: 0 };
    }
    return statsByPlayer[key];
  }

  fixtureRows.slice(1).forEach(function(row, index) {
    var player1 = String(row[fixtureColumns.PLAYER_1] || "").trim();
    var player2 = String(row[fixtureColumns.PLAYER_2] || "").trim();
    if (!player1 || !player2 || player1 === "-" || player2 === "-") return;
    var category = String(row[fixtureColumns.CATEGORY] || "").trim().toUpperCase();
    var id = adminCreateMatchId_({ matchId: row[fixtureColumns.MATCH_ID] });
    if (!String(row[fixtureColumns.MATCH_ID] || "").trim()) issues.push("Fixture fila " + (index + 2) + ": falta ID partido.");
    if (fixtureById[id]) issues.push("Fixture: ID duplicado " + id + ".");
    fixtureById[id] = { player1: player1, player2: player2 };
    if (!categoryPlayers[category]) categoryPlayers[category] = {};
    categoryPlayers[category][adminNormalizeText_(player1)] = player1;
    categoryPlayers[category][adminNormalizeText_(player2)] = player2;
  });

  registroRows.slice(1).forEach(function(row, index) {
    var player1 = String(row[registroColumns.PLAYER_1] || "").trim();
    var player2 = String(row[registroColumns.PLAYER_2] || "").trim();
    if (!player1 || !player2) return;
    var rowNumber = index + 2;
    var rawId = String(row[registroColumns.MATCH_ID] || "").trim();
    var id = adminCreateMatchId_({ matchId: rawId });
    if (!rawId) issues.push("Registro fila " + rowNumber + ": falta ID partido.");
    if (rawId && recordsById[id]) issues.push("Registro: ID duplicado " + id + ".");
    recordsById[id] = true;
    var fixtureMatch = rawId ? fixtureById[id] : null;
    if (rawId && !fixtureMatch) issues.push("Registro fila " + rowNumber + ": el ID no existe en Fixture.");
    if (fixtureMatch && adminOrderedPairKey_(fixtureMatch.player1, fixtureMatch.player2) !== adminOrderedPairKey_(player1, player2)) {
      issues.push("Registro fila " + rowNumber + ": los jugadores no coinciden con Fixture.");
    }

    var pending = Boolean(String(row[registroColumns.PENDING] || "").trim());
    var winner = String(row[registroColumns.WINNER] || "").trim();
    var loser = String(row[registroColumns.LOSER] || "").trim();
    var resultWeb = String(row[registroColumns.RESULT_WEB] || "").trim();
    var resultType = adminNormalizeText_(row[registroColumns.RESULT_TYPE]);
    var completed = Boolean(winner || loser || resultWeb || resultType);
    if (pending && completed) issues.push("Registro fila " + rowNumber + ": está pendiente y finalizado a la vez.");
    if (!pending && !completed) issues.push("Registro fila " + rowNumber + ": no tiene estado ni resultado.");
    if (winner && [adminNormalizeText_(player1), adminNormalizeText_(player2)].indexOf(adminNormalizeText_(winner)) < 0) {
      issues.push("Registro fila " + rowNumber + ": ganador inválido.");
    }
    if (loser && [adminNormalizeText_(player1), adminNormalizeText_(player2)].indexOf(adminNormalizeText_(loser)) < 0) {
      issues.push("Registro fila " + rowNumber + ": perdedor inválido.");
    }

    var points1 = Number(row[registroColumns.POINTS_PLAYER_1] || 0);
    var points2 = Number(row[registroColumns.POINTS_PLAYER_2] || 0);
    if (winner && loser && points1 + points2 !== 3) {
      issues.push("Registro fila " + rowNumber + ": los puntos del partido no suman 3.");
    }
    if (!winner || !loser) return;

    var stats1 = statsFor(player1);
    var stats2 = statsFor(player2);
    var sets1 = Number(row[registroColumns.SETS_PLAYER_1] || 0);
    var sets2 = Number(row[registroColumns.SETS_PLAYER_2] || 0);
    var games1 = Number(row[registroColumns.SET_1_PLAYER_1] || 0) + Number(row[registroColumns.SET_2_PLAYER_1] || 0);
    var games2 = Number(row[registroColumns.SET_1_PLAYER_2] || 0) + Number(row[registroColumns.SET_2_PLAYER_2] || 0);
    stats1.points += points1;
    stats2.points += points2;
    stats1.played++;
    stats2.played++;
    stats1.setDiff += sets1 - sets2;
    stats2.setDiff += sets2 - sets1;
    stats1.gameDiff += games1 - games2;
    stats2.gameDiff += games2 - games1;
  });

  var actualByCategory = {};
  var category = "";
  rankingRows.forEach(function(row) {
    var categoryMatch = String(row[0] || "").trim().match(/^CATEGORIA\s+([A-D])$/i);
    if (categoryMatch) {
      category = categoryMatch[1].toUpperCase();
      actualByCategory[category] = [];
      return;
    }
    if (!category || !/^\d+$/.test(String(row[0] || "").trim()) || !row[1]) return;
    actualByCategory[category].push({
      player: String(row[1] || "").trim(),
      points: Number(row[2] || 0),
      played: Number(row[3] || 0)
    });
  });

  ["A", "B", "C", "D"].forEach(function(categoryName) {
    var players = Object.keys(categoryPlayers[categoryName] || {}).map(function(key) {
      return categoryPlayers[categoryName][key];
    });
    var expected = players.map(function(player) { return statsFor(player); }).sort(function(a, b) {
      return b.points - a.points || a.played - b.played || b.setDiff - a.setDiff ||
        b.gameDiff - a.gameDiff || String(a.player).localeCompare(String(b.player), "es");
    });
    var actual = actualByCategory[categoryName] || [];
    if (actual.length !== expected.length) {
      issues.push("Rankings " + categoryName + ": cantidad de jugadores incorrecta.");
      return;
    }
    expected.forEach(function(player, index) {
      var row = actual[index] || {};
      if (adminNormalizeText_(row.player) !== adminNormalizeText_(player.player) ||
          Number(row.points) !== player.points || Number(row.played) !== player.played) {
        issues.push("Rankings " + categoryName + ": la posición " + (index + 1) + " no coincide con Registro.");
      }
    });
  });

  return {
    ok: issues.length === 0,
    issueCount: issues.length,
    issues: issues.slice(0, 12),
    fixtureCount: Object.keys(fixtureById).length,
    recordCount: Object.keys(recordsById).length
  };
}

function adminSaveMatch_(payload) {
  var spreadsheet = adminGetSpreadsheet_();
  var fixtureSheet = adminGetSheetByGid_(spreadsheet, ADMIN_CONFIG.FIXTURE_GID);
  var registroSheet = adminGetSheetByGid_(spreadsheet, ADMIN_CONFIG.REGISTRO_GID);
  var matchId = adminCreateMatchId_({ matchId: payload.matchId });
  var fixtureMatches = adminGetFixtureMatches_(fixtureSheet);
  var match = fixtureMatches.find(function(candidate) {
    return candidate.matchId === matchId;
  });

  if (!match) throw new Error("No se encontró el partido seleccionado en el fixture.");

  var allowedStatuses = Object.keys(ADMIN_STATUSES).map(function(key) {
    return ADMIN_STATUSES[key];
  });
  if (allowedStatuses.indexOf(payload.status) < 0) {
    throw new Error("Selecciona un estado válido para registrar.");
  }

  var allowedScheduleTypes = Object.keys(ADMIN_CONFIG.SCHEDULE_TYPES).map(function(key) {
    return ADMIN_CONFIG.SCHEDULE_TYPES[key];
  });
  var scheduleType = String(payload.scheduleType || match.scheduleType || ADMIN_CONFIG.SCHEDULE_TYPES.OFICIAL);
  if (allowedScheduleTypes.indexOf(scheduleType) < 0) throw new Error("Tipo de programación no válido.");

  if (payload.status === ADMIN_STATUSES.PROGRAMADO && scheduleType === ADMIN_CONFIG.SCHEDULE_TYPES.OFICIAL) {
    throw new Error("Para cambiar la programación selecciona adelantado, reprogramado o recuperación.");
  }

  var input = Object.assign({}, payload, {
    date: adminNormalizeDate_(payload.date || match.date || adminToday_())
  });
  var newRow = payload.status === ADMIN_STATUSES.PROGRAMADO ? null : adminBuildRegistroRow_(match, input);
  var target = newRow
    ? adminFindRegistroTarget_(registroSheet, match, fixtureMatches)
    : { row: 0, existing: false };
  var before = newRow && target.existing
    ? registroSheet.getRange(target.row, 1, 1, ADMIN_CONFIG.REGISTRO_COLUMN_COUNT).getDisplayValues()[0]
    : [];
  var fixtureColumns = ADMIN_CONFIG.COLUMNS.FIXTURE;
  var fixtureBefore = fixtureSheet.getRange(match.sourceRow, 1, 1, fixtureColumns.ROUND + 1).getDisplayValues()[0];
  var fixtureAfter = fixtureBefore.slice();
  fixtureAfter[fixtureColumns.STATUS] = adminStatusLabel_(payload.status);
  fixtureAfter[fixtureColumns.NOTES] = String(payload.notes || "").trim();
  fixtureAfter[fixtureColumns.SCHEDULE_TYPE] = scheduleType;

  if (payload.status === ADMIN_STATUSES.PROGRAMADO) {
    fixtureAfter[fixtureColumns.DATE] = input.date;
    fixtureAfter[fixtureColumns.COURT] = String(payload.court || match.court || "").trim();
    fixtureAfter[fixtureColumns.TURN] = String(payload.turn || match.turn || "").trim();
  }

  var targetRange = newRow
    ? registroSheet.getRange(target.row, 1, 1, ADMIN_CONFIG.REGISTRO_COLUMN_COUNT)
    : null;
  var fixtureRange = fixtureSheet.getRange(match.sourceRow, 1, 1, fixtureColumns.ROUND + 1);
  try {
    fixtureRange.setValues([fixtureAfter]);
    if (targetRange) targetRange.setValues([newRow]);
    adminWriteAudit_(spreadsheet, {
      action: payload.status === ADMIN_STATUSES.PROGRAMADO
        ? "REPROGRAMAR"
        : (target.existing ? "ACTUALIZAR" : "CREAR"),
      matchId: match.matchId,
      targetRow: targetRange ? target.row : match.sourceRow,
      before: { fixture: fixtureBefore, registro: before },
      after: { fixture: fixtureAfter, registro: newRow || [] }
    });
  } catch (error) {
    fixtureRange.setValues([fixtureBefore]);
    if (targetRange) {
      targetRange.setValues([target.existing ? before : new Array(ADMIN_CONFIG.REGISTRO_COLUMN_COUNT).fill("")]);
    }
    SpreadsheetApp.flush();
    throw error;
  }

  SpreadsheetApp.flush();
  return adminGetDashboard_();
}

function adminFindRegistroTarget_(registroSheet, match, fixtureMatches) {
  var values = registroSheet.getDataRange().getDisplayValues();
  var columns = ADMIN_CONFIG.COLUMNS.REGISTRO;
  var byId = [];
  var byPairDate = [];
  var byPair = [];
  var firstEmptyRow = 0;

  for (var index = 1; index < values.length; index++) {
    var row = values[index];
    var player1 = String(row[columns.PLAYER_1] || "").trim();
    var player2 = String(row[columns.PLAYER_2] || "").trim();

    if (!player1 && !player2 && !firstEmptyRow) firstEmptyRow = index + 1;
    if (!player1 || !player2) continue;

    var rowMatchId = adminCreateMatchId_({ matchId: row[columns.MATCH_ID] });
    if (row[columns.MATCH_ID] && rowMatchId === match.matchId) byId.push(index + 1);
    if (adminOrderedPairKey_(player1, player2) === match.pairKey) byPair.push(index + 1);
    if (match.pairDateKey && adminPairDateKey_(player1, player2, row[columns.DATE]) === match.pairDateKey) {
      byPairDate.push(index + 1);
    }
  }

  if (byId.length > 1) {
    throw new Error("Hay más de un registro con el mismo ID de partido: filas " + byId.join(", ") + ".");
  }
  if (byId.length === 1) return { row: byId[0], existing: true };

  if (byPairDate.length > 1) {
    throw new Error("Hay más de un registro para esta pareja y fecha: filas " + byPairDate.join(", ") + ".");
  }
  if (byPairDate.length === 1) return { row: byPairDate[0], existing: true };

  var fixturePairCount = (fixtureMatches || []).filter(function(candidate) {
    return candidate.pairKey === match.pairKey;
  }).length;
  if (fixturePairCount > 1) {
    return { row: firstEmptyRow || registroSheet.getLastRow() + 1, existing: false };
  }

  if (byPair.length > 1) {
    throw new Error("Hay más de un registro legado para esta pareja: filas " + byPair.join(", ") + ".");
  }
  if (byPair.length === 1) return { row: byPair[0], existing: true };

  return {
    row: firstEmptyRow || registroSheet.getLastRow() + 1,
    existing: false
  };
}

function adminEnsureAuditSheet_(spreadsheet) {
  var sheet = spreadsheet.getSheetByName(ADMIN_CONFIG.AUDIT_SHEET_NAME);
  if (!sheet) sheet = spreadsheet.insertSheet(ADMIN_CONFIG.AUDIT_SHEET_NAME);

  if (sheet.getLastRow() === 0) {
    sheet.appendRow([
      "Fecha y hora",
      "Usuario",
      "Acción",
      "ID partido",
      "Fila registro",
      "Valor anterior",
      "Valor nuevo"
    ]);
    sheet.setFrozenRows(1);
  }
  return sheet;
}

function adminWriteAudit_(spreadsheet, entry) {
  var sheet = adminEnsureAuditSheet_(spreadsheet);
  sheet.appendRow([
    new Date(),
    String(Session.getActiveUser().getEmail() || ""),
    entry.action,
    entry.matchId,
    entry.targetRow,
    JSON.stringify(entry.before || []),
    JSON.stringify(entry.after || [])
  ]);
}
