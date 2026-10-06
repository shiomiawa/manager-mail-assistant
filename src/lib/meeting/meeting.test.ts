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
    expect(listSpeakers(text)).toEqual(["マネージャー", "E001", "E004", "E008", "E013"]);
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
  const emails = buildMeetingEmails(draft, {
    type: "1on1",
    meetingDate: "2026-10-06",
    counterpart: "E005",
    nextMeetingDate: "2026-10-13",
  });

  it("Summary・To Employee・My Notes・To Team を作る", () => {
    expect(emails.map((e) => e.key)).toEqual(["summary", "toEmployee", "myNotes", "toTeam"]);
    expect(emails.filter((e) => e.sendable).map((e) => e.key)).toEqual(["toEmployee", "toTeam"]);
  });

  it("件名は「【種類】日付　結論」の形", () => {
    expect(emails[1].doc.subject).toMatch(/^【1on1 Follow-up】2026\/10\/06　E005　取り組み\d件・Next 10\/13$/);
    expect(renderEmailText(emails[1].doc)).toContain("【Next Meeting】\n2026/10/13 (Tue)");
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
  const agenda = "パラフレーズで要約するコツと、短く伝える方法";
  const draft = mockMeetingDraft({ type: "team", transcript, meetingDate: "2026-10-05", agenda });
  const emails = buildMeetingEmails(draft, {
    type: "team",
    meetingDate: "2026-10-05",
    counterpart: "",
    nextMeetingDate: "2026-10-12",
    nextMeetingTime: "10:00",
  });
  const toTeam = renderEmailText(emails.find((e) => e.key === "toTeam")!.doc);

  it("Summary・My Notes・To Team を作り、To Employee は作らない", () => {
    expect(emails.map((e) => e.key)).toEqual(["summary", "myNotes", "toTeam"]);
  });

  it("全員の意見を、発言の順に拾う", () => {
    expect(draft.discussion!.agenda).toBe(agenda);
    expect(draft.discussion!.opinions.map((o) => o.speaker)).toEqual(["E001", "E004", "E008", "E013"]);
  });

  it("意見への反応を種類つきで拾う（真似してみる・質問・反対・本人の返事）", () => {
    const e001 = draft.discussion!.opinions[0];
    expect(e001.reactions.map((r) => `${r.speaker}:${r.kind}`)).toEqual(["E004:willTry", "E008:question", "E001:reply"]);
    expect(toTeam).toContain("↳ E004（Will Try）：E001さんの「一文で言い換える」はとてもいいですね。");
  });

  it("意見が分かれた点は、双方の考えと理由、話し合った結果を残す", () => {
    const views = draft.discussion!.differentViews;
    expect(views.length).toBe(2);
    const e008 = views.find((v) => v.views[0].speaker === "E008")!;
    expect(e008.views[1].speaker).toBe("E001");
    expect(e008.views[0].reason).toContain("突き放されたように感じる");
    expect(e008.outcome).toContain("短くても冷たくならない");
    expect(toTeam).toContain("【Different Views】");
    expect(toTeam).toContain("Outcome → E008：");
  });

  it("最後に総括と次回の日程を載せる", () => {
    expect(draft.discussion!.wrapUp).toMatch(/^要約のコツは、/);
    expect(toTeam).toMatch(/【Wrap-up】\n要約のコツは、/);
    expect(toTeam).toContain("【Next Meeting】\n2026/10/12 (Mon) 10:00");
    expect(emails.find((e) => e.key === "toTeam")!.doc.subject).toBe(
      "【Team Meeting】2026/10/05　パラフレーズで要約するコツと、短く伝える方法・Next 10/12",
    );
  });

  it("取り組みは総括のあとから拾う（E013 の FAQ 要約例・10月9日）", () => {
    expect(draft.summary.actionItems).toContainEqual(expect.objectContaining({ owner: "E013", due: "10月9日" }));
    expect(draft.summary.actionItems.some((a) => /真似/.test(a.task))).toBe(false);
  });

  it("総括には依頼を含めない。依頼は担当つきの取り組みになり、次回の案内は取り組みにしない", () => {
    expect(draft.discussion!.wrapUp).not.toMatch(/今週は|さんは/);
    expect(draft.summary.actionItems.map((a) => a.owner)).toEqual(["全員", "E013"]);
    expect(draft.summary.actionItems.some((a) => /^次回は/.test(a.task))).toBe(false);
  });
});
