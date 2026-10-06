// 説明会の日程・期限を、カレンダー登録用ファイル（.ics）にする
// アプリからは通知を送らず、カレンダーの通知（前日・当日）でリマインドする

export type ReminderTiming = "dayBefore" | "sameDay";

export type CalendarEvent = {
  title: string;
  date: string; // YYYY-MM-DD
  time: string; // HH:MM。空なら終日の予定
  description?: string;
  remind: ReminderTiming;
};

/**
 * 話の中の「月・日」に年を付けて YYYY-MM-DD にする。
 * 説明会の年を使い、その日付が説明会より前になるなら翌年とみなす（例：12月の説明会で「1月15日まで」）。
 * ありえない日付（2月30日など）や、月・日がないときは空文字
 */
export function resolveDate(month: number | null, day: number | null, briefingDate: string): string {
  if (!month || !day || !Number.isInteger(month) || !Number.isInteger(day)) return "";
  const base = new Date(`${briefingDate}T00:00:00Z`);
  if (Number.isNaN(base.getTime())) return "";
  for (const year of [base.getUTCFullYear(), base.getUTCFullYear() + 1]) {
    const candidate: Date = new Date(Date.UTC(year, month - 1, day));
    if (candidate.getUTCMonth() !== month - 1 || candidate.getUTCDate() !== day) return "";
    if (candidate.getTime() >= base.getTime()) return candidate.toISOString().slice(0, 10);
  }
  return "";
}

export const isValidDate = (value: string) =>
  /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(new Date(`${value}T00:00:00Z`).getTime());
export const isValidTime = (value: string) => /^([01]\d|2[0-3]):[0-5]\d$/.test(value);

/** 通知のタイミング（終日の予定は前日・当日の9時、時刻のある予定は1日前・1時間前） */
function trigger(event: CalendarEvent): string {
  if (event.time) return event.remind === "dayBefore" ? "-P1D" : "-PT1H";
  return event.remind === "dayBefore" ? "-PT15H" : "PT9H";
}

export function buildIcs(events: CalendarEvent[], now = new Date()): string {
  const stamp = now.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//manager-mail-assistant//Briefing Notes//JA",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
  ];
  events.forEach((event, i) => {
    const day = event.date.replaceAll("-", "");
    lines.push("BEGIN:VEVENT", `UID:${day}-${i}-${stamp}@manager-mail-assistant`, `DTSTAMP:${stamp}`);
    if (event.time) {
      // 時刻はその端末の時間帯（日本なら日本時間）として扱う
      const start = `${day}T${event.time.replace(":", "")}00`;
      lines.push(`DTSTART:${start}`, `DTEND:${addMinutes(event.date, event.time, 30)}`);
    } else {
      lines.push(`DTSTART;VALUE=DATE:${day}`, `DTEND;VALUE=DATE:${nextDay(event.date)}`);
    }
    lines.push(`SUMMARY:${escapeText(event.title)}`);
    if (event.description) lines.push(`DESCRIPTION:${escapeText(event.description)}`);
    lines.push(
      "BEGIN:VALARM",
      "ACTION:DISPLAY",
      `DESCRIPTION:${escapeText(event.title)}`,
      `TRIGGER:${trigger(event)}`,
      "END:VALARM",
      "END:VEVENT",
    );
  });
  lines.push("END:VCALENDAR");
  return lines.map(fold).join("\r\n") + "\r\n";
}

/** 文字の中の \ ; , と改行を、.ics の決まりどおりに書き換える */
function escapeText(text: string): string {
  return text.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
}

/** 1行75バイトを超えたら折り返す（日本語の文字の途中では切らない） */
function fold(line: string): string {
  const encoder = new TextEncoder();
  const parts: string[] = [];
  let current = "";
  let bytes = 0;
  for (const char of line) {
    const size = encoder.encode(char).length;
    const limit = parts.length === 0 ? 75 : 74; // 2行目以降は先頭の空白1バイトぶん短く
    if (bytes + size > limit) {
      parts.push(current);
      current = "";
      bytes = 0;
    }
    current += char;
    bytes += size;
  }
  parts.push(current);
  return parts.join("\r\n ");
}

function nextDay(date: string): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10).replaceAll("-", "");
}

function addMinutes(date: string, time: string, minutes: number): string {
  const d = new Date(`${date}T${time}:00Z`);
  d.setUTCMinutes(d.getUTCMinutes() + minutes);
  return d.toISOString().slice(0, 16).replace(/[-:]/g, "") + "00";
}
