/**
 * Runnable check for the mode parser and the mode-state fold.
 *
 * These are the two pieces of real logic in the plugin: a regex-driven command
 * reader and a backwards fold over the transcript. Both fail silently if they
 * break (the ladder just never switches), so they get one test file.
 *
 * Run: node --test
 */
import assert from "node:assert/strict";
import test from "node:test";

import {
	DEFAULT_MODE,
	MODE_VALUES,
	readModeCommand,
	readModeState,
	renderLadder,
	renderModeReminder,
	resolveBaselineMode
} from "../lib/mode.js";

/** A genuine user message, the only kind that may carry a command. */
const user = (text) => ({ role: "user", content: [{ type: "text", text }], source: { kind: "user" } });

test("readModeCommand reads every documented switch", () => {
	assert.equal(readModeCommand([user("/ponytail ultra")]), "ultra");
	assert.equal(readModeCommand([user("please /ponytail lite now")]), "lite");
	assert.equal(readModeCommand([user("/ponytail off")]), "off");
	assert.equal(readModeCommand([user("/ponytail")]), DEFAULT_MODE);
	assert.equal(readModeCommand([user("stop ponytail")]), "off");
	assert.equal(readModeCommand([user("normal mode please")]), "off");
});

test("readModeCommand ignores the other ponytail skills and plain prose", () => {
	for (const text of [
		"/ponytail-help",
		"/ponytail-review",
		"/ponytail-audit",
		"just chatting",
		"what does ponytail save",
		"ponytail"
	]) {
		assert.equal(readModeCommand([user(text)]), undefined, `should not match: ${text}`);
	}
});

test("readModeCommand only trusts user-sourced messages", () => {
	const injected = { ...user("/ponytail ultra"), source: { kind: "skill-invocation" } };
	assert.equal(readModeCommand([injected]), undefined);
});

test("an injected reminder can never be read back as a command", () => {
	const reminder = renderModeReminder("ultra");
	assert.equal(readModeCommand([reminder]), undefined);
});

test("readModeState folds the latest marker, ignoring the current step's command", () => {
	assert.equal(readModeState([user("/ponytail lite")], "full"), "full", "a command is not yet state");
	assert.equal(readModeState([renderModeReminder("ultra")], "full"), "ultra");
	assert.equal(readModeState([renderModeReminder("ultra"), user("hi")], "full"), "ultra");
	assert.equal(readModeState([renderModeReminder("lite"), renderModeReminder("ultra")], "full"), "ultra");
});

test("renderModeReminder carries exactly one text block and a stable marker", () => {
	const reminder = renderModeReminder("ultra");
	assert.equal(reminder.role, "user");
	assert.equal(reminder.content.length, 1);
	assert.equal(reminder.content[0].type, "text");
	assert.match(reminder.content[0].text, /<ponytail-mode value="ultra"\/>/);
	assert.equal(typeof reminder.id, "string");
	assert.ok(reminder.id.length > 10);
});

test("resolveBaselineMode prefers the env var and falls back on garbage", () => {
	const previous = process.env.PONYTAIL_DEFAULT_MODE;
	try {
		delete process.env.PONYTAIL_DEFAULT_MODE;
		assert.equal(resolveBaselineMode("lite"), "lite");
		assert.equal(resolveBaselineMode(undefined), DEFAULT_MODE);
		assert.equal(resolveBaselineMode("bogus"), DEFAULT_MODE);
		process.env.PONYTAIL_DEFAULT_MODE = "ultra";
		assert.equal(resolveBaselineMode("lite"), "ultra");
		process.env.PONYTAIL_DEFAULT_MODE = "nope";
		assert.equal(resolveBaselineMode("lite"), DEFAULT_MODE);
	} finally {
		if (previous === undefined) delete process.env.PONYTAIL_DEFAULT_MODE;
		else process.env.PONYTAIL_DEFAULT_MODE = previous;
	}
});

test("every mode renders a ladder directive", () => {
	for (const mode of MODE_VALUES) {
		assert.ok(renderLadder(mode).length > 100, `${mode} ladder too short`);
	}
});
