const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.join(__dirname, "..");
function findHtmlFiles(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    if ([".git", "node_modules", "data"].includes(entry.name)) return [];
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) return findHtmlFiles(fullPath);
    return entry.name.endsWith(".html") ? [fullPath] : [];
  });
}

const htmlFiles = findHtmlFiles(root);
const failures = [];

for (const filePath of htmlFiles) {
  const fileName = path.relative(root, filePath);
  const html = fs.readFileSync(filePath, "utf8");
  const inlineScriptPattern = /<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi;
  let match;
  let scriptNumber = 0;

  while ((match = inlineScriptPattern.exec(html))) {
    scriptNumber++;

    try {
      const script = match[1].replace(/<\?[!=]?[\s\S]*?\?>/g, "null");
      new vm.Script(script, { filename: `${fileName}:inline-script-${scriptNumber}` });
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
