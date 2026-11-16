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

test("un resultado nuevo propone hoy aunque el partido estuviera atrasado", () => {
  const client = fs.readFileSync(path.join(__dirname, "..", "admin/apps-script/Client.html"), "utf8");
  assert.match(client, /var suggestedDate = isNewFinalResult \? todayForInput\(\) : match\.date;/);
  assert.match(client, /timeZone: "America\/Santiago"/);
  assert.doesNotMatch(client, /scheduledDateIsFuture/);
});

test("el administrador 2027 separa el uso semanal de la estructura avanzada", () => {
  const html = fs.readFileSync(path.join(__dirname, "..", "admin/apps-script/Index.html"), "utf8");
  const client = fs.readFileSync(path.join(__dirname, "..", "admin/apps-script/Season2027Client.html"), "utf8");
  const styles = fs.readFileSync(path.join(__dirname, "..", "admin/apps-script/Styles.html"), "utf8");
  assert.match(html, /data-2027-work-mode="daily" aria-current="page"/);
  assert.match(html, /data-2027-work-mode="advanced"/);
  assert.match(html, /Base protegida/);
  assert.match(client, /workspaceMode: "daily"/);
  assert.match(styles, /season-2027-panel:not\(\.is-advanced\) \.admin-advanced-only/);
});
