<script setup lang="ts">
import { Button } from "@/components/ui/button";

defineProps<{ page: number; pageSize: number; total: number }>();
const emit = defineEmits<{ change: [page: number] }>();
const { $i18n } = useNuxtApp();
</script>

<template>
  <div v-if="total > pageSize" class="flex items-center justify-end gap-2 pt-2">
    <Button
      :disabled="page <= 1"
      size="sm"
      variant="outline"
      @click="emit('change', page - 1)"
      >{{ $i18n.t.value.knowledge.scope.previous }}</Button
    >
    <span class="text-muted-foreground text-xs">{{ page }}</span>
    <Button
      :disabled="page * pageSize >= total"
      size="sm"
      variant="outline"
      @click="emit('change', page + 1)"
      >{{ $i18n.t.value.knowledge.scope.next }}</Button
    >
  </div>
</template>
