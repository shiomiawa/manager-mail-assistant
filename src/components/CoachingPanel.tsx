"use client";

import { useMemo, useState } from "react";
import { EmailPreview } from "@/components/EmailPreview";
import { DraftTabs } from "@/components/DraftTabs";
import { WorkbookLoader } from "@/components/WorkbookLoader";
import { EmptyReader, Step, Workspace } from "@/components/Workspace";
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

  const selectClass = "rounded border border-line px-2 py-1 text-sm";
  return (
    <Workspace
      compose={
        <>
          <WorkbookLoader />

          {report && (
            <Step n={2} label="Member" title="コーチングする人を選ぶ">
              <p className="text-xs leading-5 text-muted">
                選んだ週までの4週間のお客様アンケート（コメント）から、強み・重点テーマ・1on1で聞く質問をまとめます。社員は「悪い」の声が多い順です。
              </p>
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <select
                  value={weekStart}
                  aria-label="対象の週"
                  onChange={(event) => {
                    setSelectedWeek(event.target.value);
                    reset();
                  }}
                  className={selectClass}
                >
                  {[...weeks].reverse().map((week) => (
                    <option key={week.weekStart} value={week.weekStart}>
                      {L.week} {week.weekNumber}（{formatWeekRange(week.weekStart)}）
                    </option>
                  ))}
                </select>
                <select
                  value={selected ? employeeId : ""}
                  aria-label="社員"
                  onChange={(event) => {
                    setEmployeeId(event.target.value);
                    reset();
                  }}
                  className={selectClass}
                >
                  <option value="">社員を選ぶ</option>
                  {candidates.map(({ e, input }) => (
                    <option key={e.employeeId} value={e.employeeId}>
                      {e.employeeId}（{L.negative} {input.totals.negative}・{L.positive} {input.totals.positive}）
                    </option>
                  ))}
                </select>
              </div>
              {selected && (
                <p className="text-xs text-muted">
                  {L.tenure}：{selected.e.tenureMonths === null ? "—" : tenureLabel(selected.e.tenureMonths)}・4週間のコメント{" "}
                  {selected.input.totals.total}件
                </p>
              )}
              {selected && selected.input.totals.total === 0 && (
                <p className="text-xs text-amber-700">この4週間はコメントがありません。数字の推移だけでまとめます。</p>
              )}
            </Step>
          )}

          {report && (
            <Step n={3} label="Draft" title="コーチングを作る">
              <label className="block text-sm">
                <span className="font-semibold">行動のメモ（任意）</span>
                <span className="mt-0.5 block text-xs text-muted">
                  見聞きした具体的な行動を書くと、コーチングに反映します。数字やコメントだけで行動を決めつけないためのものです。
                </span>
                <textarea
                  value={memo}
                  maxLength={MAX_MEMO_LENGTH}
                  onChange={(event) => setMemo(event.target.value)}
                  rows={3}
                  placeholder="例：チャットで同時に3件持っているときに、返信が定型文だけになりがち"
                  className="mt-1 block w-full rounded border border-line p-2"
                />
              </label>
              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={() => void onDraft()}
                  disabled={drafting}
                  className="rounded-md bg-brand-700 px-5 py-2 text-sm font-semibold text-white hover:bg-brand-800 disabled:opacity-50"
                >
                  {drafting ? "作成中…" : "コーチングを作る"}
                </button>
                {draftError && (
                  <p role="alert" className="text-sm text-red-700">
                    {draftError}
                  </p>
                )}
              </div>
            </Step>
          )}
        </>
      }
      reader={
        result && current ? (
          <>
            <DraftTabs label="コーチングの種類" items={emails} current={current.key} onSelect={setTab} />
            <EmailPreview
              key={current.key}
              doc={current.doc}
              mock={result.mock}
              to={current.sendable ? result.input.employeeId : "自分用"}
              mockNote="コーチングの文章はダミーです（AIはまだつないでいません）。お客様の声の件数と引用はデータから集計した本物です。"
            />
          </>
        ) : (
          <EmptyReader>
            <p className="font-semibold text-ink">ここにコーチングのプレビューが表示されます</p>
            <p>{report ? "Step 2 で社員を選び、「コーチングを作る」を押してください。" : "まず Step 1 でExcelを読み込むか、サンプルを使ってください。"}</p>
          </EmptyReader>
        )
      }
    />
  );
}
