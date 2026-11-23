<script setup lang="ts">
import { Folder, MessageSquarePlus } from "lucide-vue-next";
import { computed, ref } from "vue";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import WorkspaceContainer from "@/components/workspace/WorkspaceContainer.vue";
import ProjectThreadsSection from "@/components/workspace/projects/ProjectThreadsSection.vue";
import ProjectDocumentsSection from "@/components/workspace/projects/ProjectDocumentsSection.vue";
import ProjectInstructionsSection from "@/components/workspace/projects/ProjectInstructionsSection.vue";
import ProjectSettingsSection from "@/components/workspace/projects/ProjectSettingsSection.vue";
import { useProject, useProjectThreads } from "@/composables/useProjects";
const route = useRoute();
const { $i18n } = useNuxtApp();
definePageMeta({ layout: "workspace" });
const projectId = computed(() => String(route.params.id ?? ""));
const projectQuery = useProject(projectId);
const project = computed(() => projectQuery.data.value);
const threadsQuery = useProjectThreads(projectId, {
  enabled: computed(() => project.value != null),
});
const threads = computed(() => threadsQuery.data.value?.pages.flat() ?? []);
const tab = ref("chats");
const isArchived = computed(() => project.value?.status === "archived");
useHead({
  title: computed(
    () =>
      `${project.value?.name ?? $i18n.t.value.projects.title} - ${$i18n.t.value.pages.appName}`,
  ),
});
</script>
<template>
  <WorkspaceContainer>
    <ScrollArea
      class="[container-type:size] size-full min-w-0 [&_[data-slot=scroll-area-viewport]>div]:block! [&_[data-slot=scroll-area-viewport]>div]:w-full! [&_[data-slot=scroll-area-viewport]>div]:max-w-full! [&_[data-slot=scroll-area-viewport]>div]:min-w-0! [@media(max-height:360px)]:[&_[data-slot=tabs-content]]:max-h-[calc(100cqh-var(--spacing)*14)] [@media(max-height:360px)]:[&_[data-slot=tabs-content]]:overflow-y-auto"
    >
      <div
        class="mx-auto flex w-full max-w-[var(--container-width-md)] min-w-0 flex-col gap-8 p-6 pt-8"
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
            <Button
              v-else
              class="h-auto max-w-full min-w-0 whitespace-normal max-[361px]:w-full"
              as-child
            >
              <NuxtLink
                :to="`/workspace/chats/new?project=${encodeURIComponent(project.id)}`"
              >
                <MessageSquarePlus />
                {{ $i18n.t.value.projects.newChat }}
              </NuxtLink>
            </Button>
          </header>

          <Tabs v-model="tab" class="@container/project-tabs gap-6">
            <TabsList
              :aria-label="project.name"
              class="@max-md/project-tabs:max-w-full @max-md/project-tabs:flex-wrap @max-md/project-tabs:group-data-[orientation=horizontal]/tabs:h-auto"
            >
              <TabsTrigger value="chats">{{
                $i18n.t.value.projects.threads
              }}</TabsTrigger>
              <TabsTrigger value="documents">{{
                $i18n.t.value.projects.documents
              }}</TabsTrigger>
              <TabsTrigger value="instructions">{{
                $i18n.t.value.projects.instructions
              }}</TabsTrigger>
              <TabsTrigger value="settings">{{
                $i18n.t.value.projects.settings
              }}</TabsTrigger>
            </TabsList>
            <TabsContent value="chats">
              <ProjectThreadsSection
                :threads="threads"
                :is-error="threadsQuery.isError.value"
                :is-loading="threadsQuery.isLoading.value"
                :has-next-page="threadsQuery.hasNextPage.value"
                :is-fetching-next-page="threadsQuery.isFetchingNextPage.value"
                @load-more="threadsQuery.fetchNextPage()"
              />
            </TabsContent>
            <TabsContent value="documents"
              ><ProjectDocumentsSection
                :key="project.id"
                :project="project"
                :threads="threads"
            /></TabsContent>
            <TabsContent value="instructions"
              ><ProjectInstructionsSection :key="project.id" :project="project"
            /></TabsContent>
            <TabsContent value="settings"
              ><ProjectSettingsSection :key="project.id" :project="project"
            /></TabsContent>
          </Tabs>
        </template>
      </div>
    </ScrollArea>
  </WorkspaceContainer>
</template>
