/**
 * Client-half contract tests.
 *
 * The bundle is a ModuleLoader CJS factory, so it can be evaluated in Node with
 * a stub `window`, a stub React and a stub `require`. That covers the parts
 * worth guarding: which slots it claims, what a click actually sends, and that
 * both dictionaries stay in step.
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const BUNDLE = join(dirname(fileURLToPath(import.meta.url)), "..", "lib", "client.js");

/** Minimal React stand-in: elements are plain objects, hooks are inert. */
const React = {
	createElement: (type, props, ...children) => ({ type, props: props ?? {}, children }),
	useState: (initial) => [typeof initial === "function" ? initial() : initial, () => {}],
	useEffect: () => {},
	useMemo: (factory) => factory(),
	useRef: (value) => ({ current: value }),
	useCallback: (fn) => fn
};

const require = (spec) => {
	if (spec === "react") return React;
	throw new Error(`unexpected require: ${spec}`);
};

/**
 * Evaluate the bundle and drive its `apply` against a recording context.
 * @returns the registered slots, the recorded remote calls and the bound key list.
 */
async function loadBundle() {
	const source = await readFile(BUNDLE, "utf8");
	let definition;
	globalThis.window = { __ModuleLoader__: { load: (value) => (definition = value) } };
	// The bundle is a plain script body: it only needs `window` to exist.
	new Function("window", source)(globalThis.window);
	const slots = [];
	const calls = [];
	const keys = [];
	const ctx = {
		effect: (callback) => callback(),
		on: () => {},
		locale: {
			register: (_namespace, dictionaries) => {
				keys.push(...Object.keys(dictionaries.zh));
			},
			bind: (namespace) => (key) => `${namespace}|${key}`
		},
		slots: {
			inject: (_key, callback) => callback(),
			register: (options, component) => slots.push({ options, component })
		},
		remote: {
			commands: {
				execute: async (sessionId, line) => {
					calls.push({ via: "command", sessionId, line });
					return { ok: true, value: { kind: "success", text: "ok" } };
				}
			},
			session: {
				prompt: async (request) => {
					calls.push({ via: "prompt", request });
					return { ok: true, value: { accepted: true } };
				}
			}
		}
	};
	const module = definition.factory(require);
	module.apply(ctx);
	return { inject: module.inject, slots, calls, keys };
}

/** Render a registered component the way its slot would, then return the element. */
function render(slot, props) {
	const element = slot.component(props);
	if (element === null) return null;
	return element.type(element.props);
}

const props = (extra = {}) => ({ sessionId: "session-1", useProjection: () => ({ mode: "full" }), ...extra });

test("the bundle claims both halves' slots", async () => {
	const { slots } = await loadBundle();
	assert.deepEqual(
		slots.map((slot) => [slot.options.name, slot.options.id, slot.options.order]),
		[
			["conversation.composer.dock", "ponytail-mode", 5],
			["conversation.composer.dock", "ponytail-grill", 6],
			["settings.section", "ponytail-grill", 25]
		]
	);
});

test("the client declares the services its slots use", async () => {
	const { inject } = await loadBundle();
	assert.ok(inject.includes("slots"));
	assert.ok(inject.includes("remote.commands"));
	assert.ok(inject.includes("remote.session"));
});

test("the badge cycles the mode through the host command", async () => {
	const { slots, calls } = await loadBundle();
	const badge = render(
		slots.find((slot) => slot.options.id === "ponytail-mode"),
		props()
	);
	badge.children[0].props.onClick();
	await new Promise((resolve) => setTimeout(resolve, 0));
	assert.deepEqual(calls, [{ via: "command", sessionId: "session-1", line: "/ponytail-mode ultra" }]);
});

test("the grill chip sends the skill gesture as a queued prompt", async () => {
	const { slots, calls } = await loadBundle();
	const chip = render(
		slots.find((slot) => slot.options.id === "ponytail-grill" && slot.options.name === "conversation.composer.dock"),
		props()
	);
	chip.children[0].props.onClick();
	await new Promise((resolve) => setTimeout(resolve, 0));
	assert.equal(calls.length, 1);
	assert.equal(calls[0].via, "prompt");
	assert.equal(calls[0].request.sessionId, "session-1");
	assert.equal(calls[0].request.mode, "queue");
	assert.deepEqual(calls[0].request.content, [{ type: "text", text: "/grill-me" }]);
	assert.equal(typeof calls[0].request.requestId, "string");
});

test("both dictionaries define the same keys", async () => {
	const { keys } = await loadBundle();
	const unique = [...new Set(keys)];
	assert.equal(unique.length, keys.length);
	assert.ok(unique.includes("grill.label"));
	assert.ok(unique.includes("badge.aria"));
	assert.ok(unique.includes("settings.nav"));
	assert.ok(unique.includes("settings.visible"));
});

test("both dock entries stay hidden when the settings page turned them off", async () => {
	const realFetch = globalThis.fetch;
	globalThis.fetch = async () => ({
		json: async () => ({ ok: true, state: { showInComposer: false, defaultMode: "full", baseline: "full" } })
	});
	try {
		const { slots } = await loadBundle();
		// `apply` seeds the visibility cell from one read; let that promise settle.
		await new Promise((resolve) => setTimeout(resolve, 0));
		for (const id of ["ponytail-mode", "ponytail-grill"]) {
			const slot = slots.find((entry) => entry.options.id === id && entry.options.name === "conversation.composer.dock");
			assert.equal(render(slot, props()), null, `${id} should render nothing`);
		}
	} finally {
		globalThis.fetch = realFetch;
	}
});
