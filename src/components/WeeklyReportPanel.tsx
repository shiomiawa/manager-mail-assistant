"use client";

import { useMemo, useState } from "react";
import { EmailPreview } from "@/components/EmailPreview";
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
import type { CustomerComment, PerformanceRow, WeeklyReport } from "@/lib/report/types";
import { buildIndividualEmail, buildTeamEmail } from "@/lib/report/weeklyEmails";

const SAMPLE_URL = "/sample/cs-performance-sample.xlsx";
const MAX_FILE_SIZE = 5 * 1024 * 1024;
const MAX_MEMO_LENGTH = 1000;
const targets = loadTargets();

type Draft =
  | { type: "team"; comment: TeamComment; mock: boolean }
  | { type: "individual"; employeeId: string; comment: IndividualComment; mock: boolean };

export function WeeklyReportPanel() {
  const [rows, setRows] = useState<PerformanceRow[] | null>(null);
  const [comments, setComments] = useState<CustomerComment[]>([]);
  const [fileName, setFileName] = useState("");
  const [weekStart, setWeekStart] = useState("");
  const [loadError, setLoadError] = useState<string[] | null>(null);
  const [loading, setLoading] = useState(false);

  const [mode, setMode] = useState<"team" | "individual">("team");
  const [employeeId, setEmployeeId] = useState("");
  const [memo, setMemo] = useState("");
  const [draft, setDraft] = useState<Draft | null>(null);
  const [drafting, setDrafting] = useState(false);
  const [draftError, setDraftError] = useState("");

  const weeks = useMemo(() => (rows ? listWeeks(rows) : []), [rows]);
  const report = useMemo<WeeklyReport | null>(
    () => (rows && weekStart ? buildWeeklyReport(rows, targets, weekStart, comments) : null),
    [rows, weekStart, comments],
  );

  async function load(data: ArrayBuffer, name: string) {
    setLoading(true);
    setLoadError(null);
    try {
      // Excelを読む部品は大きいので、使うときに読み込む
      const { parseWorkbook, WorkbookParseError } = await import("@/lib/report/parseWorkbook");
      try {
        const parsed = await parseWorkbook(data);
        const parsedWeeks = listWeeks(parsed.rows);
        setRows(parsed.rows);
        setComments(parsed.comments);
        setFileName(name);
        setWeekStart(parsedWeeks.at(-1)!.weekStart);
        setEmployeeId("");
        setDraft(null);
      } catch (error) {
        setLoadError(error instanceof WorkbookParseError ? error.messages : ["ファイルを読み込めませんでした。"]);
      }
    } finally {
      setLoading(false);
    }
  }

  async function onFile(file: File | undefined) {
    if (!file) return;
    if (file.size > MAX_FILE_SIZE) {
      setLoadError(["ファイルが大きすぎます（5MBまで）。"]);
      return;
    }
    await load(await file.arrayBuffer(), file.name);
  }

  async function onSample() {
    setLoading(true);
    try {
      const response = await fetch(SAMPLE_URL);
      if (!response.ok) throw new Error();
      await load(await response.arrayBuffer(), "サンプルデータ（架空の20名・6週間）");
    } catch {
      setLoadError(["サンプルデータを読み込めませんでした。"]);
      setLoading(false);
    }
  }

  async function onDraft() {
    if (!report) return;
    if (mode === "individual" && !employeeId) {
      setDraftError("社員を選んでください。");
      return;
    }
    setDrafting(true);
    setDraftError("");
    try {
      const response = await fetch("/api/weekly-comment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          mode === "team" ? { type: "team", report } : { type: "individual", report, employeeId, memo },
        ),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(data?.error ?? "下書きを作れませんでした。");
      if (mode === "team") {
        const result = data as CommentResponse<TeamComment>;
        setDraft({ type: "team", comment: result.comment, mock: result.mock });
      } else {
        const result = data as CommentResponse<IndividualComment>;
        setDraft({ type: "individual", employeeId, comment: result.comment, mock: result.mock });
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

  return (
    <div className="space-y-6">
      {/* 1. データの読み込み */}
      <section className="rounded-lg border border-slate-200 bg-white p-4">
        <h2 className="text-base font-bold text-brand-800">1. データを読み込む</h2>
        <p className="mt-1 text-sm text-slate-600">
          日付・社員ID・対応チャンネル・対応件数・平均対応時間・平均満足度・週開始日・Week番号（・在籍期間）の列があるExcelを選んでください。「コメント」シート（お客様のコメント）があれば、Kudosと改善点もメールに入れます。ファイルはこのブラウザの中だけで読み込みます。
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <label className="cursor-pointer rounded bg-brand-700 px-4 py-2 text-sm font-bold text-white hover:bg-brand-800">
            Excelファイルを選ぶ
            <input
              type="file"
              accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              className="sr-only"
              onChange={(event) => {
                void onFile(event.target.files?.[0]);
                event.target.value = "";
              }}
            />
          </label>
          <button
            type="button"
            onClick={() => void onSample()}
            className="rounded border border-brand-600 px-4 py-2 text-sm text-brand-700 hover:bg-brand-50"
          >
            サンプルデータを使う
          </button>
          {loading && <span className="text-sm text-slate-500">読み込み中…</span>}
          {fileName && !loading && (
            <span className="text-sm text-slate-600">
              読み込み済み：{fileName}（お客様コメント {comments.length.toLocaleString("ja-JP")}件）
            </span>
          )}
        </div>
        {loadError && (
          <div role="alert" className="mt-3 rounded border border-red-200 bg-red-50 p-3 text-sm text-red-800">
            {loadError.map((line) => (
              <p key={line}>{line}</p>
            ))}
          </div>
        )}
      </section>

      {report && (
        <>
          {/* 2. 集計結果 */}
          <section className="rounded-lg border border-slate-200 bg-white p-4">
            <div className="flex flex-wrap items-center gap-3">
              <h2 className="text-base font-bold text-brand-800">2. 集計結果</h2>
              <label className="ml-auto flex items-center gap-2 text-sm">
                対象の週
                <select
                  value={weekStart}
                  onChange={(event) => {
                    setWeekStart(event.target.value);
                    resetDraft();
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
            </div>
            <TeamSummary report={report} />
            <RankingTable report={report} />
          </section>

          {/* 3. メールの下書き */}
          <section className="rounded-lg border border-slate-200 bg-white p-4">
            <h2 className="text-base font-bold text-brand-800">3. メールの下書きを作る</h2>
            <div className="mt-3 flex flex-wrap items-end gap-4">
              <fieldset className="flex gap-4 text-sm">
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
                <label className="flex items-center gap-2 text-sm">
                  社員
                  <select
                    value={employeeId}
                    onChange={(event) => {
                      setEmployeeId(event.target.value);
                      resetDraft();
                    }}
                    className="rounded border border-slate-300 px-2 py-1"
                  >
                    <option value="">選んでください</option>
                    {[...report.employees]
                      .sort((a, b) => a.employeeId.localeCompare(b.employeeId))
                      .map((e) => (
                        <option key={e.employeeId} value={e.employeeId}>
                          {e.employeeId}（{L.total} {rankLabel(e.rank.total)}）
                        </option>
                      ))}
                  </select>
                </label>
              )}
            </div>
            {mode === "individual" && (
              <label className="mt-3 block text-sm">
                <span className="font-bold">行動のメモ（任意）</span>
                <span className="ml-2 text-xs text-slate-500">
                  見聞きした具体的な行動を書くと、コメントに反映します（AI接続後）。数字だけで行動を決めつけないためのものです。
                </span>
                <textarea
                  value={memo}
                  maxLength={MAX_MEMO_LENGTH}
                  onChange={(event) => setMemo(event.target.value)}
                  rows={3}
                  placeholder="例：難しい問い合わせを最後まで粘り強く対応していた／新人の質問に丁寧に答えていた"
                  className="mt-1 block w-full rounded border border-slate-300 p-2"
                />
              </label>
            )}
            <div className="mt-3 flex items-center gap-3">
              <button
                type="button"
                onClick={() => void onDraft()}
                disabled={drafting}
                className="rounded bg-brand-700 px-5 py-2 text-sm font-bold text-white hover:bg-brand-800 disabled:opacity-50"
              >
                {drafting ? "作成中…" : "下書きを作る"}
              </button>
              {draftError && (
                <p role="alert" className="text-sm text-red-700">
                  {draftError}
                </p>
              )}
            </div>
          </section>

          {emailDoc && draft && <EmailPreview doc={emailDoc} mock={draft.mock} />}
        </>
      )}
    </div>
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
    <div className="mt-3">
      <p className="text-sm text-slate-600">
        チーム全体（{team.headcount}名・{L.week} {team.weekNumber}）
      </p>
      <div className="mt-2 grid gap-3 sm:grid-cols-3">
        {groups.flatMap((group) =>
          group.items.map((item) => (
            <div key={item.label} className="rounded border border-slate-200 p-3">
              <p className="flex items-center gap-2 text-xs text-slate-500">
                <span className="font-bold text-brand-700">{group.label}</span>
                {item.label}
                <span
                  className={`rounded-full px-2 text-[11px] font-bold ${item.achieved ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"}`}
                >
                  {item.achieved ? L.met : L.missed}
                </span>
              </p>
              <p className="mt-1 text-2xl font-bold">{item.value}</p>
              <p className="text-xs text-slate-500">
                {item.target}
                {item.change && ` · ${L.vsLastWeek} ${item.change}`}
              </p>
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
    <details className="mt-4">
      <summary className="cursor-pointer text-sm font-bold text-brand-700">
        ランキングと個人の数字を見る（{report.employees.length}名）
      </summary>
      <p className="mt-2 text-xs text-slate-500">
        スコアはチーム内の相対評価（0〜100）です。{L.quality}は満足度（{L.csat}）、{L.efficiency}は対応件数（{L.cases}）と平均対応時間（{L.aht}）から計算します。{L.total}の重みは {L.cases} 0.1・{L.aht} 0.3・{L.csat} 0.6 で、チャンネルの違いはならしてから比べています。
      </p>
      <div className="mt-2 overflow-x-auto">
        <table className="w-full min-w-[860px] text-sm">
          <thead className="bg-brand-50 text-xs text-slate-600">
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
              <tr key={e.employeeId} className="border-b border-slate-100">
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
