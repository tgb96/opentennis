const fs = require("node:fs");
const http = require("node:http");
const path = require("node:path");

const directory = path.join(__dirname, "..", "admin", "apps-script");
const read = fileName => fs.readFileSync(path.join(directory, fileName), "utf8");
const dashboard = {
  season: "2026",
  spreadsheetName: "Open Tennis 2026 · Vista de prueba",
  generatedAt: "26/8/2026 16:10",
  today: "26/8/2026",
  summary: { total: 4, pending: 2, upcoming: 1, played: 1 },
  matches: [
    {
      matchId: "2026-s9-a-diego-fossa-nicolas-collao",
      week: "9", court: "1", turn: "19:00", category: "A",
      player1: "Diego Fossa", player2: "Nicolás Collao", date: "26/8/2026",
      status: "reprogramado", statusLabel: "Reprogramado", notes: "Nueva fecha por confirmar", resultWeb: "", record: null
    },
    {
      matchId: "2026-s9-b-daniel-vega-cristhian-linares",
      week: "9", court: "2", turn: "20:30", category: "B",
      player1: "Daniel Vega", player2: "Cristhian Linares", date: "27/8/2026",
      status: "pendiente", statusLabel: "Pendiente", notes: "", resultWeb: "", record: null
    },
    {
      matchId: "2026-s10-c-jose-astete-pablo-arias",
      week: "10", court: "1", turn: "19:00", category: "C",
      player1: "José Astete", player2: "Pablo Arias", date: "2/9/2026",
      status: "programado", statusLabel: "Programado", notes: "", resultWeb: "", record: null
    },
    {
      matchId: "2026-s8-a-andres-soto-felipe-leon",
      week: "8", court: "1", turn: "19:00", category: "A",
      player1: "Andrés Soto", player2: "Felipe León", date: "20/8/2026",
      status: "jugado", statusLabel: "Jugado", notes: "", resultWeb: "Ganador Andrés Soto 6-3 6-4",
      record: { date: "20/8/2026", set1Player1: "6", set1Player2: "3", set2Player1: "6", set2Player2: "4", stbPlayer1: "", stbPlayer2: "" }
    }
  ]
};

const googleMock = `<script>
window.google = { script: { run: {
  withSuccessHandler: function (handler) { this.success = handler; return this; },
  withFailureHandler: function (handler) { this.failure = handler; return this; },
  getAdminDashboard: function () { this.success(${JSON.stringify(dashboard)}); },
  saveAdminMatch: function () { this.success(${JSON.stringify(dashboard)}); }
} } };
</script>`;

const html = read("Index.html")
  .replace('<?!= include("Styles"); ?>', read("Styles.html"))
  .replace(/window\.__INITIAL_DATA__\s*=\s*<\?!=[\s\S]*?\?>;/, `window.__INITIAL_DATA__ = ${JSON.stringify(dashboard)};`)
  .replace('<?!= include("Client"); ?>', googleMock + read("Client.html"));

const port = Number(process.env.ADMIN_PREVIEW_PORT || 4173);
http.createServer((request, response) => {
  response.writeHead(200, { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" });
  response.end(html);
}).listen(port, "127.0.0.1", () => {
  console.log(`Vista previa del administrador: http://127.0.0.1:${port}`);
});
