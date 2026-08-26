const fs = require("node:fs");
const path = require("node:path");
const data = require("../assets/js/data-model.js");

function parseCSVLine(line) {
  const result = [];
  let current = "";
  let insideQuotes = false;

  for (let index = 0; index < line.length; index++) {
    const character = line[index];

    if (character === '"' && line[index + 1] === '"') {
      current += '"';
      index++;
    } else if (character === '"') {
      insideQuotes = !insideQuotes;
    } else if (character === "," && !insideQuotes) {
      result.push(current);
      current = "";
    } else {
      current += character;
    }
  }

  result.push(current);
  return result;
}

function parseCSV(filePath) {
  const content = fs.readFileSync(filePath, "utf8").replace(/^\uFEFF/, "").trim();
  return content ? content.split(/\r?\n/).map(parseCSVLine) : [];
}

function latestBackupDirectory() {
  const backupsRoot = path.join(__dirname, "..", "data", "backups");
  const directories = fs.readdirSync(backupsRoot, { withFileTypes: true })
    .filter(entry => entry.isDirectory())
    .map(entry => entry.name)
    .sort();

  if (!directories.length) throw new Error("No hay respaldos disponibles para validar.");
  return path.join(backupsRoot, directories[directories.length - 1]);
}

const backupDirectory = process.argv[2]
  ? path.resolve(process.argv[2])
  : latestBackupDirectory();

const fixtureRows = parseCSV(path.join(backupDirectory, "fixture.csv"));
const registroRows = parseCSV(path.join(backupDirectory, "registro.csv"));
const rankingsRows = parseCSV(path.join(backupDirectory, "rankings.csv"));
const errors = [];
const warnings = [];

if ((fixtureRows[0] || []).slice(0, 7).join("|") !==
  ["Semana", "Cancha", "Turno", "Categoría", "Jugador 1", "Jugador 2", "Fecha"].join("|")) {
  errors.push("El encabezado del fixture cambió en sus primeras siete columnas.");
}

if ((registroRows[0] || [])[16] !== "Resultado web") {
  errors.push("La columna Q del registro ya no corresponde a Resultado web.");
}

const fixtureMatches = fixtureRows.slice(1)
  .filter(columns => columns[0] && columns[2] && columns[4] && columns[5] && columns[4] !== "-" && columns[5] !== "-")
  .map(columns => ({
    matchId: columns[9],
    season: "2026",
    week: columns[0],
    category: columns[3],
    player1: columns[4],
    player2: columns[5]
  }));

const duplicateFixtureIds = data.findDuplicateMatchIds(fixtureMatches);
if (duplicateFixtureIds.length) {
  errors.push(`Hay ${duplicateFixtureIds.length} ID(s) duplicado(s) en el fixture: ${duplicateFixtureIds.join(", ")}`);
}

const registroWithResult = registroRows.slice(1)
  .filter(columns => String(columns[16] || "").trim());
const resultWithoutWinner = registroWithResult
  .filter(columns => !String(columns[13] || "").trim());

if (resultWithoutWinner.length) {
  errors.push(`${resultWithoutWinner.length} resultado(s) no tienen ganador.`);
}

const legacyKeys = new Map();
registroRows.slice(1).forEach(columns => {
  const key = String(columns[21] || data.createLegacyPairKey(columns[1], columns[2])).trim();
  if (!key) return;
  legacyKeys.set(key, (legacyKeys.get(key) || 0) + 1);
});

const duplicateLegacyKeys = Array.from(legacyKeys.entries())
  .filter(([, count]) => count > 1);

if (duplicateLegacyKeys.length) {
  warnings.push(
    `${duplicateLegacyKeys.length} pareja(s) aparecen más de una vez en el registro legado; los IDs nuevos evitarán ambigüedades.`
  );
}

console.log(`Respaldo validado: ${backupDirectory}`);
console.log(`Partidos programados: ${fixtureMatches.length}`);
console.log(`Registros: ${Math.max(0, registroRows.length - 1)}`);
console.log(`Filas de rankings: ${rankingsRows.length}`);

warnings.forEach(message => console.warn(`ADVERTENCIA: ${message}`));
errors.forEach(message => console.error(`ERROR: ${message}`));

if (errors.length) process.exitCode = 1;
