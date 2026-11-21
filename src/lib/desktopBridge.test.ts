import test from "node:test";
import assert from "node:assert/strict";
import {
  isTauriDesktopRuntime,
  setWidgetPinned,
  toggleOsAutostart,
} from "./desktopBridge";

test("desktopBridge propagates autostart errors instead of swallowing them", async () => {
  assert.equal(isTauriDesktopRuntime(), false);

  const originalFetch = globalThis.fetch;
  try {
    // Simulated HTTP 500 failure must return ok: false and not pretend enabled succeeded
    globalThis.fetch = (async () =>
      new Response("Internal Server Error", { status: 500 })) as typeof fetch;
    const failed = await toggleOsAutostart(true);
    assert.equal(failed.ok, false);
    assert.equal(failed.enabled, false);
    assert.ok(failed.error?.includes("500"));

    // Simulated network rejection must also return ok: false
    globalThis.fetch = (async () => {
      throw new Error("ECONNREFUSED");
    }) as typeof fetch;
    const rejected = await toggleOsAutostart(false);
    assert.equal(rejected.ok, false);
    assert.equal(rejected.enabled, true);
    assert.equal(rejected.error, "ECONNREFUSED");

    // Successful response returns ok: true with server-confirmed enabled flag
    globalThis.fetch = (async () =>
      new Response(JSON.stringify({ ok: true, enabled: true }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })) as typeof fetch;
    const okRes = await toggleOsAutostart(true);
    assert.deepEqual(okRes, { ok: true, enabled: true });

    // Web runtime pin returns typed ok result cleanly
    const pinRes = await setWidgetPinned(true);
    assert.deepEqual(pinRes, { ok: true, pinned: true });
  } finally {
    globalThis.fetch = originalFetch;
  }
});
