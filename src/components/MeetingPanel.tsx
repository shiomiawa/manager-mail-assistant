"use client";

import { useMemo, useState } from "react";
import { EmailPreview } from "@/components/EmailPreview";
import { buildMeetingEmails, type MeetingContext, type MeetingTabKey } from "@/lib/meeting/meetingEmails";
import {
  MAX_TRANSCRIPT_LENGTH,
  TRANSCRIPT_EXTENSIONS,
  TranscriptError,
  listSpeakers,
  normalizeTranscript,
  readTranscriptFile,
} from "@/lib/meeting/transcript";
import type { MeetingDraft, MeetingType } from "@/lib/meeting/types";

const SAMPLES = {
  "1on1": {
    url: "/sample/meeting-1on1-sample.vtt",
    date: "2026-10-06",
    label: "1on1のサンプル（E005）",
    agenda: "",
    next: { date: "2026-10-13", time: "" },
  },
  team: {
    url: "/sample/meeting-team-sample.txt",
    date: "2026-10-05",
    label: "チームミーティングのサンプル",
    agenda: "パラフレーズで要約するコツと、短く伝える方法",
    next: { date: "2026-10-12", time: "10:00" },
  },
} as const;
const MANAGER = /マネージャー|manager/i;

const today = () => {
  const now = new Date();
  return new Date(now.getTime() - now.getTimezoneOffset() * 60_000).toISOString().slice(0, 10);
};

export function MeetingPanel() {
  const [type, setType] = useState<MeetingType>("1on1");
  const [meetingDate, setMeetingDate] = useState(today);
  const [counterpart, setCounterpart] = useState("");
  const [agenda, setAgenda] = useState("");
  const [nextMeetingDate, setNextMeetingDate] = useState("");
  const [nextMeetingTime, setNextMeetingTime] = useState("");
  const [transcript, setTranscript] = useState("");
  const [fileName, setFileName] = useState("");
  const [loadError, setLoadError] = useState("");

  const [draft, setDraft] = useState<{ draft: MeetingDraft; mock: boolean; context: MeetingContext } | null>(null);
  const [drafting, setDrafting] = useState(false);
  const [draftError, setDraftError] = useState("");
  const [tab, setTab] = useState<MeetingTabKey>("summary");

  const emails = useMemo(() => (draft ? buildMeetingEmails(draft.draft, draft.context) : []), [draft]);
  const current = emails.find((email) => email.key === tab) ?? emails[0];

  function setLoaded(text: string, name: string) {
    setTranscript(text);
    setFileName(name);
    setLoadError("");
    setDraft(null);
    // 1on1の相手が空なら、マネージャー以外の最初の話者を入れる
    const member = listSpeakers(text).find((s) => !MANAGER.test(s));
    if (member) setCounterpart((value) => value || member);
  }

  async function onFile(file: File | undefined) {
    if (!file) return;
    try {
      setLoaded(await readTranscriptFile(file), file.name);
    } catch (error) {
      setLoadError(error instanceof TranscriptError ? error.message : "ファイルを読み込めませんでした。");
    }
  }

  async function onSample(kind: MeetingType) {
    try {
      const response = await fetch(SAMPLES[kind].url);
      if (!response.ok) throw new Error();
      const text = normalizeTranscript(await response.text());
      setType(kind);
      setMeetingDate(SAMPLES[kind].date);
      setCounterpart("");
      setAgenda(SAMPLES[kind].agenda);
      setNextMeetingDate(SAMPLES[kind].next.date);
      setNextMeetingTime(SAMPLES[kind].next.time);
      setLoaded(text, SAMPLES[kind].label);
    } catch {
      setLoadError("サンプルを読み込めませんでした。");
    }
  }

  async function onDraft() {
    if (!transcript.trim()) {
      setDraftError("文字起こしを入れてください。");
      return;
    }
    setDrafting(true);
    setDraftError("");
    const context: MeetingContext = {
      type,
      meetingDate,
      counterpart: type === "1on1" ? counterpart.trim() : "",
      nextMeetingDate,
      nextMeetingTime: nextMeetingDate ? nextMeetingTime : "",
    };
    try {
      const response = await fetch("/api/meeting-draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...context, agenda: type === "team" ? agenda.trim() : "", transcript }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(data?.error ?? "下書きを作れませんでした。");
      setDraft({ draft: data.draft, mock: data.mock, context });
      setTab("summary");
    } catch (error) {
      setDraftError(error instanceof Error ? error.message : "下書きを作れませんでした。");
    } finally {
      setDrafting(false);
    }
  }

  const resetDraft = () => {
    setDraft(null);
    setDraftError("");
  };

  return (
    <div className="space-y-6">
      {/* 1. 会議の情報 */}
      <section className="rounded-lg border border-slate-200 bg-white p-4">
        <h2 className="text-base font-bold text-brand-800">1. 会議の情報</h2>
        <div className="mt-3 flex flex-wrap items-end gap-4 text-sm">
          <fieldset className="flex gap-4">
            <legend className="sr-only">会議の種類</legend>
            {(["1on1", "team"] as const).map((value) => (
              <label key={value} className="flex items-center gap-1">
                <input
                  type="radio"
                  name="meetingType"
                  checked={type === value}
                  onChange={() => {
                    setType(value);
                    resetDraft();
                  }}
                />
                {value === "1on1" ? "1on1" : "チームミーティング"}
              </label>
            ))}
          </fieldset>
          <label className="flex items-center gap-2">
            日付
            <input
              type="date"
              value={meetingDate}
              onChange={(event) => {
                setMeetingDate(event.target.value);
                resetDraft();
              }}
              className="rounded border border-slate-300 px-2 py-1"
            />
          </label>
          <label className="flex items-center gap-2">
            次回の日程
            <input
              type="date"
              value={nextMeetingDate}
              min={meetingDate}
              onChange={(event) => {
                setNextMeetingDate(event.target.value);
                resetDraft();
              }}
              className="rounded border border-slate-300 px-2 py-1"
            />
            <input
              type="time"
              value={nextMeetingTime}
              disabled={!nextMeetingDate}
              aria-label="次回の時刻（任意）"
              onChange={(event) => {
                setNextMeetingTime(event.target.value);
                resetDraft();
              }}
              className="rounded border border-slate-300 px-2 py-1 disabled:bg-slate-100"
            />
          </label>
          {type === "1on1" && (
            <label className="flex items-center gap-2">
              相手
              <input
                type="text"
                value={counterpart}
                maxLength={40}
                placeholder="例：E005"
                onChange={(event) => {
                  setCounterpart(event.target.value);
                  resetDraft();
                }}
                className="w-32 rounded border border-slate-300 px-2 py-1"
              />
            </label>
          )}
        </div>
        {type === "team" && (
          <label className="mt-3 block text-sm">
            <span className="font-bold">アジェンダ</span>
            <span className="ml-2 text-xs text-slate-500">あらかじめ決めておいたテーマ。全員の意見と反応、意見が分かれた点、総括に分けてまとめます。</span>
            <input
              type="text"
              value={agenda}
              maxLength={200}
              placeholder="例：パラフレーズで要約するコツと、短く伝える方法"
              onChange={(event) => {
                setAgenda(event.target.value);
                resetDraft();
              }}
              className="mt-1 block w-full rounded border border-slate-300 px-2 py-1"
            />
          </label>
        )}
        <p className="mt-2 text-xs text-slate-500">次回の日程はカレンダーから選びます（時刻は任意）。件名とメールの「Next Meeting」に入ります。</p>
      </section>

      {/* 2. 文字起こし */}
      <section className="rounded-lg border border-slate-200 bg-white p-4">
        <h2 className="text-base font-bold text-brand-800">2. 文字起こしを読み込む</h2>
        <p className="mt-1 text-sm text-slate-600">
          Teams・Zoom・Google Meet などの文字起こし（{TRANSCRIPT_EXTENSIONS.join(" / ")}）を選ぶか、下の欄に貼り付けてください。時刻は取り除き、「話者：発言」の形に整えます。文字起こしは保存しません。
        </p>
        <p className="mt-1 text-xs text-amber-700">デモでは架空の会議を使ってください（実在の人の会話は入れないでください）。</p>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <label className="cursor-pointer rounded bg-brand-700 px-4 py-2 text-sm font-bold text-white hover:bg-brand-800">
            ファイルを選ぶ
            <input
              type="file"
              accept={TRANSCRIPT_EXTENSIONS.join(",")}
              className="sr-only"
              onChange={(event) => {
                void onFile(event.target.files?.[0]);
                event.target.value = "";
              }}
            />
          </label>
          {(["1on1", "team"] as const).map((kind) => (
            <button
              key={kind}
              type="button"
              onClick={() => void onSample(kind)}
              className="rounded border border-brand-600 px-4 py-2 text-sm text-brand-700 hover:bg-brand-50"
            >
              {SAMPLES[kind].label}
            </button>
          ))}
          {fileName && <span className="text-sm text-slate-600">読み込み済み：{fileName}</span>}
        </div>
        {loadError && (
          <p role="alert" className="mt-3 rounded border border-red-200 bg-red-50 p-3 text-sm text-red-800">
            {loadError}
          </p>
        )}
        <label className="mt-3 block text-sm">
          <span className="sr-only">文字起こし</span>
          <textarea
            value={transcript}
            maxLength={MAX_TRANSCRIPT_LENGTH}
            onChange={(event) => {
              setTranscript(event.target.value);
              resetDraft();
            }}
            rows={10}
            placeholder={"マネージャー：お疲れさまです。今日は…\nE005：よろしくお願いします。…"}
            className="block w-full rounded border border-slate-300 p-2 font-mono text-xs leading-5"
          />
        </label>
        <p className="mt-1 text-right text-xs text-slate-500">
          {transcript.length.toLocaleString("ja-JP")} / {MAX_TRANSCRIPT_LENGTH.toLocaleString("ja-JP")}字
        </p>
      </section>

      {/* 3. 下書き */}
      <section className="rounded-lg border border-slate-200 bg-white p-4">
        <h2 className="text-base font-bold text-brand-800">3. メールの下書きを作る</h2>
        <p className="mt-1 text-sm text-slate-600">
          {type === "1on1"
            ? "Summary（要約）・To Employee（本人向け）・My Notes（自分用）・To Team（チームに共有してよい話があるときだけ）を作ります。個人的な話題はチーム向けに入れません。"
            : "Summary（要約）・To Team（チーム向け）・My Notes（自分用）を作ります。To Team には、一人ずつの意見と反応、意見が分かれた点と理由、総括を載せます。"}
        </p>
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

      {draft && current && (
        <div>
          <div role="tablist" aria-label="下書きの種類" className="flex flex-wrap gap-1 border-b border-slate-300 text-sm">
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
          {draft.context.type === "1on1" && !emails.some((email) => email.key === "toTeam") && (
            <p className="mt-2 text-xs text-slate-500">この1on1には、チームに共有する内容がなかったため To Team は作っていません。</p>
          )}
          <div className="mt-3">
            <EmailPreview
              key={current.key}
              doc={current.doc}
              mock={draft.mock}
              mockNote="下書きの文章はダミーです（AIはまだつないでいません）。いまは文字起こしから決まった言葉を含む発言を拾っているだけで、要約はしていません。"
            />
          </div>
        </div>
      )}
    </div>
  );
}
