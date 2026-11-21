import assert from "node:assert/strict";
import test from "node:test";
import express from "express";

test("local API listener binds only to the IPv4 loopback interface", async () => {
  const localServer = await import("./listen").catch(() => null);
  assert.ok(localServer, "the local-only server listener must be available");

  const returnedServer = {};
  let receivedArgs: unknown[] = [];
  const app = {
    listen: (...args: unknown[]) => {
      receivedArgs = args;
      return returnedServer;
    },
  } as unknown as ReturnType<typeof express>;

  const result = localServer.listenLocalOnly(app, 3173);
  assert.equal(receivedArgs[0], 3173);
  assert.equal(receivedArgs[1], "127.0.0.1");
  assert.equal(result, returnedServer);
});
