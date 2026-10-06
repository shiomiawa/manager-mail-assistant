"use client";

import { useMemo, useState } from "react";
import { EmailPreview } from "@/components/EmailPreview";
import { WorkbookLoader } from "@/components/WorkbookLoader";
import { postJson } from "@/lib/apiClient";
import { buildCoachingEmails } from "@/lib/coaching/coachingEmails";
import { buildCoachingInput } from "@/lib/coaching/data";
import type { CoachingDraft, CoachingInput } from "@/lib/coaching/types";
import { L, tenureLabel } from "@/lib/labels";
import { buildWeeklyReport, listWeeks } from "@/lib/report/aggregate";
import { formatWeekRange } from "@/lib/report/format";
import { loadTargets } from "@/lib/report/targets";
import { useWorkbook } from "@/lib/workbookStore";

const MAX_MEMO_LENGTH = 1000;
const targets = loadTargets();

type Result = { version: number; draft: CoachingDraft; input: CoachingInput; weekStart: string; mock: boolean };

export function CoachingPanel() {
  const { rows, comments, version } = useWorkbook();
  const [selectedWeek, setSelectedWeek] = useState("");
  const [employeeId, setEmployeeId] = useState("");
  const [memo, setMemo] = useState("");
  const [rawResult, setResult] = useState<Result | null>(null);
  const [tab, setTab] = useState<"sheet" | "toEmployee">("sheet");
  const [drafting, setDrafting] = useState(false);
  const [draftError, setDraftError] = useState("");

  const weeks = useMemo(() => (rows ? listWeeks(rows) : []), [rows]);
  const weekStart = weeks.some((w) => w.weekStart === selectedWeek) ? selectedWeek : (weeks.at(-1)?.weekStart ?? "");
  const report = useMemo(
    () => (rows && weekStart ? buildWeeklyReport(rows, targets, weekStart, comments) : null),
    [rows, weekStart, comments],
  );
  const result = rawResult && rawResult.version === version ? rawResult : null;
  const emails = useMemo(
    () => (result ? buildCoachingEmails(result.draft, result.input, result.weekStart) : []),
    [result],
  );
  const current = emails.find((e) => e.key === tab) ?? emails[0];

  // 社員の一覧：4週間の「悪い」の声が多い順（コーチングが必要そうな人から）
  const candidates = useMemo(() => {
    if (!report) return [];
    return report.employees
      .map((e) => ({ e, input: buildCoachingInput(report, comments, e.employeeId, "")! }))
      .sort((a, b) => b.input.totals.negative - a.input.totals.negative || a.e.employeeId.localeCompare(b.e.employeeId));
  }, [report, comments]);
  const selected = candidates.find((c) => c.e.employeeId === employeeId);

  const reset = () => {
    setResult(null);
    setDraftError("");
  };

  async function onDraft() {
    if (!report || !employeeId) {
      setDraftError("社員を選んでください。");
      return;
    }
    const input = buildCoachingInput(report, comments, employeeId, memo);
    if (!input) return;
    setDrafting(true);
    setDraftError("");
    try {
      const data = await postJson<{ draft: CoachingDraft; mock: boolean }>("/api/coaching", { input });
      setResult({ version, draft: data.draft, input, weekStart, mock: data.mock });
      setTab("sheet");
    } catch (error) {
      setDraftError(error instanceof Error ? error.message : "コーチングを作れませんでした。");
    } finally {
      setDrafting(false);
    }
  }

  return (
    <div className="space-y-6">
      <WorkbookLoader />

      {report && (
        <section className="rounded-lg border border-slate-200 bg-white p-4">
          <h2 className="text-base font-bold text-brand-800">2. コーチングする人を選ぶ</h2>
          <p className="mt-1 text-sm text-slate-600">
            選んだ週までの4週間のお客様アンケート（コメント）から、強み・重点テーマ・1on1で聞く質問をまとめます。社員は「悪い」の声が多い順に並んでいます。
          </p>
          <div className="mt-3 flex flex-wrap items-end gap-4 text-sm">
            <label className="flex items-center gap-2">
              対象の週
              <select
                value={weekStart}
                onChange={(event) => {
                  setSelectedWeek(event.target.value);
                  reset();
                }}
                className="rounded border border-slate-300 px-2 py-1"
              >
                {[...weeks].reverse().map((week) => (
                  <option key={week.weekStart} value={week.weekStart}>
                    {L.week} {week.weekNumber}（{formatWeekRange(week.weekStart)}）
                  </option>
                ))}
              </select>
            </label>
            <label className="flex items-center gap-2">
              社員
              <select
                value={selected ? employeeId : ""}
                onChange={(event) => {
                  setEmployeeId(event.target.value);
                  reset();
                }}
                className="rounded border border-slate-300 px-2 py-1"
              >
                <option value="">選んでください</option>
                {candidates.map(({ e, input }) => (
                  <option key={e.employeeId} value={e.employeeId}>
                    {e.employeeId}（{L.negative} {input.totals.negative}・{L.positive} {input.totals.positive}）
                  </option>
                ))}
              </select>
            </label>
            {selected && (
              <span className="text-xs text-slate-500">
                {L.tenure}：{selected.e.tenureMonths === null ? "—" : tenureLabel(selected.e.tenureMonths)}・4週間のコメント{" "}
                {selected.input.totals.total}件
              </span>
            )}
          </div>
          <label className="mt-3 block text-sm">
            <span className="font-bold">行動のメモ（任意）</span>
            <span className="ml-2 text-xs text-slate-500">
              見聞きした具体的な行動を書くと、コーチングに反映します。数字やコメントだけで行動を決めつけないためのものです。
            </span>
            <textarea
              value={memo}
              maxLength={MAX_MEMO_LENGTH}
              onChange={(event) => setMemo(event.target.value)}
              rows={3}
              placeholder="例：チャットで同時に3件持っているときに、返信が定型文だけになりがち"
              className="mt-1 block w-full rounded border border-slate-300 p-2"
            />
          </label>
          <div className="mt-3 flex items-center gap-3">
            <button
              type="button"
              onClick={() => void onDraft()}
              disabled={drafting}
              className="rounded bg-brand-700 px-5 py-2 text-sm font-bold text-white hover:bg-brand-800 disabled:opacity-50"
            >
              {drafting ? "作成中…" : "コーチングを作る"}
            </button>
            {draftError && (
              <p role="alert" className="text-sm text-red-700">
                {draftError}
              </p>
            )}
          </div>
          {selected && selected.input.totals.total === 0 && (
            <p className="mt-2 text-xs text-amber-700">この4週間はコメントがありません。数字の推移だけでまとめます。</p>
          )}
        </section>
      )}

      {result && current && (
        <div>
          <div role="tablist" aria-label="コーチングの種類" className="flex flex-wrap gap-1 border-b border-slate-300 text-sm">
            {emails.map((email) => (
              <button
                key={email.key}
                type="button"
                role="tab"
                aria-selected={email.key === current.key}
                onClick={() => setTab(email.key)}
                className={`rounded-t border border-b-0 px-4 py-2 ${email.key === current.key ? "border-slate-300 bg-white font-bold text-brand-800" : "border-transparent text-slate-500 hover:text-brand-700"}`}
              >
                {email.label}
                {!email.sendable && <span className="ml-1 text-[11px] text-slate-400">（自分用）</span>}
              </button>
            ))}
          </div>
          <div className="mt-3">
            <EmailPreview
              key={current.key}
              doc={current.doc}
              mock={result.mock}
              mockNote="コーチングの文章はダミーです（AIはまだつないでいません）。お客様の声の件数と引用はデータから集計した本物です。"
            />
          </div>
        </div>
      )}
    </div>
  );
}
