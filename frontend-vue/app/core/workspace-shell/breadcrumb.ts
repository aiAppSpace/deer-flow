/**
 * WorkspaceHeader follows React's actual navigation policy. A reachable index
 * page is not automatically a breadcrumb link: capabilities and trash remain
 * current-page labels. The guard accounts for both policies and rejects links
 * to missing routes, including the projects section without an index page.
 */
export const LINKABLE_SECTIONS: Record<string, true> = {
  agents: true,
  chats: true,
  "scheduled-tasks": true,
};

/** Reachable sections intentionally rendered as the current breadcrumb page. */
export const CURRENT_PAGE_SECTIONS = ["capabilities", "trash"] as const;

export function isLinkableSection(segment: string | undefined): boolean {
  return Boolean(segment && LINKABLE_SECTIONS[segment]);
}
