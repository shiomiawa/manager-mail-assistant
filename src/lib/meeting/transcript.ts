// 会議の文字起こしファイルを、「話者：発言」の行だけのテキストに整える
// 対応：.vtt（Teams・Zoom・Meet の字幕）、.srt、.txt（Zoom のチャット形式など）、.docx（Teams のダウンロード）

/** 文字起こしの上限（1時間の会議でおよそ2万字なので、余裕をもたせる） */
export const MAX_TRANSCRIPT_LENGTH = 50_000;
export const MAX_TRANSCRIPT_FILE_SIZE = 5 * 1024 * 1024;
export const TRANSCRIPT_EXTENSIONS = [".vtt", ".srt", ".txt", ".docx"] as const;

export class TranscriptError extends Error {}

/** ファイルを読み、整えたテキストを返す（ブラウザ側で使う） */
export async function readTranscriptFile(file: File): Promise<string> {
  const name = file.name.toLowerCase();
  if (!TRANSCRIPT_EXTENSIONS.some((ext) => name.endsWith(ext))) {
    throw new TranscriptError(`読み込めるのは ${TRANSCRIPT_EXTENSIONS.join(" / ")} のファイルです。`);
  }
  if (file.size > MAX_TRANSCRIPT_FILE_SIZE) {
    throw new TranscriptError("ファイルが大きすぎます（5MBまで）。");
  }
  if (name.endsWith(".docx")) {
    // Word を読む部品は大きいので、使うときに読み込む
    const mammoth = await import("mammoth");
    try {
      const result = await mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() });
      return normalizeTranscript(result.value);
    } catch {
      throw new TranscriptError("Word ファイル（.docx）として読み込めませんでした。");
    }
  }
  return normalizeTranscript(await file.text());
}

/**
 * 文字起こしのテキストを整える。
 * - WEBVTT の見出し・NOTE・番号・時刻の行を消す
 * - <v 話者>発言</v> を「話者：発言」にする
 * - 行頭の [00:01:23] や 00:01:23 の時刻を消す
 * - 同じ話者が続く行はつなげる
 */
export function normalizeTranscript(raw: string): string {
  const lines = raw.replace(/^﻿/, "").replace(/\r\n?/g, "\n").split("\n");
  const out: { speaker: string; text: string }[] = [];
  let skippingNote = false;

  for (const original of lines) {
    let line = original.trim();
    if (!line) {
      skippingNote = false;
      continue;
    }
    if (skippingNote) continue;
    if (/^WEBVTT/.test(line)) continue;
    if (/^NOTE\b/.test(line)) {
      skippingNote = true;
      continue;
    }
    if (/^\d+$/.test(line)) continue; // SRT・VTT の番号
    if (/^\d{1,2}:\d{2}(:\d{2})?[.,]\d{1,3}\s*-->/.test(line)) continue; // 時刻の行

    line = line.replace(/^\[?\d{1,2}:\d{2}(:\d{2})?\]?\s*/, ""); // 行頭の時刻

    let speaker = "";
    const voice = line.match(/^<v\s+([^>]+)>(.*?)(<\/v>)?$/);
    if (voice) {
      speaker = voice[1].trim();
      line = voice[2];
    } else {
      const colon = line.match(/^([^:：]{1,20})[:：]\s*(.+)$/);
      if (colon && !/\s{2,}/.test(colon[1])) {
        speaker = colon[1].trim();
        line = colon[2];
      }
    }
    line = line.replace(/<[^>]+>/g, "").trim(); // 残ったタグ
    if (!line) continue;

    const last = out.at(-1);
    if (last && speaker && last.speaker === speaker) {
      last.text += line;
    } else {
      out.push({ speaker, text: line });
    }
  }

  const text = out.map((l) => (l.speaker ? `${l.speaker}：${l.text}` : l.text)).join("\n");
  if (!text) throw new TranscriptError("文字起こしの文章が見つかりませんでした。");
  if (text.length > MAX_TRANSCRIPT_LENGTH) {
    throw new TranscriptError(
      `文字起こしが長すぎます（${text.length.toLocaleString()}字。${MAX_TRANSCRIPT_LENGTH.toLocaleString()}字まで）。`,
    );
  }
  return text;
}

/** 話者の一覧（登場順） */
export function listSpeakers(transcript: string): string[] {
  const speakers = transcript
    .split("\n")
    .map((line) => line.match(/^([^：]{1,20})：/)?.[1])
    .filter((s): s is string => Boolean(s));
  return [...new Set(speakers)];
}
