"use client";

import { useMemo, useState } from "react";
import { EmailPreview } from "@/components/EmailPreview";
import { WorkbookLoader } from "@/components/WorkbookLoader";
import { EmptyReader, Step, Workspace } from "@/components/Workspace";
import { postJson } from "@/lib/apiClient";
import { buildWeeklyReport, listWeeks } from "@/lib/report/aggregate";
import type { CommentResponse, IndividualComment, TeamComment } from "@/lib/report/comments";
import { L, rankLabel, tenureLabel } from "@/lib/labels";
import {
  formatDiff,
  formatMin,
  formatNumber,
  formatSatisfaction,
  formatScore,
  formatWeekRange,
} from "@/lib/report/format";
import { loadTargets } from "@/lib/report/targets";
import type { WeeklyReport } from "@/lib/report/types";
import { buildIndividualEmail, buildTeamEmail } from "@/lib/report/weeklyEmails";
import { useWorkbook } from "@/lib/workbookStore";

const MAX_MEMO_LENGTH = 1000;
const targets = loadTargets();

// version：どのデータで作った下書きか（データを読み込み直したら、古い下書きは出さない）
type Draft =
  | { version: number; type: "team"; comment: TeamComment; mock: boolean }
  | { version: number; type: "individual"; employeeId: string; comment: IndividualComment; mock: boolean };

export function WeeklyReportPanel() {
  const { rows, comments, version } = useWorkbook();
  const [selectedWeek, setSelectedWeek] = useState("");
  const [mode, setMode] = useState<"team" | "individual">("team");
  const [selectedEmployee, setSelectedEmployee] = useState("");
  const [memo, setMemo] = useState("");
  const [rawDraft, setDraft] = useState<Draft | null>(null);
  const [drafting, setDrafting] = useState(false);
  const [draftError, setDraftError] = useState("");

  const weeks = useMemo(() => (rows ? listWeeks(rows) : []), [rows]);
  // 選んだ週がいまのデータにないとき（読み込み直したときなど）は、最新の週にする
  const weekStart = weeks.some((w) => w.weekStart === selectedWeek) ? selectedWeek : (weeks.at(-1)?.weekStart ?? "");
  const report = useMemo<WeeklyReport | null>(
    () => (rows && weekStart ? buildWeeklyReport(rows, targets, weekStart, comments) : null),
    [rows, weekStart, comments],
  );
  const employeeId = report?.employees.some((e) => e.employeeId === selectedEmployee) ? selectedEmployee : "";
  const draft = rawDraft && rawDraft.version === version ? rawDraft : null;

  async function onDraft() {
    if (!report) return;
    if (mode === "individual" && !employeeId) {
      setDraftError("社員を選んでください。");
      return;
    }
    setDrafting(true);
    setDraftError("");
    try {
      if (mode === "team") {
        const result = await postJson<CommentResponse<TeamComment>>("/api/weekly-comment", { type: "team", report });
        setDraft({ version, type: "team", comment: result.comment, mock: result.mock });
      } else {
        const result = await postJson<CommentResponse<IndividualComment>>("/api/weekly-comment", {
          type: "individual",
          report,
          employeeId,
          memo,
        });
        setDraft({ version, type: "individual", employeeId, comment: result.comment, mock: result.mock });
      }
    } catch (error) {
      setDraftError(error instanceof Error ? error.message : "下書きを作れませんでした。");
    } finally {
      setDrafting(false);
    }
  }

  const emailDoc = useMemo(() => {
    if (!report || !draft) return null;
    if (draft.type === "team") return buildTeamEmail(report, draft.comment);
    const employee = report.employees.find((e) => e.employeeId === draft.employeeId);
    return employee ? buildIndividualEmail(report, employee, draft.comment) : null;
  }, [report, draft]);

  // 条件を変えたら、古い下書きは消す
  const resetDraft = () => {
    setDraft(null);
    setDraftError("");
  };

  const selectClass = "rounded border border-line px-2 py-1 text-sm";
  return (
    <Workspace
      compose={
        <>
          {/* Step 1：データの読み込み（Survey Coaching と共有） */}
          <WorkbookLoader />

          {report && (
            <Step n={2} label="Results" title={`${L.week} ${report.team.weekNumber}（${formatWeekRange(report.team.weekStart)}）`}>
              <label className="flex items-center gap-2 text-xs text-muted">
                対象の週
                <select
                  value={weekStart}
                  onChange={(event) => {
                    setSelectedWeek(event.target.value);
                    resetDraft();
                  }}
                  className={selectClass}
                >
                  {[...weeks].reverse().map((week) => (
                    <option key={week.weekStart} value={week.weekStart}>
                      {L.week} {week.weekNumber}（{formatWeekRange(week.weekStart)}）
                    </option>
                  ))}
                </select>
              </label>
              <TeamSummary report={report} />
              <RankingTable report={report} />
            </Step>
          )}

          {report && (
            <Step n={3} label="Draft" title="メールの下書きを作る">
              <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
                <fieldset className="flex gap-4">
                  <legend className="sr-only">宛先</legend>
                  {(["team", "individual"] as const).map((value) => (
                    <label key={value} className="flex items-center gap-1">
                      <input
                        type="radio"
                        name="mode"
                        checked={mode === value}
                        onChange={() => {
                          setMode(value);
                          resetDraft();
                        }}
                      />
                      {value === "team" ? "チーム向け" : "個人向け"}
                    </label>
                  ))}
                </fieldset>
                {mode === "individual" && (
                  <select
                    value={employeeId}
                    aria-label="社員"
                    onChange={(event) => {
                      setSelectedEmployee(event.target.value);
                      resetDraft();
                    }}
                    className={selectClass}
                  >
                    <option value="">社員を選ぶ</option>
                    {[...report.employees]
                      .sort((a, b) => a.employeeId.localeCompare(b.employeeId))
                      .map((e) => (
                        <option key={e.employeeId} value={e.employeeId}>
                          {e.employeeId}（{L.total} {rankLabel(e.rank.total)}）
                        </option>
                      ))}
                  </select>
                )}
              </div>
              {mode === "individual" && (
                <label className="block text-sm">
                  <span className="font-semibold">行動のメモ（任意）</span>
                  <span className="mt-0.5 block text-xs text-muted">
                    見聞きした具体的な行動を書くと、AIのコメントに反映します。数字だけで行動を決めつけないためのものです。
                  </span>
                  <textarea
                    value={memo}
                    maxLength={MAX_MEMO_LENGTH}
                    onChange={(event) => setMemo(event.target.value)}
                    rows={3}
                    placeholder="例：難しい問い合わせを最後まで粘り強く対応していた"
                    className="mt-1 block w-full rounded border border-line p-2"
                  />
                </label>
              )}
              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={() => void onDraft()}
                  disabled={drafting}
                  className="rounded-md bg-brand-700 px-5 py-2 text-sm font-semibold text-white hover:bg-brand-800 disabled:opacity-50"
                >
                  {drafting ? "作成中…" : "下書きを作る"}
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
        emailDoc && draft ? (
          <EmailPreview doc={emailDoc} mock={draft.mock} to={draft.type === "team" ? "Team" : draft.employeeId} />
        ) : (
          <EmptyReader>
            <p className="font-semibold text-ink">ここにメールのプレビューが表示されます</p>
            <p>{report ? "Step 3 で宛先を選び、「下書きを作る」を押してください。" : "まず Step 1 でExcelを読み込むか、サンプルを使ってください。"}</p>
          </EmptyReader>
        )
      }
    />
  );
}

function TeamSummary({ report }: { report: WeeklyReport }) {
  const { team } = report;
  const change = team.changeFromLastWeek;
  const groups = [
    {
      label: L.quality,
      items: [
        {
          label: L.csat,
          value: formatSatisfaction(team.thisWeek.avgSatisfaction),
          target: `${L.target} ${formatSatisfaction(team.achievement.avgSatisfaction.target)}`,
          achieved: team.achievement.avgSatisfaction.achieved,
          change: change && formatDiff(change.avgSatisfaction, 2),
        },
      ],
    },
    {
      label: L.efficiency,
      items: [
        {
          label: L.cases,
          value: formatNumber(team.thisWeek.count),
          target: `${L.target} ${formatNumber(team.achievement.weeklyCount.target)}`,
          achieved: team.achievement.weeklyCount.achieved,
          change: change && formatDiff(change.count, 0),
        },
        {
          label: L.aht,
          value: formatMin(team.thisWeek.avgMinutes),
          target: `${L.target} ≤ ${formatMin(team.achievement.avgMinutes.target)}`,
          achieved: team.achievement.avgMinutes.achieved,
          change: change && formatDiff(change.avgMinutes, 1, " min"),
        },
      ],
    },
  ];
  return (
    <div>
      <p className="text-xs text-muted">チーム全体（{team.headcount}名）</p>
      <div className="mt-1 grid grid-cols-3 gap-2">
        {groups.flatMap((group) =>
          group.items.map((item) => (
            <div key={item.label} className="min-w-0 rounded-md border border-line-soft bg-bar p-2">
              <p className="flex flex-wrap items-center gap-x-1.5 text-[11px] text-muted">
                {item.label}
                <span
                  className={`rounded-full px-2 text-[11px] font-bold ${item.achieved ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"}`}
                >
                  {item.achieved ? L.met : L.missed}
                </span>
              </p>
              <p className="text-lg font-bold tabular-nums">{item.value}</p>
              <p className="text-[11px] leading-4 text-muted">{item.target}</p>
              {item.change && <p className="text-[11px] leading-4 text-muted">{L.vsLastWeek} {item.change}</p>}
            </div>
          )),
        )}
      </div>
    </div>
  );
}

function RankingTable({ report }: { report: WeeklyReport }) {
  const columns: { label: string; align: "left" | "right" | "center" }[] = [
    { label: L.rank, align: "center" },
    { label: L.employeeId, align: "left" },
    { label: L.tenure, align: "left" },
    { label: L.total, align: "right" },
    { label: L.quality, align: "right" },
    { label: L.efficiency, align: "right" },
    { label: L.csat, align: "right" },
    { label: L.cases, align: "right" },
    { label: L.aht, align: "right" },
    { label: `${L.csat} ${L.vsLastWeek}`, align: "right" },
    { label: L.kudos, align: "right" },
    { label: L.negative, align: "right" },
    { label: "Weeks", align: "right" },
  ];
  const alignClass = { left: "text-left", right: "text-right", center: "text-center" };
  return (
    <details>
      <summary className="cursor-pointer text-sm font-semibold text-brand-700">
        ランキングと個人の数字を見る（{report.employees.length}名）
      </summary>
      <p className="mt-2 text-xs text-muted">
        スコアはチーム内の相対評価（0〜100）です。{L.quality}は満足度（{L.csat}）、{L.efficiency}は対応件数（{L.cases}）と平均対応時間（{L.aht}）から計算します。{L.total}の重みは {L.cases} 0.1・{L.aht} 0.3・{L.csat} 0.6 で、チャンネルの違いはならしてから比べています。
      </p>
      <div className="mt-2 overflow-x-auto">
        <table className="w-full min-w-[860px] text-sm">
          <thead className="bg-brand-50 text-xs text-muted">
            <tr>
              {columns.map((column) => (
                <th key={column.label} className={`px-2 py-1 ${alignClass[column.align]}`}>
                  {column.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {report.employees.map((e) => (
              <tr key={e.employeeId} className="border-b border-line-soft">
                <td className="px-2 py-1 text-center">{rankLabel(e.rank.total)}</td>
                <td className="px-2 py-1">{e.employeeId}</td>
                <td className="px-2 py-1">{e.tenureMonths === null ? "—" : tenureLabel(e.tenureMonths)}</td>
                <td className="px-2 py-1 text-right font-bold">{formatScore(e.scores.total)}</td>
                <td className="px-2 py-1 text-right">{formatScore(e.scores.quality)}</td>
                <td className="px-2 py-1 text-right">{formatScore(e.scores.efficiency)}</td>
                <td className="px-2 py-1 text-right">{formatSatisfaction(e.thisWeek.avgSatisfaction)}</td>
                <td className="px-2 py-1 text-right">{formatNumber(e.thisWeek.count)}</td>
                <td className="px-2 py-1 text-right">{formatMin(e.thisWeek.avgMinutes)}</td>
                <td className="px-2 py-1 text-right">
                  {e.changeFromLastWeek ? formatDiff(e.changeFromLastWeek.avgSatisfaction, 2) : "—"}
                </td>
                <td className="px-2 py-1 text-right">{e.voice.positive}</td>
                <td className="px-2 py-1 text-right">{e.voice.negative}</td>
                <td className="px-2 py-1 text-right">{e.weeksWithData}/4</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  );
}
