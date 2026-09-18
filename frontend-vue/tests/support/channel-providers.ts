/*
  【文件职责】     IM 渠道 provider 的共享夹具：八个 provider 各站一种状态。
  【架构位置】     测试基础设施（**两个套件共用**）
  【主要导出】     CHANNEL_PROVIDERS
  【依赖关系】     无
  【边界与注意】   **它住在 tests/support/ 而不是 e2e-parity 里，是因为有两个套件要用它**
                   （2026-09-18 第三十九轮）。

                   此前只有对照场景 `channels` 喂这份夹具，而
                   `tests/e2e/settings-narrow-screen.spec.ts` 用的是共享 mock 的默认
                   `{ enabled: false, providers: [] }`——**那条门禁量的是一块空面板**，
                   于是「channels 分区在 360px 上装得下」这句话十轮以来只对空面板成立。
                   装上 provider 之后实测：面板宽 297（本仓）/ 500（上游），
                   而那一格只有 278——`panelOverflow` 分别是 +19 与 +222。

                   **抄第二份就会漂**：两个套件量的必须是同一屏，否则「门禁绿了」
                   只说明它量的那一份夹具没事。e2e-mock 不反向依赖 e2e-parity
                   （`tests/guards/e2e-suite-contract.test.ts` 管着套件边界），
                   所以共用的东西放在这一层。
*/

/** 与 frontend/tests/e2e/channels.spec.ts 同一份 provider 列表。 */
/*
  八个 provider 各站一种状态，而不是八份同样的「已连接」。

  同形夹具下，侧栏里所有按钮的文案都一样，于是「连接态怎么算」这条判据整段测不到——
  把 isConnected 写死成 true 也一样绿。这里让每一支分支各有一行：enabled=false 的
  整行不该渲染；configured=false 走「先填运行时配置」；connection_status 非 connected
  的显示「连接」；**已连接但 runtime 不可用**的也必须显示「连接」——最后这条是
  provider.connection_status 与 unavailable_reason 的交叉点，两边的判据都是
  `!unavailable_reason && connection_status === "connected"`，少一半就红。

  Telegram 与 DingTalk 仍然可见，因为它们是 settle 锚点与几何锚点；这里顺手让
  Telegram 站在「未连接」一侧，DingTalk 站在「已连接」一侧，几何锚点于是同时覆盖
  两种按钮变体（secondary 与 outline+勾）的行高与行内布局。
*/
export const CHANNEL_PROVIDERS = [
  { provider: "buzz", display_name: "Buzz", auth_mode: "binding_code" },
  {
    provider: "telegram",
    display_name: "Telegram",
    auth_mode: "deep_link",
    connection_status: "not_connected",
  },
  { provider: "slack", display_name: "Slack", auth_mode: "binding_code" },
  {
    provider: "discord",
    display_name: "Discord",
    auth_mode: "binding_code",
    enabled: false,
    configured: false,
    connectable: false,
    connection_status: "not_connected",
  },
  {
    provider: "feishu",
    display_name: "Feishu",
    auth_mode: "binding_code",
    configured: false,
    connectable: false,
    connection_status: "not_connected",
  },
  { provider: "dingtalk", display_name: "DingTalk", auth_mode: "binding_code" },
  {
    provider: "wechat",
    display_name: "WeChat",
    auth_mode: "binding_code",
    connectable: false,
    unavailable_reason: "WeChat runtime is not running.",
  },
  {
    provider: "wecom",
    display_name: "WeCom",
    auth_mode: "binding_code",
    connection_status: "revoked",
  },
].map((provider) => ({
  enabled: true,
  configured: true,
  connectable: true,
  connection_status: "connected",
  unavailable_reason: null,
  credential_fields: [
    { name: "token", label: "Token", type: "password", required: true },
  ],
  ...provider,
}));
