<script setup lang="ts">
import { computed, onMounted, onScopeDispose } from "vue";
import { useQueryClient } from "@tanstack/vue-query";

import { useSettingsPermissions } from "@/composables/useSettingsPermissions";
import { useUserPreferencesBoundary } from "@/composables/useUserPreferencesBoundary";
import { resetWorkspaceQueries } from "@/core/auth/workspace-queries";
import { preferenceOwner } from "@/core/settings/preference-owner";

const access = useSettingsPermissions();
const queryClient = useQueryClient();
const owner = computed(() =>
  preferenceOwner(access.session.value, access.authDisabled),
);
// Mirror AuthProvider's single workspace visibility refresh. The route bypass
// only supplies the initial default user; a real refreshed account owns state.
let lastCheck: number | undefined;
function refreshVisibleSession() {
  if (document.visibilityState !== "visible") return;
  if (!access.authDisabled && access.session.value?.tag === "unauthenticated")
    return;
  const now = Date.now();
  if (lastCheck !== undefined && now - lastCheck < 60_000) return;
  lastCheck = now;
  void access.refreshSession();
}
onMounted(() =>
  document.addEventListener("visibilitychange", refreshVisibleSession),
);
onScopeDispose(() =>
  document.removeEventListener("visibilitychange", refreshVisibleSession),
);
const { ready } = useUserPreferencesBoundary(owner, () =>
  resetWorkspaceQueries(queryClient),
);
</script>

<template><slot v-if="ready" /></template>
