const test = require("node:test");
const assert = require("node:assert/strict");
const cacheModule = require("../assets/js/data-cache.js");

function fakeStorage() {
  const values = new Map();
  return {
    getItem(key) { return values.has(key) ? values.get(key) : null; },
    setItem(key, value) { values.set(key, String(value)); }
  };
}

function response(text) {
  return { ok: true, text: async () => text };
}

test("guarda la primera respuesta y la reutiliza inmediatamente", async () => {
  let calls = 0;
  const runtime = {
    localStorage: fakeStorage(),
    fetch: async (url, options) => {
      calls++;
      assert.equal(options.cache, "no-store");
      return response("datos oficiales");
    }
  };
  const cache = cacheModule.createDataCache(runtime);

  assert.equal(await cache.getText("https://datos.test/fixture"), "datos oficiales");
  const second = await cache.loadMany(["https://datos.test/fixture"]);

  assert.equal(second.source, "cache");
  assert.equal(second.texts[0], "datos oficiales");
  await second.refresh;
  assert.equal(calls, 2);
});

test("actualiza la copia guardada silenciosamente cuando cambian los datos", async () => {
  let current = "versión anterior";
  const runtime = {
    localStorage: fakeStorage(),
    fetch: async () => response(current)
  };
  const cache = cacheModule.createDataCache(runtime);
  const url = "https://datos.test/ranking";

  await cache.getText(url);
  current = "versión nueva";
  const cached = await cache.loadMany([url]);

  assert.equal(cached.texts[0], "versión anterior");
  const refreshed = await cached.refresh;
  assert.equal(refreshed.changed, true);
  assert.equal(cache.peek(url), "versión nueva");
});

test("mantiene los últimos datos cuando se pierde la conexión", async () => {
  let online = true;
  const notices = [];
  const runtime = {
    localStorage: fakeStorage(),
    fetch: async () => {
      if (!online) throw new Error("sin conexión");
      return response("copia disponible");
    },
    CustomEvent: function CustomEvent(type, options) {
      this.type = type;
      this.detail = options.detail;
    },
    dispatchEvent(event) { notices.push(event.detail); }
  };
  const cache = cacheModule.createDataCache(runtime);
  const url = "https://datos.test/registro";

  await cache.getText(url);
  online = false;
  const cached = await cache.loadMany([url]);

  assert.equal(cached.texts[0], "copia disponible");
  assert.equal(await cached.refresh, null);
  assert.deepEqual(notices.at(-1), { available: false, cached: true });
});
