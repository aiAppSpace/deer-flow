"use client";

import {
  CircleCheckIcon,
  InfoIcon,
  Loader2Icon,
  OctagonXIcon,
  TriangleAlertIcon,
} from "lucide-react";
import { useEffect, useRef } from "react";
import { useTheme } from "next-themes";
import { Toaster as Sonner, type ToasterProps } from "sonner";

// A shortcut visit returns to its entry; ordinary Tab keeps native navigation.
function leavesNotificationOnTab(event: KeyboardEvent, root: HTMLElement) {
  const view = root.ownerDocument.defaultView;
  const target = event.target;
  if (
    !view ||
    event.defaultPrevented ||
    event.key !== "Tab" ||
    event.altKey ||
    event.ctrlKey ||
    event.metaKey ||
    !(target instanceof view.HTMLElement) ||
    !root.contains(target) ||
    root.ownerDocument.activeElement !== target
  )
    return false;
  const stops = Array.from(
    root.querySelectorAll<HTMLElement>(
      "button,a[href],input,select,textarea,[tabindex]",
    ),
  )
    .filter((node) => {
      if (
        node.tabIndex < 0 ||
        (node as HTMLButtonElement).disabled ||
        node.hidden
      )
        return false;
      for (
        let current: HTMLElement | null = node;
        current;
        current = current.parentElement
      ) {
        const style = view.getComputedStyle(current);
        if (
          current.hidden ||
          current.inert ||
          style.display === "none" ||
          style.visibility === "hidden"
        )
          return false;
        if (current === root) return true;
      }
      return false;
    })
    .sort(
      (left, right) =>
        (left.tabIndex || Infinity) - (right.tabIndex || Infinity),
    );
  return target === root
    ? event.shiftKey || stops.length === 0
    : target === (event.shiftKey ? stops[0] : stops.at(-1));
}

const DEFAULT_HOTKEY = ["altKey", "KeyT"];

const Toaster = ({ ...props }: ToasterProps) => {
  const hotkey = props.hotkey ?? DEFAULT_HOTKEY;
  const { theme = "system" } = useTheme();
  const region = useRef<HTMLElement | null>(null);
  useEffect(() => {
    const host = region.current;
    const view = host?.ownerDocument.defaultView;
    if (!host || !view) return;
    let entry: HTMLElement | null = null;
    let shortcutVisit = false;
    const revealReturnedFocus = (event: FocusEvent) => {
      const target = event.target;
      if (!(target instanceof view.HTMLElement)) return;
      if (host.contains(target)) {
        if (
          !(
            event.relatedTarget instanceof view.Node &&
            host.contains(event.relatedTarget)
          )
        )
          entry =
            event.relatedTarget instanceof view.HTMLElement
              ? event.relatedTarget
              : null;
        return;
      }
      const previous = entry;
      entry = null;
      shortcutVisit = false;
      // Reveal only an actual return, from the shortcut boundary or from
      // Sonner removing the last notification while it still held focus.
      if (target === previous && target.isConnected)
        target.scrollIntoView({ block: "nearest" });
    };
    // Native blur can leave the document without a subsequent focusin.
    // Retire that abandoned entry before a later viewport unmount.
    const clearAbandonedFocus = (event: FocusEvent) => {
      if (event.relatedTarget !== null) return;
      entry = null;
      shortcutVisit = false;
    };
    // The capture phase records the actual hotkey entry before Sonner expands
    // and focuses its list. Ordinary pointer/Tab entry never acquires this return.
    const enterByShortcut = (event: KeyboardEvent) => {
      const list = host.querySelector<HTMLElement>("[data-sonner-toaster]");
      if (
        !list ||
        event.defaultPrevented ||
        hotkey.length === 0 ||
        !hotkey.every((key) => Reflect.get(event, key) || event.code === key) ||
        host.contains(host.ownerDocument.activeElement)
      )
        return;
      const active = host.ownerDocument.activeElement;
      entry = active instanceof view.HTMLElement ? active : null;
      shortcutVisit = true;
      list.focus();
      if (!host.contains(host.ownerDocument.activeElement)) {
        entry = null;
        shortcutVisit = false;
      }
    };
    const restoreBoundary = (event: KeyboardEvent) => {
      const list = host.querySelector<HTMLElement>("[data-sonner-toaster]");
      if (
        shortcutVisit &&
        list &&
        entry?.isConnected &&
        leavesNotificationOnTab(event, list)
      ) {
        event.preventDefault();
        entry.focus();
      }
    };
    host.addEventListener("focusout", clearAbandonedFocus);
    host.ownerDocument.addEventListener("focusin", revealReturnedFocus, true);
    host.ownerDocument.addEventListener("keydown", enterByShortcut, true);
    host.ownerDocument.addEventListener("keydown", restoreBoundary);
    return () => {
      host.removeEventListener("focusout", clearAbandonedFocus);
      host.ownerDocument.removeEventListener(
        "focusin",
        revealReturnedFocus,
        true,
      );
      host.ownerDocument.removeEventListener("keydown", enterByShortcut, true);
      host.ownerDocument.removeEventListener("keydown", restoreBoundary);
      // Unmount retires the listener before Sonner restores with preventScroll.
      // The recorded entry belongs only to the still-focused notification owner.
      const previous = entry;
      entry = null;
      if (previous?.isConnected) {
        previous.focus();
        previous.scrollIntoView({ block: "nearest" });
      }
    };
  }, [hotkey]);

  return (
    <Sonner
      ref={region}
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      icons={{
        success: <CircleCheckIcon className="size-4" />,
        info: <InfoIcon className="size-4" />,
        warning: <TriangleAlertIcon className="size-4" />,
        error: <OctagonXIcon className="size-4" />,
        loading: <Loader2Icon className="size-4 animate-spin" />,
      }}
      style={
        {
          "--normal-bg": "var(--popover)",
          "--normal-text": "var(--popover-foreground)",
          "--normal-border": "var(--border)",
          "--border-radius": "var(--radius)",
        } as React.CSSProperties
      }
      {...props}
    />
  );
};

export { Toaster };
