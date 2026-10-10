/**
 * Host commands behind the GUI controls.
 *
 * `/ponytail` itself stays unregistered on purpose: the skill gesture and the
 * mode switch both key off that word, and a registered command would swallow
 * the line before `agent/pre-step` ever reads it. The GUI therefore speaks
 * `ponytail-mode` instead, and the handler delivers the same reminder the
 * pre-step listener would have appended.
 */
import { DEFAULT_COMMAND, MODE_COMMAND, MODE_VALUES, renderModeReminder } from "./mode.js";

const DEFINITION_ID = "@local/dsh-ponytail-grill";

/** `agent.inject` carries context without waking the driver, so no turn is spent. */
function setMode(agent, mode) {
	agent.inject(renderModeReminder(mode));
}

export function registerCommands(ctx, state) {
	ctx.inject(["commands"], (commandCtx) => {
		commandCtx.commands.register({
			definitionId: DEFINITION_ID,
			name: MODE_COMMAND,
			description: "Set the ponytail level for this session",
			input: { hint: "[lite|full|ultra|off]", attachments: false },
			handler: ({ agent, rawInput }) => {
				const mode = String(rawInput ?? "")
					.trim()
					.toLowerCase();
				if (!MODE_VALUES.includes(mode)) {
					return { kind: "error", text: `ponytail: expected one of ${MODE_VALUES.join(", ")}` };
				}
				setMode(agent, mode);
				return { kind: "success", text: `Ponytail level: ${mode}` };
			}
		});

		commandCtx.commands.register({
			definitionId: DEFINITION_ID,
			name: DEFAULT_COMMAND,
			description: "Set the ponytail level new sessions start in",
			input: { hint: "[lite|full|ultra|off]", attachments: false },
			handler: async ({ rawInput }) => {
				const mode = String(rawInput ?? "")
					.trim()
					.toLowerCase();
				if (!MODE_VALUES.includes(mode)) {
					return { kind: "error", text: `ponytail: expected one of ${MODE_VALUES.join(", ")}` };
				}
				const failure = await saveDefault(ctx, state, mode);
				if (failure !== undefined) return { kind: "error", text: failure };
				return { kind: "success", text: `Ponytail default level: ${mode}` };
			}
		});
	});
}

/**
 * Persist `defaultMode` into this plugin's profile patch.
 *
 * `configEditor.edit` is the same path the built-in agent-default-model uses:
 * it reconciles the profile patch and lets the Loader re-apply the config, so
 * no schemastery-backed Config declaration is needed.
 *
 * @returns an error string, or `undefined` on success.
 */
export async function saveDefault(ctx, state, mode) {
	const editor = ctx.get("configEditor");
	if (editor === undefined) return "ponytail: the profile editor is not available";
	const entry = ctx.fiber?.entry;
	if (entry === undefined) return "ponytail: this plugin has no profile entry to edit";
	try {
		await editor.edit(entry, (current) => ({ ...(current ?? {}), defaultMode: mode }));
	} catch (error) {
		return `ponytail: ${error?.message ?? String(error)}`;
	}
	state.defaultMode = mode;
	return undefined;
}
