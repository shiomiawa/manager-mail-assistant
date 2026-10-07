"use client";

import { useCallback, useState } from "react";
import { BriefingPanel } from "@/components/BriefingPanel";
import { CoachingPanel } from "@/components/CoachingPanel";
import { HelpDialog } from "@/components/HelpDialog";
import { KudosPanel } from "@/components/KudosPanel";
import { MeetingPanel } from "@/components/MeetingPanel";
import { StatusBar } from "@/components/StatusBar";
import { WeeklyReportPanel } from "@/components/WeeklyReportPanel";

const FOLDERS = [
  { key: "weekly", label: "Weekly Report" },
  { key: "coaching", label: "Survey Coaching" },
  { key: "meeting", label: "Meeting Notes" },
  { key: "briefing", label: "Briefing Notes" },
  { key: "kudos", label: "Kudos Mail" },
] as const;
type FolderKey = (typeof FOLDERS)[number]["key"];

/**
 * アプリの外枠（メールソフト風）：タイトルバー、左のフォルダ、作業画面、下の状態表示の帯。
 * フォルダを切り替えても、それぞれの入力内容は残す。色は data-folder で切り替わる
 */
export function AppTabs() {
  const [active, setActive] = useState<FolderKey>("weekly");
  const [helpOpen, setHelpOpen] = useState(false);
  const closeHelp = useCallback(() => setHelpOpen(false), []);

  return (
    <div data-folder={active} className="flex min-h-[calc(100vh-2rem)] flex-col overflow-hidden rounded-xl border border-line bg-white shadow-lg">
      <header className="flex flex-wrap items-center gap-x-5 gap-y-2 border-b-4 border-brand-600 bg-header px-5 py-3 text-white">
        <div className="min-w-0">
          <h1 className="text-[22px] leading-tight font-bold tracking-wide">My Mail Butler</h1>
          <p className="text-xs text-[#aab3c0]">Email Drafting Support</p>
        </div>
        <button
          type="button"
          onClick={() => setHelpOpen(true)}
          className="ml-auto inline-flex items-center gap-2 rounded-md border border-white/35 px-3.5 py-1.5 text-[13px] font-semibold hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-white"
        >
          <span aria-hidden="true" className="grid h-[18px] w-[18px] place-items-center rounded-full bg-white text-xs font-bold text-header">
            ?
          </span>
          Help
        </button>
      </header>

      <div className="grid flex-1 lg:grid-cols-[220px_minmax(0,1fr)]">
        <nav aria-label="フォルダ" className="flex gap-1 overflow-x-auto border-b border-line bg-rail p-2 lg:flex-col lg:border-r lg:border-b-0 lg:p-3">
          <p className="hidden px-2.5 pt-1 text-[11px] tracking-widest text-muted uppercase lg:block">Folders</p>
          <div role="tablist" aria-label="機能" className="flex gap-1 lg:flex-col">
            {FOLDERS.map((folder) => {
              const current = active === folder.key;
              return (
                <button
                  key={folder.key}
                  type="button"
                  role="tab"
                  aria-selected={current}
                  data-folder={folder.key}
                  onClick={() => setActive(folder.key)}
                  className={`flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-[13.5px] font-medium whitespace-nowrap ${
                    current ? "bg-brand-700 font-bold text-white" : "text-ink hover:bg-line-soft"
                  }`}
                >
                  <span aria-hidden="true" className={`h-2.5 w-2.5 flex-none rounded-[3px] ${current ? "bg-white" : "bg-brand-600"}`} />
                  {folder.label}
                </button>
              );
            })}
          </div>
          <hr className="my-2 hidden border-line-soft lg:block" />
          <p className="hidden px-2.5 text-[11px] tracking-widest text-muted uppercase lg:block">Settings</p>
          <button type="button" onClick={() => setHelpOpen(true)} className="hidden rounded-lg px-2.5 py-1.5 text-left text-[12.5px] text-muted hover:bg-line-soft lg:block">
            目標値（Targets）
          </button>
          <button type="button" onClick={() => setHelpOpen(true)} className="hidden rounded-lg px-2.5 py-1.5 text-left text-[12.5px] text-muted hover:bg-line-soft lg:block">
            行動指針（Principles）
          </button>
        </nav>

        <main className="min-w-0">
          <div hidden={active !== "weekly"} className="h-full">
            <WeeklyReportPanel />
          </div>
          <div hidden={active !== "coaching"} className="h-full">
            <CoachingPanel />
          </div>
          <div hidden={active !== "meeting"} className="h-full">
            <MeetingPanel />
          </div>
          <div hidden={active !== "briefing"} className="h-full">
            <BriefingPanel />
          </div>
          <div hidden={active !== "kudos"} className="h-full">
            <KudosPanel />
          </div>
        </main>
      </div>

      <StatusBar />
      <HelpDialog open={helpOpen} onClose={closeHelp} />
    </div>
  );
}
