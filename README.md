# dsh-ponytail-grill

[Ponytail](https://github.com/DietrichGebert/ponytail) (laziest solution that
works) and Grill Me (Socratic questioning) ported to DSH as one host plugin.

Zero runtime dependencies. No `@deepseek-ai/*` imports, so it cannot break when
host internals move.

Both skills are shipped verbatim from their upstream releases (ponytail
`v4.10.0`, `dsh-grill-me@0.1.0`); only the DSH integration is new. See
[LICENSE](LICENSE) for attribution — `grill-me` has a chain of ancestry worth
reading before you redistribute.

## What it registers

| Piece | Mechanism | Why |
| --- | --- | --- |
| 7 skills | `ctx.skills.registerProvider()` over the bundled `skills/` dir | `skill("ponytail")`, `/ponytail-review` and the catalog all work without depending on which user-level skill root the host scans |
| Always-on ladder | `ctx.systemPrompt.section()` at order `150` | Written once at activation, never rewritten, so the request prefix stays cacheable |
| `/ponytail lite\|full\|ultra\|off` | one `agent/pre-step` listener | Appends a `<system-reminder>` instead of rewriting the prompt — a rewrite would invalidate the cached prefix on every switch |

Skills: `ponytail`, `ponytail-audit`, `ponytail-debt`, `ponytail-gain`,
`ponytail-help`, `ponytail-review`, `grill-me`.

## Switching mode

Type any of these in a normal message:

- `/ponytail lite` — build what's asked, name the lazier alternative
- `/ponytail full` — the ladder enforced (default)
- `/ponytail ultra` — YAGNI extremist, deletion over addition
- `/ponytail off` — ponytail is off for the rest of the session
- `stop ponytail` / `normal mode` — same as `off`

`/ponytail-help`, `/ponytail-review` and friends are *not* mode switches; they
load their skill instead.

The mode lives in the transcript as `<ponytail-mode value="..."/>` inside the
injected reminder, so it survives compaction and needs no per-session state map.

## Configuration

```yaml
- id: ponytail-grill
  name: dsh-ponytail-grill
  config:
    defaultMode: full   # lite | full | ultra | off
```

`PONYTAIL_DEFAULT_MODE` overrides `defaultMode`. An unrecognized value in either
place falls back to `full` rather than throwing. With `off` as the baseline no
ladder section is registered at all, so the prompt stays clean until you ask.

## Layout

```
index.js              apply(): provider + prompt section + pre-step listener
lib/mode.js           command parsing, ladder text, mode-state fold
lib/skills.js         frontmatter parser + skill provider
skills/<name>/SKILL.md   the seven skills, verbatim from upstream
test/mode.test.js     node --test
```

## Install

```
plugin_manager install_bundle(target: "<absolute path to this directory>")
```

## Test

```
node --test
```

## Deviations from upstream

- `ponytail-help`'s Update section (Claude Code's `/plugin`) is dead weight
  here; the file is kept verbatim so it stays diffable against upstream.
- Upstream reads `~/.config/ponytail/config.json`. Not ported: a plugin config
  field plus one env var covers the same need without a file-format contract.
