<!--
  【文件职责】     项目详情页：标题、对话列表、设置（改名/归档/删除）。
  【架构位置】     L3 页面
  【主要导出】     默认页面组件
  【依赖关系】     composables/useProjects · WorkspaceContainer · ProjectThreadsSection ·
                   ui/{empty,badge,dialog,input,scroll-area}
  【边界与注意】   **项目 404 时不发对话请求**：那个端点对不存在的项目同样 404，
                   照发只是给控制台多一条噪音。所以 threads 查询的 `enabled` 挂在
                   「项目已取到」上。

                   改名输入框以 `project.updated_at` 为 key 重建：项目在别处被改名后
                   （侧栏改名、另一个标签页），输入框里应当是新名字而不是旧草稿。

                   删除成功后跳 `/workspace/chats`——留在一个已被删掉的项目页上，
                   下一次刷新会撞 404。
-->
<script setup lang="ts">
import {
  Archive,
  Folder,
  MessageSquarePlus,
  RotateCcw,
  Trash2,
} from "lucide-vue-next";
import { computed, ref, watch } from "vue";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Empty,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import WorkspaceContainer from "@/components/workspace/WorkspaceContainer.vue";
import ProjectThreadsSection from "@/components/workspace/projects/ProjectThreadsSection.vue";
import {
  useProject,
  useProjectMutations,
  useProjectThreads,
} from "@/composables/useProjects";
import { useWorkspaceToast } from "@/core/workspace-shell/toast";

const route = useRoute();
const router = useRouter();
const { $i18n } = useNuxtApp();
/*
  **必须显式声明 layout**：Nuxt 的默认 layout 是营销页外壳（app/layouts/default.vue），
  那里没有 workspace 的 toast owner，于是这一页在服务端渲染时直接 500
  「Workspace toast owner is not available」。

  这一条从这个页面建出来那天起就坏着——门禁一路全绿，因为**没有任何测试
  访问过这条路由**。它是 2026-09-10 把该路由加进对照取样面时当场露出来的。
*/
definePageMeta({ layout: "workspace" });

const toast = useWorkspaceToast();

const projectId = computed(() => String(route.params.id ?? ""));
const projectQuery = useProject(projectId);
const project = computed(() => projectQuery.data.value);

const threadsQuery = useProjectThreads(projectId, {
  enabled: computed(() => project.value != null),
});
const threads = computed(() => threadsQuery.data.value?.pages.flat() ?? []);

useHead({
  title: computed(() =>
    project.value?.name
      ? `${project.value.name} - ${$i18n.t.value.pages.appName}`
      : `${$i18n.t.value.projects.title} - ${$i18n.t.value.pages.appName}`,
  ),
});

const { patch, archive, restore, remove } = useProjectMutations();

const name = ref("");
watch(
  () => project.value?.updated_at,
  () => {
    name.value = project.value?.name ?? "";
  },
  { immediate: true },
);

const isArchived = computed(() => project.value?.status === "archived");
const canSave = computed(
  () =>
    name.value.trim().length > 0 &&
    name.value.trim() !== project.value?.name &&
    !patch.isPending.value,
);
const isDeleteDialogOpen = ref(false);

function messageOf(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback;
}

async function handleRename() {
  if (!canSave.value || !project.value) return;
  try {
    await patch.mutateAsync({
      id: project.value.id,
      input: { name: name.value.trim() },
    });
  } catch (error) {
    toast.error(messageOf(error, $i18n.t.value.common.renameFailed));
  }
}

function onNameKeydown(event: KeyboardEvent) {
  if (event.key !== "Enter" || event.isComposing) return;
  event.preventDefault();
  void handleRename();
}

async function handleArchiveToggle() {
  if (!project.value) return;
  const run = isArchived.value ? restore : archive;
  const fallback = isArchived.value
    ? $i18n.t.value.projects.restoreFailed
    : $i18n.t.value.projects.archiveFailed;
  try {
    await run.mutateAsync(project.value.id);
  } catch (error) {
    toast.error(messageOf(error, fallback));
  }
}

async function handleDelete() {
  if (!project.value) return;
  try {
    await remove.mutateAsync(project.value.id);
    await router.push("/workspace/chats");
  } catch (error) {
    toast.error(messageOf(error, $i18n.t.value.projects.deleteFailed));
  }
}
</script>

<template>
  <WorkspaceContainer>
    <ScrollArea class="size-full">
      <div
        class="mx-auto flex w-full max-w-[var(--container-width-md)] flex-col gap-8 p-6 pt-8"
      >
        <Empty v-if="projectQuery.isError.value" class="py-16">
          <EmptyHeader>
            <EmptyMedia variant="icon"><Folder /></EmptyMedia>
            <EmptyTitle>{{ $i18n.t.value.projects.notFound }}</EmptyTitle>
          </EmptyHeader>
        </Empty>

        <div
          v-else-if="project == null"
          class="text-muted-foreground py-16 text-center text-sm"
        >
          {{ $i18n.t.value.common.loading }}
        </div>

        <template v-else>
          <header class="flex flex-wrap items-center gap-3">
            <h1 class="min-w-0 flex-1 truncate text-2xl font-semibold">
              {{ project.name }}
            </h1>
            <Badge v-if="isArchived" variant="secondary">
              {{ $i18n.t.value.projects.archived }}
            </Badge>
            <Button v-else as-child>
              <NuxtLink
                :to="`/workspace/chats/new?project=${encodeURIComponent(project.id)}`"
              >
                <MessageSquarePlus />
                {{ $i18n.t.value.projects.newChat }}
              </NuxtLink>
            </Button>
          </header>

          <ProjectThreadsSection
            :threads="threads"
            :is-error="threadsQuery.isError.value"
            :is-loading="threadsQuery.isLoading.value"
            :has-next-page="threadsQuery.hasNextPage.value"
            :is-fetching-next-page="threadsQuery.isFetchingNextPage.value"
            @load-more="threadsQuery.fetchNextPage()"
          />

          <section class="flex flex-col gap-4">
            <h2 class="text-muted-foreground text-sm font-medium">
              {{ $i18n.t.value.projects.settings }}
            </h2>
            <div class="flex flex-col gap-2">
              <label
                for="project-name-input"
                class="text-muted-foreground text-xs"
              >
                {{ $i18n.t.value.projects.namePlaceholder }}
              </label>
              <div class="flex items-center gap-2">
                <Input
                  id="project-name-input"
                  v-model="name"
                  :placeholder="$i18n.t.value.projects.namePlaceholder"
                  @keydown="onNameKeydown"
                />
                <Button
                  variant="outline"
                  :disabled="!canSave"
                  @click="handleRename"
                >
                  {{ $i18n.t.value.common.save }}
                </Button>
              </div>
            </div>
            <div class="flex flex-wrap items-center gap-2">
              <Button
                variant="outline"
                :disabled="archive.isPending.value || restore.isPending.value"
                @click="handleArchiveToggle"
              >
                <component :is="isArchived ? RotateCcw : Archive" />
                {{
                  isArchived
                    ? $i18n.t.value.projects.restore
                    : $i18n.t.value.projects.archive
                }}
              </Button>
              <Button variant="destructive" @click="isDeleteDialogOpen = true">
                <Trash2 />
                {{ $i18n.t.value.projects.deleteProject }}
              </Button>
            </div>
          </section>
        </template>
      </div>
    </ScrollArea>

    <Dialog v-model:open="isDeleteDialogOpen">
      <DialogContent
        class="sm:max-w-[425px]"
        :close-label="$i18n.t.value.primitives.close"
      >
        <DialogHeader>
          <DialogTitle>
            {{ $i18n.t.value.projects.deleteProject }}
          </DialogTitle>
          <DialogDescription>
            {{ $i18n.t.value.projects.deleteProjectConfirm }}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" @click="isDeleteDialogOpen = false">
            {{ $i18n.t.value.common.cancel }}
          </Button>
          <Button
            variant="destructive"
            :disabled="remove.isPending.value"
            @click="handleDelete"
          >
            {{ $i18n.t.value.common.delete }}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </WorkspaceContainer>
</template>
