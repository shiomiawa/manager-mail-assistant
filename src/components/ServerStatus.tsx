"use client";

import { useState } from "react";
import { setPasscode, usePasscode, usePasscodeNeeded, useServerConfig } from "@/lib/apiClient";

// 画面上部に「いま使える機能」と、必要なときはデモ用パスコードの入力欄を出す（hotel-review-ai と同じ仕組み）
export function ServerStatus() {
  const config = useServerConfig();
  const saved = usePasscode();
  const needed = usePasscodeNeeded();
  const [draft, setDraft] = useState("");
  const [editing, setEditing] = useState(false);

  if (!config) return null;
  const showInput = config.passcodeRequired && (!saved || needed || editing);

  return (
    <div className="mb-4 flex flex-col gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600">
      <div className="flex flex-wrap gap-x-4 gap-y-1">
        <span>
          AI：
          {config.aiMode === "ai" ? (
            <strong className="text-brand-700">Claude で作成（{config.model}）</strong>
          ) : (
            <strong>ダミー（AIにつながず、決まった文で作成）</strong>
          )}
        </span>
        {config.aiMode === "ai" && (
          <span>
            1日の上限：週次コメント {config.limits.weeklyComments}回・会議の下書き {config.limits.meetingDrafts}回・説明会のメモ {config.limits.briefingNotes}回
          </span>
        )}
        {config.passcodeRequired && (
          <span>
            デモ用パスコード：
            <strong>{saved && !needed ? "入力済み" : "未入力"}</strong>
            {saved && !needed && !editing && (
              <button type="button" onClick={() => setEditing(true)} className="ml-2 underline">
                変更
              </button>
            )}
          </span>
        )}
      </div>

      {showInput && (
        <form
          className="flex flex-wrap items-center gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            setPasscode(draft);
            setDraft("");
            setEditing(false);
          }}
        >
          <label className="flex items-center gap-2">
            {needed ? (
              <span className="text-red-700">パスコードが違うか、未入力です。</span>
            ) : (
              <span>AIで下書きを作るには、デモ用パスコードが必要です。</span>
            )}
            <input
              type="password"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              autoComplete="off"
              aria-label="デモ用パスコード"
              className="w-40 rounded border border-slate-300 bg-white px-2 py-1 text-sm"
            />
          </label>
          <button type="submit" disabled={!draft.trim()} className="rounded bg-brand-700 px-3 py-1 text-sm text-white disabled:opacity-50">
            保存
          </button>
          {editing && (
            <button type="button" onClick={() => setEditing(false)} className="text-sm underline">
              やめる
            </button>
          )}
        </form>
      )}
    </div>
  );
}
