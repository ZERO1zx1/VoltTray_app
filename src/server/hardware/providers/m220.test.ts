import test from "node:test";
import assert from "node:assert/strict";
import { parseM220Info } from "./m220";

function info(pct = 64) {
  const data = Buffer.alloc(32); data[0] = 0x10; data[2] = 1; data[3] = 11;
  data.write("M220", 4, "ascii"); data[13] = pct; data[14] = 1;
  data[31] = data.subarray(4, 31).reduce((sum, byte) => sum + byte, 0) & 255;
  return data;
}
test("M220 accepts zero and rejects bad checksum, other models, offline and malformed reports", () => {
  assert.deepEqual(parseM220Info(info()), { pct: 64, charging: false });
  assert.deepEqual(parseM220Info(info(0)), { pct: 0, charging: false });
  assert.equal(parseM220Info(info(255)), null);
  const bad = info(); bad[13]++; assert.equal(parseM220Info(bad), null);
  const other = info(); other.write("M179", 4); assert.equal(parseM220Info(other), null);
  const offline = info(); offline[14] = 0; assert.equal(parseM220Info(offline), null);
  assert.equal(parseM220Info(info().subarray(0, 16)), null);
});
