var ADMIN_2027 = Object.freeze({
  VERSION: "2027.1",
  SHEETS: Object.freeze({
    PLAYERS: "OT Jugadores",
    COMPETITIONS: "OT Competiciones",
    CATEGORIES: "OT Categorías",
    ENTRIES: "OT Inscripciones",
    MATCHES: "OT Partidos"
  }),
  HEADERS: Object.freeze({
    PLAYERS: Object.freeze(["ID jugador", "Nombre", "Alias", "Sexo", "Activo", "Creado"]),
    COMPETITIONS: Object.freeze(["ID competición", "Tipo", "Nombre", "Temporada", "Edición", "Estado", "Fecha inicio", "Publicado", "Configuración", "Creado"]),
    CATEGORIES: Object.freeze(["ID competición", "ID categoría", "Nombre", "Formato", "Orden", "Activo"]),
    ENTRIES: Object.freeze(["ID competición", "ID categoría", "ID jugador", "Cabeza de serie", "Estado"]),
    MATCHES: Object.freeze([
      "ID partido", "ID competición", "ID categoría", "Ronda", "Semana", "Fecha oficial", "Fecha actual", "Cancha", "Turno",
      "Jugador 1", "Jugador 2", "Estado", "Tipo programación", "Ganador", "Marcador", "Siguiente partido", "Posición siguiente",
      "Cuenta tabla", "Cuenta H2H", "Puntos J1", "Puntos J2", "Sets J1", "Sets J2", "Games J1", "Games J2", "Actualizado"
    ])
  })
});

function admin2027Normalize_(value) {
  return String(value == null ? "" : value).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function admin2027Id_(prefix, value) {
  return prefix + "-" + (admin2027Normalize_(value) || Utilities.getUuid().slice(0, 8));
}

function admin2027Date_(value) {
  if (Object.prototype.toString.call(value) === "[object Date]") return new Date(value.getFullYear(), value.getMonth(), value.getDate());
  var text = String(value || "").trim();
  var iso = text.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (iso) return new Date(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]));
  var local = text.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})$/);
  if (local) return new Date(Number(local[3]), Number(local[2]) - 1, Number(local[1]));
  return null;
}

function admin2027IsoDate_(value) {
  var date = admin2027Date_(value);
  if (!date || isNaN(date.getTime())) return "";
  return Utilities.formatDate(date, ADMIN_CONFIG.TIME_ZONE, "yyyy-MM-dd");
}

function admin2027AddDays_(value, days) {
  var date = admin2027Date_(value);
  date.setDate(date.getDate() + Number(days || 0));
  return admin2027IsoDate_(date);
}

function admin2027Shuffle_(items, seed) {
  var source = (items || []).slice();
  var state = 2166136261;
  String(seed || "open-tennis").split("").forEach(function(character) {
    state ^= character.charCodeAt(0);
    state = Math.imul(state, 16777619) >>> 0;
  });
  function random() {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 4294967296;
  }
  for (var index = source.length - 1; index > 0; index--) {
    var target = Math.floor(random() * (index + 1));
    var swap = source[index]; source[index] = source[target]; source[target] = swap;
  }
  return source;
}

function admin2027RoundRobin_(players, doubleRound) {
  var list = (players || []).slice();
  if (list.length < 2) return [];
  if (list.length % 2) list.push(null);
  var rounds = [];
  var total = list.length - 1;
  for (var roundIndex = 0; roundIndex < total; roundIndex++) {
    var matches = [];
    for (var pairIndex = 0; pairIndex < list.length / 2; pairIndex++) {
      var first = list[pairIndex];
      var second = list[list.length - 1 - pairIndex];
      if (first && second) matches.push(roundIndex % 2 ? [second, first] : [first, second]);
    }
    rounds.push(matches);
    list.splice(1, 0, list.pop());
  }
  if (doubleRound) {
    rounds = rounds.concat(rounds.map(function(matches) {
      return matches.map(function(pair) { return [pair[1], pair[0]]; });
    }));
  }
  return rounds;
}

function admin2027AllocateRounds_(categories, capacity) {
  var totalMatches = categories.reduce(function(sum, category) {
    return sum + category.rounds.reduce(function(roundSum, matches) { return roundSum + matches.length; }, 0);
  }, 0);
  var horizon = Math.max(
    Math.ceil(totalMatches / capacity),
    categories.reduce(function(maximum, category) { return Math.max(maximum, category.rounds.length); }, 1)
  );
  while (horizon < 80) {
    var weeks = Array.from({ length: horizon }, function() { return { used: 0, categories: {}, chunks: [] }; });
    var chunks = [];
    categories.forEach(function(category) {
      category.rounds.forEach(function(matches, index) {
        var target = category.rounds.length <= 1 ? Math.floor((horizon - 1) / 2) : Math.round(index * (horizon - 1) / (category.rounds.length - 1));
        chunks.push({ category: category, roundIndex: index, matches: matches, target: target });
      });
    });
    chunks.sort(function(a, b) { return a.target - b.target || b.matches.length - a.matches.length || a.category.order - b.category.order; });
    var failed = false;
    chunks.forEach(function(chunk) {
      if (failed) return;
      var candidates = Array.from({ length: horizon }, function(_, index) { return index; }).sort(function(a, b) {
        return Math.abs(a - chunk.target) - Math.abs(b - chunk.target) || weeks[a].used - weeks[b].used || a - b;
      });
      var weekIndex = candidates.find(function(index) {
        return !weeks[index].categories[chunk.category.id] && weeks[index].used + chunk.matches.length <= capacity;
      });
      if (weekIndex == null) { failed = true; return; }
      weeks[weekIndex].used += chunk.matches.length;
      weeks[weekIndex].categories[chunk.category.id] = true;
      weeks[weekIndex].chunks.push(chunk);
    });
    if (!failed) return weeks;
    horizon++;
  }
  throw new Error("No fue posible distribuir la programación con las canchas y turnos indicados.");
}

function admin2027BuildLadderSchedule_(input) {
  var options = input || {};
  var startDate = admin2027Date_(options.startDate);
  if (!startDate || isNaN(startDate.getTime())) throw new Error("Indica una fecha inicial válida.");
  if (startDate.getDay() !== 6) throw new Error("La fecha inicial debe ser sábado.");
  var courts = (options.courts || []).map(String).map(function(value) { return value.trim(); }).filter(Boolean);
  var turns = (options.turns || []).map(String).map(function(value) { return value.trim(); }).filter(Boolean);
  if (!courts.length || !turns.length) throw new Error("Debes indicar al menos una cancha y un turno.");
  var seenPlayers = {};
  var categories = (options.categories || []).map(function(category, categoryIndex) {
    var players = admin2027Shuffle_((category.players || []).map(function(player) {
      return typeof player === "string" ? { id: player, name: player } : player;
    }), String(options.seed || "") + "-" + category.id);
    if (players.length < 2) throw new Error("La categoría " + category.name + " necesita al menos dos jugadores.");
    players.forEach(function(player) {
      if (seenPlayers[player.id]) throw new Error(player.name + " está inscrito en más de una categoría.");
      seenPlayers[player.id] = true;
    });
    return {
      id: category.id,
      name: category.name,
      order: Number(category.order || categoryIndex + 1),
      doubleRound: Boolean(category.doubleRound || String(category.format || "").toLowerCase() === "ida_vuelta"),
      rounds: admin2027RoundRobin_(players, Boolean(category.doubleRound || String(category.format || "").toLowerCase() === "ida_vuelta"))
    };
  });
  if (!categories.length) throw new Error("Crea al menos una categoría con jugadores.");
  var slots = [];
  turns.forEach(function(turn) { courts.forEach(function(court) { slots.push({ court: court, turn: turn }); }); });
  var weeks = admin2027AllocateRounds_(categories, slots.length);
  var matches = [];
  weeks.forEach(function(week, weekIndex) {
    var date = admin2027AddDays_(startDate, weekIndex * 7);
    var slotIndex = 0;
    week.chunks.sort(function(a, b) { return a.category.order - b.category.order; }).forEach(function(chunk) {
      chunk.matches.forEach(function(pair, pairIndex) {
        var slot = slots[slotIndex++];
        matches.push({
          categoryId: chunk.category.id,
          categoryName: chunk.category.name,
          round: chunk.roundIndex + 1,
          week: weekIndex + 1,
          officialDate: date,
          currentDate: date,
          court: slot.court,
          turn: slot.turn,
          player1Id: pair[0].id,
          player1Name: pair[0].name,
          player2Id: pair[1].id,
          player2Name: pair[1].name
        });
      });
    });
  });
  return { weeks: weeks.length, matches: matches };
}

function admin2027BracketCapacity_(count) {
  var capacity = 2;
  while (capacity < Math.max(2, Number(count || 0))) capacity *= 2;
  return capacity;
}

function admin2027SeedOrder_(capacity) {
  var order = [1, 2];
  while (order.length < capacity) {
    var sum = order.length * 2 + 1;
    order = order.reduce(function(result, seed) { return result.concat([seed, sum - seed]); }, []);
  }
  return order;
}

function admin2027BuildBracket_(input) {
  var participants = (input.participants || []).map(function(player, index) {
    return { id: player.id, name: player.name, seed: Number(player.seed || 0), inputIndex: index };
  });
  if (participants.length < 2) throw new Error("El torneo necesita al menos dos participantes.");
  var duplicate = {};
  participants.forEach(function(player) {
    if (duplicate[player.id]) throw new Error(player.name + " aparece dos veces en el torneo.");
    duplicate[player.id] = true;
  });
  var capacity = admin2027BracketCapacity_(participants.length);
  var roundsCount = Math.log(capacity) / Math.log(2);
  var positions = Array(capacity).fill(null);
  var seedOrder = admin2027SeedOrder_(capacity);
  var seeded = participants.filter(function(player) { return player.seed > 0; }).sort(function(a, b) { return a.seed - b.seed; });
  var usedSeeds = {};
  seeded.forEach(function(player) {
    if (player.seed > capacity || usedSeeds[player.seed]) throw new Error("Revisa las cabezas de serie: deben ser únicas y caber en el cuadro.");
    usedSeeds[player.seed] = true;
    positions[seedOrder.indexOf(player.seed)] = player;
  });
  var rest = admin2027Shuffle_(participants.filter(function(player) { return !player.seed; }), input.seed || input.competitionId);
  var byes = capacity - participants.length;
  var reservedByeSlots = {};
  for (var byeIndex = 0; byeIndex < byes; byeIndex++) {
    var protectedSeed = seedOrder.indexOf(byeIndex + 1);
    if (protectedSeed >= 0) reservedByeSlots[protectedSeed % 2 ? protectedSeed - 1 : protectedSeed + 1] = true;
  }
  positions.forEach(function(value, index) {
    if (!value && !reservedByeSlots[index] && rest.length) positions[index] = rest.shift();
  });
  positions.forEach(function(value, index) { if (!value && rest.length) positions[index] = rest.shift(); });
  var matches = [];
  for (var round = 1; round <= roundsCount; round++) {
    var matchCount = capacity / Math.pow(2, round);
    for (var matchIndex = 0; matchIndex < matchCount; matchIndex++) {
      var id = input.competitionId + "-r" + round + "-m" + (matchIndex + 1);
      var nextId = round < roundsCount ? input.competitionId + "-r" + (round + 1) + "-m" + (Math.floor(matchIndex / 2) + 1) : "";
      var match = { id: id, round: round, nextMatchId: nextId, nextPosition: matchIndex % 2 ? 2 : 1, player1: null, player2: null, winner: null, status: "pendiente" };
      if (round === 1) { match.player1 = positions[matchIndex * 2]; match.player2 = positions[matchIndex * 2 + 1]; }
      matches.push(match);
    }
  }
  matches.filter(function(match) { return match.round === 1; }).forEach(function(match) {
    if ((match.player1 && !match.player2) || (!match.player1 && match.player2)) {
      match.winner = match.player1 || match.player2;
      match.status = "bye";
      var next = matches.find(function(candidate) { return candidate.id === match.nextMatchId; });
      if (next) next[match.nextPosition === 1 ? "player1" : "player2"] = match.winner;
    }
  });
  return { capacity: capacity, byes: byes, rounds: roundsCount, matches: matches };
}

function admin2027EnsureSheet_(spreadsheet, name, headers) {
  var sheet = spreadsheet.getSheetByName(name) || spreadsheet.insertSheet(name);
  if (sheet.getLastRow() === 0) sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  var current = sheet.getRange(1, 1, 1, headers.length).getDisplayValues()[0];
  headers.forEach(function(header, index) {
    if (current[index] && admin2027Normalize_(current[index]) !== admin2027Normalize_(header)) throw new Error("La hoja " + name + " tiene un encabezado incompatible en la columna " + (index + 1) + ".");
    if (!current[index]) sheet.getRange(1, index + 1).setValue(header);
  });
  sheet.setFrozenRows(1);
  return sheet;
}

function admin2027Sheets_(spreadsheet) {
  var result = {};
  Object.keys(ADMIN_2027.SHEETS).forEach(function(key) {
    result[key] = admin2027EnsureSheet_(spreadsheet, ADMIN_2027.SHEETS[key], ADMIN_2027.HEADERS[key]);
  });
  return result;
}

function admin2027Rows_(sheet) {
  if (!sheet || sheet.getLastRow() < 2) return [];
  return sheet.getRange(2, 1, sheet.getLastRow() - 1, sheet.getLastColumn()).getDisplayValues();
}

function admin2027Setup() {
  adminAssertAuthorized_();
  var spreadsheet = adminGetSpreadsheet_();
  var sheets = admin2027Sheets_(spreadsheet);
  var players = admin2027Rows_(sheets.PLAYERS);
  if (!players.length) {
    var fixture = adminGetSheetByGid_(spreadsheet, ADMIN_CONFIG.FIXTURE_GID).getDataRange().getDisplayValues();
    var names = {};
    fixture.slice(1).forEach(function(row) { [row[4], row[5]].forEach(function(name) { if (String(name || "").trim() && name !== "-") names[String(name).trim()] = true; }); });
    var now = new Date();
    var aliases = { "María José Valladares": "M.José Valladares", "Cristhian Linares": "Christian Linares", "Jose Astete": "José Astete", "Angelo Basualto": "Ángelo Basualto" };
    var rows = Object.keys(names).sort().map(function(name) { return [admin2027Id_("jugador", name), name, aliases[name] || "", "", "Sí", now]; });
    if (rows.length) sheets.PLAYERS.getRange(2, 1, rows.length, rows[0].length).setValues(rows);
  }
  return admin2027GetDashboard();
}

function admin2027MapRows_(rows, headers) {
  return rows.map(function(row) { var item = {}; headers.forEach(function(header, index) { item[header] = row[index]; }); return item; });
}

function admin2027GetDashboard() {
  adminAssertAuthorized_();
  var spreadsheet = adminGetSpreadsheet_();
  var sheets = admin2027Sheets_(spreadsheet);
  return admin2027DashboardFromSheets_(sheets);
}

function admin2027DashboardFromSheets_(sheets) {
  var players = admin2027MapRows_(admin2027Rows_(sheets.PLAYERS), ADMIN_2027.HEADERS.PLAYERS).map(function(row) { return { id: row["ID jugador"], name: row.Nombre, aliases: row.Alias, gender: row.Sexo, active: admin2027Normalize_(row.Activo) !== "no" }; });
  var competitions = admin2027MapRows_(admin2027Rows_(sheets.COMPETITIONS), ADMIN_2027.HEADERS.COMPETITIONS).map(function(row) { return { id: row["ID competición"], type: row.Tipo, name: row.Nombre, season: row.Temporada, edition: row["Edición"], status: row.Estado, startDate: admin2027IsoDate_(row["Fecha inicio"]), published: admin2027Normalize_(row.Publicado) === "si", settings: row["Configuración"] }; });
  var categories = admin2027MapRows_(admin2027Rows_(sheets.CATEGORIES), ADMIN_2027.HEADERS.CATEGORIES).map(function(row) { return { competitionId: row["ID competición"], id: row["ID categoría"], name: row.Nombre, format: row.Formato, order: Number(row.Orden || 0), active: admin2027Normalize_(row.Activo) !== "no" }; });
  var entries = admin2027MapRows_(admin2027Rows_(sheets.ENTRIES), ADMIN_2027.HEADERS.ENTRIES).map(function(row) { return { competitionId: row["ID competición"], categoryId: row["ID categoría"], playerId: row["ID jugador"], seed: Number(row["Cabeza de serie"] || 0), status: row.Estado }; });
  var matches = admin2027MapRows_(admin2027Rows_(sheets.MATCHES), ADMIN_2027.HEADERS.MATCHES).map(admin2027PublicMatch_);
  competitions.forEach(function(competition) {
    competition.categories = categories.filter(function(category) { return category.competitionId === competition.id; });
    competition.entries = entries.filter(function(entry) { return entry.competitionId === competition.id; });
    competition.matchCount = matches.filter(function(match) { return match.competitionId === competition.id; }).length;
  });
  return { version: ADMIN_2027.VERSION, players: players, competitions: competitions, matches: matches };
}

function admin2027PublicMatch_(row) {
  return { id: row["ID partido"], competitionId: row["ID competición"], categoryId: row["ID categoría"], round: row.Ronda, week: Number(row.Semana || 0), officialDate: admin2027IsoDate_(row["Fecha oficial"]), date: admin2027IsoDate_(row["Fecha actual"]), court: row.Cancha, turn: row.Turno, player1Id: row["Jugador 1"], player2Id: row["Jugador 2"], status: row.Estado, scheduleType: row["Tipo programación"], winnerId: row.Ganador, score: row.Marcador, nextMatchId: row["Siguiente partido"], nextPosition: Number(row["Posición siguiente"] || 0), countsForTable: admin2027Normalize_(row["Cuenta tabla"]) !== "no", countsForH2h: admin2027Normalize_(row["Cuenta H2H"]) !== "no", points1: Number(row["Puntos J1"] || 0), points2: Number(row["Puntos J2"] || 0), sets1: Number(row["Sets J1"] || 0), sets2: Number(row["Sets J2"] || 0), games1: Number(row["Games J1"] || 0), games2: Number(row["Games J2"] || 0) };
}

function admin2027SavePlayer(payload) {
  adminAssertAuthorized_();
  var data = payload || {};
  if (!String(data.name || "").trim()) throw new Error("Escribe el nombre del jugador.");
  var sheet = admin2027Sheets_(adminGetSpreadsheet_()).PLAYERS;
  var rows = admin2027Rows_(sheet);
  var id = String(data.id || admin2027Id_("jugador", data.name));
  var index = rows.findIndex(function(row) { return row[0] === id; });
  var values = [id, String(data.name).trim(), String(data.aliases || "").trim(), String(data.gender || "").trim(), data.active === false ? "No" : "Sí", index >= 0 ? rows[index][5] : new Date()];
  if (index >= 0) sheet.getRange(index + 2, 1, 1, values.length).setValues([values]); else sheet.appendRow(values);
  SpreadsheetApp.flush();
  return admin2027GetDashboard();
}

function admin2027SaveCompetition(payload) {
  adminAssertAuthorized_();
  var data = payload || {};
  if (!String(data.name || "").trim()) throw new Error("Escribe el nombre de la competición.");
  var type = ["ladder", "tournament", "interclub"].indexOf(data.type) >= 0 ? data.type : "ladder";
  var id = String(data.id || admin2027Id_(type, data.name + "-" + (data.edition || "")));
  var sheet = admin2027Sheets_(adminGetSpreadsheet_()).COMPETITIONS;
  var rows = admin2027Rows_(sheet);
  var index = rows.findIndex(function(row) { return row[0] === id; });
  var values = [id, type, String(data.name).trim(), String(data.season || "2027"), String(data.edition || "").trim(), String(data.status || "draft"), admin2027IsoDate_(data.startDate), data.published ? "Sí" : "No", JSON.stringify(data.settings || {}), index >= 0 ? rows[index][9] : new Date()];
  if (index >= 0) sheet.getRange(index + 2, 1, 1, values.length).setValues([values]); else sheet.appendRow(values);
  SpreadsheetApp.flush();
  return admin2027GetDashboard();
}

function admin2027SaveCategory(payload) {
  adminAssertAuthorized_();
  var data = payload || {};
  if (!data.competitionId || !String(data.name || "").trim()) throw new Error("Selecciona una competición y escribe la categoría.");
  var sheet = admin2027Sheets_(adminGetSpreadsheet_()).CATEGORIES;
  var rows = admin2027Rows_(sheet);
  var id = String(data.id || admin2027Id_("categoria", data.name));
  var index = rows.findIndex(function(row) { return row[0] === data.competitionId && row[1] === id; });
  var values = [data.competitionId, id, String(data.name).trim(), data.format === "ida_vuelta" ? "ida_vuelta" : "unica", Number(data.order || rows.length + 1), data.active === false ? "No" : "Sí"];
  if (index >= 0) sheet.getRange(index + 2, 1, 1, values.length).setValues([values]); else sheet.appendRow(values);
  SpreadsheetApp.flush();
  return admin2027GetDashboard();
}

function admin2027SetEntries(payload) {
  adminAssertAuthorized_();
  var data = payload || {};
  if (!data.competitionId) throw new Error("Selecciona una competición.");
  var sheet = admin2027Sheets_(adminGetSpreadsheet_()).ENTRIES;
  var rows = admin2027Rows_(sheet);
  var kept = rows.filter(function(row) { return row[0] !== data.competitionId; });
  var added = (data.entries || []).map(function(entry) { return [data.competitionId, String(entry.categoryId || ""), entry.playerId, Number(entry.seed || 0) || "", "activo"]; });
  sheet.clearContents();
  sheet.getRange(1, 1, 1, ADMIN_2027.HEADERS.ENTRIES.length).setValues([ADMIN_2027.HEADERS.ENTRIES]);
  var combined = kept.concat(added);
  if (combined.length) sheet.getRange(2, 1, combined.length, ADMIN_2027.HEADERS.ENTRIES.length).setValues(combined);
  SpreadsheetApp.flush();
  return admin2027GetDashboard();
}

function admin2027ReplaceCompetitionMatches_(sheet, competitionId, rows) {
  var kept = admin2027Rows_(sheet).filter(function(row) { return row[1] !== competitionId; });
  sheet.clearContents();
  sheet.getRange(1, 1, 1, ADMIN_2027.HEADERS.MATCHES.length).setValues([ADMIN_2027.HEADERS.MATCHES]);
  var combined = kept.concat(rows);
  if (combined.length) sheet.getRange(2, 1, combined.length, ADMIN_2027.HEADERS.MATCHES.length).setValues(combined);
}

function admin2027MatchRow_(match, competitionId) {
  return [match.id, competitionId, match.categoryId || "", match.round || "", match.week || "", match.officialDate || "", match.currentDate || match.date || "", match.court || "", match.turn || "", match.player1Id || "", match.player2Id || "", match.status || "programado", match.scheduleType || "oficial", match.winnerId || "", match.score || "", match.nextMatchId || "", match.nextPosition || "", match.countsForTable === false ? "No" : "Sí", match.countsForH2h === false ? "No" : "Sí", match.points1 || 0, match.points2 || 0, match.sets1 || 0, match.sets2 || 0, match.games1 || 0, match.games2 || 0, new Date()];
}

function admin2027GenerateLadder(payload) {
  adminAssertAuthorized_();
  var dashboard = admin2027GetDashboard();
  var competition = dashboard.competitions.find(function(item) { return item.id === payload.competitionId && item.type === "ladder"; });
  if (!competition) throw new Error("No se encontró la escalerilla seleccionada.");
  if (competition.status === "published" || competition.status === "active") throw new Error("La programación publicada debe desbloquearse antes de volver a sortear.");
  var playerMap = {}; dashboard.players.forEach(function(player) { playerMap[player.id] = player; });
  var categories = competition.categories.filter(function(category) { return category.active; }).map(function(category) {
    var entries = competition.entries.filter(function(entry) { return entry.categoryId === category.id && entry.status !== "retirado"; });
    return { id: category.id, name: category.name, order: category.order, format: category.format, players: entries.map(function(entry) { return playerMap[entry.playerId]; }).filter(Boolean) };
  });
  var schedule = admin2027BuildLadderSchedule_({ startDate: payload.startDate || competition.startDate, courts: payload.courts, turns: payload.turns, seed: payload.seed || competition.id, categories: categories });
  var rows = schedule.matches.map(function(match, index) { match.id = competition.id + "-m" + String(index + 1).padStart(3, "0"); return admin2027MatchRow_(match, competition.id); });
  admin2027ReplaceCompetitionMatches_(admin2027Sheets_(adminGetSpreadsheet_()).MATCHES, competition.id, rows);
  SpreadsheetApp.flush();
  return { ok: true, weeks: schedule.weeks, matches: schedule.matches.length, dashboard: admin2027GetDashboard() };
}

function admin2027Postpone(payload) {
  adminAssertAuthorized_();
  var sheet = admin2027Sheets_(adminGetSpreadsheet_()).MATCHES;
  var rows = admin2027Rows_(sheet);
  var from = admin2027IsoDate_(payload.fromDate);
  var changed = 0;
  rows.forEach(function(row, index) {
    var status = admin2027Normalize_(row[11]);
    if (row[1] !== payload.competitionId || !row[6] || admin2027IsoDate_(row[6]) < from || /^(jugado|cancelado|anulado|bye)/.test(status)) return;
    row[6] = admin2027AddDays_(row[6], 7);
    row[12] = "reprogramado_lluvia";
    row[25] = new Date();
    sheet.getRange(index + 2, 1, 1, row.length).setValues([row]);
    changed++;
  });
  SpreadsheetApp.flush();
  return { ok: true, shiftedMatches: changed, dashboard: admin2027GetDashboard() };
}

function admin2027CreateTournament(payload) {
  adminAssertAuthorized_();
  var dashboard = admin2027GetDashboard();
  var competition = dashboard.competitions.find(function(item) { return item.id === payload.competitionId && item.type === "tournament"; });
  if (!competition) throw new Error("No se encontró el torneo seleccionado.");
  if (["published", "active", "completed"].indexOf(competition.status) >= 0) throw new Error("El cuadro publicado está bloqueado.");
  var playerMap = {}; dashboard.players.forEach(function(player) { playerMap[player.id] = player; });
  var entries = competition.entries.filter(function(entry) { return entry.status !== "retirado"; }).map(function(entry) { var player = playerMap[entry.playerId]; return player ? { id: player.id, name: player.name, seed: entry.seed } : null; }).filter(Boolean);
  var bracket = admin2027BuildBracket_({ competitionId: competition.id, participants: entries, seed: payload.seed || competition.id });
  var rows = bracket.matches.map(function(match) {
    return admin2027MatchRow_({ id: match.id, round: match.round, player1Id: match.player1 && match.player1.id, player2Id: match.player2 && match.player2.id, status: match.status, winnerId: match.winner && match.winner.id, nextMatchId: match.nextMatchId, nextPosition: match.nextPosition, countsForTable: false, countsForH2h: match.status !== "bye" }, competition.id);
  });
  admin2027ReplaceCompetitionMatches_(admin2027Sheets_(adminGetSpreadsheet_()).MATCHES, competition.id, rows);
  SpreadsheetApp.flush();
  return { ok: true, capacity: bracket.capacity, byes: bracket.byes, dashboard: admin2027GetDashboard() };
}

function admin2027SetPublished(payload) {
  adminAssertAuthorized_();
  var sheets = admin2027Sheets_(adminGetSpreadsheet_());
  var rows = admin2027Rows_(sheets.COMPETITIONS);
  var index = rows.findIndex(function(row) { return row[0] === payload.competitionId; });
  if (index < 0) throw new Error("No se encontró la competición.");
  rows[index][5] = payload.published ? (rows[index][5] === "completed" ? "completed" : "published") : "draft";
  rows[index][7] = payload.published ? "Sí" : "No";
  sheets.COMPETITIONS.getRange(index + 2, 1, 1, rows[index].length).setValues([rows[index]]);
  SpreadsheetApp.flush();
  return admin2027GetDashboard();
}

function admin2027ScoreText_(result) {
  if (!result) return "";
  if (result.status === ADMIN_STATUSES.WO_AMBOS) return "W/O ambos";
  var parts = [result.set1, result.set2];
  if (result.stb && result.stb[0] !== "") parts.push(result.stb);
  var text = parts.map(function(set) { return set[0] + "-" + set[1]; }).join(" ");
  if (result.resultType === "W/O") return "W/O " + text;
  if (result.resultType === "Retiro") return "Retiro " + text;
  return text;
}

function admin2027CalculateResult_(payload, player1, player2) {
  var input = {
    player1: player1,
    player2: player2,
    status: String(payload.resultType || ADMIN_STATUSES.JUGADO),
    set1Player1: payload.set1Player1,
    set1Player2: payload.set1Player2,
    set2Player1: payload.set2Player1,
    set2Player2: payload.set2Player2,
    stbPlayer1: payload.stbPlayer1,
    stbPlayer2: payload.stbPlayer2
  };
  if (input.status === ADMIN_STATUSES.JUGADO) return adminCalculatePlayedResult_(input);
  if ([ADMIN_STATUSES.RETIRO_J1, ADMIN_STATUSES.RETIRO_J2].indexOf(input.status) >= 0) return adminCalculateRetirementResult_(input);
  if ([ADMIN_STATUSES.WO_J1, ADMIN_STATUSES.WO_J2, ADMIN_STATUSES.WO_AMBOS].indexOf(input.status) >= 0) return adminCalculateWoResult_(input);
  throw new Error("Selecciona un tipo de resultado válido.");
}

function admin2027ResetDownstream_(rows, startIndex, sheet) {
  var index = startIndex;
  while (index >= 0) {
    var row = rows[index];
    row[11] = "pendiente"; row[13] = ""; row[14] = "";
    row[19] = 0; row[20] = 0; row[21] = 0; row[22] = 0; row[23] = 0; row[24] = 0; row[25] = new Date();
    sheet.getRange(index + 2, 1, 1, row.length).setValues([row]);
    if (!row[15]) break;
    var nextIndex = rows.findIndex(function(candidate) { return candidate[0] === row[15]; });
    if (nextIndex < 0) break;
    rows[nextIndex][row[16] === "2" ? 10 : 9] = "";
    index = nextIndex;
  }
}

function admin2027RecordResult(payload) {
  adminAssertAuthorized_();
  var sheets = admin2027Sheets_(adminGetSpreadsheet_());
  var sheet = sheets.MATCHES;
  var rows = admin2027Rows_(sheet);
  var index = rows.findIndex(function(row) { return row[0] === payload.matchId; });
  if (index < 0) throw new Error("No se encontró el partido.");
  var row = rows[index];
  if (!row[9] || !row[10]) throw new Error("Este partido todavía no tiene sus dos jugadores definidos.");
  var names = {};
  admin2027Rows_(sheets.PLAYERS).forEach(function(playerRow) { names[playerRow[0]] = playerRow[1]; });
  var competitionRows = admin2027Rows_(sheets.COMPETITIONS);
  var competitionIndex = competitionRows.findIndex(function(candidate) { return candidate[0] === row[1]; });
  var competitionType = competitionIndex >= 0 ? competitionRows[competitionIndex][1] : "ladder";
  var result = admin2027CalculateResult_(payload, names[row[9]] || row[9], names[row[10]] || row[10]);
  var winnerId = result.winnerIndex === 0 ? row[9] : result.winnerIndex === 1 ? row[10] : "";
  var nextIndex = row[15] ? rows.findIndex(function(candidate) { return candidate[0] === row[15]; }) : -1;
  var downstreamPlayed = nextIndex >= 0 && rows[nextIndex][11] === "jugado";
  if (row[13] && row[13] !== winnerId && downstreamPlayed && !payload.confirmConsequences) throw new Error("Este cambio afecta rondas posteriores ya disputadas. Confirma las consecuencias antes de continuar.");
  if (row[13] && row[13] !== winnerId && downstreamPlayed && payload.confirmConsequences) {
    admin2027ResetDownstream_(rows, nextIndex, sheet);
    if (competitionIndex >= 0 && competitionRows[competitionIndex][1] === "tournament") {
      competitionRows[competitionIndex][5] = "published";
      sheets.COMPETITIONS.getRange(competitionIndex + 2, 1, 1, competitionRows[competitionIndex].length).setValues([competitionRows[competitionIndex]]);
    }
  }
  row[6] = admin2027IsoDate_(payload.playedDate) || admin2027IsoDate_(new Date());
  row[11] = "jugado"; row[13] = winnerId; row[14] = admin2027ScoreText_(result);
  var doubleWalkover = result.status === ADMIN_STATUSES.WO_AMBOS;
  row[17] = competitionType === "ladder" && !doubleWalkover ? "Sí" : "No"; row[18] = doubleWalkover ? "No" : "Sí"; row[19] = result.points[0]; row[20] = result.points[1];
  row[21] = result.setsWon[0]; row[22] = result.setsWon[1];
  row[23] = Number(result.set1[0] || 0) + Number(result.set2[0] || 0);
  row[24] = Number(result.set1[1] || 0) + Number(result.set2[1] || 0); row[25] = new Date();
  sheet.getRange(index + 2, 1, 1, row.length).setValues([row]);
  if (nextIndex >= 0) {
    rows[nextIndex][row[16] === "2" ? 10 : 9] = winnerId;
    rows[nextIndex][25] = new Date();
    sheet.getRange(nextIndex + 2, 1, 1, rows[nextIndex].length).setValues([rows[nextIndex]]);
  } else if (winnerId) {
    if (competitionIndex >= 0 && competitionRows[competitionIndex][1] === "tournament") {
      competitionRows[competitionIndex][5] = "completed";
      sheets.COMPETITIONS.getRange(competitionIndex + 2, 1, 1, competitionRows[competitionIndex].length).setValues([competitionRows[competitionIndex]]);
    }
  }
  SpreadsheetApp.flush();
  return admin2027GetDashboard();
}

function admin2027UpdateMatchSchedule(payload) {
  adminAssertAuthorized_();
  var sheet = admin2027Sheets_(adminGetSpreadsheet_()).MATCHES;
  var rows = admin2027Rows_(sheet);
  var index = rows.findIndex(function(row) { return row[0] === payload.matchId; });
  if (index < 0) throw new Error("No se encontró el partido.");
  var row = rows[index];
  if (["jugado", "bye", "anulado_abandono", "cancelado_abandono"].indexOf(row[11]) >= 0) throw new Error("Este partido ya no admite cambios de programación.");
  var status = ["programado", "por_coordinar", "suspendido"].indexOf(payload.status) >= 0 ? payload.status : "programado";
  var scheduleType = ["oficial", "adelantado", "reprogramado", "recuperacion"].indexOf(payload.scheduleType) >= 0 ? payload.scheduleType : "oficial";
  var date = admin2027IsoDate_(payload.date);
  if (status === "programado" && !date) throw new Error("Indica la nueva fecha del partido.");
  row[6] = date; row[7] = String(payload.court || "").trim(); row[8] = String(payload.turn || "").trim();
  row[11] = status; row[12] = scheduleType; row[25] = new Date();
  sheet.getRange(index + 2, 1, 1, row.length).setValues([row]);
  SpreadsheetApp.flush();
  return admin2027GetDashboard();
}

function admin2027AbandonPlayer(payload) {
  adminAssertAuthorized_();
  var sheets = admin2027Sheets_(adminGetSpreadsheet_());
  var entryRows = admin2027Rows_(sheets.ENTRIES);
  entryRows.forEach(function(row, index) {
    if (row[0] === payload.competitionId && row[2] === payload.playerId) { row[4] = "retirado"; sheets.ENTRIES.getRange(index + 2, 1, 1, row.length).setValues([row]); }
  });
  var matchRows = admin2027Rows_(sheets.MATCHES);
  var affected = 0;
  var detail = [String(payload.reason || "abandono definitivo").trim(), admin2027IsoDate_(payload.date)].filter(Boolean).join(" · ");
  matchRows.forEach(function(row, index) {
    if (row[1] !== payload.competitionId || [row[9], row[10]].indexOf(payload.playerId) < 0) return;
    var wasPlayed = row[11] === "jugado";
    row[11] = wasPlayed ? "anulado_abandono" : "cancelado_abandono";
    row[14] = wasPlayed ? [row[14], "Anulado: " + detail].filter(Boolean).join(" · ") : "Cancelado: " + detail;
    row[17] = "No"; row[18] = "No"; row[19] = 0; row[20] = 0; row[21] = 0; row[22] = 0; row[23] = 0; row[24] = 0; row[25] = new Date();
    sheets.MATCHES.getRange(index + 2, 1, 1, row.length).setValues([row]); affected++;
  });
  SpreadsheetApp.flush();
  return { ok: true, affectedMatches: affected, dashboard: admin2027GetDashboard() };
}

function admin2027Rankings_(competition, players, matches) {
  var playerMap = {}; players.forEach(function(player) { playerMap[player.id] = player; });
  return (competition.categories || []).map(function(category) {
    var entryIds = (competition.entries || []).filter(function(entry) { return entry.categoryId === category.id && entry.status !== "retirado"; }).map(function(entry) { return entry.playerId; });
    var rows = entryIds.map(function(playerId) { return { playerId: playerId, playerName: playerMap[playerId] ? playerMap[playerId].name : playerId, points: 0, played: 0, wins: 0, setsFor: 0, setsAgainst: 0, gamesFor: 0, gamesAgainst: 0 }; });
    var byId = {}; rows.forEach(function(row) { byId[row.playerId] = row; });
    matches.filter(function(match) { return match.competitionId === competition.id && match.categoryId === category.id && match.status === "jugado" && match.countsForTable; }).forEach(function(match) {
      var first = byId[match.player1Id], second = byId[match.player2Id]; if (!first || !second) return;
      first.played++; second.played++; first.points += match.points1; second.points += match.points2;
      first.setsFor += match.sets1; first.setsAgainst += match.sets2; second.setsFor += match.sets2; second.setsAgainst += match.sets1;
      first.gamesFor += match.games1; first.gamesAgainst += match.games2; second.gamesFor += match.games2; second.gamesAgainst += match.games1;
      if (match.winnerId === first.playerId) first.wins++; else if (match.winnerId === second.playerId) second.wins++;
    });
    rows.sort(function(a, b) { return b.points - a.points || (b.setsFor - b.setsAgainst) - (a.setsFor - a.setsAgainst) || (b.gamesFor - b.gamesAgainst) - (a.gamesFor - a.gamesAgainst) || a.playerName.localeCompare(b.playerName); });
    rows.forEach(function(row, index) { row.position = index + 1; });
    return { id: category.id, name: category.name, rows: rows };
  });
}

function admin2027GetPublicData_() {
  var spreadsheet = adminGetSpreadsheet_();
  var sheets = admin2027Sheets_(spreadsheet);
  var dashboard = admin2027DashboardFromSheets_(sheets);
  var published = dashboard.competitions.filter(function(competition) { return competition.published; });
  var matches = dashboard.matches.filter(function(match) { return published.some(function(competition) { return competition.id === match.competitionId; }); });
  published.forEach(function(competition) { competition.rankings = competition.type === "ladder" ? admin2027Rankings_(competition, dashboard.players, matches) : []; });
  return { version: ADMIN_2027.VERSION, generatedAt: new Date().toISOString(), players: dashboard.players, competitions: published, matches: matches };
}

function admin2027ApiResponse_() {
  var output;
  try { output = { ok: true, data: admin2027GetPublicData_() }; }
  catch (error) { output = { ok: false, data: { version: ADMIN_2027.VERSION, players: [], competitions: [], matches: [] } }; }
  return ContentService.createTextOutput(JSON.stringify(output)).setMimeType(ContentService.MimeType.JSON);
}
