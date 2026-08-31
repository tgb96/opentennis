const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const cssDir = path.join(root, "assets", "css");

function build(output, sources) {
  const content = sources.map(source => {
    const css = fs.readFileSync(path.join(cssDir, source), "utf8").trim();
    return `/* ===== ${source} ===== */\n${css}`;
  }).join("\n\n") + "\n";

  fs.writeFileSync(path.join(cssDir, output), content, "utf8");
  console.log(`${output}: ${sources.join(" + ")}`);
}

build("app.css", ["styles.css", "v2-overrides.css", "v3.css", "v4.css", "v5.css", "v6.css", "v7.css"]);
build("scoreboard.css", ["v3.css", "v4.css", "v5.css", "v7-scoreboard.css"]);
