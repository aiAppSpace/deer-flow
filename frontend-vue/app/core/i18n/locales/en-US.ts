/*
  【文件职责】     见下方导出与 JSDoc。
  【架构位置】     L3
  【主要导出】     enUS
  【依赖关系】     见下方 import。
  【边界与注意】   本文件由本仓维护；行为由 tests/ 下的用例约束。
*/

import {
  CompassIcon,
  GraduationCapIcon,
  ImageIcon,
  MicroscopeIcon,
  PenLineIcon,
  ShapesIcon,
  SparklesIcon,
  VideoIcon,
} from "lucide-vue-next";

import type { Translations } from "./types";

export const enUS: Translations = {
  // Locale meta
  locale: {
    localName: "English",
  },

  /*
    Primitive 层的可访问名。**两份词典里的值刻意相同**，都是英文。

    React 把这几串写死在 vendored primitive 里、没有接进词典：shadcn dialog 关闭
    按钮的 "Close"（frontend/src/components/ui/dialog.tsx 里的 sr-only span）、
    shadcn sidebar 的 "Toggle Sidebar"（frontend/src/components/ui/sidebar.tsx）、
    ai-elements prompt-input 的 "Submit"/"Stop"、sonner 的 containerAriaLabel + 热键后缀，
    以及 settings-dialog.tsx 里九个 section 懒加载时那句 "Loading…"。
    实测中文界面下 React 读屏器听到的也是这几串英文。对齐的判据是「两边听到同一句」，
    所以这里照抄，而不是各自翻译——一边中文一边英文，就不是同一个控件了。

    放进词典而不是写死在 SFC 里，是为了让这个决定留在一个能被 review、能被一次性
    翻掉的地方：上游哪天把它们接进自己的 i18n，改这四行即可。
  */
  primitives: {
    close: "Close",
    toggleSidebar: "Toggle Sidebar",
    sidebar: "Sidebar",
    sidebarDescription: "Displays the mobile sidebar.",
    submit: "Submit",
    stop: "Stop",
    skillSuggestions: "Skill suggestions",
    modelSelector: "Model Selector",
    /* 上游 artifact-file-detail.tsx:415 的 `<SelectValue placeholder="Select a file" />`，同样写死英文、同样不进它自己的词典。 */
    selectAFile: "Select a file",
    /*
      上游 `<CommandDialog>` 用的是 shadcn 的默认值（ui/command.tsx:32/33），
      同样写死英文、同样不进它自己的 i18n。本仓此前把这两处读成
      `shortcuts.actions`（"Actions"）与 `shortcuts.searchActions`，
      读屏器念出来的对话框名字与上游不是同一句。
    */
    commandPalette: "Command Palette",
    commandPaletteDescription: "Search for a command to run...",
    suggestions: "Suggestions",
    notifications: "Notifications alt+T",
    loadingPanel: "Loading panel…",
    loadingSettingsPage: "Loading…",
    channel: (label) => `${label} channel`,
    breadcrumb: "breadcrumb",
  },

  // Common
  common: {
    home: "Home",
    settings: "Settings",
    delete: "Delete",
    edit: "Edit",
    rename: "Rename",
    renameFailed: "Failed to rename thread.",
    share: "Share",
    openInNewWindow: "Open in new window",
    close: "Close",
    more: "More",
    search: "Search",
    loadMore: "Load more",
    download: "Download",
    thinking: "Thinking",
    artifacts: "Artifacts",
    public: "Public",
    custom: "Custom",
    notAvailableInDemoMode: "Not available in demo mode",
    loading: "Loading...",
    version: "Version",
    lastUpdated: "Last updated",
    code: "Code",
    preview: "Preview",
    cancel: "Cancel",
    save: "Save",
    install: "Install",
    create: "Create",
    import: "Import",
    export: "Export",
    exportAsMarkdown: "Export as Markdown",
    exportAsJSON: "Export as JSON",
    exportSuccess: "Conversation exported",
    exportFailed: "Failed to export conversation.",
    regenerate: "Regenerate",
    editAndRerun: "Edit and rerun",
    updateAndRerun: "Update and rerun",
    editRerunWarning:
      "Rerunning restores conversation state only. Files, memory, and external actions are not undone.",
    branch: "Branch conversation",
    showArtifacts: "Show artifacts of this conversation",
    browser: "Browser",
    showBrowser: "Open browser panel",
    requestFailed: "Request failed.",
  },

  runDuration: {
    reasoning: "Reasoning",
    working: "Working…",
    completedIn: (duration) => `Completed in ${duration}`,
    description:
      "Total task time, including model reasoning, tool calls, and waiting.",
    lessThanSecond: "<1s",
    hours: (value) => `${value}h`,
    minutes: (value) => `${value}m`,
    seconds: (value) => `${value}s`,
    separator: " ",
  },

  // Home
  home: {
    docs: "Docs",
    blog: "Blog",
  },

  // Welcome
  welcome: {
    greeting: "Hello, again!",
    description:
      "Welcome to 🦌 DeerFlow, an open source super agent. With built-in and custom skills, DeerFlow helps you search on the web, analyze data, and generate artifacts like slides, web pages and do almost anything.",

    createYourOwnSkill: "Create Your Own Skill",
    createYourOwnSkillDescription:
      "Create your own skill to release the power of DeerFlow. With customized skills,\nDeerFlow can help you search on the web, analyze data, and generate\n artifacts like slides, web pages and do almost anything.",
  },

  // Clipboard
  clipboard: {
    copyToClipboard: "Copy to clipboard",
    copiedToClipboard: "Copied to clipboard",
    failedToCopyToClipboard: "Failed to copy to clipboard",
    linkCopied: "Link copied to clipboard",
  },

  artifactEditing: {
    unsaved: "Unsaved",
    saving: "Saving...",
    saved: "Artifact saved",
    exit: "Exit editing",
    discard: "Discard changes",
    discardChanges: "Discard the unsaved changes to this artifact?",
    conflict:
      "This artifact changed after you started editing. Discard your draft and reload before saving.",
    conflictShort: "Changed remotely",
    runInProgress: "Wait for the current agent run to finish before saving.",
    saveFailed: "Failed to save artifact",
  },

  artifactPreview: {
    limited: (previewSize, totalSize) =>
      totalSize
        ? `Showing the first ${previewSize} of ${totalSize}.`
        : `Showing the first ${previewSize}.`,
    loadFullFile: "Load full file",
    loadingFullFile: "Loading full file...",
    previewFailed:
      "This file could not be previewed. You can still download it.",
  },

  // Citations
  citations: {
    sourcesSummary: (count) =>
      `Used ${count} ${count === 1 ? "source" : "sources"}`,
    citeCount: (count) => `${count} ${count === 1 ? "cite" : "cites"}`,
    copyReference: (title) => `Copy ${title} reference`,
    copiedReference: (title) => `Copied ${title} reference`,
  },

  // Workspace Changes
  workspaceChanges: {
    title: "Workspace changes",
    editedTitle: (count) => `Edited ${count} ${count === 1 ? "file" : "files"}`,
    badge: (count, additions, deletions) =>
      `${count} ${count === 1 ? "file" : "files"} changed +${additions} -${deletions}`,
    viewChanges: "View changes",
    created: "Created",
    modified: "Modified",
    deleted: "Deleted",
    openFile: "Open file",
    loading: "Loading workspace changes...",
    noChanges: "No workspace changes recorded.",
    diffUnavailable: "Diff unavailable",
    binaryUnavailable: "Binary file. Diff unavailable.",
    largeUnavailable: "Large file. Diff omitted.",
    sensitiveUnavailable: "Sensitive path. Content hidden.",
    truncatedUnavailable: "Diff omitted because the change set is too large.",
    symlinkUnavailable: "Symlink change. Diff unavailable.",
    truncatedSummary: "Some changes were truncated.",
    symlinkCreated: "Symlink created",
    loadFailed: "Failed to load workspace changes.",
    retry: "Retry",
  },

  // Input Box
  inputBox: {
    placeholder: "How can I assist you today?",
    disclaimer: "Deerflow is AI and can make mistakes",
    createSkillPrompt:
      "We're going to build a new skill step by step with `skill-creator`. To start, what do you want this skill to do?",
    addAttachments: "Add attachments",
    inputPolish: "Polish input",
    inputPolishing: "Polishing input...",
    inputPolishNoChanges: "This input is already clear.",
    inputPolishFailed: "Failed to polish input.",
    inputPolishUndo: "Undo polish",
    inputPolishCancel: "Cancel polishing",
    voiceInputStartLabel: "Dictate with voice",
    voiceInputStopLabel: "Stop voice input",
    voiceInputStart:
      "Dictate with voice. DeerFlow receives only transcribed text; audio is handled by your browser or system speech service.",
    voiceInputStop: "Stop voice input",
    voiceInputListening: "Listening... Click to stop voice input.",
    voiceInputUnsupported:
      "Voice input is not supported in this browser. Try Chrome or Edge.",
    voiceInputPermissionDenied:
      "Microphone access was denied. Allow microphone access and try again.",
    voiceInputMicrophoneUnavailable:
      "No microphone was detected. Check your device input and try again.",
    voiceInputUnsupportedLanguage:
      "Voice input does not support the current language in this browser.",
    voiceInputNetworkError:
      "Voice input could not reach the browser speech service.",
    voiceInputNoSpeech: "No speech was detected. Please try again.",
    voiceInputFailed: "Voice input failed. Please try again.",
    mode: "Mode",
    flashMode: "Flash",
    flashModeDescription: "Fast and efficient, but may not be accurate",
    reasoningMode: "Reasoning",
    reasoningModeDescription:
      "Reasoning before action, balance between time and accuracy",
    proMode: "Pro",
    proModeDescription:
      "Reasoning, planning and executing, get more accurate results, may take more time",
    ultraMode: "Ultra",
    ultraModeDescription:
      "Pro mode with subagents to divide work; best for complex multi-step tasks",
    reasoningEffort: "Reasoning Effort",
    reasoningEffortMinimal: "Minimal",
    reasoningEffortMinimalDescription: "Retrieval + Direct Output",
    reasoningEffortLow: "Low",
    reasoningEffortLowDescription: "Simple Logic Check + Shallow Deduction",
    reasoningEffortMedium: "Medium",
    reasoningEffortMediumDescription:
      "Multi-layer Logic Analysis + Basic Verification",
    reasoningEffortHigh: "High",
    reasoningEffortHighDescription:
      "Full-dimensional Logic Deduction + Multi-path Verification + Backward Check",
    searchModels: "Search models...",
    surpriseMe: "Surprise",
    surpriseMePrompt: "Surprise me",
    followupLoading: "Generating follow-up questions...",
    followupConfirmTitle: "Send suggestion?",
    followupConfirmDescription:
      "You already have text in the input. Choose how to send it.",
    followupConfirmAppend: "Append & send",
    followupConfirmReplace: "Replace & send",
    suggestionPlaceholderRequired:
      "Replace the suggestion placeholder before sending.",
    goalCommandDescription: "Set, show, or clear an active goal",
    compactCommandDescription:
      "Compact earlier context while keeping the full chat visible",
    goalLabel: "Goal",
    goalContinuing: "Continuing {count}/{max}",
    goalContinuationTooltip:
      "Auto-continued {count}/{max} times toward the goal; stops at the limit.",
    goalSet: "Goal set.",
    goalCleared: "Goal cleared.",
    goalNone: "No active goal.",
    goalActive: "Active goal: {goal}",
    goalFailed: "Goal command failed.",
    goalTooLong: "Goal is too long. Keep it under {max} characters.",
    goalLengthCounter: "Goal length: {length}/{max} characters",
    compactSuccess:
      "Earlier context compacted. The full chat remains visible; future model calls will use the summary and recent messages.",
    compactSkipped: "The current context does not need compaction yet.",
    compactNotPerformed: (reason) => `Context was not compacted: ${reason}`,
    compactFailed: "Context compaction failed.",
    uploadFiles: "Upload files",
    stop: "Stop",
    send: "Send",
    submit: "Submit",
    suggestions: [
      {
        suggestion: "Write",
        prompt: "Write a blog post about the latest trends on [topic]",
        icon: PenLineIcon,
      },
      {
        suggestion: "Research",
        prompt:
          "Conduct a deep dive research on [topic], and summarize the findings.",
        icon: MicroscopeIcon,
      },
      {
        suggestion: "Collect",
        prompt: "Collect data from [source] and create a report.",
        icon: ShapesIcon,
      },
      {
        suggestion: "Learn",
        prompt: "Learn about [topic] and create a tutorial.",
        icon: GraduationCapIcon,
      },
    ],
    suggestionsCreate: [
      {
        suggestion: "Webpage",
        prompt: "Create a webpage about [topic]",
        icon: CompassIcon,
      },
      {
        suggestion: "Image",
        prompt: "Create an image about [topic]",
        icon: ImageIcon,
      },
      {
        suggestion: "Video",
        prompt: "Create a video about [topic]",
        icon: VideoIcon,
      },
      {
        type: "separator",
      },
      {
        suggestion: "Skill",
        prompt:
          "We're going to build a new skill step by step with `skill-creator`. To start, what do you want this skill to do?",
        icon: SparklesIcon,
      },
    ],
    pleaseWaitStreaming: "Please wait for the current response to finish.",
  },

  // Sidebar
  sidebar: {
    newChat: "New chat",
    chats: "Chats",
    channels: "Channels",
    recentChats: "Recent chats",
    demoChats: "Demo chats",
    agents: "Agents",
    scheduledTasks: "Scheduled tasks",
    agentsDisabledTooltip: "Feature not enabled",
  },

  // Scheduled tasks
  scheduledTasks: {
    scheduleType: {
      cron: "Recurring",
      once: "One-time",
    },
    preset: {
      label: "Repeat",
      hourly: "Hourly",
      daily: "Daily",
      weekly: "Weekly",
      monthly: "Monthly",
      custom: "Custom cron",
    },
    fields: {
      minute: "Minute",
      time: "Time",
      weekday: "On",
      dayOfMonth: "Day of month",
      cron: "Cron expression",
      cronPlaceholder: "0 9 * * *",
      runAt: "Run at",
      timezone: "Timezone",
    },
    weekdays: {
      mon: "Mon",
      tue: "Tue",
      wed: "Wed",
      thu: "Thu",
      fri: "Fri",
      sat: "Sat",
      sun: "Sun",
    },
    preview: "Preview",
    cronHelp: "Open crontab.guru",
    create: {
      title: "Create scheduled task",
      taskTitle: "Task title",
      prompt: "Prompt",
      submit: "Create",
      fillRequired: "Fill all required fields",
    },
    context: {
      fresh: "Fresh thread",
      reuse: "Reuse thread",
      threadIdPlaceholder: "Thread ID",
    },
    filters: {
      allStatuses: "All statuses",
      enabled: "Enabled",
      paused: "Paused",
      completed: "Completed",
      failed: "Failed",
      allTypes: "All types",
      cron: "Cron",
      once: "Once",
    },
    detail: {
      contextMode: "Context mode",
      thread: "Thread",
      lastThread: "Last thread",
      schedule: "Schedule",
      nextRun: "Next run",
      lastRun: "Last run",
      lastRunId: "Last run id",
      lastError: "Last error",
      runsCount: "{count} runs",
      runsCountOne: "{count} run",
      noRuns: "No runs yet",
      loadMore: "Load more runs",
      loadingMore: "Loading more…",
      noSelection: "No scheduled task selected",
      filteredByThread: "Filtered by thread: {id}",
      loadFailed: "Failed to load scheduled tasks",
    },
    actions: {
      edit: "Edit",
      cancelEdit: "Cancel edit",
      pause: "Pause",
      resume: "Resume",
      trigger: "Trigger now",
      delete: "Delete",
    },
    deleteConfirm:
      "Are you sure you want to delete this scheduled task? This action cannot be undone.",
    errors: {
      create: "Failed to create scheduled task",
      update: "Failed to update scheduled task",
      pause: "Failed to pause scheduled task",
      resume: "Failed to resume scheduled task",
      trigger: "Failed to trigger scheduled task",
      delete: "Failed to delete scheduled task",
    },
    edit: {
      titlePlaceholder: "Edit title",
      promptPlaceholder: "Edit prompt",
      submit: "Save edit",
    },
    status: {
      enabled: "Enabled",
      paused: "Paused",
      running: "Running",
      completed: "Completed",
      failed: "Failed",
      cancelled: "Cancelled",
    },
    runTrigger: { scheduled: "scheduled", manual: "manual" },
    runStatus: {
      queued: "Queued",
      running: "Running",
      success: "Success",
      failed: "Failed",
      skipped: "Skipped",
      interrupted: "Interrupted",
    },
    recipes: {
      label: "Quick create",
      trending: {
        title: "GitHub Trending daily",
        desc: "Summarize today's top 10 trending repos",
      },
      news: {
        title: "Daily tech news digest",
        desc: "Collect and summarize the day's top tech news",
      },
      issues: {
        title: "GitHub Issue triage",
        desc: "Triage a repo's open issues (fill in {{repo}})",
      },
      weekly: {
        title: "Weekly report",
        desc: "Compile a weekly summary, every Monday",
      },
    },
  },

  // Agents
  agents: {
    title: "Agents",
    description:
      "Create and manage custom agents with specialized prompts and capabilities.",
    newAgent: "New Agent",
    emptyTitle: "No custom agents yet",
    emptyDescription:
      "Create your first custom agent with a specialized system prompt.",
    featureDisabledTitle: "Agents feature is not enabled",
    featureDisabledDescription:
      "This feature is not enabled on this server. Please contact your administrator.",
    chat: "Chat",
    delete: "Delete",
    deleteConfirm:
      "Are you sure you want to delete this agent? This action cannot be undone.",
    deleteSuccess: "Agent deleted",
    newChat: "New chat",
    createPageTitle: "Design your Agent",
    createPageSubtitle:
      "Describe the agent you want — I'll help you create it through conversation.",
    nameStepTitle: "Name your new Agent",
    nameStepHint:
      "Letters, digits, and hyphens only — stored lowercase (e.g. code-reviewer)",
    nameStepPlaceholder: "e.g. code-reviewer",
    nameStepContinue: "Continue",
    nameStepInvalidError:
      "Invalid name — use only letters, digits, and hyphens",
    nameStepAlreadyExistsError: "An agent with this name already exists",
    nameStepNetworkError:
      "Network request failed — check your network or backend connection",
    nameStepCheckError: "Could not verify name availability — please try again",
    nameStepCheckErrorWithDetail: "Name check failed: {detail}",
    nameStepApiDisabledError:
      "Custom agent management is not enabled on this server. Please contact your administrator.",
    nameStepBootstrapMessage:
      "The new custom agent name is {name}. Help me design its purpose, behavior, and SOUL.md before saving it.",
    save: "Save agent",
    saving: "Saving agent...",
    verifying: "Verifying agent...",
    retry: "Try again",
    creationError: "Agent creation failed",
    saveNotAccepted: "The save request was not accepted.",
    creationLoadFailed: "Failed to load the created agent.",
    creationVisibilityUnavailable:
      "The created agent is not visible yet. Try verification again.",
    creationRequestFailed: "Failed to request agent creation.",
    creationMissingToolResult: "The run finished without a setup_agent result.",
    creationRunFailed: "The agent creation run failed.",
    saveRequested:
      "Save requested. DeerFlow is generating and saving an initial version now.",
    saveHint:
      "You can save this agent at any time from the top-right menu, even if this is only a first draft.",
    saveCommandMessage:
      "Please save this custom agent now based on everything we have discussed so far. Treat this as my explicit confirmation to save. If some details are still missing, make reasonable assumptions, generate a concise first SOUL.md in English, and call setup_agent immediately without asking me for more confirmation.",
    agentCreatedPendingRefresh:
      "The agent was created, but DeerFlow could not load it yet. Please refresh this page in a moment.",
    more: "More actions",
    agentCreated: "Agent created!",
    startChatting: "Start chatting",
    backToGallery: "Back to Gallery",
    settings: "Model settings",
    settingsTitle: "Model settings",
    settingsDescription:
      "Choose the default model and generation parameters for this agent. Changes take effect on the next message.",
    settingsModel: "Default model",
    settingsModelDefault: "Use global default",
    settingsTemperature: "Temperature",
    settingsTemperatureHint: "0 = deterministic, higher = more creative (0–2).",
    settingsMaxTokens: "Max output tokens",
    settingsMaxTokensPlaceholder: "Inherit from model",
    settingsThinking: "Thinking mode",
    settingsThinkingOn: "On",
    settingsThinkingOff: "Off",
    settingsReasoningEffort: "Reasoning effort",
    settingsInherit: "Inherit",
    settingsSaved: "Model settings saved",
    settingsInvalidTemperature: "Temperature must be between 0 and 2",
    settingsInvalidMaxTokens:
      "Max output tokens must be a positive integer up to 200,000",
    settingsInvalidModel: "Choose an available model.",
    settingsModelsLoading: "Loading model capabilities…",
    settingsModelsFailed: "Failed to load model capabilities",
    settingsModelUnavailable: "Unavailable",
    settingsReasoningLow: "Low",
    settingsReasoningMedium: "Medium",
    settingsReasoningHigh: "High",
    settingsCancel: "Cancel",
    settingsSave: "Save",
    settingsSaving: "Saving…",
    settingsSaveFailed: "Failed to save model settings",
    loading: "Loading agents…",
    loadFailed: "Failed to load agents",
    deleteFailed: "Failed to delete agent",
    cardModel: "Model",
    cardSkills: "Skills",
    cardSkillsNone: "No skills",
    cardToolGroups: "Tool groups",
    cardToolGroupsAll: "All configured tool groups",
    cardToolGroupsNone: "No configured tool groups",
  },

  // Breadcrumb
  breadcrumb: {
    workspace: "Workspace",
    chats: "Chats",
  },

  // Workspace
  workspace: {
    officialWebsite: "DeerFlow's official website",
    githubTooltip: "DeerFlow on GitHub",
    sidePanelDescription: "Browse the side panel for this conversation.",
    settingsAndMore: "Settings and more",
    visitGithub: "DeerFlow on GitHub",
    reportIssue: "Report an issue",
    contactUs: "Contact us",
    about: "About DeerFlow",
    logout: "Log out",
    gatewayUnavailable: "Gateway is temporarily unavailable.",
    gatewayUnavailableRetrying: "Retrying in the background…",
    gatewayRecovered: "Gateway connection restored.",
    retryNow: "Try again",
    retrying: "Retrying...",
  },

  // Conversation
  conversation: {
    noMessages: "No messages yet",
    startConversation: "Start a conversation to see messages here",
    newChatNotificationTitle: "New Chat",
    branchCreated: "Conversation branch created",
    branchFailed: "Failed to branch conversation.",
    streamReplayGap:
      "Some live updates expired. The conversation was restored from saved state.",
  },

  // Chats
  chats: {
    searchChats: "Search chats",
    loadMoreToSearch: "Load more to search older conversations",
    loadingMore: "Loading more...",
    loadOlderChats: "Load older chats",
    pinChat: "Pin chat",
    unpinChat: "Unpin chat",
    pinChatFailed: "Failed to update pinned chat",
  },

  // Sidecar
  sidecar: {
    title: "Side chat",
    open: "Open side chat",
    close: "Close side chat",
    delete: "Delete side chat",
    deleting: "Deleting…",
    deleteConfirm:
      "Are you sure you want to delete this side chat? This action cannot be undone. To simply hide it, use the side chat toggle in the header instead.",
    deleteSuccess: "Side chat deleted",
    deleteFailed: "Failed to delete side chat.",
    addToConversation: "Add to conversation",
    askInSideChat: "Ask in side chat",
    reference: "Reference",
    selectedTextFragment: "{count} selected text fragment",
    selectedTextFragments: "{count} selected text fragments",
    clearReferences: "Clear selected references",
    emptyTitle: "Ask a follow-up",
    emptyDescription: "Ask a follow-up grounded in the referenced text.",
    placeholder: "Ask a deeper follow-up...",
    send: "Send",
    sendFailed: "Failed to send side chat message.",
    noContext: "No context selected",
    continuing: "Continue in this side chat",
    selectionCrossesMessages:
      "Selection spans multiple messages. Select text within a single reply to quote it.",
  },

  // Channels
  channels: {
    title: "Channels",
    connect: "Connect",
    addAccount: "Add account",
    modify: "Modify",
    reconnect: "Reconnect",
    disconnect: "Disconnect",
    connected: "Connected",
    notConnected: "Not connected",
    pending: "Pending",
    revoked: "Disconnected",
    disabled: "Disabled",
    unconfigured: "Not configured",
    unavailable: "Channel connections are unavailable right now.",
    unavailableShort: "Unavailable",
    accounts: "Connected accounts",
    noAccounts: "No channel accounts yet.",
    removeProviderConfig: "Remove provider configuration",
    removeProviderTitle: (name: string) =>
      `Remove ${name} provider configuration?`,
    removeProviderDescription:
      "This admin action stops the provider runtime and revokes every active connection for this provider.",
    connectTitle: "Connect channel",
    waitingForConnection: "Waiting for the channel account to connect…",
    connectLinkOpened: "The provider connection page opened in a new tab.",
    connectionExpired:
      "This connection code expired. Start a new connection to try again.",
    disconnectAccount: (name: string) => `Disconnect ${name}`,
    cancel: "Cancel",
    close: "Close",
    setupTitle: (name: string) => `Connect ${name}`,
    setupEditTitle: (name: string) => `Modify ${name}`,
    setupDescription:
      "Enter the values needed by this server process. They are not written to config.yaml.",
    saveAndConnect: "Save and connect",
    saveChanges: "Save changes",
    descriptions: {
      buzz: "Buzz channels and direct messages through your DeerFlow agent.",
      telegram: "Telegram direct messages through your DeerFlow bot.",
      slack: "Slack workspace messages and mentions.",
      discord: "Discord server messages through your DeerFlow bot.",
      feishu: "Feishu and Lark messages through your DeerFlow app.",
      dingtalk: "DingTalk Stream Push messages through your DeerFlow bot.",
      wechat: "WeChat iLink messages through your DeerFlow bot.",
      wecom: "WeCom messages through your DeerFlow AI bot.",
    },
    connectedAs: (name: string) => `Connected as ${name}.`,
  },

  // Page titles (document title)
  pages: {
    appName: "DeerFlow",
    chats: "Chats",
    newChat: "New chat",
    untitled: "Untitled",
  },

  // Tool calls
  toolCalls: {
    moreSteps: (count: number) => `${count} more step${count === 1 ? "" : "s"}`,
    lessSteps: "Less steps",
    executeCommand: "Execute command",
    presentFiles: "Present files",
    needYourHelp: "Need your help",
    useTool: (toolName: string) => `Use "${toolName}" tool`,
    searchFor: (query: string) => `Search for "${query}"`,
    searchForRelatedInfo: "Search for related information",
    searchForRelatedImages: "Search for related images",
    searchForRelatedImagesFor: (query: string) =>
      `Search for related images for "${query}"`,
    searchOnWebFor: (query: string) => `Search on the web for "${query}"`,
    viewWebPage: "View web page",
    listFolder: "List folder",
    readFile: "Read file",
    writeFile: "Write file",
    clickToViewContent: "Click to view file content",
    writeTodos: "Update to-do list",
    skillInstallTooltip: "Install skill and make it available to DeerFlow",
    browserNavigate: (url: string) => `Open ${url} in browser`,
    browserNavigateGeneric: "Open page in browser",
    browserClick: "Click element in browser",
    browserType: "Type into browser field",
    browserSnapshot: "Read page in browser",
    browserGetText: "Read page text in browser",
    browserBack: "Go back in browser",
    browserScreenshot: "Capture browser screenshot",
    browserClose: "Close browser",
  },

  humanInput: {
    answered: "Answered",
    pending: "Sending...",
    readOnly: "Read only",
    otherLabel: "Other answer",
    otherPlaceholder: "Type another answer...",
    submit: "Submit",
    emptyError: "Enter an answer before submitting.",
    requiredError: "Fill in all required fields before submitting.",
    requiredA11yLabel: "required",
    selectPlaceholder: "Select...",
    answeredValue: (value: string) => `Answered: ${value}`,
  },

  // Subtasks
  uploads: {
    uploading: "Uploading...",
    uploadingFiles: "Uploading files, please wait...",
    limitsHint: (maxFiles: number, maxFileSize: string, maxTotalSize: string) =>
      `Add attachments (up to ${maxFiles} files, ${maxFileSize} each, ${maxTotalSize} total). Most regular file types are supported; compress macOS .app bundles first.`,
    filesTooLarge: (files: string, maxFileSize: string) =>
      `Files exceeding the ${maxFileSize} per-file limit were not added: ${files}.`,
    tooManyFiles: (count: number, maxFiles: number) =>
      `${count} file${count === 1 ? " was" : "s were"} not added. You can attach up to ${maxFiles} files at once.`,
    totalSizeTooLarge: (count: number, maxTotalSize: string) =>
      `${count} file${count === 1 ? " was" : "s were"} not added. Attachments can total up to ${maxTotalSize}.`,
  },

  subtasks: {
    subtask: "Subtask",
    executing: (count: number) =>
      `Executing ${count === 1 ? "" : count + " "}subtask${count === 1 ? "" : "s in parallel"}`,
    in_progress: "Running subtask",
    completed: "Subtask completed",
    failed: "Subtask failed",
    loadingSteps: "Loading steps…",
    retry: "Try again",
  },

  // Token Usage
  tokenUsage: {
    title: "Token Usage",
    label: "Tokens",
    input: "Input",
    output: "Output",
    total: "Total",
    view: "Display",
    unavailable:
      "No token usage yet. Usage appears only after a successful model response when the provider returns usage_metadata.",
    unavailableShort: "No usage returned",
    collecting: "Collecting tokens",
    note: "Header totals use persisted thread usage, plus visible in-flight usage while a run is still streaming. Per-turn and debug usage come from currently visible messages only. Totals may differ from provider billing pages.",
    presets: {
      off: "Off",
      summary: "Summary",
      perTurn: "Per turn",
      debug: "Debug",
    },
    presetDescriptions: {
      off: "Hide token usage in the header and conversation.",
      summary: "Show only the current conversation total in the header.",
      perTurn:
        "Show the header total and one token summary per assistant turn.",
      debug: "Show the header total and step-level token debugging details.",
    },
    finalAnswer: "Final answer",
    stepTotal: "Step total",
    sharedAttribution: "Shared across multiple actions in this step",
    subagent: (description: string) => `Subagent: ${description}`,
    startTodo: (content: string) => `Start To-do: ${content}`,
    completeTodo: (content: string) => `Complete To-do: ${content}`,
    updateTodo: (content: string) => `Update To-do: ${content}`,
    removeTodo: (content: string) => `Remove To-do: ${content}`,
  },

  contextUsage: {
    label: "Context",
    title: "Context window",
    badgeAriaLabel: (percentage: string) =>
      `Context window ${percentage}% full`,
  },

  // Shortcuts
  shortcuts: {
    searchActions: "Search actions...",
    noResults: "No results found.",
    actions: "Actions",
    keyboardShortcuts: "Keyboard Shortcuts",
    keyboardShortcutsDescription:
      "Navigate DeerFlow faster with keyboard shortcuts.",
    openCommandPalette: "Open Command Palette",
    toggleSidebar: "Toggle Sidebar",
  },

  // Settings
  settings: {
    title: "Settings",
    description: "Adjust how DeerFlow looks and behaves for you.",
    sessionUnavailable:
      "The current session could not be verified. Check the Gateway connection and try again.",
    sections: {
      account: "Account",
      appearance: "Appearance",
      channels: "Channels",
      integrations: "Integrations",
      memory: "Memory",
      tools: "Tools",
      skills: "Skills",
      notification: "Notification",
      about: "About",
    },
    memory: {
      title: "Memory",
      description:
        "DeerFlow automatically learns from your conversations in the background. These memories help DeerFlow understand you better and deliver a more personalized experience.",
      empty: "No memory data to display.",
      rawJson: "Raw JSON",
      exportButton: "Export memory",
      exportSuccess: "Memory exported",
      importButton: "Import memory",
      importConfirmTitle: "Import memory?",
      importConfirmDescription:
        "This will overwrite your current memory with the selected JSON backup.",
      importFileLabel: "Selected file",
      importInvalidFile:
        "Failed to read the selected memory file. Please choose a valid JSON export.",
      importSchemaIssue: (code, path) =>
        `The memory export is invalid (${code} at ${path}).`,
      importExtraWarning: (count) =>
        `${count} unknown field${count === 1 ? "" : "s"} will be sent unchanged, but the Gateway may ignore them.`,
      importDuplicateContentWarning: (count) =>
        `${count} duplicate-content fact${count === 1 ? "" : "s"} will be preserved because their IDs are different.`,
      importSuccess: "Memory imported",
      manualFactSource: "Manual",
      addFact: "Add fact",
      addFactTitle: "Add memory fact",
      editFactTitle: "Edit memory fact",
      addFactSuccess: "Fact created",
      editFactSuccess: "Fact updated",
      clearAll: "Clear all memory",
      clearAllConfirmTitle: "Clear all memory?",
      clearAllConfirmDescription:
        "This will remove all saved summaries and facts. This action cannot be undone.",
      clearAllSuccess: "All memory cleared",
      factDeleteConfirmTitle: "Delete this fact?",
      factDeleteConfirmDescription:
        "This fact will be removed from memory immediately. This action cannot be undone.",
      factDeleteSuccess: "Fact deleted",
      factContentLabel: "Content",
      factCategoryLabel: "Category",
      factConfidenceLabel: "Confidence",
      factContentPlaceholder: "Describe the memory fact you want to save",
      factCategoryPlaceholder: "context",
      factConfidenceHint: "Use a number between 0 and 1.",
      factSave: "Save fact",
      factValidationContent: "Fact content cannot be empty.",
      factValidationConfidence: "Confidence must be a number between 0 and 1.",
      noFacts: "No saved facts yet.",
      summaryReadOnly:
        "Summary sections are read-only for now. You can currently add, edit, or delete individual facts, or clear all memory.",
      memoryFullyEmpty: "No memory saved yet.",
      factPreviewLabel: "Fact to delete",
      searchPlaceholder: "Search memory",
      filterAll: "All",
      filterFacts: "Facts",
      filterSummaries: "Summaries",
      noMatches: "No matching memory found.",
      markdown: {
        overview: "Overview",
        userContext: "User context",
        work: "Work",
        personal: "Personal",
        topOfMind: "Top of mind",
        historyBackground: "History",
        recentMonths: "Recent months",
        earlierContext: "Earlier context",
        longTermBackground: "Long-term background",
        updatedAt: "Updated at",
        facts: "Facts",
        empty: "(empty)",
        table: {
          category: "Category",
          confidence: "Confidence",
          confidenceLevel: {
            veryHigh: "Very high",
            high: "High",
            normal: "Normal",
            unknown: "Unknown",
          },
          content: "Content",
          source: "Source",
          createdAt: "CreatedAt",
          view: "View",
        },
      },
    },
    appearance: {
      themeTitle: "Theme",
      themeDescription:
        "Choose how the interface follows your device or stays fixed.",
      system: "System",
      light: "Light",
      dark: "Dark",
      systemDescription: "Match the operating system preference automatically.",
      lightDescription: "Bright palette with higher contrast for daytime.",
      darkDescription: "Dim palette that reduces glare for focus.",
      languageTitle: "Language",
      languageDescription: "Switch between languages.",
    },
    tools: {
      title: "Tools",
      description: "Manage the configuration and enabled status of MCP tools.",
      adminRequired: "Admin privileges are required to manage MCP tools.",
      empty: "No MCP tools configured.",
    },
    channels: {
      title: "Channels",
      description:
        "Connect IM accounts that can send messages to DeerFlow from outside the browser.",
      disabled:
        "Channel connections are not enabled on this server. Ask an administrator to enable channel_connections.",
    },
    integrations: {
      title: "Integrations",
      description:
        "Connect third-party tools and work platforms so agents can use them directly.",
      refresh: "Refresh",
      install: "Install",
      reinstall: "Reinstall",
      installing: "Installing...",
      ready: "Ready",
      pending: "Pending",
      available: "Available",
      unavailable: "Unavailable",
      connected: "Connected",
      loadFailed: "Failed to load integration status",
      adminRequired: "Admin privileges are required to install integrations.",
      lark: {
        title: "Lark / Feishu CLI",
        description:
          "Install the official Lark/Feishu agent skills and let agents use Lark after authorization.",
        skillPack: "Skill pack",
        gatewayCli: "Gateway CLI",
        auth: "Auth",
        sandboxRuntime: "Sandbox runtime",
        sandboxRuntimeInitContainer: "Provisioned by init container",
        sandboxRuntimeBroker: "Provisioned by broker sidecar",
        sandboxRuntimeGatewayDownload: "Provisioned by Gateway",
        sandboxRuntimeNotReady:
          "Not ready — lark-cli may be missing at chat time",
        notInstalled: "Not installed",
        skillsInstalled: (installed, expected) =>
          `${installed}/${expected} skills installed`,
        installedVersion: (version) => `Installed: ${version}`,
        updateAvailable: (version) =>
          `Update available: ${version} — admin reinstall updates the managed Gateway CLI and skill pack`,
        runtimeVersionMismatch:
          "Skill pack version differs from the Gateway runtime lark-cli; admin reinstall attempts to update the managed Gateway CLI and realign the skill pack",
        authNotConfigured: "Not connected",
        authConfigured: "Credentials configured (not live-verified)",
        authConfiguredFor: (user) =>
          `${user} · credentials configured (not live-verified)`,
        connect: "Connect Lark",
        authStarting: "Opening connection link...",
        checkingConnection: "Checking connection...",
        connectedAction: "Reconnect Lark",
        requestPermissions: "Request permissions",
        alreadyConnected:
          "Lark is already connected. If authorization expires, refresh the status and reconnect.",
        changeAppButton: "Change Lark app",
        changeAppTitle: "Switch to a different Lark app",
        changeAppDescription:
          "Point your DeerFlow account at a different Lark/Feishu app. This only affects your account; other users are not changed.",
        changeAppIdLabel: "App ID",
        changeAppSecretLabel: "App Secret",
        changeAppAuthResetNote:
          "Switching revokes the previous app's authorization. You will authorize the new app next.",
        changeAppSubmit: "Switch app",
        changeAppReRegister: "Re-register in browser",
        changeAppSwitched:
          "Lark app switched. Reconnect to authorize the new app.",
        brandFeishu: "Feishu",
        brandLark: "Lark",
        connectionStarted: "Connection link opened",
        connectionReady: "Connection is ready. Opening authorization...",
        authStarted:
          "Authorization page opened. DeerFlow will detect completion automatically.",
        authorizationStillPending:
          'Authorization is not complete yet. Finish it in the browser; DeerFlow keeps checking automatically. You can click "I completed authorization" if the page does not update.',
        permissionTitle: "Authorization scope",
        permissionDescription:
          "By default, DeerFlow only completes the base sign-in and does not request any business permissions. Select the domains you need here; connected users can re-authorize to add more (scopes accumulate).",
        authDomains: {
          calendar: {
            label: "Calendar",
            description:
              "Events, free/busy, RSVP, and meeting-room scheduling.",
          },
          im: {
            label: "Messenger",
            description:
              "Send/reply messages, manage group chats, search history, download media.",
          },
          docs: {
            label: "Docs",
            description: "Create, read, update, and search documents.",
          },
          drive: {
            label: "Drive",
            description:
              "Upload/download files, search docs & wiki, manage comments.",
          },
          sheets: {
            label: "Sheets",
            description: "Read, write, append, find, and export spreadsheets.",
          },
          base: {
            label: "Base",
            description:
              "Bitable tables, fields, records, views, dashboards, and workflows.",
          },
          wiki: {
            label: "Wiki",
            description: "Knowledge spaces, nodes, and wiki documents.",
          },
          task: {
            label: "Tasks",
            description:
              "Tasks, task lists, subtasks, comments, and reminders.",
          },
          mail: {
            label: "Mail",
            description:
              "Browse, search, read, send, reply, forward, and manage drafts.",
          },
          vc: {
            label: "Meetings",
            description: "Meeting records, minutes artifacts, and recordings.",
          },
          minutes: {
            label: "Minutes",
            description: "Meeting minutes content and transcripts.",
          },
          note: {
            label: "Notes",
            description: "Meeting notes and related content.",
          },
          slides: {
            label: "Slides",
            description: "Presentations and slide content.",
          },
          markdown: {
            label: "Markdown",
            description:
              "Create, fetch, patch, and overwrite Drive-native .md files.",
          },
          mindnotes: {
            label: "Mind notes",
            description: "Mind notes content.",
          },
          contact: {
            label: "Contacts",
            description: "Look up users by name/email/phone and read profiles.",
          },
          approval: {
            label: "Approval",
            description:
              "Query and act on approval tasks; cancel and CC instances.",
          },
          attendance: {
            label: "Attendance",
            description: "Query personal attendance check-in records.",
          },
          okr: {
            label: "OKR",
            description:
              "Objectives, key results, alignments, indicators, and progress.",
          },
          event: {
            label: "Events",
            description: "Subscribe to and consume real-time platform events.",
          },
          apps: {
            label: "Apps",
            description:
              "Create Spark/Miaoda apps, publish sites, and manage access scope.",
          },
          all: {
            label: "All",
            description:
              "Request every business domain supported by lark-cli. Use this only when the missing permission is unclear.",
          },
        },
        customScopeLabel: "Exact OAuth scope",
        customScopePlaceholder: "For example calendar:calendar.event:read",
        customScopeDescription:
          "Advanced: if an error reports a missing scope, paste it here. Examples: calendar:calendar.event:read, calendar:calendar.free_busy:read.",
        openConnectionLinkTitle: "Continue connecting Lark",
        openConnectionLinkDescription:
          "The first connection needs one browser confirmation from Lark. Open the link below and finish the prompt, then return here to continue authorization.",
        openAuthLinkTitle: "Authorize Lark in your browser",
        openAuthLinkDescription:
          "Open the link below to authorize. DeerFlow keeps checking automatically and will save the connection after approval.",
        waitingAuthTitle: "Waiting for Lark authorization",
        waitingAuthDescription:
          "Finish authorization in the browser page that just opened. DeerFlow will update this panel automatically; the button below is only a fallback.",
        openAuthLink: "Open link",
        copyAuthLink: "Copy link",
        completeAuth: "I completed authorization",
        continueAuth: "I completed browser confirmation, continue",
        preparingAuthorization: "Preparing authorization...",
        completingAuth: "Checking...",
        authExpiresIn: (seconds) =>
          `This link expires in about ${seconds} seconds.`,
        installingTitle: "Installing official skill pack",
        installingDescription:
          "This usually finishes within 30 seconds; slower networks may take about 1 minute. The status refreshes automatically when installation completes.",
        installNextTitle: "Install the official skill pack first",
        installNextDescription:
          "After installation, /lark-doc, /lark-im, /lark-sheets and related skills appear in the skill index.",
        cliNextTitle: "Install Gateway CLI",
        cliNextDescription:
          "The skill pack is installed, but the Gateway cannot find lark-cli. Admin reinstall attempts to download the managed Gateway CLI; offline deployments can use an image with @larksuite/cli built in.",
        configuredTitle: "Lark credentials are configured locally",
        configuredDescription:
          "Credentials are present, but their current validity has not been checked with Lark. Reconnect to refresh and live-verify authorization.",
        connectedTitle: "Lark authorization is live-verified",
        connectedDescription:
          "The current user's authorization was verified with Lark during this connection flow. Reconnect whenever you need to refresh it or add permissions.",
        authNextTitle: "Complete browser authorization next",
        authNextDescription:
          "Click “Connect Lark”; DeerFlow checks the current status first and opens browser authorization only when disconnected or expired.",
      },
    },
    skills: {
      title: "Agent Skills",
      description:
        "Manage the configuration and enabled status of the agent skills.",
      createSkill: "Create skill",
      emptyTitle: "No agent skill yet",
      emptyDescription:
        "Put your agent skill folders under the `/skills/custom` folder under the root folder of DeerFlow.",
      emptyButton: "Create Your First Skill",
      adminRequired: "Admin privileges are required to manage agent skills.",
      installAdminRequired:
        "Admin privileges are required to install agent skills.",
    },
    notification: {
      title: "Notification",
      description:
        "DeerFlow only sends a completion notification when the window is not active. This is especially useful for long-running tasks so you can switch to other work and get notified when done.",
      requestPermission: "Request notification permission",
      deniedHint:
        "Notification permission was denied. You can enable it in your browser's site settings to receive completion alerts.",
      testButton: "Send test notification",
      testTitle: "DeerFlow",
      testBody: "This is a test notification.",
      notSupported: "Your browser does not support notifications.",
      disableNotification: "Disable notification",
    },
    account: {
      profileTitle: "Profile",
      email: "Email",
      role: "Role",
      ssoProvider: "SSO",
      changePasswordTitle: "Change Password",
      changePasswordDescription: "Update your account password.",
      ssoPasswordDescription: "Password is managed by your SSO provider.",
      ssoPasswordMessage:
        "This account signs in with {provider}, so DeerFlow cannot manage or change its password here. Use your SSO provider's account settings instead.",
      currentPassword: "Current password",
      newPassword: "New password",
      confirmNewPassword: "Confirm new password",
      passwordMismatch: "New passwords do not match",
      passwordTooShort: "Password must be at least 8 characters",
      passwordChangedSuccess: "Password changed successfully",
      loadFailed: "Failed to load account.",
      changePasswordFailed: "Failed to change password.",
      networkError: "Network error. Please try again.",
      updating: "Updating...",
      updatePassword: "Update Password",
      signOut: "Sign Out",
      signOutFailed: "Failed to sign out.",
    },
    acknowledge: {
      emptyTitle: "Acknowledgements",
      emptyDescription: "Credits and acknowledgements will show here.",
    },
  },
  browser: {
    panelTitle: "Browser view",
    live: "Live",
    back: "Back",
    forward: "Forward",
    urlPlaceholder: "Enter a URL and press Enter",
    close: "Close browser",
    retryNavigation: "Retry navigation",
    retryLive: "Retry live browser",
    stopLiveControl: "Stop live control",
    takeLiveControl: "Take live control",
    connectingFrame: "Connecting to live browser…",
    connectingFrameDescription: "Waiting for the first live frame.",
    noFrame: "No browser activity yet",
    noFrameDescription:
      "Enter a URL above or let the agent browse — the live view will appear here.",
    navigationFailedFallback: "Browser navigation failed.",
  },
  artifacts: {
    actions: {
      removeFile: (filename) => `Remove ${filename}`,
    },
    previewTitle: "Artifact preview",
    noSelectionTitle: "No artifact selected",
    noSelectionDescription: "Select an artifact to view its details",
    fileTypeLabel: (type) => `${type} file`,
    loadFailed: "Failed to load artifact",
    saveFailed: "Save failed",
    copyFailed: "Unable to copy artifact content.",
    installFailed: "Install failed",
    openFailed: "Failed to open artifact.",
    downloadFailed: "Failed to download artifact.",
    loading: "Loading artifact…",
    cannotPreview: "This file type cannot be previewed in the browser.",
  },
  messages: {
    tool: "Tool",
    toolResult: (name) => `${name} result`,
    copyFailed: "Failed to copy message.",
    loadEarlierFailed: "Failed to load earlier messages.",
    loadingConversation: "Loading conversation…",
    tryAgain: "Try again",
    actions: {
      editAndRerun: "Edit and rerun",
      branch: "Branch conversation",
      regenerate: "Regenerate",
    },
  },
  navigation: {
    closeSidebar: "Close sidebar",
    deleteConversationFailed: "Failed to delete conversation.",
    tryAgain: "Try again",
  },
  markdown: {
    downloadFile: "Download file",
    downloadImage: "Download image",
    imageNotAvailable: "Image not available",
    openExternalLink: "Open external link?",
    externalLinkWarning: "You're about to visit an external website.",
    copyLink: "Copy link",
    copied: "Copied",
    openLink: "Open link",
    copyCode: "Copy Code",
    copyTable: "Copy table",
    copyTableAsMarkdown: "Copy table as Markdown",
    copyTableAsCsv: "Copy table as CSV",
    copyTableAsTsv: "Copy table as TSV",
    downloadTable: "Download table",
    downloadTableAsCsv: "Download table as CSV",
    downloadTableAsMarkdown: "Download table as Markdown",
    viewFullscreen: "View fullscreen",
    exitFullscreen: "Exit fullscreen",
    tableFormatMarkdown: "Markdown",
    tableFormatCsv: "CSV",
    tableFormatTsv: "TSV",
    mermaidChart: "Mermaid chart",
    downloadDiagram: "Download diagram",
    downloadDiagramAsSvg: "Download diagram as SVG",
    downloadDiagramAsPng: "Download diagram as PNG",
    downloadDiagramAsMmd: "Download diagram as MMD",
    mermaidFormatSvg: "SVG",
    mermaidFormatPng: "PNG",
    mermaidFormatMmd: "MMD",
    zoomIn: "Zoom in",
    zoomOut: "Zoom out",
    resetZoomAndPan: "Reset zoom and pan",
    unsafeLink: "Unsafe link omitted",
    unsafeLinkTitle: (url) => `Unsafe link scheme in ${url}`,
  },
  setup: {
    createAdminTitle: "Create admin account",
    createAdminSubtitle: "Set up the administrator account to get started.",
    completeAdminTitle: "Complete admin account setup",
    currentPassword: "Current password",
    password: "Password",
    passwordPlaceholder: "Password (min. 8 characters)",
    // 上游 `(auth)/setup/page.tsx:258` 的 label 是 `Confirm Password`（大写 P），
    // placeholder 才是小写的 `Confirm password`。两处此前共用同一条词条，于是
    // 标签少了个大写、占位符与标签同字导致快照里连 `/placeholder:` 那一行都不出现。
    confirmPassword: "Confirm Password",
    confirmPasswordPlaceholder: "Confirm password",
    passwordMismatch: "Passwords do not match",
    passwordTooShort: "Password must be at least 8 characters",
    createAdmin: "Create Admin Account",
    completeSetup: "Complete Setup",
  },
  marketing: {
    badge: "Super Agent, now with public examples",
    showcaseDescription:
      "Explore real DeerFlow conversations in a safe, read-only showcase.",
    enterWorkspace: "Enter workspace",
    caseStudies: "Case Studies",
    caseStudiesDescription: "See how DeerFlow is used in the wild",
    caseStudyPreview: (title) => `${title} preview`,
    caseStudyItems: [
      {
        title: "Forecast 2026 Agent Trends and Opportunities",
        description:
          "Create a webpage with a Deep Research report forecasting the agent technology trends and opportunities in 2026.",
      },
      {
        title: 'Generate a Video Based On the Novel "Pride and Prejudice"',
        description:
          'Search a scene from "Pride and Prejudice", then generate a reference image and video.',
      },
      {
        title: "Doraemon Explains the MOE Architecture",
        description:
          "Generate a Doraemon comic strip explaining the MOE architecture to teenagers interested in AI.",
      },
      {
        title: "An Exploratory Data Analysis of the Titanic Dataset",
        description:
          "Explore the Titanic dataset and identify factors that influenced survival with visualizations and insights.",
      },
      {
        title: "Watch Y Combinator's Video then Conduct a Deep Research",
        description:
          "Watch a Y Combinator video and research its advice for technical startup founders.",
      },
      {
        title: "Collect and Summarize Dr. Fei Fei Li's Podcasts",
        description:
          "Collect recent podcast appearances by Dr. Fei Fei Li and summarize them into a report.",
      },
    ],
  },
  login: {
    signInTitle: "Sign in to your account",
    createAccountTitle: "Create a new account",
    email: "Email",
    emailPlaceholder: "you@example.com",
    password: "Password",
    passwordPlaceholder: "•••••••",
    rememberMe: "Keep me signed in",
    rememberMeDescription:
      "Keep this browser session when possible. DeerFlow stores only your email, never your password.",
    pleaseWait: "Please wait...",
    signIn: "Sign In",
    createAccount: "Create Account",
    createAdminAccount: "Create admin account",
    adminSetupRequiredTitle: "Administrator setup is required",
    adminSetupRequiredDescription:
      "DeerFlow needs an administrator account before new regular accounts can be created.",
    orContinueWith: "Or continue with",
    ssoHint:
      "If your account uses single sign-on, sign in with the option below instead.",
    continueWith: (provider: string) => `Continue with ${provider}`,
    noAccountSignUp: "Don't have an account? Sign up",
    haveAccountSignIn: "Already have an account? Sign in",
    backToHome: "← Back to home",
    networkError: "Network error. Please try again.",
    serviceUnavailableTitle: "Service temporarily unavailable",
    serviceUnavailableDescription:
      "The Gateway is taking too long to respond. Check that it is running, then try again.",
    retry: "Try again",
    authFailed: "Authentication failed.",
    callbackSigningIn: "Signing you in...",
    callbackRedirecting: "Redirecting...",
    callbackFailedRedirect: "Authentication failed. Redirecting to login...",
    callbackUnavailableRedirect:
      "Gateway is temporarily unavailable. Redirecting to recovery...",
    errors: {
      sso_failed: "SSO login failed. Please try again or use email login.",
      sso_cancelled: "SSO login was cancelled.",
      sso_account_exists:
        "An account with this email already exists. Please sign in with your password or contact your administrator.",
      sso_not_allowed:
        "SSO login is not allowed for your account. Contact your administrator.",
    },
  },
};
