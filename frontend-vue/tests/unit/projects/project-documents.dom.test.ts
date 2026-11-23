import { flushPromises, mount } from "@vue/test-utils";
import { reactive, ref } from "vue";
import type { Window as HappyDOMWindow } from "happy-dom";
import { beforeEach, expect, it, vi } from "vitest";
import ProjectDocumentsSection from "@/components/workspace/projects/ProjectDocumentsSection.vue";
import ProjectDocumentPreviewDialog from "@/components/workspace/projects/ProjectDocumentPreviewDialog.vue";
import { readProjectAttachments } from "@/core/projects/composer-attach";
import {
  createWorkspaceToastStore,
  workspaceToastKey,
} from "@/core/workspace-shell/toast";
import type { Project, ProjectDocument } from "@/core/projects";

const api = vi.hoisted(() => ({
  upload: vi.fn(),
  promote: vi.fn(),
  remove: vi.fn(),
  attach: vi.fn(),
  preview: vi.fn(),
  push: vi.fn(),
  shelfMore: vi.fn(),
  filesMore: vi.fn(),
}));
const doc: ProjectDocument = {
  id: "d-1",
  name: "report.docx",
  size_bytes: 3,
  sha256: "sha",
  content_missing: false,
  source_thread_id: null,
  source_kind: null,
  source_name: null,
  created_at: "",
  updated_at: "",
};
const project: Project = {
  id: "p-1",
  name: "Project",
  instructions: "",
  status: "active",
  presentation: {},
  created_at: "",
  updated_at: "",
};
const documents = ref({
  pages: [{ documents: [doc], total: 102, offset: 0, limit: 100 }],
});
const files = ref({
  pages: [
    {
      groups: [
        {
          thread_id: "member",
          display_name: "Member",
          updated_at: "",
          files: [
            {
              kind: "output",
              name: "file.csv",
              size_bytes: 4,
              modified_at: "",
              artifact_url: "/api/file",
            },
          ],
          truncated: true,
        },
      ],
      next_offset: 1,
    },
  ],
});
vi.mock("@/composables/useProjectDocuments", () => ({
  useProjectsConfig: () => ({ data: ref({ trash_retention_days: 30 }) }),
  useInfiniteProjectDocuments: () => ({
    data: documents,
    isLoading: ref(false),
    isError: ref(false),
    hasNextPage: ref(true),
    isFetchingNextPage: ref(false),
    fetchNextPage: api.shelfMore,
    refetch: vi.fn(),
  }),
  useInfiniteProjectThreadFiles: () => ({
    data: files,
    isLoading: ref(false),
    isError: ref(false),
    hasNextPage: ref(true),
    isFetchingNextPage: ref(false),
    fetchNextPage: api.filesMore,
    refetch: vi.fn(),
  }),
  useProjectDocumentMutations: () =>
    Object.fromEntries(
      ["upload", "promote", "remove", "attach"].map((key) => [
        key,
        { mutateAsync: api[key as "upload"], isPending: ref(false) },
      ]),
    ),
}));
vi.mock("@/composables/useThreads", () => ({
  useThreads: () =>
    reactive({
      threads: [
        { thread_id: "writable", values: { title: "Writable" }, metadata: {} },
        {
          thread_id: "archived",
          values: { title: "Archived" },
          metadata: { deerflow_archived: true },
        },
      ],
      loading: false,
      error: null,
      hasMore: false,
    }),
}));
vi.mock("@/core/projects/api", async (original) => ({
  ...(await original()),
  fetchProjectDocumentPreview: api.preview,
}));
const provide = () => ({
  [workspaceToastKey as symbol]: createWorkspaceToastStore(),
});
beforeEach(() => {
  Object.values(api).forEach((fn) => fn.mockReset());
  sessionStorage.clear();
  vi.stubGlobal("useRouter", () => ({ push: api.push }));
});
function buttons(wrapper: ReturnType<typeof mount>, text: string) {
  return wrapper.findAll("button").filter((b) => b.text() === text);
}

it("keeps archived shelves readable and attachable while removing all shelf mutations", () => {
  const wrapper = mount(ProjectDocumentsSection, {
    props: { project: { ...project, status: "archived" }, threads: [] },
    global: { provide: provide() },
  });
  expect(
    wrapper.find('[data-testid="project-documents-archived-banner"]').exists(),
  ).toBe(true);
  expect(buttons(wrapper, "Attach to chat")).toHaveLength(1);
  expect(buttons(wrapper, "Move to trash")).toHaveLength(0);
  expect(buttons(wrapper, "Save to project")).toHaveLength(0);
  expect(wrapper.find('input[type="file"]').exists()).toBe(false);
  expect(wrapper.find('a[href$="?download=true"]').exists()).toBe(true);
  expect(wrapper.text()).toContain("Only the first 1 files");
  wrapper.unmount();
});

it("stages the authoritative attach response only after success and navigates to the selected writable chat", async () => {
  api.attach.mockResolvedValue({
    filename: "server-renamed.docx",
    size_bytes: 9,
    virtual_path: "/mnt/user-data/uploads/server-renamed.docx",
    artifact_url: "/api/artifact",
  });
  const wrapper = mount(ProjectDocumentsSection, {
    props: { project, threads: [] },
    attachTo: document.body,
    global: { provide: provide() },
  });
  await buttons(wrapper, "Attach to chat")[0]!.trigger("click");
  await flushPromises();
  const target = [...document.querySelectorAll("button")].find(
    (b) => b.textContent?.trim() === "Writable",
  )!;
  expect(
    [...document.querySelectorAll("button")].some(
      (b) => b.textContent?.trim() === "Archived",
    ),
  ).toBe(false);
  target.click();
  await flushPromises();
  expect(api.attach).toHaveBeenCalledWith({
    documentId: "d-1",
    threadId: "writable",
  });
  expect(readProjectAttachments("writable")[0]).toMatchObject({
    filename: "server-renamed.docx",
  });
  // A completed shelf attachment remains a removable chip, rather than an inline reference.
  expect(readProjectAttachments("writable")[0]).not.toHaveProperty(
    "source_document_id",
  );
  expect(readProjectAttachments("writable")[0]).not.toHaveProperty(
    "source_project_id",
  );
  expect(api.push).toHaveBeenCalledWith("/workspace/chats/writable");
  wrapper.unmount();
});

it("does not turn content-missing rows into preview/download/attach affordances", async () => {
  documents.value = {
    pages: [
      {
        documents: [{ ...doc, content_missing: true }],
        total: 1,
        offset: 0,
        limit: 100,
      },
    ],
  };
  const wrapper = mount(ProjectDocumentsSection, {
    props: { project, threads: [] },
    global: { provide: provide() },
  });
  expect(wrapper.find('[data-testid="content-missing-badge"]').exists()).toBe(
    true,
  );
  expect(buttons(wrapper, "Attach to chat")).toHaveLength(0);
  expect(wrapper.find('a[href$="?download=true"]').exists()).toBe(false);
  wrapper.unmount();
  documents.value = {
    pages: [{ documents: [doc], total: 102, offset: 0, limit: 100 }],
  };
});

it("uploads one file per request, continues after a rejected file, and uses both list pagination actions", async () => {
  api.upload
    .mockRejectedValueOnce(new Error("Denied"))
    .mockResolvedValueOnce({});
  const wrapper = mount(ProjectDocumentsSection, {
    props: { project, threads: [] },
    global: { provide: provide() },
  });
  const files = [new File(["a"], "a.txt"), new File(["b"], "b.txt")];
  Object.defineProperty(wrapper.get('input[type="file"]').element, "files", {
    value: files,
  });
  await wrapper.get('input[type="file"]').trigger("change");
  await flushPromises();
  expect(api.upload.mock.calls).toEqual([
    [{ file: files[0] }],
    [{ file: files[1] }],
  ]);
  await wrapper
    .get('[data-testid="project-documents-load-more"]')
    .trigger("click");
  await wrapper
    .get('[data-testid="project-thread-files-load-more"]')
    .trigger("click");
  expect(api.shelfMore).toHaveBeenCalledOnce();
  expect(api.filesMore).toHaveBeenCalledOnce();
  wrapper.unmount();
});

it("does not send the remaining upload batch after leaving its project owner", async () => {
  let settle!: () => void;
  api.upload.mockReturnValue(
    new Promise<void>((resolve) => {
      settle = resolve;
    }),
  );
  const wrapper = mount(ProjectDocumentsSection, {
    props: { project, threads: [] },
    global: { provide: provide() },
  });
  Object.defineProperty(wrapper.get('input[type="file"]').element, "files", {
    value: [new File(["a"], "a.txt"), new File(["b"], "b.txt")],
  });
  await wrapper.get('input[type="file"]').trigger("change");
  wrapper.unmount();
  settle();
  await flushPromises();
  expect(api.upload).toHaveBeenCalledOnce();
});

it("promotes the selected member-thread file with the edited shelf name and reports the server's final name", async () => {
  api.promote.mockResolvedValue({ document: { ...doc, name: "server.csv" } });
  const toast = createWorkspaceToastStore();
  const wrapper = mount(ProjectDocumentsSection, {
    props: { project, threads: [] },
    attachTo: document.body,
    global: { provide: { [workspaceToastKey as symbol]: toast } },
  });
  await buttons(wrapper, "Save to project")[0]!.trigger("click");
  await flushPromises();
  const input = document.getElementById(
    "project-shelf-name",
  ) as HTMLInputElement;
  input.value = "Renamed.csv";
  input.dispatchEvent(new Event("input", { bubbles: true }));
  await flushPromises();
  const confirmation = document.querySelector('[role="dialog"]')!;
  const save = [...confirmation.querySelectorAll("button")].find(
    (button) => button.textContent?.trim() === "Save to project",
  );
  expect(
    save,
    "confirmation action matches React's Save to project",
  ).toBeDefined();
  save!.click();
  await flushPromises();
  expect(api.promote).toHaveBeenCalledWith({
    thread_id: "member",
    kind: "output",
    name: "file.csv",
    shelf_name: "Renamed.csv",
  });
  expect(
    toast.toasts.value.some((item) => item.message.includes("server.csv")),
  ).toBe(true);
  wrapper.unmount();
});

it("retains the attachment picker after a denied ingestion and stages no fabricated attachment", async () => {
  api.attach.mockRejectedValue(new Error("Permission denied"));
  const wrapper = mount(ProjectDocumentsSection, {
    props: { project, threads: [] },
    attachTo: document.body,
    global: { provide: provide() },
  });
  await buttons(wrapper, "Attach to chat")[0]!.trigger("click");
  await flushPromises();
  [...document.querySelectorAll("button")]
    .find((b) => b.textContent?.trim() === "Writable")!
    .click();
  await flushPromises();
  expect(readProjectAttachments("writable")).toEqual([]);
  expect(api.push).not.toHaveBeenCalled();
  expect(document.body.textContent).toContain("Choose a chat to attach");
  wrapper.unmount();
});

it("aborts obsolete preview requests and preserves separate converted-preview and immutable-original URLs", async () => {
  // Exercise the iframe resource boundary instead of disabling it: this DOM
  // test owns URL/admission/lifetime, while native tests own PDF rendering.
  const happyDOM = (window as unknown as HappyDOMWindow).happyDOM;
  const settings = happyDOM.settings;
  const previous = {
    enabled: settings.enableIframePageLoading,
    disabled: settings.disableIframePageLoading,
    childNavigation: settings.navigation.disableChildFrameNavigation,
    interceptor: settings.fetch.interceptor,
  };
  const loaded: string[] = [];
  const expectedUrl = new URL(
    "/api/projects/p-1/documents/d-2/content",
    window.location.href,
  ).href;
  const error = vi.spyOn(console, "error"); // Observe, never silence diagnostics.
  settings.enableIframePageLoading = true;
  settings.disableIframePageLoading = false;
  settings.navigation.disableChildFrameNavigation = false;
  settings.fetch.interceptor = {
    async beforeAsyncRequest({ request, window: child }) {
      loaded.push(request.url);
      expect(request.url).toBe(expectedUrl);
      return new child.Response("%PDF-1.4\n%%EOF", {
        headers: { "Content-Type": "application/pdf" },
      });
    },
  };
  let wrapper: ReturnType<typeof mount> | undefined;
  try {
    let settle!: (value: unknown) => void;
    api.preview
      .mockReturnValueOnce(
        new Promise((resolve) => {
          settle = resolve;
        }),
      )
      .mockResolvedValueOnce({ kind: "pdf" });
    wrapper = mount(ProjectDocumentPreviewDialog, {
      props: { projectId: "p-1", document: doc },
      attachTo: document.body,
    });
    await flushPromises();
    const signal = api.preview.mock.calls[0]![2].signal as AbortSignal;
    await wrapper.setProps({
      document: { ...doc, id: "d-2", name: "second.pdf" },
    });
    await flushPromises();
    expect(signal.aborted).toBe(true);
    settle({ kind: "text", content: "obsolete", truncated: false });
    await flushPromises();
    const frame = document.querySelector(
      '[data-testid="project-document-preview-frame"]',
    )!;
    expect(frame.getAttribute("src")).toContain("/d-2/content");
    expect(frame.hasAttribute("sandbox")).toBe(false);
    expect(document.body.textContent).not.toContain("obsolete");
    expect(
      [...document.querySelectorAll("a")].some((a) =>
        a.href.endsWith("/d-2/content?download=true"),
      ),
    ).toBe(true);
    await happyDOM.waitUntilComplete();
    expect(loaded).toEqual([expectedUrl]);
    expect((frame as HTMLIFrameElement).contentWindow?.location.href).toBe(
      expectedUrl,
    );
    expect(error).not.toHaveBeenCalled();
  } finally {
    wrapper?.unmount();
    settings.enableIframePageLoading = previous.enabled;
    settings.disableIframePageLoading = previous.disabled;
    settings.navigation.disableChildFrameNavigation = previous.childNavigation;
    settings.fetch.interceptor = previous.interceptor;
    error.mockRestore();
  }
});
