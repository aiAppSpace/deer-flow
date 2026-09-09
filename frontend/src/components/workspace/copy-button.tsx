import { CheckIcon, CopyIcon } from "lucide-react";
import { useCallback, useState, type ComponentProps } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { writeTextToClipboard } from "@/core/clipboard";
import { useI18n } from "@/core/i18n/hooks";

import { Tooltip } from "./tooltip";

export function CopyButton({
  clipboardData,
  ...props
}: ComponentProps<typeof Button> & {
  clipboardData: string;
}) {
  const { t } = useI18n();
  const [copied, setCopied] = useState(false);
  const handleCopy = useCallback(() => {
    void (async () => {
      const didCopy = await writeTextToClipboard(clipboardData);
      if (!didCopy) {
        toast.error(t.clipboard.failedToCopyToClipboard);
        return;
      }

      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    })().catch(() => {
      toast.error(t.clipboard.failedToCopyToClipboard);
    });
  }, [clipboardData, t.clipboard.failedToCopyToClipboard]);
  return (
    <Tooltip content={t.clipboard.copyToClipboard}>
      {/*
        The tooltip is not an accessible name: Radix wires it as
        `aria-describedby`, so a screen reader announced this icon-only control
        as a bare "button". Name it explicitly, the same way the sibling
        "Edit and rerun" trigger in message-list-item.tsx already does.
        `aria-label` stays ahead of `{...props}` so callers can still override.
      */}
      <Button
        aria-label={
          copied ? t.clipboard.copiedToClipboard : t.clipboard.copyToClipboard
        }
        size="icon-sm"
        type="button"
        variant="ghost"
        onClick={handleCopy}
        {...props}
      >
        {copied ? (
          <CheckIcon className="text-green-500" size={12} />
        ) : (
          <CopyIcon size={12} />
        )}
      </Button>
    </Tooltip>
  );
}
