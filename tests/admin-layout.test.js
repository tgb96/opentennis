const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

test("el regreso al club comparte encabezado sin una segunda barra", () => {
  const html = fs.readFileSync(path.join(__dirname, "..", "admin/apps-script/Index.html"), "utf8");
  const header = html.match(/<header class="topbar">([\s\S]*?)<\/header>/)[1];
  assert.match(header, /aria-label="Volver al club"/);
  assert.match(header, /href="https:\/\/opentennis\.cl\/index\.html" target="_top"/);
  assert.match(header, /id="refreshButton"/);
  assert.doesNotMatch(html, /class="club-return-nav"/);
  assert.equal((html.match(/class="club-return-link"/g) || []).length, 1);
});
