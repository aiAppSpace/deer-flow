import {
  RESERVED_SLASH_SKILL_NAMES as CONTRACT_RESERVED_NAMES,
  SLASH_SKILL_PATTERN_SOURCE,
} from "../contracts/backend.gen";

import type { Skill } from "./type";

/**
 * Composer control names that may own the leading slash when their command
 * syntax matches. `/context compact` is a command; other `/context` input
 * can activate the enabled context skill, as in the current backend. Both this set and {@link SLASH_SKILL_RE} come from
 * `contracts/slash_skill_contract.json`, which the backend gate in
 * `deerflow/skills/slash.py` is pinned to as well — so the reserved list and the
 * name grammar have exactly one source of truth across both languages.
 */
export const RESERVED_SLASH_SKILL_NAMES: ReadonlySet<string> = new Set(
  CONTRACT_RESERVED_NAMES,
);

export const SLASH_SKILL_RE = new RegExp(SLASH_SKILL_PATTERN_SOURCE);
const CONTEXT_COMPACT_ARGUMENT = "compact";

export type SlashSkillReference = {
  name: string;
  remainingText: string;
};

/**
 * Parse strict `/skill-name task` syntax, ignoring reserved control commands.
 * Mirrors the backend `parse_slash_skill_reference`; returns null when the text
 * is not a slash-skill activation.
 */
export function parseSlashSkillReference(
  text: string,
): SlashSkillReference | null {
  const match = SLASH_SKILL_RE.exec(text);
  if (!match) {
    return null;
  }
  const name = match[1];
  const remainingText = text.slice(match[0].length).replace(/^\s+/, "");
  const isContextSkillTask =
    name === "context" &&
    remainingText.trim().toLowerCase() !== CONTEXT_COMPACT_ARGUMENT;
  if (!name || (RESERVED_SLASH_SKILL_NAMES.has(name) && !isContextSkillTask)) {
    return null;
  }
  return {
    name,
    remainingText,
  };
}

/**
 * Resolve a slash-skill reference against the enabled skill catalog, matching
 * the backend `resolve_slash_skill` gate: only an installed + enabled skill
 * activates. Returns null when the text is not a slash command or the skill is
 * unknown/disabled, so callers fall back to plain-text rendering.
 */
export function resolveSlashSkillDisplay(
  text: string,
  skills: Skill[],
): SlashSkillReference | null {
  const reference = parseSlashSkillReference(text);
  if (!reference) {
    return null;
  }
  const enabled = skills.some(
    (skill) => skill.enabled && skill.name === reference.name,
  );
  return enabled ? reference : null;
}
