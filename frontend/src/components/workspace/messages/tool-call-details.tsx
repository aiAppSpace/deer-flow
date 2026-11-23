"use client";

import type { Message } from "@langchain/langgraph-sdk";
import { useEffect, useId, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { writeTextToClipboard } from "@/core/clipboard";
import { useI18n } from "@/core/i18n/hooks";
import { formatToolDetail } from "@/core/messages/tool-detail-preview";

export function ToolCallDetails({
  name,
  callId,
  args,
  resultMessage,
}: {
  name: string;
  callId?: string;
  args: Record<string, unknown>;
  resultMessage?: Extract<Message, { type: "tool" }>;
}) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const panelId = useId();
  return (
    <div className="@container/tool-details min-w-0">
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="h-auto min-h-8 max-w-full min-w-0 wrap-anywhere whitespace-normal"
        aria-label={`${t.toolCalls.details}: ${name}${callId ? ` (${callId})` : ""}`}
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen(!open)}
      >
        {t.toolCalls.details}
      </Button>
      {open && (
        <div
          id={panelId}
          className="space-y-3 rounded-md border p-3 @max-md/tool-details:p-2"
        >
          <Payload label={t.toolCalls.toolName} value={name} />
          <Payload label={t.toolCalls.callId} value={callId ?? "—"} />
          <Payload label={t.toolCalls.input} value={args} />
          {resultMessage ? (
            <Payload
              label={
                resultMessage.status === "error"
                  ? t.toolCalls.error
                  : t.toolCalls.result
              }
              value={resultMessage.content}
            />
          ) : (
            <p>{t.toolCalls.noResult}</p>
          )}
        </div>
      )}
    </div>
  );
}

function Payload({ label, value }: { label: string; value: unknown }) {
  const { t } = useI18n();
  const preview = useMemo(() => formatToolDetail(value), [value]);
  const [copyStatus, setCopyStatus] = useState<{
    text: string;
    message: string;
  }>();
  const visibleText = preview.text === "" ? '""' : preview.text;
  useEffect(() => {
    if (!copyStatus) return;
    const timer = setTimeout(() => setCopyStatus(undefined), 2000);
    return () => clearTimeout(timer);
  }, [copyStatus]);
  async function copy() {
    try {
      if (!(await writeTextToClipboard(visibleText))) {
        throw new Error("Clipboard write failed");
      }
      setCopyStatus({
        text: visibleText,
        message: t.clipboard.copiedToClipboard,
      });
    } catch {
      setCopyStatus({
        text: visibleText,
        message: t.clipboard.failedToCopyToClipboard,
      });
    }
  }
  return (
    <section aria-label={label} className="min-w-0 space-y-1">
      <div className="@container/tool-payload flex flex-wrap items-center justify-between gap-2">
        <span className="font-medium">{label}</span>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="@max-md/tool-payload:h-auto @max-md/tool-payload:min-h-8 @max-md/tool-payload:max-w-full @max-md/tool-payload:min-w-0 @max-md/tool-payload:px-0 @max-md/tool-payload:wrap-anywhere @max-md/tool-payload:whitespace-normal"
          aria-label={`${t.clipboard.copyToClipboard}: ${label}`}
          onClick={copy}
        >
          {t.clipboard.copyToClipboard}
        </Button>
      </div>
      <pre className="bg-muted max-h-64 overflow-auto rounded p-2 text-xs break-all whitespace-pre-wrap">
        {visibleText}
      </pre>
      {preview.text === "" && (
        <p className="text-xs">{t.toolCalls.emptyResult}</p>
      )}
      {preview.truncated && <p className="text-xs">{t.toolCalls.truncated}</p>}
      <span role="status" className="text-xs">
        {copyStatus?.text === visibleText ? copyStatus.message : ""}
      </span>
    </section>
  );
}
