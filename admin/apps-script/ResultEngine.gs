var ADMIN_STATUSES = Object.freeze({
  PROGRAMADO: "programado",
  JUGADO: "jugado",
  POR_COORDINAR: "por_coordinar",
  WO_J1: "wo_j1",
  WO_J2: "wo_j2",
  WO_AMBOS: "wo_ambos",
  SUSPENDIDO: "suspendido"
});

function adminNormalizeText_(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[\u200B-\u200D\uFEFF]/g, "")
    .replace(/\u00a0/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function adminSlug_(value) {
  return adminNormalizeText_(value)
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function adminLegacyPlayerKey_(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/\s+/g, "")
    .trim();
}

function adminLegacyPairKey_(player1, player2) {
  return adminLegacyPlayerKey_(player1) + "|" + adminLegacyPlayerKey_(player2);
}

function adminOrderedPairKey_(player1, player2) {
  return [adminSlug_(player1), adminSlug_(player2)].filter(Boolean).sort().join("|");
}

function adminCreateMatchId_(match) {
  var explicitId = adminSlug_(match && match.matchId);
  if (explicitId) return explicitId;

  var players = [
    adminSlug_(match && match.player1),
    adminSlug_(match && match.player2)
  ].filter(Boolean).sort();

  return [
    adminSlug_(match && match.season) || "sin-temporada",
    "s" + (adminSlug_(match && match.week) || "sin-semana"),
    adminSlug_(match && match.category) || "sin-categoria"
  ].concat(players).join("-");
}

function adminNormalizeStatus_(value) {
  var text = adminNormalizeText_(value);
  if (!text) return ADMIN_STATUSES.PROGRAMADO;

  if (/w\s*\/?\s*o/.test(text) || /w[._-]o/.test(text)) {
    if (text.indexOf("ambos") >= 0) return ADMIN_STATUSES.WO_AMBOS;
    if (/jugador\s*1|j1/.test(text)) return ADMIN_STATUSES.WO_J1;
    if (/jugador\s*2|j2/.test(text)) return ADMIN_STATUSES.WO_J2;
  }

  if (text.indexOf("jugado") >= 0 || text.indexOf("finalizado") >= 0) return ADMIN_STATUSES.JUGADO;
  if (text.indexOf("por coordinar") >= 0 || text.indexOf("por_coordinar") >= 0) return ADMIN_STATUSES.POR_COORDINAR;
  if (text.indexOf("reprogram") >= 0 || text.indexOf("posterg") >= 0) return ADMIN_STATUSES.POR_COORDINAR;
  if (text.indexOf("pendiente") >= 0 || text === "si") return ADMIN_STATUSES.POR_COORDINAR;
  if (text.indexOf("suspend") >= 0) return ADMIN_STATUSES.SUSPENDIDO;
  return ADMIN_STATUSES.PROGRAMADO;
}

function adminStatusLabel_(status) {
  var labels = {};
  labels[ADMIN_STATUSES.PROGRAMADO] = "Programado";
  labels[ADMIN_STATUSES.JUGADO] = "Jugado";
  labels[ADMIN_STATUSES.POR_COORDINAR] = "Por coordinar";
  labels[ADMIN_STATUSES.WO_J1] = "W/O Jugador 1";
  labels[ADMIN_STATUSES.WO_J2] = "W/O Jugador 2";
  labels[ADMIN_STATUSES.WO_AMBOS] = "W/O ambos";
  labels[ADMIN_STATUSES.SUSPENDIDO] = "Suspendido";
  return labels[status] || labels[ADMIN_STATUSES.PROGRAMADO];
}

function adminScheduleTypeLabel_(type) {
  var labels = {};
  labels[ADMIN_CONFIG.SCHEDULE_TYPES.OFICIAL] = "Oficial";
  labels[ADMIN_CONFIG.SCHEDULE_TYPES.ADELANTADO] = "Adelantado";
  labels[ADMIN_CONFIG.SCHEDULE_TYPES.REPROGRAMADO] = "Reprogramado";
  labels[ADMIN_CONFIG.SCHEDULE_TYPES.RECUPERACION] = "Recuperación";
  return labels[type] || labels[ADMIN_CONFIG.SCHEDULE_TYPES.OFICIAL];
}

function adminNormalizeDate_(value) {
  var text = String(value || "").trim();
  var match = text.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})$/);

  if (!match) {
    var isoMatch = text.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (isoMatch) match = [isoMatch[0], isoMatch[3], isoMatch[2], isoMatch[1]];
  }
  if (!match) throw new Error("La fecha debe tener formato día/mes/año.");

  var day = Number(match[1]);
  var month = Number(match[2]);
  var year = Number(match[3]);
  var date = new Date(year, month - 1, day);
  var valid = date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;

  if (!valid || year < 2020 || year > 2100) throw new Error("La fecha ingresada no es válida.");
  return day + "/" + month + "/" + year;
}

function adminComparableDate_(value) {
  var text = String(value || "").trim();
  if (!text) return "";

  var match = text.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})$/);
  if (!match) {
    var isoMatch = text.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (isoMatch) match = [isoMatch[0], isoMatch[3], isoMatch[2], isoMatch[1]];
  }
  if (!match) return adminNormalizeText_(text);

  return match[3] + "-" + String(Number(match[2])).padStart(2, "0") +
    "-" + String(Number(match[1])).padStart(2, "0");
}

function adminPairDateKey_(player1, player2, date) {
  var comparableDate = adminComparableDate_(date);
  return comparableDate ? adminOrderedPairKey_(player1, player2) + "|" + comparableDate : "";
}

function adminToScore_(value, label) {
  if (value === "" || value === null || typeof value === "undefined") {
    throw new Error("Falta el marcador de " + label + ".");
  }

  var number = Number(value);
  if (!Number.isInteger(number) || number < 0 || number > 99) {
    throw new Error("El marcador de " + label + " no es válido.");
  }
  return number;
}

function adminRegularSetWinner_(score1, score2, label) {
  var high = Math.max(score1, score2);
  var low = Math.min(score1, score2);
  var valid = (high === 6 && low <= 4) || (high === 7 && (low === 5 || low === 6));

  if (!valid || score1 === score2) {
    throw new Error(label + " no tiene un marcador de set válido.");
  }
  return score1 > score2 ? 0 : 1;
}

function adminSuperTieBreakWinner_(score1, score2) {
  var high = Math.max(score1, score2);
  var difference = Math.abs(score1 - score2);

  if (high < 10 || difference < 2 || score1 === score2) {
    throw new Error("El super tie-break debe llegar al menos a 10 con diferencia de 2.");
  }
  return score1 > score2 ? 0 : 1;
}

function adminCalculatePlayedResult_(input) {
  var players = [String(input.player1 || "").trim(), String(input.player2 || "").trim()];
  if (!players[0] || !players[1] || players[0] === players[1]) {
    throw new Error("El partido necesita dos jugadores distintos.");
  }

  var set1 = [
    adminToScore_(input.set1Player1, "Set 1 / Jugador 1"),
    adminToScore_(input.set1Player2, "Set 1 / Jugador 2")
  ];
  var set2 = [
    adminToScore_(input.set2Player1, "Set 2 / Jugador 1"),
    adminToScore_(input.set2Player2, "Set 2 / Jugador 2")
  ];
  var winners = [
    adminRegularSetWinner_(set1[0], set1[1], "El primer set"),
    adminRegularSetWinner_(set2[0], set2[1], "El segundo set")
  ];
  var setsWon = [0, 0];
  setsWon[winners[0]]++;
  setsWon[winners[1]]++;

  var stb = ["", ""];
  var matchWinner;
  var resultType;
  var points = [0, 0];

  if (setsWon[0] === 2 || setsWon[1] === 2) {
    matchWinner = setsWon[0] === 2 ? 0 : 1;
    resultType = "2 sets";
    points[matchWinner] = 3;
  } else {
    stb = [
      adminToScore_(input.stbPlayer1, "Super tie-break / Jugador 1"),
      adminToScore_(input.stbPlayer2, "Super tie-break / Jugador 2")
    ];
    matchWinner = adminSuperTieBreakWinner_(stb[0], stb[1]);
    setsWon[matchWinner]++;
    resultType = "Super tie-break";
    points[matchWinner] = 2;
    points[matchWinner === 0 ? 1 : 0] = 1;
  }

  var loser = matchWinner === 0 ? 1 : 0;
  var scoreParts = [set1, set2];
  if (resultType === "Super tie-break") scoreParts.push(stb);
  var scoreWinnerFirst = scoreParts.map(function(score) {
    return score[matchWinner] + "-" + score[loser];
  }).join(" ");

  return {
    status: ADMIN_STATUSES.JUGADO,
    set1: set1,
    set2: set2,
    stb: stb,
    setsWon: setsWon,
    winner: players[matchWinner],
    loser: players[loser],
    winnerIndex: matchWinner,
    resultType: resultType,
    resultWeb: "Ganador " + players[matchWinner] + " " + scoreWinnerFirst,
    points: points,
    pointsWinner: points[matchWinner],
    pointsLoser: points[loser]
  };
}

function adminCalculateWoResult_(input) {
  var players = [String(input.player1 || "").trim(), String(input.player2 || "").trim()];
  var status = String(input.status || "");

  if (status === ADMIN_STATUSES.WO_AMBOS) {
    return {
      status: status,
      set1: ["", ""],
      set2: ["", ""],
      stb: ["", ""],
      setsWon: [0, 0],
      winner: "",
      loser: "",
      resultType: "W/O",
      resultWeb: "W/O ambos",
      points: [0, 0],
      pointsWinner: 0,
      pointsLoser: 0
    };
  }

  var winnerIndex = status === ADMIN_STATUSES.WO_J1 ? 1 : 0;
  var loserIndex = winnerIndex === 0 ? 1 : 0;
  var setsWon = winnerIndex === 0 ? [2, 0] : [0, 2];
  var points = winnerIndex === 0 ? [3, 0] : [0, 3];

  return {
    status: status,
    set1: ["", ""],
    set2: ["", ""],
    stb: ["", ""],
    setsWon: setsWon,
    winner: players[winnerIndex],
    loser: players[loserIndex],
    winnerIndex: winnerIndex,
    resultType: "W/O",
    resultWeb: "Ganador " + players[winnerIndex] + " por W/O",
    points: points,
    pointsWinner: 3,
    pointsLoser: 0
  };
}

function adminBuildRegistroRow_(match, input) {
  var status = String(input.status || ADMIN_STATUSES.JUGADO);
  var result = null;

  if (status === ADMIN_STATUSES.JUGADO) {
    result = adminCalculatePlayedResult_({
      player1: match.player1,
      player2: match.player2,
      set1Player1: input.set1Player1,
      set1Player2: input.set1Player2,
      set2Player1: input.set2Player1,
      set2Player2: input.set2Player2,
      stbPlayer1: input.stbPlayer1,
      stbPlayer2: input.stbPlayer2
    });
  } else if ([ADMIN_STATUSES.WO_J1, ADMIN_STATUSES.WO_J2, ADMIN_STATUSES.WO_AMBOS].indexOf(status) >= 0) {
    result = adminCalculateWoResult_({
      player1: match.player1,
      player2: match.player2,
      status: status
    });
  }

  var row = new Array(23).fill("");
  row[0] = adminNormalizeDate_(input.date || match.date);
  row[1] = match.player1;
  row[2] = match.player2;
  row[21] = adminLegacyPairKey_(match.player1, match.player2);
  row[22] = match.matchId;

  if (!result) {
    row[3] = status === ADMIN_STATUSES.PROGRAMADO ? "" : "si";
    row[4] = String(input.notes || adminStatusLabel_(status)).trim();
    return row;
  }

  row[4] = String(input.notes || "").trim();
  row[5] = result.set1[0];
  row[6] = result.set1[1];
  row[7] = result.set2[0];
  row[8] = result.set2[1];
  row[9] = result.stb[0];
  row[10] = result.stb[1];
  row[11] = result.setsWon[0];
  row[12] = result.setsWon[1];
  row[13] = result.winner;
  row[14] = result.loser;
  row[15] = result.resultType;
  row[16] = result.resultWeb;
  row[17] = result.points[0];
  row[18] = result.points[1];
  row[19] = result.pointsWinner;
  row[20] = result.pointsLoser;
  return row;
}
