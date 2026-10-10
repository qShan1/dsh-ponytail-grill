/**
 * ponytail + grill-me for DSH.
 *
 * Five moving parts, all registered on this plugin's own context:
 *
 * 1. `ctx.skills.registerProvider()` serves the bundled `skills/` directory, so
 *    the seven skills work without depending on which user-level skill root the
 *    host scans. `skill("ponytail")` and the `/ponytail-review` gesture both
 *    come from here.
 * 2. `ctx.systemPrompt.section()` adds the always-on ladder. It is written once
 *    at activation and never rewritten, so the request prefix stays cacheable.
 * 3. One `agent/pre-step` listener reads `/ponytail lite|full|ultra|off` (and
 *    `stop ponytail` / `normal mode`) from genuine user input and appends a
 *    `<system-reminder>` carrying the new mode. Rewriting the prompt instead
 *    would invalidate the cached prefix on every switch.
 * 4. Two host commands (`ponytail-mode`, `ponytail-default`) give the GUI a way
 *    to switch without typing. `/ponytail` itself stays unregistered so the
 *    pre-step reader keeps seeing the raw text.
 * 5. A `ponytail` session projection publishes the current mode to the Client
 *    half, and one exact HTTP route serves the settings page.
 */
import { BundledSkillProvider } from "./lib/skills.js";
import {
	DEFAULT_MODE,
	LADDER_SECTION,
	readModeCommand,
	readModeState,
	renderLadder,
	renderModeReminder,
	resolveBaselineMode
} from "./lib/mode.js";
import { registerCommands } from "./lib/commands.js";
import { registerApi } from "./lib/http.js";
import { createPonytailProjection } from "./lib/projection.js";

export const name = "ponytail-grill";
export const inject = ["skills", "systemPrompt"];

/** Order just after the deployment persona, before the tool sections. */
const LADDER_ORDER = 150;

export function apply(ctx, config = {}) {
	const baseline = resolveBaselineMode(config.defaultMode ?? DEFAULT_MODE);
	const state = { baseline, defaultMode: config.defaultMode ?? DEFAULT_MODE };

	const provider = new BundledSkillProvider();
	ctx.skills.registerProvider(() => provider);

	if (baseline !== "off") {
		ctx.systemPrompt.section({
			name: LADDER_SECTION,
			order: LADDER_ORDER,
			text: renderLadder(baseline)
		});
	}

	ctx.on("agent/pre-step", async ({ messages }, next) => {
		const decision = await next();
		if (decision.kind === "reject") return decision;

		const requested = readModeCommand(messages);
		if (requested === undefined) return decision;

		const current = readModeState(decision.messages, baseline);
		if (requested === current) return decision;

		return {
			...decision,
			messages: [...decision.messages, renderModeReminder(requested)]
		};
	});

	// Optional collaborators: the plugin keeps working when any of these is absent.
	ctx.inject(["sessionProjections"], (projCtx) => {
		projCtx.sessionProjections.register(createPonytailProjection(baseline));
	});
	registerCommands(ctx, state);
	registerApi(ctx, state);
}
