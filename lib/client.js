// dsh-ponytail-grill — Client half (web bundle, ModuleLoader CJS format).
//
// Two visible surfaces, both driven by services that already exist:
//
//   * `conversation.composer.dock` — the level badge. It reads the `ponytail`
//     session projection the Host half registers, so it needs no RPC to know
//     the current level, and it switches by running the host command
//     `ponytail-mode` through `ctx.remote.commands.execute`.
//   * `settings.section` — a page for the default level. That value lives in
//     the profile patch, not in a session, so there is no agent to scope a
//     remote to and this plugin ships no schemastery-backed Config. It reads
//     and writes over the plugin's own exact HTTP route instead.
//
// No JSX: the browser module table hands out React, and the bundle is plain JS.
window.__ModuleLoader__.load({
	id: 'dsh-ponytail-grill',
	factory: (require) => {
		const React = require('react');
		const h = React.createElement;

		const NS = 'ponytail-grill';
		const API = '/dsh-ponytail-grill/api';
		const LEVELS = ['lite', 'full', 'ultra', 'off'];

		const zh = {
			'badge.aria': 'Ponytail 档位',
			'badge.hint': '点击切换档位',
			'badge.failed': '切换失败',
			'level.lite': '轻',
			'level.full': '标准',
			'level.ultra': '极简',
			'level.off': '关闭',
			'settings.title': 'Ponytail',
			'settings.nav': 'Ponytail',
			'settings.default': '新会话默认档位',
			'settings.current': '本次会话档位',
			'settings.env': '环境变量 PONYTAIL_DEFAULT_MODE 正在覆盖该设置：',
			'settings.saved': '已保存',
			'settings.failed': '保存失败',
			'settings.loading': '读取中…'
		};
		const en = {
			'badge.aria': 'Ponytail level',
			'badge.hint': 'Click to switch level',
			'badge.failed': 'Switch failed',
			'level.lite': 'lite',
			'level.full': 'full',
			'level.ultra': 'ultra',
			'level.off': 'off',
			'settings.title': 'Ponytail',
			'settings.nav': 'Ponytail',
			'settings.default': 'Default level for new sessions',
			'settings.current': 'Level in this session',
			'settings.env': 'The PONYTAIL_DEFAULT_MODE environment variable overrides this setting: ',
			'settings.saved': 'Saved',
			'settings.failed': 'Save failed',
			'settings.loading': 'Loading…'
		};

		const T = {
			bg: 'var(--dsw-alias-bg-layer-1)',
			bg2: 'var(--dsw-alias-bg-layer-2)',
			border: 'var(--dsw-alias-border-l1)',
			label: 'var(--dsw-alias-label-primary)',
			dim: 'var(--dsw-alias-label-secondary)',
			brand: 'var(--dsw-alias-brand-primary)',
			error: 'var(--dsw-alias-state-error-primary)',
			success: 'var(--dsw-alias-state-success-primary)'
		};

		/** The pill in the composer dock. Reads the projection, writes a host command. */
		function PonytailBadge({ useProjection, sessionId, t, switchLevel }) {
			const projection = useProjection ? useProjection('ponytail') : undefined;
			const [error, setError] = React.useState(null);
			const [busy, setBusy] = React.useState(false);
			const mode = projection && projection.mode ? projection.mode : 'full';

			const next = LEVELS[(LEVELS.indexOf(mode) + 1) % LEVELS.length];
			const switchTo = () => {
				if (busy) return;
				setBusy(true);
				setError(null);
				Promise.resolve()
					.then(() => (sessionId ? switchLevel(sessionId, next) : 'no session'))
					.then((failure) => {
						setBusy(false);
						if (failure) setError(failure);
					});
			};

			return h(
				'span',
				{ style: { display: 'inline-flex', alignItems: 'center', gap: '6px' } },
				h(
					'button',
					{
						type: 'button',
						title: t('badge.hint'),
						'aria-label': t('badge.aria'),
						disabled: busy,
						onClick: switchTo,
						style: {
							display: 'inline-flex',
							alignItems: 'center',
							gap: '6px',
							padding: '2px 10px',
							borderRadius: '999px',
							border: '1px solid ' + (mode === 'off' ? T.border : T.brand),
							background: T.bg2,
							color: mode === 'off' ? T.dim : T.brand,
							font: 'inherit',
							fontSize: '12px',
							lineHeight: '18px',
							cursor: 'pointer'
						}
					},
					h('span', { 'aria-hidden': true }, '🐴'),
					h('span', null, 'Ponytail · ' + t('level.' + mode))
				),
				error === null
					? null
					: h('span', { role: 'status', title: error, style: { color: T.error, fontSize: '12px' } }, t('badge.failed'))
			);
		}

		/** The settings page. Talks to the plugin's own route; the value is not session-scoped. */
		function PonytailSettings({ t, api }) {
			const [state, setState] = React.useState(null);
			const [notice, setNotice] = React.useState(null);
			const [busy, setBusy] = React.useState(false);

			React.useEffect(() => {
				let alive = true;
				api('read').then((result) => {
					if (!alive) return;
					if (result.ok) setState(result.state);
					else setNotice({ kind: 'error', text: result.error });
				});
				return () => {
					alive = false;
				};
			}, []);

			const choose = (mode) => {
				if (busy || (state && state.defaultMode === mode)) return;
				setBusy(true);
				setNotice(null);
				api('set-default', { mode }).then((result) => {
					setBusy(false);
					if (!result.ok) {
						setNotice({ kind: 'error', text: result.error });
						return;
					}
					setState(result.state);
					setNotice({ kind: 'ok', text: t('settings.saved') });
				});
			};

			if (state === null) {
				return h('div', { style: { color: T.dim, fontSize: '13px' } }, notice ? notice.text : t('settings.loading'));
			}

			const rows = LEVELS.map((mode) =>
				h(
					'button',
					{
						key: mode,
						type: 'button',
						disabled: busy,
						onClick: () => choose(mode),
						'aria-pressed': state.defaultMode === mode,
						style: {
							padding: '4px 14px',
							borderRadius: '6px',
							border: '1px solid ' + (state.defaultMode === mode ? T.brand : T.border),
							background: state.defaultMode === mode ? T.bg2 : 'transparent',
							color: state.defaultMode === mode ? T.brand : T.label,
							font: 'inherit',
							fontSize: '13px',
							cursor: 'pointer'
						}
					},
					t('level.' + mode)
				)
			);

			return h(
				'div',
				{ style: { display: 'flex', flexDirection: 'column', gap: '10px', padding: '4px 0' } },
				h('div', { style: { color: T.label, fontSize: '13px', fontWeight: 600 } }, t('settings.default')),
				h('div', { style: { display: 'flex', gap: '8px', flexWrap: 'wrap' } }, rows),
				h(
					'div',
					{ style: { color: T.dim, fontSize: '12px' } },
					t('settings.current') + '：' + t('level.' + state.baseline)
				),
				state.envOverride === null
					? null
					: h('div', { style: { color: T.dim, fontSize: '12px' } }, t('settings.env') + state.envOverride),
				notice === null
					? null
					: h(
							'div',
							{
								role: 'status',
								style: { color: notice.kind === 'ok' ? T.success : T.error, fontSize: '12px' }
							},
							notice.text
						)
			);
		}

		return {
			inject: ['slots', 'locale', 'remote', 'remote.commands'],
			apply(ctx) {
				ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'ponytail-grill: dictionaries');
				const t = ctx.locale.bind(NS);

				const callApi = (op, extra) =>
					fetch(API, {
						method: 'POST',
						headers: { 'content-type': 'application/json' },
						body: JSON.stringify(Object.assign({ op }, extra || {}))
					})
						.then((response) => response.json())
						.catch((error) => ({ ok: false, error: String((error && error.message) || error) }));

				const switchLevel = (sessionId, mode) =>
					ctx.remote.commands.execute(sessionId, '/ponytail-mode ' + mode, []).then((result) => {
						if (!result.ok) return result.error.message + ' (' + result.error.code + ')';
						if (result.value === undefined) return 'unknown command: /ponytail-mode';
						if (result.value.kind === 'error') return result.value.text;
						return null;
					});

				// The dock passes `useProjection` and `sessionId`; the rest rides the closure.
				ctx.slots.inject('conversation.composer.dock', () =>
					ctx.slots.register(
						{ name: 'conversation.composer.dock', id: 'ponytail-mode', order: 5 },
						(props) => h(PonytailBadge, Object.assign({}, props, { t: t, switchLevel: switchLevel }))
					)
				);

				// The settings row receives no props at all, so it draws itself and
				// gets its tools through this slot's `inject` face.
				ctx.slots.inject('settings.section', () =>
					ctx.slots.register(
						{
							name: 'settings.section',
							id: 'ponytail-grill',
							order: 25,
							label: () => t('settings.nav'),
							locale: NS,
							inject: () => ({ t: t, api: callApi })
						},
						PonytailSettings
					)
				);
			}
		};
	}
});
