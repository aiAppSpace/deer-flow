/*
  【文件职责】     归档/恢复会话的产品动作：写入 + 成功提示 + 撤销。
  【架构位置】     L3 composable
  【主要导出】     useThreadArchiveAction
  【依赖关系】     core/threads/archive · core/workspace-shell/toast
  【边界与注意】   **撤销是提示条上的一颗动作键**，不是单独的 UI：归档之后那一行会立刻
                   离开侧栏列表，没有地方再放「撤销」。提示条是唯一还在的落点。

                   成功/失败回调注册在 mutation 级（见 core/threads/archive.ts 的文件头）：
                   按调用传入会随着那一行卸载而丢失，提示就静默没了。
*/
import { useArchiveThread } from "@/core/threads/archive";
import { useWorkspaceToast } from "@/core/workspace-shell/toast";

export function useThreadArchiveAction() {
  const { $i18n } = useNuxtApp();
  const toast = useWorkspaceToast();

  const mutation = useArchiveThread({
    onSuccess(_data, { threadId, archived }) {
      if (archived) {
        toast.success($i18n.t.value.chats.archiveSuccess, {
          description: $i18n.t.value.chats.archiveDescription,
          action: {
            label: $i18n.t.value.chats.undoArchive,
            onClick: () => setArchived(threadId, false),
          },
        });
      } else {
        toast.success($i18n.t.value.chats.restoreSuccess);
      }
    },
    onError() {
      toast.error($i18n.t.value.chats.archiveFailed);
    },
  });

  function setArchived(threadId: string, archived: boolean) {
    mutation.mutate({ threadId, archived });
  }

  return { setArchived, isPending: mutation.isPending };
}
