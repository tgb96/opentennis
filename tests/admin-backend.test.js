const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

class MockRange {
  constructor(sheet, row, column, rowCount = 1, columnCount = 1) {
    Object.assign(this, { sheet, row, column, rowCount, columnCount });
  }

  getDisplayValue() {
    return String((this.sheet.rows[this.row - 1] || [])[this.column - 1] || "");
  }

  getDisplayValues() {
    return Array.from({ length: this.rowCount }, (_, rowOffset) =>
      Array.from({ length: this.columnCount }, (_, columnOffset) =>
        String((this.sheet.rows[this.row - 1 + rowOffset] || [])[this.column - 1 + columnOffset] || "")
      )
    );
  }

  setValue(value) {
    return this.setValues([[value]]);
  }

  setValues(values) {
    values.forEach((sourceRow, rowOffset) => {
      const targetIndex = this.row - 1 + rowOffset;
      if (!this.sheet.rows[targetIndex]) this.sheet.rows[targetIndex] = [];
      sourceRow.forEach((value, columnOffset) => {
        this.sheet.rows[targetIndex][this.column - 1 + columnOffset] = value;
      });
    });
    return this;
  }
}

class MockSheet {
  constructor(id, name, rows) {
    this.id = id;
    this.name = name;
    this.rows = rows.map(row => row.slice());
  }

  getSheetId() { return this.id; }
  getName() { return this.name; }
  getLastRow() { return this.rows.length; }
  getDataRange() {
    const columns = Math.max(...this.rows.map(row => row.length), 1);
    return new MockRange(this, 1, 1, this.rows.length, columns);
  }
  getRange(row, column, rowCount, columnCount) {
    return new MockRange(this, row, column, rowCount, columnCount);
  }
}

class MockSpreadsheet {
  constructor(sheets) { this.sheets = sheets; }
  getSheets() { return this.sheets; }
  getName() { return "Open Tennis 2026"; }
}

function parseCsv(filePath) {
  const content = fs.readFileSync(filePath, "utf8").replace(/^\uFEFF/, "").trim();
  return content.split(/\r?\n/).map(line => {
    const columns = [];
    let current = "";
    let quoted = false;
    for (let index = 0; index < line.length; index++) {
      const character = line[index];
      if (character === '"' && line[index + 1] === '"') {
        current += '"';
        index++;
      } else if (character === '"') {
        quoted = !quoted;
      } else if (character === "," && !quoted) {
        columns.push(current);
        current = "";
      } else {
        current += character;
      }
    }
    columns.push(current);
    return columns;
  });
}

function createContext() {
  const context = vm.createContext({
    Date, Object, String, Number, Math, RegExp, Error,
    SpreadsheetApp: { flush() {} }
  });
  const directory = path.join(__dirname, "..", "admin", "apps-script");
  for (const fileName of ["Config.gs", "ResultEngine.gs", "Code.gs"]) {
    vm.runInContext(fs.readFileSync(path.join(directory, fileName), "utf8"), context, { filename: fileName });
  }
  return context;
}

function baseSheets() {
  const fixture = new MockSheet(0, "Fixture", [
    ["Semana", "Cancha", "Turno", "Categoría", "Jugador 1", "Jugador 2", "Fecha"],
    ["1", "1", "Turno 1", "A", "Ana", "Bea", "1/1/2026"],
    ["1", "2", "Turno 2", "B", "Carla", "Diana", "1/1/2026"],
    ["2", "2", "Turno 2", "B", "Carla", "Diana", "8/1/2026"]
  ]);
  const registroHeader = Array.from({ length: 22 }, (_, index) => `Columna ${index + 1}`);
  const uniqueRecord = Array(22).fill("");
  uniqueRecord[1] = "Ana";
  uniqueRecord[2] = "Bea";
  const ambiguousRecord = Array(22).fill("");
  ambiguousRecord[0] = "1/1/2026";
  ambiguousRecord[1] = "Carla";
  ambiguousRecord[2] = "Diana";
  const registro = new MockSheet(1046180821, "Registro", [registroHeader, uniqueRecord, ambiguousRecord]);
  return { fixture, registro, spreadsheet: new MockSpreadsheet([fixture, registro]) };
}

test("setup crea encabezados y migra solo IDs inequívocos", () => {
  const context = createContext();
  const { fixture, registro, spreadsheet } = baseSheets();

  context.adminEnsureAdminSchema_(spreadsheet);
  const result = context.adminPopulateMatchIds_(spreadsheet);

  assert.equal(fixture.rows[0][9], "ID partido");
  assert.equal(registro.rows[0][22], "ID partido");
  assert.equal(result.fixtureIdsCreated, 3);
  assert.equal(result.registroIdsCreated, 2);
  assert.equal(fixture.rows[1][9], "2026-s1-a-ana-bea");
  assert.equal(registro.rows[1][22], "2026-s1-a-ana-bea");
  assert.equal(registro.rows[2][22], "2026-s1-b-carla-diana");
});

test("inicializa programación oficial y distingue ida y vuelta", () => {
  const context = createContext();
  const { fixture, spreadsheet } = baseSheets();
  fixture.rows[2][3] = "D";
  fixture.rows[3][3] = "D";
  context.adminEnsureAdminSchema_(spreadsheet);
  const result = context.adminPopulateSchedulingMetadata_(spreadsheet);

  assert.equal(result.rowsInitialized, 3);
  assert.deepEqual(fixture.rows[0].slice(10, 15), ["Fecha oficial", "Cancha oficial", "Turno oficial", "Tipo programación", "Ronda"]);
  assert.deepEqual(fixture.rows[1].slice(10, 15), ["1/1/2026", "1", "Turno 1", "oficial", "Única"]);
  assert.equal(fixture.rows[2][14], "Ida");
  assert.equal(fixture.rows[3][14], "Vuelta");
});

test("la migración se detiene antes de escribir IDs duplicados", () => {
  const context = createContext();
  const { fixture, spreadsheet } = baseSheets();
  fixture.rows.push(["1", "3", "Turno 3", "A", "Bea", "Ana", "1/1/2026"]);
  context.adminEnsureAdminSchema_(spreadsheet);

  assert.throws(
    () => context.adminPopulateMatchIds_(spreadsheet),
    /IDs de partido duplicados en el fixture/
  );
  assert.equal(fixture.rows[1][9] || "", "");
});

test("una pareja repetida sin fecha permanece sin ID", () => {
  const context = createContext();
  const { registro, spreadsheet } = baseSheets();
  registro.rows[2][0] = "";
  context.adminEnsureAdminSchema_(spreadsheet);

  const result = context.adminPopulateMatchIds_(spreadsheet);

  assert.equal(result.registroIdsCreated, 1);
  assert.equal(registro.rows[2][22] || "", "");
});

test("una segunda programación de la misma pareja no sobreescribe el primer partido", () => {
  const context = createContext();
  const { registro } = baseSheets();
  const pairKey = context.adminOrderedPairKey_("Carla", "Diana");
  const firstMatch = {
    matchId: "2026-s1-b-carla-diana",
    pairKey,
    pairDateKey: context.adminPairDateKey_("Carla", "Diana", "1/1/2026")
  };
  const secondMatch = {
    matchId: "2026-s2-b-carla-diana",
    pairKey,
    pairDateKey: ""
  };

  const firstTarget = context.adminFindRegistroTarget_(registro, firstMatch, [firstMatch, secondMatch]);
  const secondTarget = context.adminFindRegistroTarget_(registro, secondMatch, [firstMatch, secondMatch]);

  assert.equal(firstTarget.row, 3);
  assert.equal(firstTarget.existing, true);
  assert.equal(secondTarget.row, 4);
  assert.equal(secondTarget.existing, false);
});

test("los 56 registros reales se relacionan sin ambigüedad con el fixture", () => {
  const context = createContext();
  const backup = path.join(__dirname, "..", "data", "backups", "2026-08-26");
  const fixture = new MockSheet(0, "Fixture", parseCsv(path.join(backup, "fixture.csv")));
  const registro = new MockSheet(1046180821, "Registro", parseCsv(path.join(backup, "registro.csv")));
  const spreadsheet = new MockSpreadsheet([fixture, registro]);

  context.adminEnsureAdminSchema_(spreadsheet);
  const migration = context.adminPopulateMatchIds_(spreadsheet);
  const scheduling = context.adminPopulateSchedulingMetadata_(spreadsheet);
  context.PropertiesService = {
    getScriptProperties() {
      return { getProperty() { return "spreadsheet-test"; } };
    }
  };
  context.SpreadsheetApp.openById = () => spreadsheet;
  context.Utilities = {
    formatDate(date, timeZone, pattern) {
      return pattern === "d/M/yyyy" ? "26/8/2026" : "26/8/2026 18:00";
    }
  };

  const dashboard = context.adminGetDashboard_();

  assert.equal(migration.fixtureIdsCreated, 129);
  assert.equal(migration.registroIdsCreated, 56);
  assert.equal(scheduling.rowsInitialized, 129);
  assert.equal(dashboard.matches.length, 129);
  assert.deepEqual(
    {
      total: dashboard.summary.total,
      played: dashboard.summary.played,
      pending: dashboard.summary.pending,
      upcoming: dashboard.summary.upcoming
    },
    { total: 129, played: 43, pending: 13, upcoming: 73 }
  );
});

test("el acceso falla si Google no entrega un correo verificable", () => {
  const context = createContext();
  context.PropertiesService = {
    getScriptProperties() {
      return { getProperty() { return "admin@example.com"; } };
    }
  };
  context.Session = {
    getActiveUser() { return { getEmail() { return ""; } }; }
  };

  assert.throws(
    () => context.adminAssertAuthorized_(),
    /ejecutarse como el usuario que accede/
  );
});
