import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { renderEmailText } from "@/lib/email/template";
import { buildMeetingEmails } from "./meetingEmails";
import { mockMeetingDraft } from "./mockDraft";
import { TranscriptError, listSpeakers, normalizeTranscript } from "./transcript";

const vtt = readFileSync("sample-data/meeting-1on1-sample.vtt", "utf8");
const zoom = readFileSync("sample-data/meeting-team-sample.txt", "utf8");

describe("文字起こしの整形", () => {
  it("VTT：見出し・NOTE・時刻を消し、「話者：発言」にする", () => {
    const text = normalizeTranscript(vtt);
    expect(text).not.toMatch(/WEBVTT|NOTE|-->|<v /);
    expect(text.split("\n")[0]).toBe("マネージャー：お疲れさまです。今日は30分ほど、最近の様子を聞かせてください。");
    expect(listSpeakers(text)).toEqual(["マネージャー", "E005"]);
  });

  it("Zoom形式のテキスト：行頭の時刻を消す", () => {
    const text = normalizeTranscript(zoom);
    expect(text).not.toMatch(/\[\d{2}:\d{2}:\d{2}\]/);
    expect(listSpeakers(text)).toEqual(["マネージャー", "E001", "E008", "E004", "E013"]);
  });

  it("SRT にも対応し、同じ話者が続く行はつなげる", () => {
    const srt = "1\n00:00:01,000 --> 00:00:02,000\nA: こんにちは。\n\n2\n00:00:03,000 --> 00:00:04,000\nA: 元気です。\n";
    expect(normalizeTranscript(srt)).toBe("A：こんにちは。元気です。");
  });

  it("空のファイルや長すぎる文字起こしはエラー", () => {
    expect(() => normalizeTranscript("WEBVTT\n\n")).toThrow(TranscriptError);
    expect(() => normalizeTranscript("あ".repeat(50_001))).toThrow(TranscriptError);
  });
});

describe("1on1 の下書き（ダミー）", () => {
  const transcript = normalizeTranscript(vtt);
  const draft = mockMeetingDraft({ type: "1on1", transcript, meetingDate: "2026-10-06", counterpart: "E005" });
  const emails = buildMeetingEmails(draft, { type: "1on1", meetingDate: "2026-10-06", counterpart: "E005" });

  it("Summary・To Employee・My Notes・To Team を作る", () => {
    expect(emails.map((e) => e.key)).toEqual(["summary", "toEmployee", "myNotes", "toTeam"]);
    expect(emails.filter((e) => e.sendable).map((e) => e.key)).toEqual(["toEmployee", "toTeam"]);
  });

  it("件名は「【種類】日付　結論」の形", () => {
    expect(emails[1].doc.subject).toMatch(/^【1on1 Follow-up】2026\/10\/06　E005　取り組み\d件・次回10月13日$/);
  });

  it("個人的な話題（保育園など）はチーム向けに入れず、My Notes で配慮を促す", () => {
    const toTeam = renderEmailText(emails.find((e) => e.key === "toTeam")!.doc);
    expect(toTeam).not.toMatch(/保育園|子ども|送り迎え|シフト/);
    expect(toTeam).toContain("テンプレート");
    expect(draft.myNotes.sensitive.length).toBe(1);
  });

  it("マネージャーがすること（シフトの確認）は My Support に入る", () => {
    expect(draft.toEmployee!.support.join("")).toContain("シフト");
  });
});

describe("取り組みの拾い方（ダミー）", () => {
  it("「はい、」で始まる返事も、中身があれば拾う。あいさつだけの文は拾わない", () => {
    const draft = mockMeetingDraft({
      type: "1on1",
      transcript: "マネージャー：お疲れさまです。今日はよろしくお願いします。\nE005：はい、金曜までに手順書を確認します。",
      meetingDate: "2026-10-06",
      counterpart: "E005",
    });
    expect(draft.summary.actionItems).toEqual([{ owner: "E005", task: "金曜までに手順書を確認します。", due: "金曜まで" }]);
  });
});

describe("チームミーティングの下書き（ダミー）", () => {
  const transcript = normalizeTranscript(zoom);
  const draft = mockMeetingDraft({ type: "team", transcript, meetingDate: "2026-10-05" });
  const emails = buildMeetingEmails(draft, { type: "team", meetingDate: "2026-10-05", counterpart: "" });

  it("Summary・My Notes・To Team を作り、To Employee は作らない", () => {
    expect(emails.map((e) => e.key)).toEqual(["summary", "myNotes", "toTeam"]);
  });

  it("担当と期限つきの取り組みを拾う（E013 の FAQ 見直し・10月9日）", () => {
    expect(draft.summary.actionItems).toContainEqual(
      expect.objectContaining({ owner: "E013", due: "10月9日" }),
    );
    expect(renderEmailText(emails.find((e) => e.key === "toTeam")!.doc)).toContain("Owner | Task | Due");
  });
});
