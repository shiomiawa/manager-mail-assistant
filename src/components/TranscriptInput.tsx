"use client";

import { useState } from "react";
import {
  MAX_TRANSCRIPT_LENGTH,
  TRANSCRIPT_EXTENSIONS,
  TranscriptError,
  normalizeTranscript,
  readTranscriptFile,
} from "@/lib/meeting/transcript";

type Sample = { label: string; url: string };

type Props = {
  value: string;
  onChange: (text: string) => void;
  /** ファイルやサンプルを読み込んだとき（sampleIndex はサンプルのときだけ） */
  onLoaded: (text: string, name: string, sampleIndex?: number) => void;
  fileName: string;
  samples: Sample[];
  placeholder?: string;
};

/** 文字起こしの入力（ファイル選択・サンプル・貼り付け）。Meeting Notes と Briefing Notes で共通 */
export function TranscriptInput({ value, onChange, onLoaded, fileName, samples, placeholder }: Props) {
  const [error, setError] = useState("");

  async function onFile(file: File | undefined) {
    if (!file) return;
    try {
      onLoaded(await readTranscriptFile(file), file.name);
      setError("");
    } catch (err) {
      setError(err instanceof TranscriptError ? err.message : "ファイルを読み込めませんでした。");
    }
  }

  async function onSample(index: number) {
    try {
      const response = await fetch(samples[index].url);
      if (!response.ok) throw new Error();
      onLoaded(normalizeTranscript(await response.text()), samples[index].label, index);
      setError("");
    } catch {
      setError("サンプルを読み込めませんでした。");
    }
  }

  return (
    <>
      <p className="mt-1 text-sm text-slate-600">
        Teams・Zoom・Google Meet・録音アプリなどの文字起こし（{TRANSCRIPT_EXTENSIONS.join(" / ")}）を選ぶか、下の欄に貼り付けてください。時刻は取り除き、「話者：発言」の形に整えます。文字起こしは保存しません。
      </p>
      <p className="mt-1 text-xs text-amber-700">デモでは架空の内容を使ってください（実在の人の会話は入れないでください）。</p>
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
        {samples.map((sample, index) => (
          <button
            key={sample.url}
            type="button"
            onClick={() => void onSample(index)}
            className="rounded border border-brand-600 px-4 py-2 text-sm text-brand-700 hover:bg-brand-50"
          >
            {sample.label}
          </button>
        ))}
        {fileName && <span className="text-sm text-slate-600">読み込み済み：{fileName}</span>}
      </div>
      {error && (
        <p role="alert" className="mt-3 rounded border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          {error}
        </p>
      )}
      <label className="mt-3 block text-sm">
        <span className="sr-only">文字起こし</span>
        <textarea
          value={value}
          maxLength={MAX_TRANSCRIPT_LENGTH}
          onChange={(event) => onChange(event.target.value)}
          rows={10}
          placeholder={placeholder}
          className="block w-full rounded border border-slate-300 p-2 font-mono text-xs leading-5"
        />
      </label>
      <p className="mt-1 text-right text-xs text-slate-500">
        {value.length.toLocaleString("ja-JP")} / {MAX_TRANSCRIPT_LENGTH.toLocaleString("ja-JP")}字
      </p>
    </>
  );
}
