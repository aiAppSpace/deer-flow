# Vue capabilities and extensions alignment audit

Source baseline: React on main-wc after merge a78045395 (2026-10-09). This report records implementation evidence, not a whole-product completion claim.

## Source differences

| Surface | React baseline | Vue before this work | Required implementation |
| --- | --- | --- | --- |
| Capability center | `/workspace/capabilities`, Plugins/Skills/Extensions tabs with URL navigation and query search | Old settings-only skill/tool/integration screens | Native Vue center, exact directory/card layouts and state behavior |
| Plugin directory | Catalog manifests, categories, installed filter, platform/personal sections | Flat administrator MCP list | Catalog reads and sanitized installation projections; personal MCP mutations distinct from deployment admin mutations |
| Plugin settings | Business schema credential forms; MCP HTTP connection configuration; Lark flow | Legacy Lark integration settings | Manifest-driven forms and user-scoped installs; preserved existing Lark authorization fences |
| MCP presentation | Validated local PNG upload, brand assets, stable capability identity | Text-only rows | Shared icon resolver, staged image decode/reset and targeted saves |
| Skills | Builtin/community/custom/all source filters, localized presentation, card/detail, admin export | Public/custom text list and archive install | Same card UI, source identity, archive checks, export manifest/revision handling |
| Full-stack extensions | User-keyed descriptors, authenticated inline/asset modules, mount/dispose Shadow DOM, page contributions, backend action allowlists | Absent | Native Vue host and dynamic `/workspace/extensions/[namespace]/[surface_id]` route |

## Ownership

This work owns Vue capability and extension core/helpers/composables/components/routes, compatible MCP API additions and skill export. The root agent owns global locales, shell navigation/settings links, baselines, agent/composer consumers and final integration acceptance. No backend business feature is introduced: these are implementations of existing upstream product interfaces and extension contribution points.

## Validation

Pending implementation and focused tests. Browser comparison and whole-project gates are recorded by the root agent.
