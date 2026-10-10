/**
 * The one HTTP route the Client half talks to.
 *
 * The composer badge needs no route — it reads the `ponytail` projection and
 * switches through the host command. The settings page does: it is not bound to
 * a session, so there is no `agentId` for a remote to scope to, and this plugin
 * ships no schemastery-backed Config for the Settings service to drive.
 *
 * Registration is defensive and scoped: without a Web server the plugin still
 * runs, and the route's disposer is wired into this plugin's fiber so an unload
 * (disable, update, HMR) removes it.
 */
import { MODE_VALUES } from "./mode.js";
import { saveConfig } from "./commands.js";

export const API_PATH = "/dsh-ponytail-grill/api";

function sendJson(res, status, payload) {
	res.writeHead(status, { "content-type": "application/json" });
	res.end(JSON.stringify(payload));
}

function readBody(req) {
	return new Promise((resolve) => {
		const chunks = [];
		req.on("data", (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk))));
		req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
		req.on("error", () => resolve(""));
	});
}

/** The state the settings page renders. */
function snapshot(state) {
	const env = process.env.PONYTAIL_DEFAULT_MODE;
	return {
		defaultMode: state.defaultMode,
		baseline: state.baseline,
		showInComposer: state.showInComposer !== false,
		modes: MODE_VALUES,
		envOverride: env === undefined || env === "" ? null : String(env)
	};
}

export function registerApi(ctx, state) {
	ctx.inject(["webServer"], (webCtx) => {
		const connection = () => {
			try {
				return webCtx.get("connection");
			} catch {
				return undefined;
			}
		};

		/** Admit only requests the host already trusts: Host/Origin plus the browser session. */
		const rejected = (req, res) => {
			const rejection = connection()?.requestRejection(req);
			if (rejection === undefined) return false;
			res.statusCode = rejection;
			res.end();
			return true;
		};

		webCtx.effect(
			() =>
				webCtx.webServer.register({
					kind: "exact",
					path: API_PATH,
					handler: async (req, res) => {
						if (rejected(req, res)) return;
						if (String(req.method ?? "POST").toUpperCase() !== "POST") {
							sendJson(res, 405, { ok: false, error: "method not allowed" });
							return;
						}
						let payload = {};
						try {
							payload = JSON.parse((await readBody(req)) || "{}");
						} catch {
							payload = {};
						}
						const op = String(payload.op ?? "read");
						if (op === "read") {
							sendJson(res, 200, { ok: true, state: snapshot(state) });
							return;
						}
						if (op === "set-default") {
							const mode = String(payload.mode ?? "")
								.trim()
								.toLowerCase();
							if (!MODE_VALUES.includes(mode)) {
								sendJson(res, 400, { ok: false, error: `expected one of ${MODE_VALUES.join(", ")}` });
								return;
							}
							const failure = await saveConfig(ctx, state, { defaultMode: mode });
							if (failure !== undefined) {
								sendJson(res, 500, { ok: false, error: failure });
								return;
							}
							sendJson(res, 200, { ok: true, state: snapshot(state) });
							return;
						}
						if (op === "set-visible") {
							if (typeof payload.showInComposer !== "boolean") {
								sendJson(res, 400, { ok: false, error: "expected a boolean showInComposer" });
								return;
							}
							const failure = await saveConfig(ctx, state, { showInComposer: payload.showInComposer });
							if (failure !== undefined) {
								sendJson(res, 500, { ok: false, error: failure });
								return;
							}
							sendJson(res, 200, { ok: true, state: snapshot(state) });
							return;
						}
						sendJson(res, 400, { ok: false, error: `unknown op "${op}"` });
					}
				}),
			"ponytail-grill: api route"
		);
	});
}
