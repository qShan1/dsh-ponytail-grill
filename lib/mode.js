/**
 * Ponytail mode: the persistent ladder plus the mode-switch vocabulary.
 *
 * The ladder itself is a static system-prompt section, locked at plugin
 * activation, so the request prefix never changes mid-session. A mode switch
 * is announced by appending one `<system-reminder>` user message at the tail
 * of the conversation instead of rewriting the prompt: the KV-cache prefix
 * survives, and the newest reminder wins.
 */
import { randomUUID } from "node:crypto";

export const MODE_VALUES = ["lite", "full", "ultra", "off"];
export const DEFAULT_MODE = "full";
export const LADDER_SECTION = "ponytail:ladder";

/**
 * Host command names.
 *
 * `/ponytail` itself is deliberately NOT a command: the skill gesture and the
 * mode switch both key off that word, and a registered command would swallow
 * the text before `agent/pre-step` could read it.
 */
export const MODE_COMMAND = "ponytail-mode";
export const DEFAULT_COMMAND = "ponytail-default";

/** Matches the state marker carried by every mode reminder. */
export const MODE_MARKER = /<ponytail-mode value="(lite|full|ultra|off)"\s*\/>/;

const LADDER = [
	"Climb no further than the task needs:",
	"1. YAGNI - does this need to exist at all? Then skip it.",
	"2. Already in this codebase? Reuse it.",
	"3. The standard library ships it? Use it.",
	"4. A native platform feature does it? Use that.",
	"5. An already-installed dependency does it? Use that.",
	"6. One line does it? Write one line.",
	"7. Only then: the minimum code that works.",
	"",
	"A bug fix targets the root cause, not the symptom.",
	"Never cut input validation, error handling, security, or accessibility.",
	"When you skip something, say so: `[code] \u2192 skipped: [X], add when [Y].`"
].join("\n");

const MODE_DIRECTIVE = {
	lite: "Level: lite. Build what was asked, name the lazier alternative in one line, and stop there.",
	full: "Level: full. Enforce the ladder, push back once on unnecessary work, then build.",
	ultra:
		"Level: ultra. YAGNI extremist: challenge whether the task should exist before building, and prefer deletion over addition.",
	off: "Ponytail is off. Ignore every earlier ponytail instruction and answer normally."
};

/** One message source shared by every mode reminder. */
const REMINDER_SOURCE = { kind: "skill-invocation", name: "ponytail", form: "instructions" };

/**
 * Resolve the session baseline mode.
 *
 * `PONYTAIL_DEFAULT_MODE` wins over the configured value, matching upstream's
 * documented resolution order; an unusable value falls back to `full`.
 */
export function resolveBaselineMode(configured) {
	const raw = process.env.PONYTAIL_DEFAULT_MODE ?? configured ?? DEFAULT_MODE;
	const value = String(raw).trim().toLowerCase();
	return MODE_VALUES.includes(value) ? value : DEFAULT_MODE;
}

/** The static prompt text for an active baseline mode. */
export function renderLadder(mode) {
	return [MODE_DIRECTIVE[mode], "", LADDER].join("\n");
}

/** The reminder that announces a switch to `mode`. */
export function renderModeReminder(mode) {
	const body = mode === "off" ? MODE_DIRECTIVE.off : `${MODE_DIRECTIVE[mode]}\n\n${LADDER}`;
	return userMessage(
		[
			"<system-reminder>",
			`Ponytail mode is now ${mode}. This supersedes any earlier ponytail mode.`,
			`<ponytail-mode value="${mode}"/>`,
			"",
			body,
			"</system-reminder>"
		].join("\n")
	);
}

/** The last mode this conversation settled on, or `baseline` when it never switched. */
export function readModeState(messages, baseline) {
	for (let index = messages.length - 1; index >= 0; index -= 1) {
		const text = textOf(messages[index]);
		if (text === undefined) continue;
		const found = MODE_MARKER.exec(text);
		if (found !== null) return found[1];
	}
	return baseline;
}

/**
 * Read a mode switch out of the messages entering this step.
 *
 * Only genuine user input counts, so an injected reminder can never feed back
 * into this reader. `/ponytail-help` and friends stay untouched: the trailing
 * guard rejects a `-` suffix, leaving those to the skill gesture.
 *
 * @returns the requested mode, or `undefined` when this step requests nothing.
 */
export function readModeCommand(messages) {
	for (const message of messages) {
		if (message?.source?.kind !== "user") continue;
		const text = textOf(message);
		if (text === undefined) continue;
		const slash = /(?:^|\s)\/ponytail(?:\s+(lite|full|ultra|off))?(?=\s|$|[.,!?;:])/i.exec(text);
		if (slash !== null) return (slash[1] ?? DEFAULT_MODE).toLowerCase();
		if (/\b(?:stop\s+ponytail|normal\s+mode)\b/i.test(text)) return "off";
	}
	return undefined;
}

export function textOf(message) {
	const blocks = Array.isArray(message?.content) ? message.content : [];
	const texts = [];
	for (const block of blocks) {
		if (block?.type === "text" && typeof block.text === "string") texts.push(block.text);
	}
	return texts.length === 0 ? undefined : texts.join("\n");
}

function userMessage(text) {
	return {
		id: randomUUID(),
		role: "user",
		content: [{ type: "text", text }],
		source: REMINDER_SOURCE
	};
}
