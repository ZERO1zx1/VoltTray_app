import { readdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { spawnSync } from "node:child_process";

const root = fileURLToPath(new URL("../", import.meta.url));
async function collect(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const groups = await Promise.all(
    entries.map((entry) => {
      const file = path.join(directory, entry.name);
      return entry.isDirectory()
        ? collect(file)
        : entry.name.endsWith(".test.ts") || entry.name.endsWith(".test.mjs")
          ? [file]
          : [];
    }),
  );
  return groups.flat();
}
const files = [
  ...(await collect(path.join(root, "src"))),
  ...(await collect(path.join(root, "scripts"))),
].sort();
if (files.length === 0) throw new Error("No test files found in src/ or scripts/");
const result = spawnSync(
  process.execPath,
  ["--import", "tsx", "--test", ...files],
  {
    cwd: root,
    stdio: "inherit",
  },
);
if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
