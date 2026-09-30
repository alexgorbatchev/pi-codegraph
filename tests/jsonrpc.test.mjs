import assert from "node:assert/strict";
import { PassThrough } from "node:stream";
import test from "node:test";

import { JsonRpcPeer } from "../dist/lib/jsonrpc.js";

test("JsonRpcPeer handles leading empty lines and multiple messages without hanging", async () => {
  const readable = new PassThrough();
  const writable = new PassThrough();
  const peer = new JsonRpcPeer(readable, writable);

  const p1 = peer.request("test1");
  const p2 = peer.request("test2");

  // Send empty lines, whitespace, and responses
  readable.write("\n\n  \n");
  readable.write(
    `${JSON.stringify({ jsonrpc: "2.0", id: 1, result: "first" })}\n`,
  );
  readable.write("\n");
  readable.write(
    `${JSON.stringify({ jsonrpc: "2.0", id: 2, result: "second" })}\n`,
  );

  const [res1, res2] = await Promise.all([p1, p2]);
  assert.equal(res1, "first");
  assert.equal(res2, "second");
});

test("JsonRpcPeer skips notifications and malformed lines without hanging", async () => {
  const readable = new PassThrough();
  const writable = new PassThrough();
  const peer = new JsonRpcPeer(readable, writable);

  const p1 = peer.request("test");

  // Notification (no id), malformed JSON line, non-record line
  readable.write(
    `${JSON.stringify({ jsonrpc: "2.0", method: "notify", params: {} })}\n`,
  );
  readable.write("not valid json\n");
  readable.write("123\n");
  readable.write(
    `${JSON.stringify({ jsonrpc: "2.0", id: 1, result: "ok" })}\n`,
  );

  const res = await p1;
  assert.equal(res, "ok");
});
