"use client";

import { useMemo, useState } from "react";
import { DraftTabs } from "@/components/DraftTabs";
import { EmailPreview } from "@/components/EmailPreview";
import { WorkbookLoader } from "@/components/WorkbookLoader";
import { EmptyReader, Step, Workspace } from "@/components/Workspace";
import { postJson } from "@/lib/apiClient";
import { MAX_QUOTES, kudosCandidates, trendLines } from "@/lib/kudos/data";
import { MAX_EPISODE_LENGTH, MAX_NAME_LENGTH, aiKudosReady } from "@/lib/kudos/guard";
import { buildKudosEmails } from "@/lib/kudos/kudosEmails";
import type { KudosDraft, KudosInput } from "@/lib/kudos/types";
import { L, axisLabel, tenureLabel } from "@/lib/labels";
import { buildWeeklyReport } from "@/lib/report/aggregate";
import { loadTargets } from "@/lib/report/targets";
import { useWorkbook } from "@/lib/workbookStore";

const targets = loadTargets();

const today = () => {
  const now = new Date();
  return new Date(now.getTime() - now.getTimezoneOffset() * 60_000).toISOString().slice(0, 10);
};

type Result = { version: number; draft: KudosDraft; input: KudosInput; date: string; mock: boolean };

export function KudosPanel() {
  const { rows, comments, version } = useWorkbook();
  const [employeeId, setEmployeeId] = useState("");
  const [typedName, setTypedName] = useState("");
  const [picked, setPicked] = useState<string[]>([]); // 選んだお客様の声（コメントID＋日付）
  const [episode, setEpisode] = useState("");
  const [includeTeam, setIncludeTeam] = useState(false);
  const [rawResult, setResult] = useState<Result | null>(null);
  const [tab, setTab] = useState<"toEmployee" | "toTeam">("toEmployee");
  const [drafting, setDrafting] = useState(false);
  const [draftError, setDraftError] = useState("");

  // データがあれば最新の週で集計する（Kudos の多い人から並べる）
  const report = useMemo(() => (rows ? buildWeeklyReport(rows, targets, undefined, comments) : null), [rows, comments]);
  const people = useMemo(() => {
    if (!report) return [];
    return report.employees
      .map((e) => ({ e, quotes: kudosCandidates(report, comments, e.employeeId) }))
      .sort((a, b) => b.quotes.length - a.quotes.length || a.e.employeeId.localeCompare(b.e.employeeId));
  }, [report, comments]);
  const selected = people.find((p) => p.e.employeeId === employeeId);
  const name = selected ? selected.e.employeeId : typedName.trim();
  const keyOf = (q: { commentId: string; date: string }) => `${q.date}-${q.commentId}`;

  const result = rawResult && rawResult.version === version ? rawResult : null;
  const emails = useMemo(() => (result ? buildKudosEmails(result.draft, result.input, result.date) : []), [result]);
  const current = emails.find((e) => e.key === tab) ?? emails[0];

  const reset = () => {
    setResult(null);
    setDraftError("");
  };

  async function onDraft() {
    const input: KudosInput = {
      name,
      episode: episode.trim(),
      quotes: selected ? selected.quotes.filter((q) => picked.includes(keyOf(q))) : [],
      trend: selected ? trendLines(selected.e) : [],
      tenureMonths: selected?.e.tenureMonths ?? null,
      includeTeam,
    };
    const problem = aiKudosReady(input);
    if (problem) {
      setDraftError(problem);
      return;
    }
    setDrafting(true);
    setDraftError("");
    try {
      const data = await postJson<{ draft: KudosDraft; mock: boolean }>("/api/kudos", { input });
      setResult({ version, draft: data.draft, input, date: today(), mock: data.mock });
      setTab("toEmployee");
    } catch (error) {
      setDraftError(error instanceof Error ? error.message : "称賛メールを作れませんでした。");
    } finally {
      setDrafting(false);
    }
  }

  return (
    <Workspace
      compose={
        <>
          <WorkbookLoader />

          <Step n={2} label="Member" title="ほめる人を選ぶ">
            {report ? (
              <>
                <select
                  value={selected ? employeeId : ""}
                  aria-label="社員"
                  onChange={(event) => {
                    setEmployeeId(event.target.value);
                    setPicked([]);
                    reset();
                  }}
                  className="rounded border border-line px-2 py-1 text-sm"
                >
                  <option value="">社員を選ぶ</option>
                  {people.map(({ e, quotes }) => (
                    <option key={e.employeeId} value={e.employeeId}>
                      {e.employeeId}（{L.kudos} {quotes.length}）
                    </option>
                  ))}
                </select>
                {selected && (
                  <p className="text-xs text-muted">
                    {L.tenure}：{selected.e.tenureMonths === null ? "—" : tenureLabel(selected.e.tenureMonths)}
                  </p>
                )}
              </>
            ) : (
              <label className="block text-sm">
                <span className="text-xs text-muted">名前（Excelを読み込むと、社員とお客様の声から選べます）</span>
                <input
                  type="text"
                  value={typedName}
                  maxLength={MAX_NAME_LENGTH}
                  placeholder="例：E015"
                  onChange={(event) => {
                    setTypedName(event.target.value);
                    reset();
                  }}
                  className="mt-1 block w-40 rounded border border-line px-2 py-1"
                />
              </label>
            )}
            {selected && (
              <fieldset className="space-y-1">
                <legend className="text-xs text-muted">
                  引用するお客様の声（直近4週間の {L.kudos}。{MAX_QUOTES}件まで）
                </legend>
                {selected.quotes.length === 0 && <p className="text-xs text-muted">この4週間の {L.kudos} はありません。</p>}
                {selected.quotes.map((q) => {
                  const key = keyOf(q);
                  const checked = picked.includes(key);
                  return (
                    <label key={key} className="flex items-start gap-2 text-xs">
                      <input
                        type="checkbox"
                        checked={checked}
                        disabled={!checked && picked.length >= MAX_QUOTES}
                        onChange={(event) => {
                          setPicked((list) => (event.target.checked ? [...list, key] : list.filter((k) => k !== key)));
                          reset();
                        }}
                        className="mt-0.5"
                      />
                      <span>
                        「{q.text}」<span className="text-muted">（{axisLabel(q.axis)}・{q.date.slice(5).replace("-", "/")}）</span>
                      </span>
                    </label>
                  );
                })}
              </fieldset>
            )}
          </Step>

          <Step n={3} label="Draft" title="称賛メールを作る">
            <label className="block text-sm">
              <span className="font-semibold">具体的な行動（エピソード）</span>
              <span className="mt-0.5 block text-xs text-muted">
                いつ・何をして・どうなったかを書いてください。性格ではなく行動をほめるメールにします。
              </span>
              <textarea
                value={episode}
                maxLength={MAX_EPISODE_LENGTH}
                onChange={(event) => {
                  setEpisode(event.target.value);
                  reset();
                }}
                rows={4}
                placeholder="例：先週、返金の問い合わせが続いたときに、手続きの案内をテンプレートにまとめてチームに共有してくれた。おかげで対応時間が短くなった"
                className="mt-1 block w-full rounded border border-line p-2"
              />
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={includeTeam}
                onChange={(event) => {
                  setIncludeTeam(event.target.checked);
                  reset();
                }}
              />
              チームへの紹介メールも作る
            </label>
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => void onDraft()}
                disabled={drafting}
                className="rounded-md bg-brand-700 px-5 py-2 text-sm font-semibold text-white hover:bg-brand-800 disabled:opacity-50"
              >
                {drafting ? "作成中…" : "称賛メールを作る"}
              </button>
              {draftError && (
                <p role="alert" className="text-sm text-red-700">
                  {draftError}
                </p>
              )}
            </div>
          </Step>
        </>
      }
      reader={
        result && current ? (
          <>
            {emails.length > 1 && <DraftTabs label="称賛メールの種類" items={emails} current={current.key} onSelect={setTab} />}
            <EmailPreview
              key={current.key}
              doc={current.doc}
              mock={result.mock}
              to={current.key === "toTeam" ? "Team" : result.input.name}
              mockNote="メールの文章はダミーです（AIはまだつないでいません）。いまは入力したエピソードとお客様の声を、決まった文に入れているだけです。"
            />
          </>
        ) : (
          <EmptyReader>
            <p className="font-semibold text-ink">ここに称賛メールのプレビューが表示されます</p>
            <p>ほめる人を選び、具体的な行動を書いて「称賛メールを作る」を押してください。</p>
          </EmptyReader>
        )
      }
    />
  );
}
