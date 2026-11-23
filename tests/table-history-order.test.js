const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const source = fs.readFileSync(path.join(__dirname, "..", "tablas.html"), "utf8");

function cargarComparador() {
  const inicio = source.indexOf("  function parseFechaPartido(valor)");
  const fin = source.indexOf("  function esProximoProgramado(partido)", inicio);
  assert.ok(inicio >= 0 && fin > inicio, "no se encontraron los helpers de fecha");

  const contexto = {};
  vm.runInNewContext(`${source.slice(inicio, fin)}\nthis.comparar = compararRegistrosPorFechaReal;`, contexto);
  return contexto.comparar;
}

test("ordena el historial por la fecha real y conserva el orden de origen si empatan", () => {
  const comparar = cargarComparador();
  const registros = [
    { fecha: "14/11/2026", _indiceFuente: 1, id: "loreto" },
    { fecha: "6/6/2026", _indiceFuente: 0, id: "maria-jose-1" },
    { fecha: "21/11/2026", _indiceFuente: 5, id: "sara-2" },
    { fecha: "9/11/2026", _indiceFuente: 3, id: "maria-jose-2" },
    { fecha: "11/7/2026", _indiceFuente: 2, id: "sara-1" },
    { fecha: "21/11/2026", _indiceFuente: 4, id: "mismo-dia-anterior" }
  ];

  registros.sort(comparar);
  assert.deepEqual(
    registros.map(registro => registro.id),
    ["maria-jose-1", "sara-1", "maria-jose-2", "loreto", "mismo-dia-anterior", "sara-2"]
  );
});

test("usa ese orden para la racha, el último partido y el historial completo", () => {
  assert.match(source, /jugados\.sort\(compararRegistrosPorFechaReal\);/);
  assert.match(source, /const ultimos = jugados\.slice\(-3\);/);
  assert.match(source, /const ultimo = jugados\.length \? jugados\[jugados\.length - 1\] : null;/);
  assert.match(source, /historialArchivado[\s\S]*?\.sort\(compararRegistrosPorFechaReal\)[\s\S]*?\.map\(item => item\.texto\)/);
});
