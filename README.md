# dsh-ponytail-grill

[Ponytail](https://github.com/DietrichGebert/ponytail) (laziest solution that
works) and Grill Me (Socratic questioning) ported to DSH as one host plugin.

Zero runtime dependencies. No `@deepseek-ai/*` imports, so it cannot break when
host internals move.

The `ponytail*` skills are shipped verbatim from upstream (`v4.10.0`); only the
DSH integration is new. `grill-me` was rewritten as original text — its earlier
revisions descended from an unlicensed intermediate. See [LICENSE](LICENSE) for
the full record.

A host half and a Client half in one package: the host registers the skills, the
prompt section, the mode commands, a session projection and one HTTP route; the
Client adds a mode badge and a grill chip under the composer plus a settings page.

## What it registers

Host half:

| Piece | Mechanism | Why |
| --- | --- | --- |
| 7 skills | `ctx.skills.registerProvider()` over the bundled `skills/` dir | `skill("ponytail")`, `/ponytail-review` and the catalog all work without depending on which user-level skill root the host scans |
| Always-on ladder | `ctx.systemPrompt.section()` at order `150` | Written once at activation, never rewritten, so the request prefix stays cacheable |
| `/ponytail lite\|full\|ultra\|off` | one `agent/pre-step` listener | Appends a `<system-reminder>` instead of rewriting the prompt — a rewrite would invalidate the cached prefix on every switch |
| `ponytail-mode`, `ponytail-default` | `ctx.commands.register()` | Gives the GUI a way to switch without typing. `/ponytail` itself stays unregistered, or the command table would swallow the gesture before the pre-step reader sees it |
| `ponytail` projection | `ctx.inject(["sessionProjections"], …)` | Folds the mode out of the transcript so the badge shows real state with no extra RPC |
| One exact route | `ctx.inject(["webServer"], …)` on `/dsh-ponytail-grill/api` | The settings page is not bound to a session, so it has no `agentId` for a remote to scope to |

Client half (`lib/client.js`):

| Piece | Slot | Reads / writes |
| --- | --- | --- |
| Mode badge | `conversation.composer.dock` (order 5) | reads `useProjection("ponytail")`, clicks through `ctx.remote.commands.execute(sessionId, "/ponytail-mode X")` |
| Grill chip | `conversation.composer.dock` (order 6) | sends `/grill-me` as a queued prompt through `ctx.remote.session.prompt` |
| Settings page | `settings.section` (order 25) | reads and writes `defaultMode` and `showInComposer` through the plugin's own HTTP route |

The badge renders nothing until the projection reports a mode, and the settings
row draws its own label — `settings.section` projects no `label` and passes no
owner props beyond `close`.

The grill chip exists because a skill has no command-table entry: `/grill-me` is
a *gesture* the skill tool reads out of user input, so the chip sends that exact
text as an ordinary prompt rather than calling a command. Typing `/grill-me`
yourself does the same thing.

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

## Grill Me

`grill-me` is a skill, not a command, so it has no `/` entry in the command
table and no GUI of its own. Three ways to start it:

- type `/grill-me` anywhere in a message — the skill tool reads that gesture out
  of your input and loads the skill;
- click the **Grill** chip under the composer, which sends exactly that text;
- just ask to be questioned ("帮我挑毛病", "grill me"), since the skill is
  model-invocable too.

Once loaded it asks one multiple-choice question at a time through
`ask_user_question` and ends with a summary of the decisions.

## In the GUI

Three visible surfaces, all from the Client half:

- **Mode badge** under the composer. It shows the session's live mode and cycles
  `lite → full → ultra → off → lite` on click. The click runs
  `/ponytail-mode <next>` through `ctx.remote.commands.execute`, so the badge and
  a typed gesture go down the same path; a failure shows inline next to the badge
  instead of disappearing.
- **Grill chip** next to the badge. Clicking it queues `/grill-me` as a normal
  user prompt, which the skill tool turns into an interview driven by
  `ask_user_question`.
- **Settings page** ("Ponytail") in Settings. It shows the effective baseline,
  lets you change `defaultMode`, and carries one checkbox —
  **show the level badge and the grill chip below the composer** — for when you
  want both dock entries out of the way. Both fields are written back into the
  profile patch through the Config Editor.

The checkbox is the one thing the badge cannot read off the transcript: it is
profile state, not session state, so the settings page seeds a module-level cell
that the badge and the chip subscribe to. Unchecking it hides both immediately;
a reload reads the stored value back.

If `PONYTAIL_DEFAULT_MODE` is set, the page shows it as an override and changing
`defaultMode` will not take effect until that variable is unset.

## Configuration

```yaml
- id: ponytail-grill
  name: dsh-ponytail-grill
  config:
    defaultMode: full   # lite | full | ultra | off
    showInComposer: true # show the badge and the grill chip under the composer
```

`PONYTAIL_DEFAULT_MODE` overrides `defaultMode`. An unrecognized value in either
place falls back to `full` rather than throwing. With `off` as the baseline no
ladder section is registered at all, so the prompt stays clean until you ask.

The settings page writes both fields. The plugin declares no schemastery-backed
`Config`, so the Settings service's generic form does not list it — the page is
its own, and it persists through `configEditor.edit()` on this plugin's profile
entry.

## Layout

```
index.js              apply(): provider + prompt section + pre-step + collaborators
lib/mode.js           command parsing, ladder text, mode-state fold
lib/skills.js         frontmatter parser + skill provider
lib/projection.js     the `ponytail` session projection (transcript → live mode)
lib/commands.js       /ponytail-mode and /ponytail-default host commands
lib/http.js           the exact route the settings page talks to
lib/client.js         Client half: mode badge + grill chip + settings page
skills/<name>/SKILL.md   seven skills: `ponytail*` verbatim, `grill-me` rewritten
test/mode.test.js     node --test
test/projection.test.js  node --test
test/client.test.js   node --test (slots, click paths, dictionaries)
```

## Install

```
plugin_manager install_bundle(target: "<absolute path to this directory>")
```

The install adds this package to the profile's `dsh.profile.bundles` and to its
`dependencies` as a `link:` entry, then applies `cordis.patch.yml`. **Bundle
membership is what makes the Client half load**: the host only serves
`<id>/client.js` for packages listed in `bundles`, so a package that is merely a
dependency shows up in the host tree with no badge and no settings page. Installing
needs a restart of DSH for the Client half to appear.

## Test

```
node --test
```

## Deviations from upstream

- `ponytail-help`'s Update section (Claude Code's `/plugin`) is dead weight
  here; the file is kept verbatim so it stays diffable against upstream.
- Upstream reads `~/.config/ponytail/config.json`. Not ported: a plugin config
  field plus one env var covers the same need without a file-format contract.
