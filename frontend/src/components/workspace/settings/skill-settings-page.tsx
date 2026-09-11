"use client";

import { LoaderIcon, SparklesIcon, UploadIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { type ChangeEvent, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import {
  Item,
  ItemActions,
  ItemTitle,
  ItemContent,
  ItemDescription,
} from "@/components/ui/item";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/core/auth/AuthProvider";
import { useI18n } from "@/core/i18n/hooks";
import {
  formatSkillSecurityFindings,
  MAX_SKILL_ARCHIVE_UPLOAD_BYTES,
  SkillRequestError,
} from "@/core/skills/api";
import {
  useEnableSkill,
  useSkills,
  useUploadSkillArchive,
} from "@/core/skills/hooks";
import type { Skill } from "@/core/skills/type";
import { env } from "@/env";

import { SettingsSection } from "./settings-section";

export function SkillSettingsPage({ onClose }: { onClose?: () => void } = {}) {
  const { t } = useI18n();
  const { skills, isLoading, error } = useSkills();
  const adminRequired =
    error instanceof SkillRequestError && error.isAdminRequired;
  return (
    <SettingsSection
      title={t.settings.skills.title}
      description={t.settings.skills.description}
    >
      {isLoading ? (
        <div className="text-muted-foreground text-sm">{t.common.loading}</div>
      ) : adminRequired ? (
        <div className="text-muted-foreground text-sm">
          {t.settings.skills.adminRequired}
        </div>
      ) : error ? (
        /*
          A failed load has to announce itself: this was a bare <div> with no
          role, so a screen reader never heard it, and the hardcoded "Error: "
          prefix stayed English under zh-CN. It also rendered as ordinary body
          text (16px, foreground) rather than as an error.
        */
        <p role="alert" className="text-destructive text-sm">
          {error.message}
        </p>
      ) : (
        <SkillSettingsList skills={skills} onClose={onClose} />
      )}
    </SettingsSection>
  );
}

function SkillSettingsList({
  skills,
  onClose,
}: {
  skills: Skill[];
  onClose?: () => void;
}) {
  const { t } = useI18n();
  const router = useRouter();
  const { user } = useAuth();
  const isAdmin = user?.system_role === "admin";
  const [filter, setFilter] = useState<string>("public");
  const { mutate: enableSkill } = useEnableSkill();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { mutateAsync: uploadSkillArchive, isPending: isUploading } =
    useUploadSkillArchive();
  const isArchiveUploadDisabled =
    isUploading || !isAdmin || env.NEXT_PUBLIC_STATIC_WEBSITE_ONLY === "true";
  const filteredSkills = useMemo(
    () => skills.filter((skill) => skill.category === filter),
    [skills, filter],
  );
  const handleCreateSkill = () => {
    onClose?.();
    router.push("/workspace/chats/new?mode=skill");
  };
  const handleSkillArchive = async (event: ChangeEvent<HTMLInputElement>) => {
    if (isUploading) {
      event.target.value = "";
      return;
    }
    const archive = event.target.files?.[0];
    event.target.value = "";
    if (!archive) return;
    if (!archive.name.toLowerCase().endsWith(".skill")) {
      toast.error(t.settings.skills.invalidArchive);
      return;
    }
    if (archive.size > MAX_SKILL_ARCHIVE_UPLOAD_BYTES) {
      toast.error(t.settings.skills.archiveTooLarge);
      return;
    }

    try {
      const result = await uploadSkillArchive(archive);
      if (result.success) {
        toast.success(result.message);
        setFilter("custom");
      } else {
        toast.error(result.message || t.settings.skills.installFailed);
      }
    } catch (error) {
      if (error instanceof SkillRequestError && error.isAdminRequired) {
        toast.error(t.settings.skills.installAdminRequired);
      } else if (error instanceof SkillRequestError && error.status === 413) {
        toast.error(t.settings.skills.archiveTooLarge);
      } else if (
        error instanceof SkillRequestError &&
        error.findings.length > 0
      ) {
        toast.error(error.message, {
          description: (
            <span className="whitespace-pre-line">
              {formatSkillSecurityFindings(error.findings)}
            </span>
          ),
        });
      } else {
        toast.error(
          error instanceof Error
            ? error.message
            : t.settings.skills.installFailed,
        );
      }
    }
  };
  return (
    <div className="flex w-full flex-col gap-4">
      {/*
        flex-wrap: the tabs and the two action buttons do not fit side by side
        at 375px. Radix's ScrollArea viewport wraps its children in
        `min-width:100%; display:table` (react-scroll-area/dist/index.mjs:130),
        and a table box takes its *shrink-to-fit* width — so a row that does not
        fit does not overflow-and-clip, it makes the whole panel wider than the
        dialog. Every row below then lays out at that wider width: the skill
        switch was measured at x=395.5 in a 375px viewport, past the clip edge,
        with the hit probe unable to reach it. reka's viewport has no such
        wrapper, which is why only this app was affected.
      */}
      <header className="flex flex-wrap justify-between gap-2">
        <div className="flex gap-2">
          {/* #5039 made this controlled (`value`, not `defaultValue`) so
              installing a local archive can switch the tab for you. */}
          <Tabs value={filter} onValueChange={setFilter}>
            {/* Name the tab set. An unnamed tablist is announced as a bare
                "tab list", which says nothing about what it filters. */}
            <TabsList variant="line" aria-label={t.settings.skills.title}>
              <TabsTrigger value="public">{t.common.public}</TabsTrigger>
              <TabsTrigger value="custom">{t.common.custom}</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
        <div className="flex gap-2">
          {/* The visible Button is the affordance; this input only carries the
              file dialog. Left in the accessibility tree it is a second,
              anonymous "button" that does the same thing — so hide it from AT
              and take it out of the tab order (tabIndex=-1 keeps
              aria-hidden legal on a focusable element). */}
          <input
            ref={fileInputRef}
            type="file"
            accept=".skill"
            disabled={isArchiveUploadDisabled}
            className="sr-only"
            aria-hidden="true"
            tabIndex={-1}
            onChange={handleSkillArchive}
          />
          {isAdmin && (
            <Button
              size="sm"
              variant="outline"
              disabled={isArchiveUploadDisabled}
              onClick={() => fileInputRef.current?.click()}
            >
              {isUploading ? (
                <LoaderIcon className="size-4 animate-spin" />
              ) : (
                <UploadIcon className="size-4" />
              )}
              {isUploading
                ? t.settings.skills.installingArchive
                : t.settings.skills.installFromFile}
            </Button>
          )}
          <Button size="sm" onClick={handleCreateSkill}>
            <SparklesIcon className="size-4" />
            {t.settings.skills.createSkill}
          </Button>
        </div>
      </header>
      {filteredSkills.length === 0 && (
        <EmptySkill onCreateSkill={handleCreateSkill} />
      )}
      {filteredSkills.length > 0 &&
        filteredSkills.map((skill) => (
          <Item className="w-full" variant="outline" key={skill.name}>
            {/*
              min-w-0 so the row can shrink below its content width, matching
              the channels row (channels-settings-page.tsx:187). This is not
              what pushed the switch off-screen at 375px — see the header above
              for that — but a flex item that cannot shrink is a latent version
              of the same failure.
            */}
            <ItemContent className="min-w-0">
              <ItemTitle>
                <div className="flex items-center gap-2">{skill.name}</div>
              </ItemTitle>
              <ItemDescription className="line-clamp-4">
                {skill.description}
              </ItemDescription>
            </ItemContent>
            <ItemActions>
              {/* Name the switch after its skill. A page of skills otherwise
                  ships a column of identical unnamed switches, so a screen
                  reader cannot tell which one it is on (WCAG 4.1.2). */}
              <Switch
                aria-label={skill.name}
                checked={skill.enabled}
                disabled={
                  env.NEXT_PUBLIC_STATIC_WEBSITE_ONLY === "true" || !isAdmin
                }
                onCheckedChange={(checked) =>
                  enableSkill({ skillName: skill.name, enabled: checked })
                }
              />
            </ItemActions>
          </Item>
        ))}
    </div>
  );
}

function EmptySkill({ onCreateSkill }: { onCreateSkill: () => void }) {
  const { t } = useI18n();
  return (
    <Empty>
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <SparklesIcon />
        </EmptyMedia>
        <EmptyTitle>{t.settings.skills.emptyTitle}</EmptyTitle>
        <EmptyDescription>
          {t.settings.skills.emptyDescription}
        </EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        <Button onClick={onCreateSkill}>{t.settings.skills.emptyButton}</Button>
      </EmptyContent>
    </Empty>
  );
}
