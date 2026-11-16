(function initPlayerIdentities(root, factory) {
  const api = factory();
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (root) root.OPEN_TENNIS_IDENTITIES = api;
})(typeof window !== "undefined" ? window : null, function createPlayerIdentities() {
  "use strict";
  const aliases = {
    "m jose valladares": "maria jose valladares",
    "m jose valladares ": "maria jose valladares",
    "m. jose valladares": "maria jose valladares",
    "christian linares": "cristhian linares",
    "jose astete": "jose astete",
    "angelo basualto": "angelo basualto"
  };
  const ids = {};
  function normalize(value) {
    return String(value || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, " ").trim();
  }
  function canonicalName(value) {
    const normalized = normalize(value);
    return aliases[normalized] || normalized;
  }
  function idForName(value) {
    const normalized = normalize(value);
    const canonical = canonicalName(value);
    return ids[normalized] || ids[canonical] || `jugador-${canonical.replace(/\s+/g, "-")}`;
  }
  function registerPlayers(players) {
    (players || []).forEach(player => {
      const canonical = normalize(player && player.name);
      if (!canonical) return;
      const id = String(player.id || `jugador-${canonical.replace(/\s+/g, "-")}`);
      ids[canonical] = id;
      String(player.aliases || "").split(",").map(normalize).filter(Boolean).forEach(alias => {
        aliases[alias] = canonical;
        ids[alias] = id;
      });
    });
    return api;
  }
  function samePlayer(first, second) { return Boolean(first && second && idForName(first) === idForName(second)); }
  const api = { aliases, normalize, canonicalName, idForName, samePlayer, registerPlayers };
  return api;
});
