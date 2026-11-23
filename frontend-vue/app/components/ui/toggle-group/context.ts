import { inject, provide, type ComputedRef, type InjectionKey } from "vue";

interface ToggleGroupStyle {
  variant?: "default" | "outline";
  size?: "default" | "sm" | "lg";
  spacing: number;
}

const key: InjectionKey<ComputedRef<ToggleGroupStyle>> =
  Symbol("toggle-group-style");

export function provideToggleGroupStyle(style: ComputedRef<ToggleGroupStyle>) {
  provide(key, style);
}

export function useToggleGroupStyle() {
  return inject(key, undefined);
}
