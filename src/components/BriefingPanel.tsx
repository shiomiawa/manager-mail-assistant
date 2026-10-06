"use client";

import { useMemo, useState } from "react";
import { EmailPreview } from "@/components/EmailPreview";
import { TranscriptInput } from "@/components/TranscriptInput";
import { EmptyReader, Step, Workspace } from "@/components/Workspace";
import { postJson } from "@/lib/apiClient";
import { buildBriefingEmail } from "@/lib/briefing/briefingEmail";
import {
  buildIcs,
  isValidDate,
  isValidTime,
  resolveDate,
  type CalendarEvent,
  type ReminderTiming,
} from "@/lib/briefing/calendar";
import type { BriefingDraft } from "@/lib/briefing/types";

const SAMPLE = {
  label: "説明会のサンプル（新システム導入）",
  url: "/sample/briefing-sample.txt",
  title: "新しい問い合わせ管理システムの導入説明会",
  date: "2026-10-14",
};

/** リマインダーの1行（画面で日付・時刻を確かめて直せる） */
type Reminder = {
  id: number;
  include: boolean;
  title: string;
  whenText: string;
  date: string;
  time: string;
  remind: ReminderTiming;
};

const today = () => {
  const now = new Date();
  return new Date(now.getTime() - now.getTimezoneOffset() * 60_000).toISOString().slice(0, 10);
};

export function BriefingPanel() {
  const [title, setTitle] = useState("");
  const [briefingDate, setBriefingDate] = useState(today);
  const [transcript, setTranscript] = useState("");
  const [fileName, setFileName] = useState("");

  const [result, setResult] = useState<{ draft: BriefingDraft; mock: boolean; title: string; briefingDate: string } | null>(null);
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [drafting, setDrafting] = useState(false);
  const [draftError, setDraftError] = useState("");

  const doc = useMemo(
    () =>
      result
        ? buildBriefingEmail(
            result.draft,
            { title: result.title, briefingDate: result.briefingDate },
            reminders.map((r) => ({ title: r.title, whenText: r.whenText, date: r.date, time: r.time })),
          )
        : null,
    [result, reminders],
  );

  const reset = () => {
    setResult(null);
    setReminders([]);
    setDraftError("");
  };

  function onLoaded(text: string, name: string, sampleIndex?: number) {
    if (sampleIndex !== undefined) {
      setTitle(SAMPLE.title);
      setBriefingDate(SAMPLE.date);
    }
    setTranscript(text);
    setFileName(name);
    reset();
  }

  async function onDraft() {
    if (!transcript.trim()) {
      setDraftError("文字起こしを入れてください。");
      return;
    }
    setDrafting(true);
    setDraftError("");
    try {
      const data = await postJson<{ draft: BriefingDraft; mock: boolean }>("/api/briefing-notes", {
        title: title.trim(),
        briefingDate,
        transcript,
      });
      setResult({ draft: data.draft, mock: data.mock, title: title.trim(), briefingDate });
      // 年はコードで決める（AIには月・日だけを答えさせている）
      // 日付順に並べ、日付の分からないものは最後にする
      setReminders(
        data.draft.dates
          .map((d) => ({ d, date: resolveDate(d.month, d.day, briefingDate) }))
          .sort((a, b) => (a.date || "9999").localeCompare(b.date || "9999") || a.d.time.localeCompare(b.d.time))
          .map(({ d, date }, id) => ({
            id,
            include: Boolean(date),
            title: d.item,
            whenText: d.whenText,
            date,
            time: isValidTime(d.time) ? d.time : "",
            remind: "dayBefore" as const,
          })),
      );
    } catch (error) {
      setDraftError(error instanceof Error ? error.message : "メモを作れませんでした。");
    } finally {
      setDrafting(false);
    }
  }

  const update = (id: number, patch: Partial<Reminder>) =>
    setReminders((list) => list.map((r) => (r.id === id ? { ...r, ...patch } : r)));

  const toEvent = (r: Reminder): CalendarEvent => ({
    title: r.title,
    date: r.date,
    time: r.time,
    remind: r.remind,
    description: [result?.title, r.whenText && `説明会では「${r.whenText}」`].filter(Boolean).join("\n"),
  });

  const included = reminders.filter((r) => r.include);
  const missingDate = included.some((r) => !isValidDate(r.date));

  function download(list: Reminder[], name: string) {
    const blob = new Blob([buildIcs(list.map(toEvent))], { type: "text/calendar;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    a.click();
    URL.revokeObjectURL(url);
  }

  const inputClass = "rounded border border-line px-2 py-1 text-sm";
  return (
    <Workspace
      compose={
        <>
          <Step n={1} label="Briefing" title="説明会の情報">
            <div className="grid grid-cols-[auto_1fr] items-center gap-x-3 gap-y-2 text-sm">
              <label htmlFor="briefing-title" className="text-xs text-muted">名前</label>
              <input
                id="briefing-title"
                type="text"
                value={title}
                maxLength={100}
                placeholder="例：新しい問い合わせ管理システムの導入説明会"
                onChange={(event) => {
                  setTitle(event.target.value);
                  reset();
                }}
                className={`${inputClass} min-w-0`}
              />
              <label htmlFor="briefing-date" className="text-xs text-muted">日付</label>
              <input
                id="briefing-date"
                type="date"
                value={briefingDate}
                onChange={(event) => {
                  setBriefingDate(event.target.value);
                  reset();
                }}
                className={`${inputClass} w-fit`}
              />
            </div>
          </Step>

          <Step n={2} label="Transcript" title="文字起こしを読み込む">
            <TranscriptInput
              value={transcript}
              onChange={(text) => {
                setTranscript(text);
                reset();
              }}
              onLoaded={onLoaded}
              fileName={fileName}
              samples={[{ label: SAMPLE.label, url: SAMPLE.url }]}
              placeholder={"講師：本日は、新しいシステムの説明会です。…"}
            />
          </Step>

          <Step n={3} label="Draft" title="自分用メモとリマインダーを作る">
            <p className="text-xs leading-5 text-muted">
              要点・やること・日程と期限・確認したいことを自分用メモにまとめ、日程と期限はカレンダー登録用ファイル（.ics）にします。アプリからの自動送信はしません。
            </p>
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => void onDraft()}
                disabled={drafting}
                className="rounded-md bg-brand-700 px-5 py-2 text-sm font-semibold text-white hover:bg-brand-800 disabled:opacity-50"
              >
                {drafting ? "作成中…" : "メモを作る"}
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
        result && doc ? (
          <>
            <section aria-label="Reminders" className="border-b border-line bg-white px-4 py-3">
              <div className="flex flex-wrap items-center gap-3">
                <h2 className="text-sm font-semibold">Reminders</h2>
                <p className="text-xs text-muted">日付と時刻を確かめて、必要なら直してください。日付の分からない予定は、日付を入れると登録できます。</p>
              </div>
              {reminders.length === 0 ? (
                <p className="mt-2 text-sm text-muted">日程や期限は見つかりませんでした。</p>
              ) : (
                <div className="mt-2 overflow-x-auto">
                  <table className="w-full min-w-[700px] text-sm">
                    <thead className="bg-brand-50 text-xs text-muted">
                      <tr>
                        <th className="px-2 py-1 text-center">Add</th>
                        <th className="px-2 py-1 text-left">Item</th>
                        <th className="px-2 py-1 text-left">説明会での言い方</th>
                        <th className="px-2 py-1 text-left">Date</th>
                        <th className="px-2 py-1 text-left">Time</th>
                        <th className="px-2 py-1 text-left">Notify</th>
                        <th className="px-2 py-1" />
                      </tr>
                    </thead>
                    <tbody>
                      {reminders.map((r) => (
                        <tr key={r.id} className="border-b border-line-soft align-middle">
                          <td className="px-2 py-1 text-center">
                            <input
                              type="checkbox"
                              checked={r.include}
                              aria-label={`${r.title}をカレンダーに登録する`}
                              onChange={(event) => update(r.id, { include: event.target.checked })}
                            />
                          </td>
                          <td className="px-2 py-1">
                            <input
                              type="text"
                              value={r.title}
                              maxLength={100}
                              aria-label="予定の名前"
                              onChange={(event) => update(r.id, { title: event.target.value })}
                              className="w-full rounded border border-line px-2 py-1"
                            />
                          </td>
                          <td className="px-2 py-1 text-xs text-muted">{r.whenText || "—"}</td>
                          <td className="px-2 py-1">
                            <input
                              type="date"
                              value={r.date}
                              aria-label="日付"
                              onChange={(event) => update(r.id, { date: event.target.value, include: Boolean(event.target.value) || r.include })}
                              className={`rounded border px-2 py-1 ${r.include && !r.date ? "border-red-400" : "border-line"}`}
                            />
                          </td>
                          <td className="px-2 py-1">
                            <input
                              type="time"
                              value={r.time}
                              aria-label="時刻（任意）"
                              onChange={(event) => update(r.id, { time: event.target.value })}
                              className="rounded border border-line px-2 py-1"
                            />
                          </td>
                          <td className="px-2 py-1">
                            <select
                              value={r.remind}
                              aria-label="通知のタイミング"
                              onChange={(event) => update(r.id, { remind: event.target.value as ReminderTiming })}
                              className="rounded border border-line px-2 py-1"
                            >
                              <option value="dayBefore">前日</option>
                              <option value="sameDay">当日</option>
                            </select>
                          </td>
                          <td className="px-2 py-1">
                            <button
                              type="button"
                              disabled={!isValidDate(r.date)}
                              onClick={() => download([r], `reminder-${r.date}.ics`)}
                              className="text-xs whitespace-nowrap text-brand-700 underline disabled:text-line disabled:no-underline"
                            >
                              .ics
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              <div className="mt-2 flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  disabled={included.length === 0 || missingDate}
                  onClick={() => download(included, `briefing-${result.briefingDate}.ics`)}
                  className="rounded-md bg-brand-700 px-4 py-1.5 text-sm font-semibold text-white hover:bg-brand-800 disabled:opacity-50"
                >
                  Add to Calendar（{included.length}）
                </button>
                {missingDate && <p className="text-xs text-red-700">登録する予定に、日付が空のものがあります。</p>}
                <p className="text-xs text-muted">
                  .ics を開くと Outlook・Google・iPhone のカレンダーに登録できます。Outlook で1件しか入らないときは、各行の「.ics」から登録してください。
                </p>
              </div>
            </section>
            <EmailPreview
              doc={doc}
              mock={result.mock}
              to="自分用"
              mockNote="メモの文章はダミーです（AIはまだつないでいません）。いまは文字起こしから日付や依頼を含む文を拾っているだけで、要約はしていません。"
            />
          </>
        ) : (
          <EmptyReader>
            <p className="font-semibold text-ink">ここに自分用メモとリマインダーが表示されます</p>
            <p>文字起こしを読み込み（サンプルでも試せます）、「メモを作る」を押してください。</p>
          </EmptyReader>
        )
      }
    />
  );
}
