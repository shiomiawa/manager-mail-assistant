"use client";

import { useState } from "react";
import { MeetingPanel } from "@/components/MeetingPanel";
import { WeeklyReportPanel } from "@/components/WeeklyReportPanel";

const TABS = [
  { key: "weekly", label: "Weekly Performance Report" },
  { key: "meeting", label: "Meeting Notes" },
] as const;

/** 機能の切り替え。切り替えても、それぞれの入力内容は残す */
export function AppTabs() {
  const [active, setActive] = useState<(typeof TABS)[number]["key"]>("weekly");
  return (
    <>
      <div role="tablist" aria-label="機能" className="mb-4 flex gap-1 border-b border-slate-300 text-sm">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            type="button"
            role="tab"
            aria-selected={active === tab.key}
            onClick={() => setActive(tab.key)}
            className={`rounded-t border border-b-0 px-4 py-2 ${active === tab.key ? "border-slate-300 bg-white font-bold text-brand-800" : "border-transparent text-slate-500 hover:text-brand-700"}`}
          >
            {tab.label}
          </button>
        ))}
      </div>
      <div hidden={active !== "weekly"}>
        <WeeklyReportPanel />
      </div>
      <div hidden={active !== "meeting"}>
        <MeetingPanel />
      </div>
    </>
  );
}
