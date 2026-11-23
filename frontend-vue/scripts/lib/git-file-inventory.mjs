import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";

/**
 * List tracked and unignored files without depending on the checkout's size.
 * @param {string} root
 * @returns {Promise<string[]>}
 */
export function gitFileInventory(root) {
  return new Promise((resolve, reject) => {
    const child = spawn(
      "git",
      ["ls-files", "--cached", "--others", "--exclude-standard", "-t", "-z"],
      { cwd: root, stdio: ["ignore", "pipe", "pipe"] },
    );
    const files = new Set();
    let pending = "";
    let stderr = "";
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk) => {
      pending += chunk;
      let boundary;
      while ((boundary = pending.indexOf("\0")) !== -1) {
        const record = pending.slice(0, boundary);
        const path = record.slice(2);
        // Git's index also lists tracked deletions; documentation names must
        // resolve to something still present. Untracked entries come from Git's
        // current filesystem walk, so statting all of them repeats that work.
        if (record.startsWith("? ") || existsSync(join(root, path)))
          files.add(path);
        pending = pending.slice(boundary + 1);
      }
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });
    child.once("error", reject);
    child.once("close", (code, signal) => {
      if (code !== 0) {
        reject(
          new Error(
            `git ls-files failed (${signal ?? code}): ${stderr.trim()}`,
          ),
        );
      } else if (pending !== "") {
        reject(new Error("git ls-files returned an incomplete NUL record"));
      } else {
        resolve([...files]);
      }
    });
  });
}
