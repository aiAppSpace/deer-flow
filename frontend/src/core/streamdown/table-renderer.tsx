"use client";

/*
 * Table presentation adapted from Streamdown 2.5 (Apache-2.0, Vercel Inc.).
 * The public table override owns only the containers and modal lifetime;
 * Streamdown retains copy, download, serialization and menu behavior.
 */
import * as Dialog from "@radix-ui/react-dialog";
import { useContext, type ComponentProps } from "react";
import {
  StreamdownContext,
  TableCopyDropdown,
  TableDownloadDropdown,
  type ExtraProps,
} from "streamdown";

import { enterDialogContent } from "@/components/ui/dialog";
import { useI18n } from "@/core/i18n/hooks";
import { StreamdownControlIcon } from "@/core/streamdown/control-icon";
import { cn } from "@/lib/utils";

export function TableRenderer({
  children,
  className,
  node: _node,
  ...props
}: ComponentProps<"table"> & ExtraProps) {
  const { t } = useI18n();
  const { controls, isAnimating } = useContext(StreamdownContext);
  const enabled = (control: "copy" | "download" | "fullscreen") => {
    if (typeof controls === "boolean") return controls;
    const settings = controls.table;
    return (
      settings !== false &&
      (typeof settings !== "object" || settings[control] !== false)
    );
  };
  const copy = enabled("copy");
  const download = enabled("download");
  const fullscreen = enabled("fullscreen");

  return (
    <Dialog.Root>
      <div
        className="border-border bg-sidebar my-4 flex flex-col gap-2 rounded-lg border p-2"
        data-streamdown="table-wrapper"
      >
        {(copy || download || fullscreen) && (
          <div className="flex items-center justify-end gap-1">
            {copy && <TableCopyDropdown />}
            {download && <TableDownloadDropdown />}
            {fullscreen && (
              <Dialog.Trigger asChild>
                <button
                  type="button"
                  disabled={isAnimating}
                  title={t.markdown.viewFullscreen}
                  className="text-muted-foreground hover:text-foreground cursor-pointer p-1 transition-all disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <StreamdownControlIcon name="fullscreen" size={14} />
                </button>
              </Dialog.Trigger>
            )}
          </div>
        )}
        <div className="border-border bg-background border-collapse overflow-x-auto overflow-y-auto rounded-md border">
          <table
            {...props}
            className={cn("divide-border w-full divide-y", className)}
            data-streamdown="table"
          >
            {children}
          </table>
        </div>
      </div>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50" />
        <Dialog.Content
          className="bg-background fixed inset-0 z-50 flex flex-col"
          data-streamdown="table-fullscreen"
          onKeyDown={enterDialogContent}
        >
          <Dialog.Title className="sr-only">
            {t.markdown.viewFullscreen}
          </Dialog.Title>
          <Dialog.Description className="sr-only">
            {t.markdown.viewFullscreen}
          </Dialog.Description>
          <div
            className="flex h-full min-h-0 flex-col"
            data-streamdown="table-wrapper"
          >
            <div className="flex items-center justify-end gap-1 p-4">
              {copy && <TableCopyDropdown />}
              {download && <TableDownloadDropdown />}
              <Dialog.Close asChild>
                <button
                  type="button"
                  title={t.markdown.exitFullscreen}
                  className="text-muted-foreground hover:bg-muted hover:text-foreground rounded-md p-1 transition-all"
                >
                  <StreamdownControlIcon name="close" size={20} />
                </button>
              </Dialog.Close>
            </div>
            <div className="flex-1 overflow-auto p-4 pt-0 [&_thead]:sticky [&_thead]:top-0 [&_thead]:z-10">
              <table
                className="border-border w-full border-collapse border"
                data-streamdown="table"
              >
                {children}
              </table>
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
