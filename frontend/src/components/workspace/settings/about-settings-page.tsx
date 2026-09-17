"use client";

import { SafeStreamdown } from "@/core/streamdown/components";

import { aboutMarkdown } from "./about-content";

export function AboutSettingsPage() {
  /*
    `wrap-anywhere` because this page's headings are single long words at
    text-2xl: "🙌 Acknowledgments" is the widest thing here, and at 360px the
    settings panel's content column is about 200px. Measured on CI's Linux
    fonts, that heading pushed the whole panel 4px past its grid cell
    (panelSlack -3) while macOS metrics left 41px of slack — a defect that
    only exists on one platform looks exactly like no defect at all.
    `break-word` would not help: per css-text-3 the wrap opportunities it adds
    are ignored when computing min-content. `anywhere` counts them, and only
    ever breaks a word that has no other way to fit.
  */
  return (
    <SafeStreamdown className="wrap-anywhere">{aboutMarkdown}</SafeStreamdown>
  );
}
