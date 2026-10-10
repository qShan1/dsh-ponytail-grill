/**
 * Runnable check for the `ponytail` session projection.
 *
 * The projection is what the Client badge reads, so its fold has to be exactly
 * right in both directions: the clicked command flips the badge at once, and a
 * typed gesture is confirmed off the log.
 *
 * Run: node --test
 */
import assert from "node:assert/strict";
import test from "node:test";

import { MODE_COMMAND, renderModeReminder } from "../lib/mode.js";
import { PROJECTION_KEY, createPonytailProjection } from "../lib/projection.js";

const user = (text) => ({ role: "user", content: [{ type: "text", text }], source: { kind: "user" } });
const run = (name, args) => ({ type: "command/run", data: { name, args } });

test("the projection starts at the session baseline", () => {
	const projection = createPonytailProjection("lite");
	assert.equal(projection.key, PROJECTION_KEY);
	assert.deepEqual(projection.init(), { mode: "lite", baseline: "lite" });
});

test("a clicked command flips the mode immediately", () => {
	const projection = createPonytailProjection("full");
	const state = projection.apply(projection.init(), run(MODE_COMMAND, "ultra"));
	assert.equal(state.mode, "ultra");
});

test("a confirmed reminder is authoritative over the pending command", () => {
	const projection = createPonytailProjection("full");
	let state = projection.apply(projection.init(), run(MODE_COMMAND, "ultra"));
	state = projection.apply(state, { type: "user/message", data: renderModeReminder("ultra") });
	assert.equal(state.mode, "ultra");
	assert.deepEqual(state, { mode: "ultra", baseline: "full" });
});

test("a hand-typed gesture reaches the projection off the log", () => {
	const projection = createPonytailProjection("full");
	const state = projection.apply(projection.init(), { type: "user/message", data: user("/ponytail lite") });
	assert.equal(state.mode, "lite");
});

test("unrelated events return the same reference so nothing is republished", () => {
	const projection = createPonytailProjection("full");
	const state = projection.init();
	assert.equal(projection.apply(state, { type: "user/message", data: user("hello there") }), state);
	assert.equal(projection.apply(state, run(MODE_COMMAND, "bogus")), state);
	assert.equal(projection.apply(state, run("some-other-command", "ultra")), state);
	assert.equal(projection.apply(state, { type: "assistant/message", data: {} }), state);
});

test("the wire view survives the registry's parse call", () => {
	const projection = createPonytailProjection("full");
	const state = projection.init();
	assert.deepEqual(projection.stateSchema.parse(state), state);
	assert.deepEqual(projection.wire.viewSchema.parse(projection.wire.view(state)), { mode: "full", baseline: "full" });
});
