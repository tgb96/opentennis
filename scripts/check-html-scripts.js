const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.join(__dirname, "..");
const htmlFiles = fs.readdirSync(root)
  .filter(fileName => fileName.endsWith(".html"));
const failures = [];

for (const fileName of htmlFiles) {
  const html = fs.readFileSync(path.join(root, fileName), "utf8");
  const inlineScriptPattern = /<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi;
  let match;
  let scriptNumber = 0;

  while ((match = inlineScriptPattern.exec(html))) {
    scriptNumber++;

    try {
      new vm.Script(match[1], { filename: `${fileName}:inline-script-${scriptNumber}` });
    } catch (error) {
      failures.push(error.message);
    }
  }
}

if (failures.length) {
  failures.forEach(message => console.error(message));
  process.exitCode = 1;
} else {
  console.log(`Scripts HTML verificados: ${htmlFiles.length} páginas sin errores de sintaxis.`);
}
