"use client";

import { useParams, usePathname, useRouter } from "next/navigation";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { resetThreadChatAfterDelete } from "@/components/workspace/chats/use-thread-chat";
import { useAuth } from "@/core/auth/AuthProvider";
import { useI18n } from "@/core/i18n/hooks";
import { useDeleteThread } from "@/core/threads/hooks";
import type { AgentThread } from "@/core/threads/types";
import { pathOfThread, titleOfThread } from "@/core/threads/utils";

type DeleteTarget = {
  thread: AgentThread;
  recentThreadId?: string | undefined;
};
type DeleteFocusCompletion = {
  focus?: () => void;
  sourcePath: string;
  sourceSearch: string;
  nextPath: string;
  accountRevision: number;
};
const ThreadDeleteContext = createContext<
  ((target: DeleteTarget) => void) | null
>(null);

export function useThreadDeleteDialog() {
  const requestDelete = useContext(ThreadDeleteContext);
  if (!requestDelete) throw new Error("ThreadDeleteDialogProvider is required");
  return requestDelete;
}

export function ThreadDeleteDialogProvider({
  children,
}: {
  children: ReactNode;
}) {
  const { t } = useI18n();
  const { user } = useAuth();
  const accountRevision = useRef(0);
  useLayoutEffect(() => {
    accountRevision.current += 1;
  }, [user?.id]);
  const router = useRouter();
  const pathname = usePathname();
  const { thread_id: threadIdFromPath, agent_name: agentNameFromPath } =
    useParams<{ thread_id: string; agent_name?: string }>();
  const {
    mutateAsync: deleteThread,
    isPending: isDeleting,
    isError: deleteFailed,
  } = useDeleteThread();
  // A partial deletion can remove the row on a list refresh. Keep its snapshot
  // and the retry dialog in this stable host, outside the virtualized lists.
  const [target, setTarget] = useState<DeleteTarget | null>(null);
  const active = useRef(true);
  useEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
    };
  }, []);
  const deleteInFlight = useRef(false);
  const deletingAccount = useRef<number | null>(null);
  const completedFocus = useRef<DeleteFocusCompletion | null>(null);
  const requestedAccount = useRef<number | null>(null);
  const deleteCancelRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    // Wait for React to re-enable the button before restoring focus.
    if (
      target &&
      deleteFailed &&
      !isDeleting &&
      deletingAccount.current === accountRevision.current
    )
      deleteCancelRef.current?.focus();
  }, [target, deleteFailed, isDeleting]);

  const handleDelete = useCallback(async () => {
    if (!target || deleteInFlight.current) return;
    const { thread, recentThreadId } = target;
    deleteInFlight.current = true;
    const operationAccount = accountRevision.current;
    deletingAccount.current = operationAccount;
    const currentPathname =
      typeof window === "undefined" ? pathname : window.location.pathname;
    const currentSearch =
      typeof window === "undefined" ? "" : window.location.search;
    const threadPath = pathOfThread(thread);
    const nextThreadPath = pathOfThread("new", {
      agent_name: agentNameFromPath,
    });
    const isNewThreadPath = currentPathname === nextThreadPath;
    const isCurrentThread =
      thread.thread_id === threadIdFromPath ||
      threadPath === currentPathname ||
      (isNewThreadPath && recentThreadId === thread.thread_id);

    try {
      await deleteThread({
        threadId: thread.thread_id,
        onDeleted: isCurrentThread
          ? () => {
              // The pending deletion cannot reset a later navigation or new-chat scope.
              if (
                !active.current ||
                operationAccount !== accountRevision.current ||
                (typeof window !== "undefined" &&
                  (window.location.pathname !== currentPathname ||
                    window.location.search !== currentSearch))
              )
                return;
              const completion: DeleteFocusCompletion = {
                accountRevision: operationAccount,
                sourcePath: currentPathname,
                sourceSearch: currentSearch,
                nextPath: nextThreadPath,
              };
              completedFocus.current = completion;
              resetThreadChatAfterDelete({
                deletedThreadId: thread.thread_id,
                nextPath: nextThreadPath,
                force: true,
                claimFocus: (focus) => {
                  completion.focus = focus;
                },
              });
              void router.replace(nextThreadPath);
            }
          : undefined,
      });
      if (active.current) setTarget(null);
    } catch (error) {
      if (!active.current) return;
      if (operationAccount !== accountRevision.current) {
        setTarget(null);
        return;
      }
      console.error("Failed to delete chat:", error);
      toast.error(
        error instanceof Error && error.message
          ? error.message
          : t.chats.deleteFailed,
      );
    } finally {
      deleteInFlight.current = false;
    }
  }, [
    agentNameFromPath,
    deleteThread,
    pathname,
    router,
    target,
    threadIdFromPath,
    t.chats.deleteFailed,
  ]);

  const requestDelete = useCallback((next: DeleteTarget) => {
    if (!deleteInFlight.current) {
      completedFocus.current = null;
      requestedAccount.current = accountRevision.current;
      setTarget(next);
    }
  }, []);
  return (
    <ThreadDeleteContext.Provider value={requestDelete}>
      {children}
      <Dialog
        open={target !== null}
        onOpenChange={(open) => {
          if (!open && !deleteInFlight.current) setTarget(null);
        }}
      >
        <DialogContent
          showCloseButton={!isDeleting}
          onCloseAutoFocus={(event) => {
            const completion = completedFocus.current;
            completedFocus.current = null;
            // Even a cancelled or retired request has a primitive default
            // return path. A connected opener may now belong to a new account.
            if (
              !active.current ||
              requestedAccount.current !== accountRevision.current
            ) {
              event.preventDefault();
              return;
            }
            if (!completion) return;
            // Successful current deletion retires its trigger. React has
            // committed the new UUID before the closing scope's cleanup;
            // resolve the current editor through its page ref, since the
            // existing ChatBox owner may have replaced its subtree.
            event.preventDefault();
            const currentPath = window.location.pathname;
            if (
              !active.current ||
              completion.accountRevision !== accountRevision.current ||
              !(
                (currentPath === completion.sourcePath &&
                  window.location.search === completion.sourceSearch) ||
                (currentPath === completion.nextPath && !window.location.search)
              )
            )
              return;
            const focused = document.activeElement;
            if (
              focused &&
              focused !== document.body &&
              !(
                event.target instanceof HTMLElement &&
                event.target.contains(focused)
              )
            )
              return;
            completion.focus?.();
          }}
          onOpenAutoFocus={(event) => {
            event.preventDefault();
            deleteCancelRef.current?.focus();
          }}
          onEscapeKeyDown={(event) => {
            if (deleteInFlight.current) event.preventDefault();
          }}
          onInteractOutside={(event) => {
            if (deleteInFlight.current) event.preventDefault();
          }}
        >
          <DialogHeader>
            <DialogTitle>{t.chats.deleteChat}</DialogTitle>
            <DialogDescription className="break-words">
              {target &&
                t.chats.deleteConfirm(
                  titleOfThread(target.thread, t.pages.untitled),
                )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              ref={deleteCancelRef}
              variant="outline"
              onClick={() => setTarget(null)}
              disabled={isDeleting}
            >
              {t.common.cancel}
            </Button>
            <Button
              variant="destructive"
              onClick={() => void handleDelete()}
              disabled={isDeleting}
            >
              {isDeleting ? t.common.loading : t.common.delete}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </ThreadDeleteContext.Provider>
  );
}
