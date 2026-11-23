import { createRouteAnnouncements } from "@/core/workspace-shell/route-announcement";

// Per Nuxt app/request: never a shared module singleton or serialized useState.
export default defineNuxtPlugin(() => ({
  provide: { routeAnnouncements: createRouteAnnouncements() },
}));
