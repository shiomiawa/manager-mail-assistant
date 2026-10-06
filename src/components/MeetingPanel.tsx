"use client";

import { useMemo, useState } from "react";
import { EmailPreview } from "@/components/EmailPreview";
import { DraftTabs } from "@/components/DraftTabs";
import { TranscriptInput } from "@/components/TranscriptInput";
import { EmptyReader, Step, Workspace } from "@/components/Workspace";
import { postJson } from "@/lib/apiClient";
import { buildMeetingEmails, type MeetingContext, type MeetingTabKey } from "@/lib/meeting/meetingEmails";
import { listSpeakers } from "@/lib/meeting/transcript";
import type { MeetingDraft, MeetingType } from "@/lib/meeting/types";

const SAMPLE_KINDS = ["1on1", "team"] as const;
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

  const [draft, setDraft] = useState<{ draft: MeetingDraft; mock: boolean; context: MeetingContext } | null>(null);
  const [drafting, setDrafting] = useState(false);
  const [draftError, setDraftError] = useState("");
  const [tab, setTab] = useState<MeetingTabKey>("summary");

  const emails = useMemo(() => (draft ? buildMeetingEmails(draft.draft, draft.context) : []), [draft]);
  const current = emails.find((email) => email.key === tab) ?? emails[0];

  /** ファイルやサンプルを読み込んだとき。サンプルなら、会議の情報もサンプルに合わせる */
  function onLoaded(text: string, name: string, sampleIndex?: number) {
    let blankCounterpart = false;
    if (sampleIndex !== undefined) {
      const kind = SAMPLE_KINDS[sampleIndex];
      setType(kind);
      setMeetingDate(SAMPLES[kind].date);
      setAgenda(SAMPLES[kind].agenda);
      setNextMeetingDate(SAMPLES[kind].next.date);
      setNextMeetingTime(SAMPLES[kind].next.time);
      blankCounterpart = true;
    }
    setTranscript(text);
    setFileName(name);
    setDraft(null);
    // 1on1の相手が空なら、マネージャー以外の最初の話者を入れる
    const member = listSpeakers(text).find((s) => !MANAGER.test(s)) ?? "";
    setCounterpart((value) => (blankCounterpart ? member : value || member));
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
      const data = await postJson<{ draft: MeetingDraft; mock: boolean }>("/api/meeting-draft", {
        ...context,
        agenda: type === "team" ? agenda.trim() : "",
        transcript,
      });
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

  const inputClass = "rounded border border-line px-2 py-1 text-sm";
  return (
    <Workspace
      compose={
        <>
          <Step n={1} label="Meeting" title="会議の情報">
            <fieldset className="flex gap-4 text-sm">
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
            <div className="grid grid-cols-[auto_1fr] items-center gap-x-3 gap-y-2 text-sm">
              <label htmlFor="meeting-date" className="text-xs text-muted">日付</label>
              <input
                id="meeting-date"
                type="date"
                value={meetingDate}
                onChange={(event) => {
                  setMeetingDate(event.target.value);
                  resetDraft();
                }}
                className={`${inputClass} w-fit`}
              />
              {type === "1on1" && (
                <>
                  <label htmlFor="meeting-counterpart" className="text-xs text-muted">相手</label>
                  <input
                    id="meeting-counterpart"
                    type="text"
                    value={counterpart}
                    maxLength={40}
                    placeholder="例：E005"
                    onChange={(event) => {
                      setCounterpart(event.target.value);
                      resetDraft();
                    }}
                    className={`${inputClass} w-32`}
                  />
                </>
              )}
              {type === "team" && (
                <>
                  <label htmlFor="meeting-agenda" className="text-xs text-muted">アジェンダ</label>
                  <input
                    id="meeting-agenda"
                    type="text"
                    value={agenda}
                    maxLength={200}
                    placeholder="例：パラフレーズで要約するコツと、短く伝える方法"
                    onChange={(event) => {
                      setAgenda(event.target.value);
                      resetDraft();
                    }}
                    className={`${inputClass} min-w-0`}
                  />
                </>
              )}
              <label htmlFor="meeting-next" className="text-xs text-muted">次回の日程</label>
              <div className="flex flex-wrap gap-2">
                <input
                  id="meeting-next"
                  type="date"
                  value={nextMeetingDate}
                  min={meetingDate}
                  onChange={(event) => {
                    setNextMeetingDate(event.target.value);
                    resetDraft();
                  }}
                  className={inputClass}
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
                  className={`${inputClass} disabled:bg-bar`}
                />
              </div>
            </div>
            <p className="text-xs text-muted">
              {type === "team" ? "アジェンダは、全員の意見と反応、意見が分かれた点、総括に分けてまとめます。" : ""}
              次回の日程（時刻は任意）は、メールの「Next Meeting」に入ります。
            </p>
          </Step>

          <Step n={2} label="Transcript" title="文字起こしを読み込む">
            <TranscriptInput
              value={transcript}
              onChange={(text) => {
                setTranscript(text);
                resetDraft();
              }}
              onLoaded={onLoaded}
              fileName={fileName}
              samples={SAMPLE_KINDS.map((kind) => ({ label: SAMPLES[kind].label, url: SAMPLES[kind].url }))}
              placeholder={"マネージャー：お疲れさまです。今日は…\nE005：よろしくお願いします。…"}
            />
          </Step>

          <Step n={3} label="Draft" title="メールの下書きを作る">
            <p className="text-xs leading-5 text-muted">
              {type === "1on1"
                ? "Summary・To Employee・My Notes・To Team（チームに共有してよい話があるときだけ）を作ります。個人的な話題はチーム向けに入れません。"
                : "Summary・To Team・My Notes を作ります。To Team には、一人ずつの意見と反応、意見が分かれた点と理由、総括を載せます。"}
            </p>
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
        </>
      }
      reader={
        draft && current ? (
          <>
            <DraftTabs label="下書きの種類" items={emails} current={current.key} onSelect={setTab} />
            {draft.context.type === "1on1" && !emails.some((email) => email.key === "toTeam") && (
              <p className="mx-4 mt-2 text-xs text-muted">この1on1には、チームに共有する内容がなかったため To Team は作っていません。</p>
            )}
            <EmailPreview
              key={current.key}
              doc={current.doc}
              mock={draft.mock}
              to={
                !current.sendable
                  ? "自分用"
                  : current.key === "toEmployee"
                    ? draft.context.counterpart || "本人"
                    : "Team"
              }
              mockNote="下書きの文章はダミーです（AIはまだつないでいません）。いまは文字起こしから決まった言葉を含む発言を拾っているだけで、要約はしていません。"
            />
          </>
        ) : (
          <EmptyReader>
            <p className="font-semibold text-ink">ここに下書きのプレビューが表示されます</p>
            <p>文字起こしを読み込み（サンプルでも試せます）、「下書きを作る」を押してください。</p>
          </EmptyReader>
        )
      }
    />
  );
}
