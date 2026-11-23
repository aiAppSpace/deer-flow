"use client";

import * as DialogPrimitive from "@radix-ui/react-dialog";
import { XIcon } from "lucide-react";
import * as React from "react";

import { cn } from "@/lib/utils";
import {
  enterDialogContent,
  useDialogContentRef,
} from "@/components/ui/dialog-focus-boundary";

function Dialog({
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Root>) {
  return <DialogPrimitive.Root data-slot="dialog" {...props} />;
}

function DialogTrigger({
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Trigger>) {
  return <DialogPrimitive.Trigger data-slot="dialog-trigger" {...props} />;
}

function DialogPortal({
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Portal>) {
  return <DialogPrimitive.Portal data-slot="dialog-portal" {...props} />;
}

function DialogClose({
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Close>) {
  return <DialogPrimitive.Close data-slot="dialog-close" {...props} />;
}

function DialogOverlay({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Overlay>) {
  return (
    <DialogPrimitive.Overlay
      data-slot="dialog-overlay"
      className={cn(
        "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 fixed inset-0 z-50 bg-black/50",
        className,
      )}
      {...props}
    />
  );
}

function DialogContent({
  className,
  children,
  showCloseButton = true,
  onFocusCapture,
  onBlurCapture,
  onPointerDownCapture,
  onKeyDownCapture,
  onKeyDown,
  ref,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Content> & {
  showCloseButton?: boolean;
}) {
  const boundaryRef = useDialogContentRef(ref);
  const focusModality = React.useRef<"keyboard" | "pointer">("keyboard");
  const focusRevision = React.useRef(0);
  const pendingReveal = React.useRef<{ view: Window; id: number } | undefined>(
    undefined,
  );
  const retireFocusReveal = React.useCallback(() => {
    focusRevision.current++;
    const pending = pendingReveal.current;
    if (pending) {
      pending.view.cancelAnimationFrame(pending.id);
      pendingReveal.current = undefined;
    }
  }, []);
  React.useEffect(() => retireFocusReveal, [retireFocusReveal]);
  // Tab can start on body or a library guard after nested content closes.
  // Modality belongs to the document before focus re-enters this host.
  const contentRef = React.useCallback(
    (container: HTMLDivElement | null) => {
      const release = boundaryRef(container);
      if (!container) return release;
      const ownerDocument = container.ownerDocument;
      const recordKeyboard = (event: KeyboardEvent) => {
        if (!event.altKey && !event.ctrlKey && !event.metaKey)
          focusModality.current = "keyboard";
      };
      ownerDocument.addEventListener("keydown", recordKeyboard, true);
      return () => {
        ownerDocument.removeEventListener("keydown", recordKeyboard, true);
        release?.();
      };
    },
    [boundaryRef],
  );

  function ownedFocusTarget(event: React.SyntheticEvent<HTMLDivElement>) {
    const host = event.currentTarget;
    const view = host.ownerDocument.defaultView;
    const target = event.target;
    // Nested portals bubble through React ancestors, but have their own host.
    if (
      !view ||
      !(target instanceof view.HTMLElement) ||
      !host.contains(target) ||
      target.closest('[data-slot="dialog-content"]') !== host
    )
      return;
    return { host, target, view };
  }

  return (
    <DialogPortal data-slot="dialog-portal">
      <DialogOverlay />
      <DialogPrimitive.Content
        ref={contentRef}
        data-slot="dialog-content"
        className={cn(
          "bg-background data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 fixed top-[50%] left-[50%] z-50 grid max-h-[calc(100dvh-32px)] w-full max-w-[calc(100%-32px)] min-w-0 translate-x-[-50%] translate-y-[-50%] grid-cols-[minmax(0,1fr)] gap-4 overflow-x-hidden overflow-y-auto rounded-lg border p-4 shadow-lg duration-200 outline-none sm:max-w-lg sm:p-6",
          className,
        )}
        onFocusCapture={(event) => {
          onFocusCapture?.(event);
          const owner = ownedFocusTarget(event);
          if (
            !owner ||
            owner.target.ownerDocument.activeElement !== owner.target
          )
            return;
          retireFocusReveal();
          if (event.defaultPrevented || focusModality.current === "pointer")
            return;
          const { host, target, view } = owner;
          const revision = focusRevision.current;
          const id = view.requestAnimationFrame(() => {
            if (
              revision !== focusRevision.current ||
              !host.isConnected ||
              host.dataset.state === "closed" ||
              !host.contains(target) ||
              target.ownerDocument.activeElement !== target
            )
              return;
            pendingReveal.current = undefined;
            let block: ScrollLogicalPosition = "nearest";
            for (
              let node: HTMLElement | null = target;
              node;
              node = node.parentElement
            ) {
              if (
                /^(auto|scroll)$/.test(view.getComputedStyle(node).overflowY) &&
                node.scrollHeight > node.clientHeight
              ) {
                block = "center";
                break;
              }
              if (node === host) break;
            }
            target.scrollIntoView({ block });
          });
          pendingReveal.current = { view, id };
        }}
        onBlurCapture={(event) => {
          onBlurCapture?.(event);
          if (ownedFocusTarget(event)) retireFocusReveal();
        }}
        onPointerDownCapture={(event) => {
          onPointerDownCapture?.(event);
          if (!ownedFocusTarget(event)) return;
          retireFocusReveal();
          focusModality.current = "pointer";
        }}
        onKeyDownCapture={(event) => {
          onKeyDownCapture?.(event);
          if (ownedFocusTarget(event)) focusModality.current = "keyboard";
        }}
        onKeyDown={(event) => {
          onKeyDown?.(event);
          // Async removal can make FocusScope focus its -1 container. Reverse
          // Tab from that node otherwise leaves and is trapped back forever.
          enterDialogContent(event);
        }}
        {...props}
      >
        {children}
        {/*
          The close button is a 28px target, not a bare 16px icon. Without
          `size-7` the hit area is exactly the glyph, which is below the 24x24
          minimum in WCAG 2.5.8 (Target Size, Minimum) and is noticeably hard
          to hit on a trackpad. `cursor-pointer` is explicit because Tailwind
          4's preflight does not give buttons a pointer cursor; every Button
          variant states it for the same reason.
        */}
        {showCloseButton && (
          <DialogPrimitive.Close
            data-slot="dialog-close"
            className="ring-offset-background focus:ring-ring data-[state=open]:bg-accent data-[state=open]:text-muted-foreground absolute top-4 right-4 flex size-7 cursor-pointer items-center justify-center rounded-md opacity-70 transition-opacity hover:opacity-100 focus:ring-2 focus:ring-offset-2 focus:outline-hidden disabled:pointer-events-none [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4"
          >
            <XIcon />
            <span className="sr-only">Close</span>
          </DialogPrimitive.Close>
        )}
      </DialogPrimitive.Content>
    </DialogPortal>
  );
}

function DialogHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="dialog-header"
      className={cn("flex flex-col gap-2 text-center sm:text-left", className)}
      {...props}
    />
  );
}

function DialogFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="dialog-footer"
      className={cn(
        "flex flex-col-reverse gap-2 sm:flex-row sm:justify-end",
        className,
      )}
      {...props}
    />
  );
}

function DialogTitle({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Title>) {
  return (
    <DialogPrimitive.Title
      data-slot="dialog-title"
      className={cn("text-lg leading-none font-semibold", className)}
      {...props}
    />
  );
}

function DialogDescription({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Description>) {
  return (
    <DialogPrimitive.Description
      data-slot="dialog-description"
      className={cn("text-muted-foreground text-sm", className)}
      {...props}
    />
  );
}

export {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
  DialogTrigger,
  enterDialogContent,
};
