import { describe, expect, it } from "vitest";
import { buildIcs, resolveDate } from "./calendar";

describe("resolveDate（月・日に年を付ける）", () => {
  it("説明会と同じ年にする", () => {
    expect(resolveDate(10, 23, "2026-10-14")).toBe("2026-10-23");
  });
  it("説明会より前の日付になるなら翌年にする", () => {
    expect(resolveDate(1, 15, "2026-12-10")).toBe("2027-01-15");
  });
  it("説明会の当日はその年のまま", () => {
    expect(resolveDate(10, 14, "2026-10-14")).toBe("2026-10-14");
  });
  it("月・日がない、ありえない日付は空文字", () => {
    expect(resolveDate(null, 5, "2026-10-14")).toBe("");
    expect(resolveDate(2, 30, "2026-10-14")).toBe("");
    expect(resolveDate(13, 1, "2026-10-14")).toBe("");
  });
});

describe("buildIcs（カレンダー登録用ファイル）", () => {
  const now = new Date("2026-10-14T05:00:00Z");
  const ics = buildIcs(
    [
      { title: "事前アンケートの締め切り", date: "2026-10-23", time: "17:00", remind: "dayBefore" },
      { title: "本番切り替え", date: "2026-11-04", time: "", remind: "sameDay", description: "7時〜9時は両方のシステムが使えない" },
    ],
    now,
  );

  it("行の区切りは CRLF で、決まった始まりと終わりがある", () => {
    expect(ics.startsWith("BEGIN:VCALENDAR\r\nVERSION:2.0\r\n")).toBe(true);
    expect(ics.endsWith("END:VCALENDAR\r\n")).toBe(true);
    expect(ics.replace(/\r\n/g, "")).not.toMatch(/\n/);
    expect(ics.match(/BEGIN:VEVENT/g)).toHaveLength(2);
  });

  it("時刻のある予定は1日前に通知、終日の予定は当日9時に通知", () => {
    expect(ics).toContain("DTSTART:20261023T170000\r\nDTEND:20261023T173000");
    expect(ics).toContain("TRIGGER:-P1D");
    expect(ics).toContain("DTSTART;VALUE=DATE:20261104\r\nDTEND;VALUE=DATE:20261105");
    expect(ics).toContain("TRIGGER:PT9H");
  });

  it("カンマなどの記号はエスケープし、長い行は75バイトで折り返す（日本語の途中で切らない）", () => {
    const long = buildIcs([{ title: "あ".repeat(40) + ",;", date: "2026-10-23", time: "", remind: "dayBefore" }], now);
    const lines = long.split("\r\n");
    for (const line of lines) expect(new TextEncoder().encode(line).length).toBeLessThanOrEqual(75);
    expect(long.replace(/\r\n /g, "")).toContain(`SUMMARY:${"あ".repeat(40)}\\,\\;`);
  });
});
