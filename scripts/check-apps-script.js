const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const directory = path.join(__dirname, "..", "admin", "apps-script");
const files = fs.readdirSync(directory).filter(fileName => fileName.endsWith(".gs"));
const failures = [];

for (const fileName of files) {
  try {
    const source = fs.readFileSync(path.join(directory, fileName), "utf8");
    new vm.Script(source, { filename: fileName });
  } catch (error) {
    failures.push(error.message);
  }
}

if (failures.length) {
  failures.forEach(message => console.error(message));
  process.exitCode = 1;
} else {
  console.log(`Apps Script verificado: ${files.length} archivos sin errores de sintaxis.`);
}
