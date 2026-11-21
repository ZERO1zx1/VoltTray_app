import { rm } from "node:fs/promises";

// Only web build output. Keep persisted user state and native installers.
await rm(new URL("../dist/", import.meta.url), {
  recursive: true,
  force: true,
});
