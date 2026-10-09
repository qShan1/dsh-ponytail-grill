/**
 * Skill provider: serves this plugin's own `skills/` directory.
 *
 * Registering the skills here instead of relying on a filesystem root keeps the
 * bundle self-contained and immune to which user-level skill directory the host
 * happens to scan. The provider reports `source: "custom"` so the catalog shows
 * where the entries come from.
 */
import { readFile, readdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

/** Lower than the filesystem roots, so an explicit user override still wins. */
const CUSTOM_RANK = 100;
const PROVIDER_NAME = "ponytail-grill";
const SKILL_NAME = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

const SKILLS_DIR = join(dirname(fileURLToPath(import.meta.url)), "..", "skills");

/**
 * Parse the leading YAML frontmatter block.
 *
 * Only the scalar and folded-block forms these skills use are supported; a
 * richer parser would be a dependency for no gain here.
 */
function parseFrontmatter(source) {
	const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/.exec(source);
	if (match === null) return { data: {}, body: source };
	const data = {};
	let key = null;
	let folded = [];
	const flush = () => {
		if (key !== null && folded.length > 0) data[key] = folded.join(" ");
		key = null;
		folded = [];
	};
	for (const line of match[1].split(/\r?\n/)) {
		const entry = /^([A-Za-z][\w-]*):\s*(.*)$/.exec(line);
		if (entry !== null) {
			flush();
			const [, name, raw] = entry;
			const value = raw.trim();
			if (value === ">" || value === "|") {
				key = name;
				continue;
			}
			data[name] = value.replace(/^["']|["']$/g, "");
			continue;
		}
		if (key !== null && line.trim().length > 0) folded.push(line.trim());
	}
	flush();
	return { data, body: source.slice(match[0].length) };
}

async function loadSkill(dirName) {
	const path = join(SKILLS_DIR, dirName, "SKILL.md");
	const source = await readFile(path, "utf8");
	const { data, body } = parseFrontmatter(source);
	const name = data.name ?? dirName;
	if (!SKILL_NAME.test(name)) return undefined;
	const description = (data.description ?? "").trim();
	if (description.length === 0) return undefined;
	return {
		candidate: {
			name,
			description,
			whenToUse: data["argument-hint"],
			invocation: { modelInvocable: true, userInvocable: true },
			source: "custom",
			provider: PROVIDER_NAME,
			rank: CUSTOM_RANK,
			locator: { path, name, description }
		},
		body
	};
}

/** Provider over this plugin's bundled `skills/` directory. */
export class BundledSkillProvider {
	name = PROVIDER_NAME;
	#cache = new Map();

	async list() {
		let dirs;
		try {
			dirs = await readdir(SKILLS_DIR, { withFileTypes: true });
		} catch {
			return { candidates: [], complete: false };
		}
		const candidates = [];
		for (const dir of dirs) {
			if (!dir.isDirectory()) continue;
			const skill = await this.#load(dir.name);
			if (skill !== undefined) candidates.push(skill.candidate);
		}
		candidates.sort((left, right) => (left.name < right.name ? -1 : left.name > right.name ? 1 : 0));
		return candidates;
	}

	async get(candidate) {
		const skill = await this.#load(candidate.name);
		if (skill === undefined) return undefined;
		return {
			...skill.candidate,
			content: skill.body,
			resourceBase: { kind: "directory", path: dirname(skill.candidate.locator.path) }
		};
	}

	async #load(name) {
		const cached = this.#cache.get(name);
		if (cached !== undefined) return cached;
		const skill = await loadSkill(name);
		this.#cache.set(name, skill);
		return skill;
	}
}
