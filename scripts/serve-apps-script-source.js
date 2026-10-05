const fs = require("node:fs");
const http = require("node:http");
const path = require("node:path");

const sourceDirectory = path.join(__dirname, "..", "admin", "apps-script");
const bundles = {
  "/Codigo.gs": ["Config.gs", "ResultEngine.gs", "Code.gs"],
  "/Index.html": ["Index.html"],
  "/Styles.html": ["Styles.html"],
  "/Client.html": ["Client.html"]
};

const port = Number(process.env.APPS_SCRIPT_SOURCE_PORT || 4175);

http.createServer((request, response) => {
  const files = bundles[request.url];
  if (!files) {
    response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    response.end("Not found");
    return;
  }

  const contents = files
    .map(fileName => fs.readFileSync(path.join(sourceDirectory, fileName), "utf8"))
    .join("\n\n");

  response.writeHead(200, {
    "Content-Type": "text/plain; charset=utf-8",
    "Cache-Control": "no-store"
  });
  response.end(contents);
}).listen(port, "127.0.0.1", () => {
  console.log(`Fuentes de Apps Script: http://127.0.0.1:${port}/Codigo.gs`);
});
