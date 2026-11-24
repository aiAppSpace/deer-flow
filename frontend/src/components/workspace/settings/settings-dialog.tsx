"use client";

import {
  BotIcon,
  BellIcon,
  CableIcon,
  InfoIcon,
  BrainIcon,
  PaletteIcon,
  UserCogIcon,
  UsersRoundIcon,
  UserIcon,
} from "lucide-react";
import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useAuth } from "@/core/auth/AuthProvider";
import { useI18n } from "@/core/i18n/hooks";
import { cn } from "@/lib/utils";

function SettingsPageLoading() {
  return (
    <p role="status" className="text-muted-foreground py-8 text-center text-sm">
      Loading…
    </p>
  );
}

const AccountSettingsPage = dynamic(
  () =>
    import("./account-settings-page").then(
      (module) => module.AccountSettingsPage,
    ),
  { loading: SettingsPageLoading },
);
const AppearanceSettingsPage = dynamic(
  () =>
    import("./appearance-settings-page").then(
      (module) => module.AppearanceSettingsPage,
    ),
  { loading: SettingsPageLoading },
);
const ChannelsSettingsPage = dynamic(
  () =>
    import("./channels-settings-page").then(
      (module) => module.ChannelsSettingsPage,
    ),
  { loading: SettingsPageLoading },
);
const MemorySettingsPage = dynamic(
  () =>
    import("./memory-settings-page").then(
      (module) => module.MemorySettingsPage,
    ),
  { loading: SettingsPageLoading },
);
const NotificationSettingsPage = dynamic(
  () =>
    import("./notification-settings-page").then(
      (module) => module.NotificationSettingsPage,
    ),
  { loading: SettingsPageLoading },
);
const SubagentSettingsPage = dynamic(
  () =>
    import("./subagent-settings-page").then(
      (module) => module.SubagentSettingsPage,
    ),
  { loading: SettingsPageLoading },
);
const ModelSettingsPage = dynamic(
  () =>
    import("./model-settings-page").then((module) => module.ModelSettingsPage),
  { loading: SettingsPageLoading },
);
const UserSettingsPage = dynamic(
  () =>
    import("./user-settings-page").then((module) => module.UserSettingsPage),
  { loading: SettingsPageLoading },
);
const AboutSettingsPage = dynamic(
  () =>
    import("./about-settings-page").then((module) => module.AboutSettingsPage),
  { loading: SettingsPageLoading },
);

export type SettingsSection =
  | "models"
  | "users"
  | "account"
  | "appearance"
  | "channels"
  | "memory"
  | "subagents"
  | "notification"
  | "about";

type SettingsDialogProps = React.ComponentProps<typeof Dialog> & {
  defaultSection?: SettingsSection;
};

export function SettingsDialog(props: SettingsDialogProps) {
  const { defaultSection = "appearance", ...dialogProps } = props;
  const { t } = useI18n();
  const { user } = useAuth();
  const isAdmin = user?.system_role === "admin";
  const [activeSection, setActiveSection] =
    useState<SettingsSection>(defaultSection);
  /*
    Put the initial focus on the nav button for the section that is actually
    open. Radix's default lands on the first focusable element, which is always
    "Account" — so deep-linking to `?settings=appearance` opened that page with
    the focus parked somewhere else, and a keyboard or screen-reader user had to
    find their way there although the URL already said where to go.
  */
  const sectionButtons = useRef(
    new Map<SettingsSection, HTMLButtonElement | null>(),
  );
  const focusActiveSection = useCallback(
    (event: Event) => {
      event.preventDefault();
      sectionButtons.current.get(activeSection)?.focus();
    },
    [activeSection],
  );

  useEffect(() => {
    // When opening the dialog, ensure the active section follows the caller's intent.
    // This allows triggers like "About" to open the dialog directly on that page.
    if (dialogProps.open) {
      setActiveSection(defaultSection);
    }
  }, [defaultSection, dialogProps.open]);

  const sections = useMemo(() => {
    const items: {
      id: SettingsSection;
      label: string;
      icon: typeof BotIcon;
    }[] = [
      { id: "models", label: t.settings.sections.models, icon: BotIcon },
      {
        id: "account",
        label: t.settings.sections.account,
        icon: UserIcon,
      },
      {
        id: "appearance",
        label: t.settings.sections.appearance,
        icon: PaletteIcon,
      },
      {
        id: "notification",
        label: t.settings.sections.notification,
        icon: BellIcon,
      },
      {
        id: "channels",
        label: t.settings.sections.channels,
        icon: CableIcon,
      },
      {
        id: "memory",
        label: t.settings.sections.memory,
        icon: BrainIcon,
      },
      {
        id: "subagents",
        label: t.settings.sections.subagents,
        icon: UsersRoundIcon,
      },
      { id: "about", label: t.settings.sections.about, icon: InfoIcon },
    ];
    // User management is meaningless (and confusing) for non-admins, so the
    // entry point itself is hidden; the page still guards independently in
    // case a stale dialog store ever activates the section.
    if (isAdmin) {
      items.splice(1, 0, {
        id: "users",
        label: t.settings.sections.users,
        icon: UserCogIcon,
      });
    }
    return items;
  }, [
    isAdmin,
    t.settings.sections.models,
    t.settings.sections.users,
    t.settings.sections.account,
    t.settings.sections.appearance,
    t.settings.sections.channels,
    t.settings.sections.memory,
    t.settings.sections.subagents,
    t.settings.sections.notification,
    t.settings.sections.about,
  ]);
  // A `?settings=<section>` deep link (or a stale dialog store) can activate
  // a section this user's nav does not offer — e.g. user management for a
  // non-admin — so fall back to the first available section instead of
  // rendering a panel with no highlighted entry. The base list above is
  // non-empty, so the fallback itself always resolves.
  const activeId = sections.some((section) => section.id === activeSection)
    ? activeSection
    : sections[0]!.id;
  return (
    <Dialog
      {...dialogProps}
      onOpenChange={(open) => props.onOpenChange?.(open)}
    >
      <DialogContent
        className="[container-type:size] flex h-[75vh] max-h-[calc(100vh-2rem)] flex-col overflow-y-auto! [container-name:settings-dialog] sm:max-w-5xl md:max-w-6xl [@media(max-height:360px)]:h-[calc(100dvh-32px)] [@media(max-height:360px)]:max-h-[calc(100dvh-32px)] [@media(max-height:360px)]:gap-[8px] [@media(max-height:360px)]:p-[8px]"
        aria-describedby={undefined}
        onOpenAutoFocus={focusActiveSection}
      >
        <DialogHeader className="gap-1">
          <DialogTitle>{t.settings.title}</DialogTitle>
          <p className="text-muted-foreground text-sm">
            {t.settings.description}
          </p>
        </DialogHeader>
        {/*
          `grid-cols-[minmax(0,1fr)]` is the base track, not redundant: below `md`
          there is no explicit template, so the implicit column is `auto` and the
          grid item's default `min-width: auto` lets the content push the column
          wider instead of being constrained by it. Measured at 360px with the
          channels fixtures: the column resolved to 500.1px and the panel's right
          edge landed at 541 while the dialog ends at 344 (`overflow: visible`),
          i.e. the panel ran 181px past the viewport. Mirrored in the Vue app.
        */}
        <div className="grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)] gap-4 max-md:flex-none md:grid-cols-[220px_minmax(0,1fr)] md:grid-rows-[minmax(0,1fr)] [@container_settings-dialog_(height<28rem)]:flex-none [@container_settings-dialog_(height<28rem)]:grid-rows-[auto]">
          <nav className="bg-sidebar min-h-0 min-w-0 overflow-x-hidden overflow-y-auto rounded-lg border p-2">
            <ul className="min-w-0 space-y-1 pr-1">
              {sections.map(({ id, label, icon: Icon }) => {
                const active = activeId === id;
                return (
                  <li key={id}>
                    <button
                      type="button"
                      ref={(element) => {
                        sectionButtons.current.set(id, element);
                      }}
                      onClick={() => setActiveSection(id)}
                      onFocus={(event) =>
                        event.currentTarget.scrollIntoView({
                          block: "nearest",
                          inline: "nearest",
                        })
                      }
                      className={cn(
                        "flex w-full min-w-0 items-center gap-3 rounded-md px-3 py-2 text-left text-sm font-medium whitespace-normal transition-colors",
                        active
                          ? "bg-primary text-primary-foreground shadow-sm"
                          : "text-muted-foreground hover:bg-muted hover:text-foreground",
                      )}
                    >
                      <Icon className="size-4 shrink-0" />
                      <span className="min-w-0 wrap-anywhere">{label}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </nav>
          <ScrollArea className="h-full min-h-0 min-w-0 rounded-lg border max-md:h-auto max-md:[&_[data-slot=scroll-area-viewport]]:h-auto max-md:[&_[data-slot=scroll-area-viewport]]:max-h-[100cqh] [&_[data-slot=scroll-area-viewport]>div]:block! [&_[data-slot=scroll-area-viewport]>div]:w-full! [&_[data-slot=scroll-area-viewport]>div]:max-w-full! [&_[data-slot=scroll-area-viewport]>div]:min-w-0! [@container_settings-dialog_(height<28rem)]:h-auto [@container_settings-dialog_(height<28rem)]:[&_[data-slot=scroll-area-viewport]]:h-auto [@container_settings-dialog_(height<28rem)]:[&_[data-slot=scroll-area-viewport]]:max-h-[100cqh]">
            {/*
              Below sm the dialog is 343px wide and this panel's own padding
              plus a nested card's px-6 left the integrations column at 167px
              — narrower than the buttons and OAuth-scope examples inside it,
              which then overflowed. Step the padding down on small screens;
              sm+ keeps the 24px the desktop layout was measured at.
            */}
            <div className="w-full max-w-full min-w-0 space-y-8 p-4 sm:p-6">
              {activeId === "models" && <ModelSettingsPage />}
              {activeId === "users" && <UserSettingsPage />}
              {activeId === "account" && <AccountSettingsPage />}
              {activeId === "appearance" && <AppearanceSettingsPage />}
              {activeId === "memory" && <MemorySettingsPage />}
              {activeId === "subagents" && <SubagentSettingsPage />}
              {activeId === "notification" && <NotificationSettingsPage />}
              {activeId === "channels" && <ChannelsSettingsPage />}
              {activeId === "about" && <AboutSettingsPage />}
            </div>
          </ScrollArea>
        </div>
      </DialogContent>
    </Dialog>
  );
}
