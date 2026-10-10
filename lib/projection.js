/**
 * Session projection: the ponytail mode the client half reads.
 *
 * A projection is a pure replay of the session log, so the badge in the
 * composer needs no extra RPC: the host folds two event kinds and publishes
 * `{ mode, baseline }` under the key `ponytail`.
 *
 * - `command/run` for the mode command records the *intent* the moment the
 *   badge is clicked, so the badge flips immediately. Command events are
 *   log-only, so nothing reaches the model.
 * - `user/message` carrying a `<ponytail-mode value="...">` marker confirms
 *   the switch once the host has actually appended its reminder. A typed
 *   `/ponytail lite` lands here too.
 *
 * Schemas are duck-typed: the registry only ever calls `.parse(value)`, and
 * this plugin deliberately carries no runtime dependencies.
 */
import { MODE_COMMAND, MODE_MARKER, MODE_VALUES, readModeCommand, textOf } from "./mode.js";

export const PROJECTION_KEY = "ponytail";
const STATE_VERSION = 1;

/** The registry calls `parse` and nothing else, so identity is a valid schema. */
const looseSchema = Object.freeze({ parse: (value) => value });

/**
 * Build the projection definition for a session baseline.
 *
 * `wire.view` returns the state object itself, so the registry's `Object.is`
 * comparison publishes only on a real change.
 */
export function createPonytailProjection(baseline) {
	return {
		key: PROJECTION_KEY,
		stateVersion: STATE_VERSION,
		stateSchema: looseSchema,
		init: () => ({ mode: baseline, baseline }),
		apply: (state, event) => {
			const mode = modeFromEvent(event);
			if (mode === undefined || mode === state.mode) return state;
			return { mode, baseline: state.baseline };
		},
		wire: {
			viewSchema: looseSchema,
			view: (state) => state
		}
	};
}

function modeFromEvent(event) {
	if (event?.type === "command/run" && event.data?.name === MODE_COMMAND) {
		const value = String(event.data.args ?? "")
			.trim()
			.toLowerCase();
		return MODE_VALUES.includes(value) ? value : undefined;
	}
	if (event?.type === "user/message") {
		const message = event.data;
		const text = textOf(message);
		if (text === undefined) return undefined;
		const marker = MODE_MARKER.exec(text);
		if (marker !== null) return marker[1];
		// A hand-typed gesture reaches the log before the host appends its reminder.
		if (message?.source?.kind === "user") return readModeCommand([message]);
	}
	return undefined;
}
