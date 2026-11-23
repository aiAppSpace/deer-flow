import type { AgentPackage } from "./types";

/** Download the Gateway's portable definition, never a local Agent/session snapshot. */
export function handOffAgentPackageDownload(
  agentPackage: AgentPackage,
  name: string,
) {
  const blob = new Blob([JSON.stringify(agentPackage, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `${name}.deerflow-agent.json`;
  try {
    document.body.append(anchor);
    anchor.click();
  } finally {
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 0);
  }
}

export function packageSuggestedName(document: unknown) {
  if (!document || typeof document !== "object") return "";
  const agent: unknown = Reflect.get(document, "agent");
  return agent &&
    typeof agent === "object" &&
    typeof Reflect.get(agent, "name") === "string"
    ? String(Reflect.get(agent, "name"))
    : "";
}
