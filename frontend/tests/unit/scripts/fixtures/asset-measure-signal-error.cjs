const { ChildProcess } = require("node:child_process");
const original = ChildProcess.prototype.kill;
const failed = new WeakSet();
ChildProcess.prototype.kill = function (signal) {
  if (
    signal === "SIGTERM" &&
    !failed.has(this) &&
    this.spawnargs.some((arg) =>
      arg.includes("node_modules/next/dist/bin/next"),
    )
  ) {
    failed.add(this);
    queueMicrotask(() =>
      this.emit(
        "error",
        new Error("fixture signal delivery failed after spawn"),
      ),
    );
    return false;
  }
  return original.call(this, signal);
};
