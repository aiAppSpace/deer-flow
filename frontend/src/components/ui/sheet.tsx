"use client";

import * as React from "react";
import * as SheetPrimitive from "@radix-ui/react-dialog";
import { XIcon } from "lucide-react";

import { cn } from "@/lib/utils";
import {
  enterDialogContent,
  useDialogContentRef,
} from "@/components/ui/dialog-focus-boundary";

function Sheet({ ...props }: React.ComponentProps<typeof SheetPrimitive.Root>) {
  return <SheetPrimitive.Root data-slot="sheet" {...props} />;
}

function SheetTrigger({
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Trigger>) {
  return <SheetPrimitive.Trigger data-slot="sheet-trigger" {...props} />;
}

function SheetClose({
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Close>) {
  return <SheetPrimitive.Close data-slot="sheet-close" {...props} />;
}

function SheetPortal({
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Portal>) {
  return <SheetPrimitive.Portal data-slot="sheet-portal" {...props} />;
}

function SheetOverlay({
  className,
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Overlay>) {
  return (
    <SheetPrimitive.Overlay
      data-slot="sheet-overlay"
      className={cn(
        "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 fixed inset-0 z-50 bg-black/50",
        className,
      )}
      {...props}
    />
  );
}

function SheetContent({
  className,
  children,
  side = "right",
  onFocusCapture,
  onBlurCapture,
  onKeyDown,
  ref,
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Content> & {
  side?: "top" | "right" | "bottom" | "left";
}) {
  const contentRef = useDialogContentRef(ref);
  const revision = React.useRef(0);
  const pending = React.useRef<{ view: Window; id: number } | undefined>(
    undefined,
  );
  const retireReveal = React.useCallback(() => {
    revision.current++;
    if (pending.current) {
      pending.current.view.cancelAnimationFrame(pending.current.id);
      pending.current = undefined;
    }
  }, []);
  React.useEffect(() => retireReveal, [retireReveal]);

  function focusOwner(event: React.FocusEvent<HTMLDivElement>) {
    const host = event.currentTarget;
    const view = host.ownerDocument.defaultView;
    const target = event.target;
    if (
      !view ||
      !(target instanceof view.HTMLElement) ||
      !host.contains(target) ||
      target.closest(
        '[data-slot="dialog-content"],[data-slot="sheet-content"]',
      ) !== host
    )
      return;
    return { host, view, target };
  }
  return (
    <SheetPortal>
      <SheetOverlay />
      <SheetPrimitive.Content
        ref={contentRef}
        data-slot="sheet-content"
        className={cn(
          "bg-background data-[state=open]:animate-in data-[state=closed]:animate-out fixed z-50 flex flex-col gap-4 shadow-lg transition ease-in-out data-[state=closed]:duration-300 data-[state=open]:duration-500",
          side === "right" &&
            "data-[state=closed]:slide-out-to-right data-[state=open]:slide-in-from-right inset-y-0 right-0 h-full w-3/4 border-l sm:max-w-sm",
          side === "left" &&
            "data-[state=closed]:slide-out-to-left data-[state=open]:slide-in-from-left inset-y-0 left-0 h-full w-3/4 border-r sm:max-w-sm",
          side === "top" &&
            "data-[state=closed]:slide-out-to-top data-[state=open]:slide-in-from-top inset-x-0 top-0 h-auto border-b",
          side === "bottom" &&
            "data-[state=closed]:slide-out-to-bottom data-[state=open]:slide-in-from-bottom inset-x-0 bottom-0 h-auto border-t",
          className,
        )}
        onFocusCapture={(event) => {
          onFocusCapture?.(event);
          const owner = focusOwner(event);
          if (
            !owner ||
            owner.target.ownerDocument.activeElement !== owner.target
          )
            return;
          retireReveal();
          if (event.defaultPrevented) return;
          const { host, view, target } = owner;
          const current = revision.current;
          const id = view.requestAnimationFrame(() => {
            if (
              current === revision.current &&
              host.isConnected &&
              host.dataset.state !== "closed" &&
              host.contains(target) &&
              target.isConnected &&
              target.ownerDocument.activeElement === target
            ) {
              pending.current = undefined;
              target.scrollIntoView({ block: "nearest" });
            }
          });
          pending.current = { view, id };
        }}
        onBlurCapture={(event) => {
          onBlurCapture?.(event);
          if (focusOwner(event)) retireReveal();
        }}
        onKeyDown={(event) => {
          onKeyDown?.(event);
          enterDialogContent(event);
        }}
        {...props}
      >
        {children}
        <SheetPrimitive.Close className="ring-offset-background focus:ring-ring data-[state=open]:bg-secondary absolute top-4 right-4 rounded-xs opacity-70 transition-opacity hover:opacity-100 focus:ring-2 focus:ring-offset-2 focus:outline-hidden disabled:pointer-events-none">
          <XIcon className="size-4" />
          <span className="sr-only">Close</span>
        </SheetPrimitive.Close>
      </SheetPrimitive.Content>
    </SheetPortal>
  );
}

function SheetHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="sheet-header"
      className={cn("flex flex-col gap-1.5 p-4", className)}
      {...props}
    />
  );
}

function SheetFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="sheet-footer"
      className={cn("mt-auto flex flex-col gap-2 p-4", className)}
      {...props}
    />
  );
}

function SheetTitle({
  className,
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Title>) {
  return (
    <SheetPrimitive.Title
      data-slot="sheet-title"
      className={cn("text-foreground font-semibold", className)}
      {...props}
    />
  );
}

function SheetDescription({
  className,
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Description>) {
  return (
    <SheetPrimitive.Description
      data-slot="sheet-description"
      className={cn("text-muted-foreground text-sm", className)}
      {...props}
    />
  );
}

export {
  Sheet,
  SheetTrigger,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetFooter,
  SheetTitle,
  SheetDescription,
};
