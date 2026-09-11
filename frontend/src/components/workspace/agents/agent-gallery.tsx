"use client";

import { BotIcon, PlusIcon } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { useAgents } from "@/core/agents";
import { useI18n } from "@/core/i18n/hooks";

import { AgentCard } from "./agent-card";

export function AgentGallery() {
  const { t } = useI18n();
  const { agents, isLoading } = useAgents();

  return (
    <div className="flex size-full flex-col">
      {/* Page header */}
      <div className="flex items-center justify-between border-b px-6 py-4">
        <div>
          <h1 className="text-xl font-semibold">{t.agents.title}</h1>
          <p className="text-muted-foreground mt-0.5 text-sm">
            {t.agents.description}
          </p>
        </div>
        {/*
          "New Agent" goes to a URL, so it is a link. As a <button
          onClick={router.push(...)}> it could not be middle-clicked, opened in
          a new tab or have its address copied, and a screen reader announced it
          as a button. Same change as the card's chat action.
        */}
        <Button asChild>
          <Link href="/workspace/agents/new">
            <PlusIcon className="mr-1.5 h-4 w-4" />
            {t.agents.newAgent}
          </Link>
        </Button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6">
        {/*
          The loading placeholder is a live region: without role="status" a
          screen reader never hears that the gallery is fetching, and the
          generic "Loading..." does not say what is loading.
        */}
        {isLoading ? (
          <div
            role="status"
            className="text-muted-foreground flex h-40 items-center justify-center text-sm"
          >
            {t.agents.loading}
          </div>
        ) : agents.length === 0 ? (
          <div className="flex h-64 flex-col items-center justify-center gap-3 text-center">
            <div className="bg-muted flex h-14 w-14 items-center justify-center rounded-full">
              <BotIcon className="text-muted-foreground h-7 w-7" />
            </div>
            <div>
              <p className="font-medium">{t.agents.emptyTitle}</p>
              <p className="text-muted-foreground mt-1 text-sm">
                {t.agents.emptyDescription}
              </p>
            </div>
            <Button variant="outline" className="mt-2" asChild>
              <Link href="/workspace/agents/new">
                <PlusIcon className="mr-1.5 h-4 w-4" />
                {t.agents.newAgent}
              </Link>
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {agents.map((agent) => (
              <AgentCard key={agent.name} agent={agent} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
