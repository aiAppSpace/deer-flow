import {
  branchThreadFromTurn,
  patchThreadMetadata,
  createThread,
  moveThreadToProject,
  compactThreadContext,
  searchThreadsByArchive,
} from "@/core/threads/api";
import {
  loadMCPConfig,
  updateMCPConfig,
  updateMCPServerState,
  createMCPServers,
  updateMCPServer,
  deleteMCPServer,
} from "@/core/mcp/api";
import { fetchFrontendExtensions } from "@/core/extensions/api";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fetch as fetcher } from "@/core/api/fetcher";
import { GatewayResponseError, throwGatewayApiError } from "@/core/api/errors";
import { loadModels } from "@/core/models/api";
import { loadMemory, clearMemory } from "@/core/memory/api";
import {
  listAgents,
  getAgent,
  createAgent,
  updateAgent,
  deleteAgent,
  exportAgentPackage,
  importAgentPackage,
} from "@/core/agents/api";
import {
  listProjects,
  getProject,
  createProject,
  patchProject,
  archiveProject,
  restoreProject,
  deleteProject,
  listProjectThreads,
} from "@/core/projects/api";
import {
  startWechatQRLogin,
  pollWechatQRLogin,
  cancelWechatQRLogin,
} from "@/core/channels/api";
import {
  installSkill,
  uploadSkillArchive,
  SkillRequestError,
} from "@/core/skills/api";

vi.mock("@/core/api/fetcher", () => ({ fetch: vi.fn() }));
vi.mock("@/core/config", () => ({ getBackendBaseURL: () => "/backend" }));
const request = vi.mocked(fetcher);
beforeEach(() => request.mockReset());

describe("Gateway API presentation preserves the current React contract", () => {
  it.each([
    [{ detail: "  backend detail  " }, "  backend detail  "],
    [{ detail: "" }, ""],
    [
      {
        detail: {
          code: "conflict",
          message: "Already running",
          params: { id: 2 },
        },
      },
      "Already running",
    ],
    [{ detail: { code: "conflict", message: "" } }, "Fallback"],
    [{ detail: [{ loc: ["body", "x"], msg: "Invalid field" }] }, "Fallback"],
    [{ detail: null }, "Fallback"],
    [null, "Fallback"],
  ])("renders %j without losing diagnostics", async (body, message) => {
    const text = JSON.stringify(body);
    const response = new Response(text, { status: 422 });
    const read = vi.spyOn(response, "text");
    const error = await throwGatewayApiError(response, "Fallback").catch(
      (e: unknown) => e,
    );
    expect(error).toBeInstanceOf(GatewayResponseError);
    expect(error).toMatchObject({
      message,
      status: 422,
      body,
      responseText: text,
    });
    expect(read).toHaveBeenCalledTimes(1);
  });
  it("keeps non-JSON upstream text in diagnostics and uses the domain fallback for API display", async () => {
    const error = await throwGatewayApiError(
      new Response("proxy unavailable", { status: 502 }),
      "Fallback",
    ).catch((e: unknown) => e);
    expect(error).toMatchObject({
      message: "Fallback",
      body: "proxy unavailable",
      responseText: "proxy unavailable",
      status: 502,
    });
  });
});

const domains: Array<[string, () => Promise<unknown>, string]> = [
  ["models", () => loadModels(), "Failed to load models: 502 Bad Gateway"],
  ["memory load", () => loadMemory(), "Failed to fetch memory: Bad Gateway"],
  ["memory clear", () => clearMemory(), "Failed to clear memory: Bad Gateway"],
  ["agents list", () => listAgents(), "Failed to load agents: Bad Gateway"],
  ["agent load", () => getAgent("reviewer"), "Agent 'reviewer' not found"],
  [
    "agent create",
    () => createAgent({ name: "reviewer" }),
    "Failed to create agent: Bad Gateway",
  ],
  [
    "agent update",
    () => updateAgent("reviewer", {}),
    "Failed to update agent: Bad Gateway",
  ],
  [
    "agent delete",
    () => deleteAgent("reviewer"),
    "Failed to delete agent: Bad Gateway",
  ],
  [
    "agent export",
    () => exportAgentPackage("reviewer"),
    "Failed to export agent: Bad Gateway",
  ],
  [
    "agent import",
    () => importAgentPackage({}),
    "Failed to import agent: Bad Gateway",
  ],
  ["projects list", () => listProjects(), "Failed to load projects."],
  ["project load", () => getProject("p"), "Failed to load project."],
  [
    "project create",
    () => createProject({ name: "Plan" }),
    "Failed to create project.",
  ],
  ["project update", () => patchProject("p", {}), "Failed to update project."],
  ["project archive", () => archiveProject("p"), "Failed to archive project."],
  ["project restore", () => restoreProject("p"), "Failed to restore project."],
  ["project delete", () => deleteProject("p"), "Failed to delete project."],
  [
    "project threads",
    () => listProjectThreads("p"),
    "Failed to load project threads.",
  ],
  [
    "WeChat start",
    () => startWechatQRLogin(),
    "Unable to start WeChat QR login",
  ],
  [
    "WeChat poll",
    () => pollWechatQRLogin("qr"),
    "Unable to check WeChat QR login",
  ],
  [
    "WeChat cancel",
    () => cancelWechatQRLogin("qr"),
    "Unable to cancel WeChat QR login",
  ],
];
it.each(domains)(
  "%s uses the same failed-response fallback",
  async (_name, action, message) => {
    request.mockResolvedValue(
      new Response("{}", { status: 502, statusText: "Bad Gateway" }),
    );
    await expect(action()).rejects.toMatchObject({ message });
  },
);

it.each(["", { message: "not a string detail" }, [{ msg: "invalid" }]])(
  "project CRUD does not display unsupported detail %j",
  async (detail) => {
    request.mockResolvedValue(Response.json({ detail }, { status: 422 }));
    await expect(createProject({ name: "Plan" })).rejects.toThrow(
      "Failed to create project.",
    );
  },
);
it("models displays a coded server message", async () => {
  request.mockResolvedValue(
    Response.json(
      {
        detail: { code: "not_available", message: "Model catalog unavailable" },
      },
      { status: 503 },
    ),
  );
  await expect(loadModels()).rejects.toThrow("Model catalog unavailable");
});
it("memory preserves an intentionally empty server detail", async () => {
  request.mockResolvedValue(Response.json({ detail: "" }, { status: 400 }));
  await expect(loadMemory()).rejects.toMatchObject({ message: "" });
});
it("skill installation displays the structured message", async () => {
  request.mockResolvedValue(
    Response.json(
      {
        detail: { message: "Archive is missing SKILL.md", skill_name: "demo" },
      },
      { status: 400 },
    ),
  );
  await expect(
    installSkill({ thread_id: "t", path: "/a.skill" }),
  ).resolves.toEqual({
    success: false,
    skill_name: "",
    message: "Archive is missing SKILL.md",
  });
});
it("skill security errors preserve message, name, findings and raw response", async () => {
  const finding = {
    rule_id: "test-rule",
    severity: "high",
    file: "SKILL.md",
    line: 2,
    message: "Disallowed instruction",
    remediation: "Remove it",
  };
  const body = {
    detail: {
      message: "Skill rejected",
      skill_name: "demo",
      findings: [finding, null],
    },
  };
  request.mockResolvedValue(Response.json(body, { status: 400 }));
  const error = await uploadSkillArchive(
    new File(["fixture"], "demo.skill"),
  ).catch((e: unknown) => e);
  expect(error).toBeInstanceOf(SkillRequestError);
  expect(error).toMatchObject({
    message: "Skill rejected",
    skillName: "demo",
    findings: [finding],
    body,
    status: 400,
  });
});
it("skill fallback omits a dangling colon when HTTP status text is absent", async () => {
  request.mockResolvedValue(Response.json({}, { status: 400 }));
  await expect(
    installSkill({ thread_id: "t", path: "/a.skill" }),
  ).resolves.toMatchObject({ message: "HTTP 400" });
});

const threadActions: Array<[string, () => Promise<unknown>, string]> = [
  [
    "branch",
    () => branchThreadFromTurn("t", { messageId: "m" }),
    "Failed to branch conversation.",
  ],
  [
    "metadata",
    () => patchThreadMetadata("t", {}),
    "Failed to update conversation.",
  ],
  ["create", () => createThread("t"), "Failed to create conversation."],
  [
    "move",
    () => moveThreadToProject("t", null),
    "Failed to move conversation.",
  ],
  ["compact", () => compactThreadContext("t"), "Failed to compact context."],
  [
    "search",
    () => searchThreadsByArchive({ archived: false, limit: 20, offset: 0 }),
    "Failed to load conversations.",
  ],
];
for (const [name, action, fallback] of threadActions) {
  it.each([
    "  exact detail  ",
    "",
    null,
    { message: "structured" },
    [{ msg: "invalid" }],
  ])(`thread ${name} preserves domain presentation for %j`, async (detail) => {
    const body = { detail };
    request.mockResolvedValue(Response.json(body, { status: 422 }));
    await expect(action()).rejects.toMatchObject({
      message: typeof detail === "string" && detail ? detail : fallback,
      status: 422,
      body,
    });
  });
  it(`thread ${name} keeps non-JSON text in diagnostics only`, async () => {
    request.mockResolvedValue(
      new Response("proxy unavailable", { status: 502 }),
    );
    await expect(action()).rejects.toMatchObject({
      message: fallback,
      responseText: "proxy unavailable",
      status: 502,
    });
  });
}
const mcpActions: Array<[string, () => Promise<unknown>, string]> = [
  ["load", () => loadMCPConfig(), "Failed to load MCP configuration"],
  [
    "replace",
    () => updateMCPConfig({ mcp_servers: {} }),
    "Failed to update MCP configuration",
  ],
  [
    "state",
    () => updateMCPServerState("s", false),
    "Failed to update MCP server",
  ],
  [
    "create",
    () => createMCPServers({ s: { enabled: true, description: "" } }),
    "Failed to add MCP servers",
  ],
  [
    "update",
    () => updateMCPServer("s", { enabled: true, description: "" }),
    "Failed to update MCP server",
  ],
  ["delete", () => deleteMCPServer("s"), "Failed to delete MCP server"],
];
for (const [name, action, fallback] of mcpActions) {
  it.each([
    "  exact detail  ",
    "",
    null,
    { message: "structured" },
    [{ msg: "invalid" }],
  ])(
    `MCP ${name} preserves string-only detail %j and admin classification`,
    async (detail) => {
      const body = { detail };
      request.mockResolvedValue(Response.json(body, { status: 403 }));
      await expect(action()).rejects.toMatchObject({
        message: typeof detail === "string" ? detail : fallback,
        status: 403,
        body,
        isAdminRequired: true,
      });
    },
  );
}
it.each(["Backend internal text", { message: "structured" }, null])(
  "extensions preserve their status-only display for %j",
  async (detail) => {
    const body = { detail };
    request.mockResolvedValue(Response.json(body, { status: 503 }));
    await expect(fetchFrontendExtensions()).rejects.toMatchObject({
      message: "Frontend extensions unavailable (503)",
      status: 503,
      body,
    });
  },
);
