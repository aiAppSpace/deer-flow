<script setup lang="ts">
/*
  【文件职责】     编辑 once/cron 两种 Gateway schedule，并提供五种 cron preset、时区和预览。
  【架构位置】     L3 scheduled-task form component
  【主要导出】     默认 ScheduledTaskScheduleInput
  【依赖关系】     scheduled-tasks cron/schedule · ui/button · ui/select · app i18n
  【边界与注意】   接口是 `initial` + `@change`，**不是** v-model：与
                   frontend/src/components/workspace/scheduled-task-schedule-input.tsx
                   一样，组件自己持有 preset/parts/时区，把它们规范化成一个
                   `ScheduleValue` 发出去，包括挂载那一次——挂载时发出的那一次正是
                   「时区留空则用浏览器时区」「cron 写回规范形式」生效的地方。
                   要重置（应用 recipe、换选中任务）由调用方换 `key` 重新挂载，同 React。

                   `run_at` 发出去的是 **UTC ISO**，不是 datetime-local 的墙上时间：
                   转换在这里发生，payload 构建那一层只做搬运。此前 Vue 把墙上时间留在
                   模型里、在 form.ts 边界转换，还额外做了「这个本地时间在该时区不存在」
                   和「必须是将来」两条本地校验——React 没有这两条，它把这类输入直接
                   POST 给 Gateway，由 422 的 detail 回来。两条校验各自带着一句写死的
                   英文文案，两个应用在同一次误操作上会说不同的话。

                   `hourly` 只给分钟输入框，其余 preset 给一个 `type="time"`：一个时间
                   选择器，不是「小时」+「分钟」两个数字框。数字框那版把 `fields.time`
                   («Time») 挂在 0~23 的小时框上，读屏器会念出一个叫「时间」的微调框。
*/
import { computed, ref, watch } from "vue";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  describeSchedule,
  pad2,
  parseCron,
  serializeCron,
  utcToZonedLocalInput,
  WEEKDAYS,
  zonedLocalToUtcIso,
  type CronParts,
  type CronPreset,
  type ScheduleLocale,
  type Weekday,
} from "@/core/scheduled-tasks/cron";
import {
  detectBrowserTimezone,
  timezoneOptions,
  withCurrentTimezone,
  type ScheduleValue,
} from "@/core/scheduled-tasks/schedule";

const PRESETS: CronPreset[] = [
  "hourly",
  "daily",
  "weekly",
  "monthly",
  "custom",
];

const TIMEZONE_OPTIONS = timezoneOptions();

const props = withDefaults(
  defineProps<{
    initial: ScheduleValue;
    scheduleTypeLocked?: boolean;
  }>(),
  { scheduleTypeLocked: false },
);
const emit = defineEmits<{ change: [value: ScheduleValue] }>();
const { $i18n } = useNuxtApp();

const labels = computed(() => $i18n.t.value.scheduledTasks);
const scheduleLocale = computed<ScheduleLocale>(() =>
  $i18n.locale.value.startsWith("zh") ? "zh" : "en",
);

const initialCron = parseCron(props.initial.schedule_spec.cron ?? "0 9 * * *");
const scheduleType = ref<"once" | "cron">(props.initial.schedule_type);
const preset = ref<CronPreset>(initialCron.preset);
const parts = ref<CronParts>(initialCron.parts);
const runAtLocal = ref(
  props.initial.schedule_type === "once" && props.initial.schedule_spec.run_at
    ? utcToZonedLocalInput(
        props.initial.schedule_spec.run_at,
        props.initial.timezone || "UTC",
      )
    : "",
);
const timezone = ref(props.initial.timezone || detectBrowserTimezone());
// 候选里必须有当前值，否则触发器显示为空，见 schedule.ts 文件头。
const timezoneChoices = computed(() =>
  withCurrentTimezone(TIMEZONE_OPTIONS, timezone.value),
);

watch(
  [scheduleType, preset, parts, runAtLocal, timezone],
  () => {
    if (scheduleType.value === "once") {
      const runAt = runAtLocal.value
        ? zonedLocalToUtcIso(runAtLocal.value, timezone.value)
        : "";
      emit("change", {
        schedule_type: "once",
        schedule_spec: runAt ? { run_at: runAt } : {},
        timezone: timezone.value,
      });
      return;
    }
    const cron =
      preset.value === "custom"
        ? (parts.value.raw ?? "")
        : serializeCron(preset.value, parts.value);
    emit("change", {
      schedule_type: "cron",
      schedule_spec: cron ? { cron } : {},
      timezone: timezone.value,
    });
  },
  { deep: true, immediate: true },
);

function updateParts(patch: Partial<CronParts>) {
  parts.value = { ...parts.value, ...patch };
}

function changePreset(next: CronPreset) {
  const merged = { ...parts.value };
  if (next === "weekly" && (merged.weekdays ?? []).length === 0) {
    merged.weekdays = ["mon"];
  }
  if (next === "monthly" && merged.dayOfMonth == null) {
    merged.dayOfMonth = 1;
  }
  if (next === "custom" && !merged.raw) {
    merged.raw = serializeCron("daily", parts.value);
  }
  parts.value = merged;
  preset.value = next;
}

/** 最后一个星期几不能取消：cron 的 day-of-week 字段不能为空。 */
function toggleWeekday(day: Weekday) {
  const selected = new Set(parts.value.weekdays ?? []);
  if (selected.has(day)) {
    if (selected.size <= 1) return;
    selected.delete(day);
  } else {
    selected.add(day);
  }
  updateParts({
    weekdays: WEEKDAYS.filter((candidate) => selected.has(candidate)),
  });
}

function setTime(value: string) {
  const [hour, minute] = value.split(":").map(Number);
  updateParts({ hour, minute });
}

const timeValue = computed(
  () => `${pad2(parts.value.hour ?? 9)}:${pad2(parts.value.minute ?? 0)}`,
);
const preview = computed(() =>
  describeSchedule(
    {
      scheduleType: scheduleType.value,
      preset: preset.value,
      parts: parts.value,
      runAtLocal: runAtLocal.value,
      timezone: timezone.value,
    },
    scheduleLocale.value,
  ),
);
</script>

<template>
  <div class="flex flex-col gap-2" data-testid="schedule-input">
    <div
      v-if="!scheduleTypeLocked"
      class="flex flex-wrap gap-2"
      data-testid="scheduled-task-schedule-type"
    >
      <Button
        :variant="scheduleType === 'cron' ? 'default' : 'outline'"
        :aria-pressed="scheduleType === 'cron'"
        size="sm"
        @click="scheduleType = 'cron'"
      >
        {{ labels.scheduleType.cron }}
      </Button>
      <Button
        :variant="scheduleType === 'once' ? 'default' : 'outline'"
        :aria-pressed="scheduleType === 'once'"
        size="sm"
        @click="scheduleType = 'once'"
      >
        {{ labels.scheduleType.once }}
      </Button>
    </div>

    <template v-if="scheduleType === 'cron'">
      <Select
        :model-value="preset"
        @update:model-value="changePreset($event as CronPreset)"
      >
        <SelectTrigger class="w-full" data-testid="schedule-preset">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem v-for="kind in PRESETS" :key="kind" :value="kind">
            {{ labels.preset[kind] }}
          </SelectItem>
        </SelectContent>
      </Select>

      <!--
        这一屏的五个输入全走 `ui/input`，不要手写：上游同一处是
        `scheduled-task-schedule-input.tsx:240/253/287/301/319` 的 `<Input>`。
        本仓原来把 primitive 的整串基类抄成了一个本地常量（还漏了 `aria-invalid:`
        与 `disabled:` 两段），primitive 一改就悄悄分叉。
      -->
      <Input
        v-if="preset === 'hourly'"
        type="number"
        min="0"
        max="59"
        :model-value="parts.minute ?? 0"
        :aria-label="labels.fields.minute"
        @update:model-value="updateParts({ minute: Number($event) })"
      />

      <Input
        v-if="preset === 'daily' || preset === 'weekly' || preset === 'monthly'"
        type="time"
        :model-value="timeValue"
        :aria-label="labels.fields.time"
        @update:model-value="setTime($event)"
      />

      <div v-if="preset === 'weekly'" class="flex flex-wrap gap-1">
        <span class="text-muted-foreground w-full text-sm">
          {{ labels.fields.weekday }}
        </span>
        <Button
          v-for="day in WEEKDAYS"
          :key="day"
          :variant="parts.weekdays?.includes(day) ? 'default' : 'outline'"
          size="sm"
          :aria-pressed="Boolean(parts.weekdays?.includes(day))"
          @click="toggleWeekday(day)"
        >
          {{ labels.weekdays[day] }}
        </Button>
      </div>

      <Input
        v-if="preset === 'monthly'"
        type="number"
        min="1"
        max="31"
        :model-value="parts.dayOfMonth ?? 1"
        :aria-label="labels.fields.dayOfMonth"
        @update:model-value="updateParts({ dayOfMonth: Number($event) })"
      />

      <div v-if="preset === 'custom'" class="flex flex-col gap-1">
        <Input
          data-testid="scheduled-task-custom-cron"
          :model-value="parts.raw ?? ''"
          :placeholder="labels.fields.cronPlaceholder"
          :aria-label="labels.fields.cron"
          @update:model-value="updateParts({ raw: $event })"
        />
        <a
          href="https://crontab.guru/"
          target="_blank"
          rel="noreferrer"
          class="text-muted-foreground text-xs hover:underline"
        >
          {{ labels.cronHelp }} ↗
        </a>
      </div>
    </template>
    <Input
      v-else
      data-testid="scheduled-task-run-at"
      type="datetime-local"
      :model-value="runAtLocal"
      :aria-label="labels.fields.runAt"
      @update:model-value="runAtLocal = $event"
    />

    <Select v-model="timezone">
      <SelectTrigger class="w-full" data-testid="schedule-timezone">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem
          v-for="option in timezoneChoices"
          :key="option"
          :value="option"
        >
          {{ option }}
        </SelectItem>
      </SelectContent>
    </Select>

    <div class="text-muted-foreground text-sm" data-testid="schedule-preview">
      {{ preview }}
    </div>
  </div>
</template>
