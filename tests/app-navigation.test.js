const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const appSource = fs.readFileSync(
  path.join(__dirname, "..", "assets", "js", "app.js"),
  "utf8"
);

test("el doble atrás se limita a la aplicación instalada en Android", () => {
  assert.match(appSource, /isStandalone\(\) && isAndroid/);
  assert.doesNotMatch(appSource, /isStandalone\(\) \|\| isTouchDevice/);
});

test("el segundo atrás no recorre todo el historial previo", () => {
  assert.match(appSource, /setTimeout\(\(\) => window\.history\.back\(\), 0\)/);
  assert.doesNotMatch(appSource, /history\.go\(-window\.history\.length\)/);
});

test("la navegación interna reemplaza la entrada base de la PWA", () => {
  assert.match(appSource, /window\.location\.replace\(destination\)/);
  assert.match(appSource, /pendingNavigation = destination\.href/);
});
