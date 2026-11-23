import { onScopeDispose } from "vue";
import { useQueryClient } from "@tanstack/vue-query";
import { captureWorkspaceQueryOwner } from "@/core/auth/workspace-queries";

/** Capture before awaiting; both unmount and account reset retire local effects. */
export function useWorkspaceAsyncOwner() {
  const client = useQueryClient();
  let disposed = false;
  onScopeDispose(() => {
    disposed = true;
  });
  return () => {
    const ownsAccount = captureWorkspaceQueryOwner(client);
    return () => !disposed && ownsAccount();
  };
}
