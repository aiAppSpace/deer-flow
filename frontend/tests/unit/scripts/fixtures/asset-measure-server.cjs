const { appendFileSync } = require("node:fs");
const http = require("node:http");
const mode = process.env.ASSET_FIXTURE_MODE;
const port = Number(process.argv[process.argv.indexOf("--port") + 1]);
const record = (event) =>
  appendFileSync(
    process.env.ASSET_FIXTURE_LOG,
    JSON.stringify({ ...event, pid: process.pid, port }) + "\n",
  );
record({
  kind: "server",
  staticMode: process.env.NEXT_PUBLIC_STATIC_WEBSITE_ONLY ?? null,
});
if (mode === "exit-code") process.exit(17);
if (mode === "exit-143") process.exit(143);
if (mode === "exit-signal") process.kill(process.pid, "SIGTERM");
if (mode === "ignore-term")
  process.on("SIGTERM", () => record({ kind: "term-ignored" }));
const server = http.createServer((request, response) => {
  record({ kind: "request", url: request.url });
  if (
    mode === "hang-ready" ||
    (mode === "hang-headers" && request.url === "/login")
  )
    return;
  if (mode === "http-error" && request.url === "/login") {
    response.writeHead(503);
    response.end("failed route");
    return;
  }
  const css = mode === "missing-asset" ? "missing.css" : "app.css";
  response.writeHead(200, { "content-type": "text/html" });
  response.write(
    `<link rel="stylesheet" href="/_next/static/css/${css}"><script src="/_next/static/chunks/app.js"></script>`,
  );
  if (mode !== "hang-body" || request.url !== "/login") response.end();
});
if (mode !== "ignore-term") {
  // Match the installed Next start-server cleanup: handle TERM, close owned
  // sockets, and explicitly exit 143. An unhandled signal is not equivalent.
  process.on("SIGTERM", () => {
    record({ kind: "term-cleanup" });
    server.close(() => process.exit(143));
    server.closeAllConnections();
  });
}
server.listen(port, "127.0.0.1");
