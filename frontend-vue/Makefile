# frontend-vue developer entrypoint. package.json intentionally contains only postinstall.

.PHONY: help install dev build preview lint format format-check typecheck typecheck-core test verify asset-budget \
	e2e-install e2e-preflight e2e e2e-auth e2e-visual e2e-infra e2e-proxy-options e2e-stream \
	e2e-protocol e2e-real e2e-scheduled e2e-channels e2e-agents e2e-settings e2e-shell \
	e2e-browser e2e-external e2e-parity e2e-parity-auth e2e-mock e2e-backend e2e-list \
	proxy-security audit docker-build container-smoke \
	upstream-drift upstream-accept dom-parity icon-parity parity-accept parity-auth-accept \
	i18n-check i18n-diff i18n-unused i18n-source-check i18n-refresh \
	gen-api-types gen-api-types-check gen-contract-constants gen-contract-constants-check \
	consumer-check standalone-check standalone-sim coverage

PYTHON ?= python3
PNPM = $(PYTHON) ../scripts/pnpm.py --dir frontend-vue
EXEC = $(PNPM) exec
E2E_EXEC = node scripts/with-loopback-no-proxy.mjs -- $(EXEC)
DEV_PORT ?= 3100
# 每个 e2e 套件一个前端端口 + 需要真实后端的再加一个 Gateway 端口，
# 这样多个套件可以并行跑而不抢端口。默认值同时写在各自的 config 里。
E2E_PORT ?= 3101
E2E_PROXY_OPTIONS_PORT ?= 3102
E2E_STREAM_PORT ?= 3104
E2E_AUTH_PORT ?= 3108
E2E_VISUAL_PORT ?= 3109
E2E_SCHEDULED_PORT ?= 3110
E2E_CHANNELS_PORT ?= 3111
E2E_AGENTS_PORT ?= 3112
E2E_SETTINGS_PORT ?= 3113
E2E_SHELL_PORT ?= 3114
# parity 一个套件要起三个服务：Gateway + Vue + 兄弟 React。
E2E_PARITY_PORT ?= 3115
E2E_PARITY_REACT_PORT ?= 3116
E2E_PARITY_GATEWAY_PORT ?= 8021
IMAGE ?= deer-flow-frontend-vue:ci

help:
	@echo "frontend-vue commands:"
	@echo "  make dev / build / preview     Nuxt lifecycle (dev port $(DEV_PORT))"
	@echo "  make verify                    lint + format + types + unit + i18n + OpenAPI"
	@echo "                                 + contracts + standalone + build"
	@echo ""
	@echo "  E2E 套件（一个套件 = 一种后端拓扑，名字说的是测什么）:"
	@echo "  make e2e                       product contracts on a mocked Gateway (default gate)"
	@echo "  make e2e-auth                  auth UI contracts (frontend built with auth on)"
	@echo "  make e2e-visual                product visual snapshots"
	@echo "  make e2e-infra                 same-origin proxy and __m0 test pages"
	@echo "  make e2e-proxy-options         proxy with streaming forwarding disabled"
	@echo "  make e2e-stream                real chunked SSE: heartbeat, resume cursor, gap"
	@echo "  make e2e-protocol              run-protocol state machine on a real Gateway"
	@echo "  make e2e-real                  render, multi-run order, artifact write"
	@echo "  make e2e-scheduled             scheduled tasks against real Gateway/SQLite"
	@echo "  make e2e-channels              channel connection lifecycle (auth on)"
	@echo "  make e2e-agents                custom agent creation and settings (auth on)"
	@echo "  make e2e-settings              settings with a supported and a degraded Gateway"
	@echo "  make e2e-shell                 workspace shell and workspace-changes (auth on)"
	@echo "  make e2e-browser               browser panel against a real Chromium backend"
	@echo "  make e2e-external              WebSocket and OIDC; needs the backend browser extra"
	@echo "  make e2e-parity                React and Vue on one replay Gateway; needs ../frontend"
	@echo "  make e2e-mock                  every suite that needs no backend process"
	@echo "  make e2e-backend               every suite that needs a real Gateway"
	@echo "  make e2e-list                  collect every suite and print its test count"
	@echo ""
	@echo "  make coverage                  unit-test line coverage (diagnostic, not a gate)"
	@echo "  make asset-budget              build and enforce raw/gzip client asset budgets"
	@echo "  make container-smoke           non-root /health / SIGTERM production image smoke"
	@echo "  make upstream-drift            report what ../frontend changed since the marker"
	@echo "  make upstream-accept           advance the reviewed-upstream marker to HEAD"
	@echo "  make dom-parity                diff React vs Vue semantic DOM (needs both apps running)"
	@echo "  make icon-parity               diff React vs Vue icon glyphs/sizes and tooltips (source scan)"
	@echo "  make parity-accept             re-record the checked-in parity difference list"
	@echo "  make typecheck-core            standalone tsc for packages/agent-core"
	@echo "  make gen-api-types             regenerate app/core/api/types.gen.ts from the snapshot"
	@echo "  make gen-contract-constants    regenerate backend contract constants from contracts/*.json"
	@echo "  make consumer-check            clean-install packages/agent-core into a temp consumer"
	@echo "  make standalone-check          P0 gate: no cross-app reference to ../frontend"
	@echo "  make standalone-sim            P0 gate (dynamic): move ../frontend away and run"
	@echo "  make i18n-check                dictionary health: locales in sync, no key lost"
	@echo "  make i18n-diff / i18n-unused   exact key and audited-unused drift against baseline"
	@echo "  make i18n-source-check         reject core English literals in product Vue SFCs"

install:
	$(PNPM) install

dev:
	$(EXEC) nuxt dev --port $(DEV_PORT)

build:
	$(EXEC) nuxt build

preview:
	PORT=$(DEV_PORT) HOST=127.0.0.1 $(EXEC) nuxt preview

lint:
	$(EXEC) eslint .

format:
	$(EXEC) prettier --write .

format-check:
	$(EXEC) prettier --check .

typecheck:
	$(EXEC) vue-tsc --noEmit

# packages/agent-core 走**自己的** tsconfig，不走 vue-tsc。
#
# 这不是洁癖，是本窗口实测出来的洞：`.nuxt/tsconfig.app.json` 的 include 只有
# app/** 与 tests/nuxt/**，`packages/agent-core/src/**` 一行都不在里面——
# 也就是说 M2 的整个交付物在加这条之前从未被类型检查过（首次运行 6 条错误）。
# 顺带满足 08 §54：包要能在自己的 tsconfig 下独立 typecheck，
# 否则「整包搬给别的项目」这个卖点没有任何机器证据。
typecheck-core:
	$(EXEC) tsc --noEmit -p packages/agent-core
	$(EXEC) tsc --noEmit -p packages/agent-core/tsconfig.test.json

# REST 信封类型（02 §340 / 04 §267）。生成源是**签入的**快照，不是活着的 Gateway：
# 让 CI 去 curl 一个跑着的后端，门禁就会随部署状态变色。
# check 检的是幂等性——同一份快照生成两次必须一致。刷新快照的命令见
# baseline/openapi.snapshot.README.md。OpenAPI 不承担 SSE schema（06 原话）。
gen-api-types:
	node scripts/gen-api-types.mjs

gen-api-types-check:
	node scripts/gen-api-types.mjs --check

# 上游同步 L1：后端契约（contracts/*.json）在 Vue 侧只有一份真相。
gen-contract-constants:
	node scripts/gen-contract-constants.mjs

gen-contract-constants-check:
	node scripts/gen-contract-constants.mjs --check

# 08 §54 的可移植性验收。打真包 → 临时目录 clean install → typecheck → 跑一次最小
# session。**不进 verify**：它要联网装 typescript/esbuild，而 verify 必须能离线跑。
# 里程碑收口与改动 packages/agent-core/package.json 时必须跑一次。
consumer-check:
	node scripts/consumer-check.mjs

# 平替验收判据。frontend-vue 必须能在 ../frontend 不存在时完成
# install / build / test / e2e，否则「用 Vue 替换 React」这件事不成立。
# BLOCKING 已归零并接进 verify：任何新的跨应用引用都会当场变红。
standalone-check:
	node scripts/standalone-check.mjs

# 同一条判据的**动态**那一半：真把 ../frontend 移出 checkout 跑一遍，再移回来。
#
# 为什么两条都要：`standalone-check` 是静态证明（没有代码级跨应用引用），
# wave 83 之前它已经 0 了几十轮，而第一次真做实验时 `make verify` 当场红——
# `upstream-key-coverage.test.ts` 的 `describe.skipIf` 工厂函数照样执行。
#
# **有意不进 verify**：它动文件系统，而且不能与任何构建/测试并发。它是收工清单
# 的一项，和 e2e-backend / asset-budget 同级。
standalone-sim:
	node scripts/standalone-sim.mjs

test:
	$(EXEC) vitest run

# 覆盖率**有意不进 verify**：把它当门禁会逼着写凑数的测试，而这个数本身也只看得见
# 单测进程里执行的代码——layouts、Nitro 路由、app.vue 全靠 e2e 覆盖，在这里恒为 0。
# 它是**诊断工具**，用来找「哪一块没人测」，不是及格线。
#
# provider 的版本必须跟 vitest 走：裸 `pnpm add @vitest/coverage-v8` 会装最新大版本
# （实测装成 5.0.0 配 vitest 4.1.10），报的是 `coverageFilesDirectory is required`
# ——一句完全看不出是版本问题的错。`tests/guards/tooling-contracts.test.ts` 钉住这一条。
coverage:
	$(EXEC) vitest run --coverage.enabled --coverage.provider=v8 \
		--coverage.include='app/**' --coverage.include='server/**' \
		--coverage.include='packages/*/src/**' \
		--coverage.reporter=text-summary --coverage.reporter=html \
		--coverage.reportsDirectory=coverage
	@echo "HTML 报告：frontend-vue/coverage/index.html"

# 词典体检（06 §M1 1d）。只读签入的词典与基线，不碰 git 历史，所以能进 verify。
# 基线必须趁词典还是上游原样时取——等 M4b 重写完再补，「这次漏了哪个 key」就无从判断。
i18n-check:
	node scripts/i18n-manager.mjs check

i18n-diff:
	node scripts/i18n-manager.mjs diff

i18n-unused:
	node scripts/i18n-manager.mjs unused

i18n-source-check:
	node scripts/i18n-source-guard.mjs

i18n-refresh:
	node scripts/i18n-manager.mjs --refresh

# gen-contract-constants-check 是上游同步 L1：后端 contracts/*.json 变了就红。
# 它是三层同步方案里唯一阻断的一层——那是上游变更能直接让 Vue 功能损坏的路径。
verify: lint format-check typecheck typecheck-core test i18n-check i18n-source-check gen-api-types-check gen-contract-constants-check standalone-check build

# The build dependency makes the gate inspect the current checkout rather than stale .output.
asset-budget: build
	node scripts/asset-budget.mjs

e2e-install:
	$(EXEC) playwright install --with-deps chromium

# 每个 e2e 目标的前置检查。@playwright/test 是本工作区的正常 devDependency，
# 前置检查也只看自己。
e2e-preflight:
	@test -f node_modules/@playwright/test/package.json \
		|| { echo "@playwright/test 未安装：先运行 make install"; exit 1; }

# 一个套件 = 一份 config = 一种后端拓扑。名字说的是**测什么**，
# 不是迁移阶段——套件之间不能合并的原因写在各自 config 的文件头里。
define run_suite
	@$(MAKE) --no-print-directory e2e-preflight
	$(E2E_EXEC) playwright test -c playwright.$(1).config.ts
endef

# ── 只需要 Nuxt preview 的套件（page.route() mock Gateway）────────────────
# 主 config 用 Playwright 的默认文件名，所以不走 run_suite 的 playwright.<id>.config.ts 规则。
e2e:
	@$(MAKE) --no-print-directory e2e-preflight
	$(E2E_EXEC) playwright test

e2e-auth:
	$(call run_suite,auth)

e2e-visual:
	$(call run_suite,visual)

# ── 需要本地 stub server 的基础设施套件 ────────────────────────────────
e2e-infra:
	$(call run_suite,infra)

e2e-proxy-options:
	$(call run_suite,proxy-options)

e2e-stream:
	$(call run_suite,stream)

# ── 需要真实 Gateway 的套件（各自的 seed 与 auth 模式见 config）──────────
e2e-protocol:
	$(call run_suite,protocol)

e2e-real:
	$(call run_suite,real)

e2e-scheduled:
	$(call run_suite,scheduled)

e2e-channels:
	$(call run_suite,channels)

e2e-agents:
	$(call run_suite,agents)

e2e-settings:
	$(call run_suite,settings)

e2e-shell:
	$(call run_suite,shell)

e2e-browser:
	$(call run_suite,browser)

# 需要后端的 browser extra 与自带 IdP。
e2e-external:
	$(call run_suite,external)

# 唯一需要**兄弟应用**的套件：React 与 Vue 同时架在一个 replay Gateway 上。
# 因此它不进任何聚合入口——本仓的 install/build/test/e2e 都不依赖 ../frontend
# （见 make standalone-check）。frontend/ 缺席时 React 不启动，用例整组跳过。
e2e-parity:
	$(call run_suite,parity)

# 开着鉴权才到得了的那几屏（登录、安装向导）。与 e2e-parity 分开是因为
# auth 模式是构建期决定的，一个 preview 只能是一种——见该 config 的文件头。
e2e-parity-auth:
	$(call run_suite,parity-auth)

# 刷新对照差异清单。
#
# **它现在会判一件事：台账不许变长。** accept 时把新旧逐行比对，只要出现一行
# 基线里没有的，就拒写并把那些行打出来（判据是集合包含，不是行数——修好一条、
# 同时新坏一条，行数不变而台账里多了一行没人看过的东西）。确实要接受就
# `PARITY_ACCEPT_GROW=1 make parity-accept`，并在提交说明里写清楚每一行是什么。
#
# 这道闸门之前只是一句散文（「否则这个目标会变成把回归洗白的按钮」），
# 没有任何机器在守；wave 85 补上。判据的算法在
# tests/e2e-parity/support/ledger.ts，单测在 tests/unit/parity/ledger.test.ts
# ——台账 0 行时真跑 accept 永远走不到那条分支，所以它只能在单测里打。
#
# 剩下那一半仍然是人的事：**每一条变化是修好了还是新坏了，得逐条看清楚。**
parity-accept:
	@$(MAKE) --no-print-directory e2e-preflight
	PARITY_ACCEPT=1 $(E2E_EXEC) playwright test -c playwright.parity.config.ts diff.spec.ts

parity-auth-accept:
	@$(MAKE) --no-print-directory e2e-preflight
	PARITY_ACCEPT=1 $(E2E_EXEC) playwright test -c playwright.parity-auth.config.ts diff.spec.ts

# ── 聚合入口 ────────────────────────────────────────────────────────────
# 不需要任何后端进程，CI 的主门禁。
#
# e2e-visual **不在**这里：截图基线目前只有 `-darwin` 一份，而 CI 跑 Linux，
# 两边的字体栅格化不同。要把它接进 CI，得先生成 `-linux` 基线并签入。在那之前
# 它是本机门禁——这也正是它悄悄红了三个提交没人发现的原因（旧 CI 只跑
# @visual-seed，从没跑过产品截图）。
# 「基线平台集合 == 门禁运行平台集合」现在由
# tests/guards/visual-baseline-platforms.test.ts 双向守着，具体解除步骤写在
# 那个文件的头注释里。
e2e-mock: e2e e2e-auth e2e-infra e2e-proxy-options e2e-stream

# 需要 backend 的 uv 环境。
e2e-backend: e2e-protocol e2e-real e2e-scheduled e2e-channels e2e-agents e2e-settings e2e-shell e2e-browser

e2e-list:
	@$(MAKE) --no-print-directory e2e-preflight
	@for c in playwright*.config.ts; do \
		printf '%-38s ' "$$c"; \
		$(E2E_EXEC) playwright test -c "$$c" --list --reporter=line 2>&1 | grep -oE 'Total: [0-9]+ test' || echo '收集失败'; \
	done

proxy-security: e2e-infra e2e-proxy-options
	$(EXEC) vitest run tests/unit/config/routes.test.ts tests/unit/server/gateway-proxy.test.ts

# 上游同步 L2：报告 ../frontend 自 marker 以来改了什么，供人工决定是否在 Vue 跟进。
# 顾问性质，不阻断构建；frontend/ 不在 checkout 里时安静跳过。
# 取代了原来的 SHA-256 文件护城河——那套机制比对的是「Vue 副本 vs 冻结基线」，
# 因此 React 前进时结构上看不见，实测已让两个 lark 文件在 CI 全绿时过期。
upstream-drift:
	node scripts/upstream-drift.mjs

upstream-accept:
	node scripts/upstream-drift.mjs --accept

# 语义 DOM 对照。需要两个 app 都在跑，所以是顾问命令而不是门禁：
#   React  cd ../frontend && pnpm build && PORT=3000 pnpm start
#   Vue    make build && PORT=3100 HOST=127.0.0.1 pnpm exec nuxt preview
# 端口可用 DOM_PARITY_REACT_BASE / DOM_PARITY_VUE_BASE 覆盖。
# 为什么不用词典比对：见 scripts/dom-parity.mjs 的文件头。
dom-parity:
	node scripts/dom-parity.mjs

# 图标字形 / 尺寸 / tooltip 的对照报告。**只读源码，不用把两个应用跑起来**——
# 这三样都不进可访问性树，dom-parity 的几何档也只在两边同时跑起来、
# 且那个元素当时可见时才够得着。顾问性质：上游缺席时打印一行退出 0。
icon-parity:
	node scripts/icon-parity.mjs

# `make audit` **当前预期是红的**，2026-09-04（wave 66）逐条查过可达性，结论记在这里，
# 免得下一个人看到 "14 vulnerabilities" 再做一遍同样的分析。
#
#   js-yaml（high，!!omap 二次方 CPU）—— **0 个客户端 chunk**，构建期依赖，运行时无关。
#   nanoid（high，自定义生成器可能死循环）—— 1 个 chunk，但漏洞要求传入自定义生成器，
#           本仓没有这种用法。
#   lodash-es（high，`_.template` 代码注入）—— 5 个 chunk，来路是
#           mermaid → @mermaid-js/parser → langium → chevrotain → @chevrotain/gast。
#           漏洞要求把攻击者可控的模板串喂给 `_.template`，chevrotain 不这么用。
#   mermaid（moderate，radar 图 DoS，>=11.6.0 <11.16.1）—— **有意不升**，见下。
#
# **mermaid 有意锁在 11.12.2，不跟着 advisory 升。** 那不是保守，是判据：
# 上游 React 侧的 mermaid 来自 `@streamdown/mermaid → streamdown → mermaid@^11.12.2`，
# 实际解析成 **11.12.2**；本仓精确锁同一个版本，**为的是两个应用画出同一张图**。
# mermaid 的渲染结果直接进对照取样面（`thread-history-mermaid` 是台账里的场景），
# 单边升级会让台账立刻分叉。要升就得两边一起升，而 React 那边的版本由被 vendored 的
# streamdown 的依赖树决定——覆盖它等于从上游的锁文件上分叉，正是本仓一直在避免的漂移。
# **这条的正确归属方是上游 streamdown / DeerFlow，不是这个 fork。**
# 该 advisory 是「渲染恶意 radar 图时卡住自己这一个标签页」，而图的来源是 agent 输出。
audit:
	$(PNPM) audit --audit-level moderate --registry https://registry.npmjs.org

docker-build:
	docker build --file Dockerfile --tag $(IMAGE) ..

container-smoke: docker-build
	./scripts/container-smoke.sh "$(IMAGE)"
