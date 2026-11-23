"use client";

import { FileTextIcon, XIcon } from "lucide-react";
import { useEffect, useRef } from "react";

import { Button } from "@/components/ui/button";
import { useI18n } from "@/core/i18n/hooks";

import { useMaybeMessageDetails } from "./context";

export function MessageDetailsPanel() {
  const { t } = useI18n();
  const details = useMaybeMessageDetails();
  const selected = details?.selectedDetail;
  const headingRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    if (details?.open && selected) {
      headingRef.current?.focus({ preventScroll: true });
    }
  }, [details?.open, selected]);
  if (!details?.open || !selected) return null;

  return (
    <section
      className="bg-background flex h-full min-h-0 flex-col"
      aria-label={selected.title}
      onKeyDown={(event) => {
        if (event.key === "Escape" && !event.defaultPrevented) {
          event.preventDefault();
          event.stopPropagation();
          details.close();
        }
      }}
    >
      <header className="flex shrink-0 flex-wrap items-center gap-2 border-b px-5 py-3">
        <div className="flex max-w-full min-w-0 flex-auto items-center gap-2">
          <FileTextIcon className="text-muted-foreground size-4" />
          <h2
            ref={headingRef}
            tabIndex={-1}
            className="min-w-0 flex-1 truncate text-sm font-medium outline-none"
          >
            {selected.title}
          </h2>
        </div>
        <div className="ml-auto flex shrink-0 items-center gap-2">
          {selected.actions}
          <Button
            size="icon-sm"
            variant="ghost"
            aria-label={t.common.close}
            title={t.common.close}
            onClick={() => details.close()}
          >
            <XIcon className="size-4" />
          </Button>
        </div>
      </header>
      <div
        className="min-h-0 flex-1 overflow-y-auto overscroll-contain"
        key={selected.id}
      >
        {selected.content}
      </div>
    </section>
  );
}
