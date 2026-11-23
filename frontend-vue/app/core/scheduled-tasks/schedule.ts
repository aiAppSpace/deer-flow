/**
 * Schedule values and timezone choices shared by the form and recipes.
 * Keep the selected timezone in the choices: Intl.supportedValuesOf and
 * resolvedOptions can return different sets (for example UTC).
 * Browser timezone detection belongs to format.browserTimeZone.
 */

export type ScheduleValue = {
  schedule_type: "once" | "cron" | "interval";
  schedule_spec: { cron?: string; run_at?: string; every_seconds?: number };
  timezone: string;
};

/** `Intl.supportedValuesOf` 不可用时的候选，与 React 同一份。 */
const FALLBACK_TIMEZONES = [
  "UTC",
  "Asia/Shanghai",
  "Asia/Tokyo",
  "Asia/Singapore",
  "Europe/London",
  "Europe/Berlin",
  "America/New_York",
  "America/Chicago",
  "America/Los_Angeles",
];

/**
 * 渲染用的时区列表：候选加上当前值。
 *
 * 选中值不在选项里时触发器会显示为空，见文件头。
 */
export function withCurrentTimezone(
  options: readonly string[],
  current: string,
): string[] {
  return current && !options.includes(current)
    ? [current, ...options]
    : [...options];
}

export function timezoneOptions(): string[] {
  const supported = (
    Intl as typeof Intl & {
      supportedValuesOf?: (key: string) => string[] | undefined;
    }
  ).supportedValuesOf?.("timeZone");
  if (Array.isArray(supported) && supported.length > 0) {
    return supported;
  }
  return FALLBACK_TIMEZONES;
}
