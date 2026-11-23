import { afterEach, beforeEach, expect, test, rs } from "@rstest/core";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { toast } from "sonner";

import { AgentGallery } from "@/components/workspace/agents/agent-gallery";
import { importAgentPackage, listAgents } from "@/core/agents/api";
import type * as Api from "@/core/agents/api";
import { enUS } from "@/core/i18n/locales/en-US";

rs.mock("sonner", () => ({ toast: { error: rs.fn(), success: rs.fn() } }));
rs.mock("@/core/i18n/hooks", () => ({ useI18n: () => ({ t: enUS }) }));
rs.mock("@/core/agents/api", () => ({
  ...rs.requireActual<typeof Api>("@/core/agents/api"),
  listAgents: rs.fn(),
  importAgentPackage: rs.fn(),
}));
const clients: QueryClient[] = [];
beforeEach(() => {
  rs.mocked(listAgents).mockResolvedValue([]);
});
afterEach(() => {
  cleanup();
  clients.splice(0).forEach((client) => client.clear());
  rs.clearAllMocks();
});
function mount() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  clients.push(client);
  return render(
    <QueryClientProvider client={client}>
      <AgentGallery />
    </QueryClientProvider>,
  );
}
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<T>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}
function choose(promise: Promise<string>) {
  fireEvent.change(document.querySelector('input[type="file"]')!, {
    target: { files: [{ text: () => promise }] },
  });
}
async function chooseNamed(name: string) {
  await act(async () =>
    choose(Promise.resolve(JSON.stringify({ agent: { name } }))),
  );
  await waitFor(() =>
    expect(
      screen.getByLabelText<HTMLInputElement>(enUS.agents.importName).value,
    ).toBe(name),
  );
}
const imported = {
  name: "first-package",
  description: "",
  model: null,
  tool_groups: null,
  skills: null,
};
for (const outcome of ["success", "failure"] as const) {
  test(`ignores older file ${outcome} after another package is selected`, async () => {
    mount();
    const old = deferred<string>();
    choose(old.promise);
    await chooseNamed("latest-package");
    await act(async () => {
      if (outcome === "success")
        old.resolve(JSON.stringify({ agent: { name: "obsolete-package" } }));
      else old.reject(new Error("obsolete file"));
    });
    expect(
      screen.getByLabelText<HTMLInputElement>(enUS.agents.importName).value,
    ).toBe("latest-package");
    expect(toast.error).not.toHaveBeenCalled();
  });
  test(`ignores old import ${outcome} after close and reopen`, async () => {
    mount();
    const old = deferred<typeof imported>();
    rs.mocked(importAgentPackage).mockReturnValueOnce(old.promise);
    await chooseNamed("first-package");
    fireEvent.click(
      within(screen.getByRole("dialog")).getByRole("button", {
        name: enUS.agents.importAgent,
      }),
    );
    await waitFor(() => expect(importAgentPackage).toHaveBeenCalledTimes(1));
    fireEvent.click(
      within(screen.getByRole("dialog")).getByRole("button", { name: "Close" }),
    );
    expect(screen.queryByRole("dialog")).toBeNull();
    await chooseNamed("latest-package");
    await act(async () => {
      if (outcome === "success") old.resolve(imported);
      else old.reject(new Error("obsolete import"));
    });
    expect(
      screen.getByLabelText<HTMLInputElement>(enUS.agents.importName).value,
    ).toBe("latest-package");
    expect(toast.success).not.toHaveBeenCalled();
    expect(toast.error).not.toHaveBeenCalled();
  });
}
test("unmounted file read rejection does not publish an error", async () => {
  const view = mount();
  const old = deferred<string>();
  choose(old.promise);
  view.unmount();
  await act(async () => old.reject(new Error("retired file")));
  expect(toast.error).not.toHaveBeenCalled();
});
test("owned successful import refreshes the catalog and closes its dialog", async () => {
  mount();
  rs.mocked(importAgentPackage).mockResolvedValueOnce(imported);
  await chooseNamed("first-package");
  fireEvent.click(
    within(screen.getByRole("dialog")).getByRole("button", {
      name: enUS.agents.importAgent,
    }),
  );
  await waitFor(() =>
    expect(toast.success).toHaveBeenCalledWith(enUS.agents.importSuccess),
  );
  expect(importAgentPackage).toHaveBeenCalledWith(
    { agent: { name: "first-package" } },
    "first-package",
  );
  expect(screen.queryByRole("dialog")).toBeNull();
  expect(listAgents).toHaveBeenCalledTimes(2);
});
