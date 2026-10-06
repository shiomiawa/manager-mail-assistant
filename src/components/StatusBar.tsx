"use client";

import { useState } from "react";
import { setPasscode, usePasscode, usePasscodeNeeded, useServerConfig } from "@/lib/apiClient";

// ウィンドウのいちばん下の状態表示の帯。AIのモデルとパスコードは目立たせない（hotel-review-ai と同じ仕組み）
export function StatusBar() {
  const config = useServerConfig();
  const saved = usePasscode();
  const needed = usePasscodeNeeded();
  const [draft, setDraft] = useState("");
  const [editing, setEditing] = useState(false);

  const showInput = Boolean(config?.passcodeRequired) && (!saved || needed || editing);

  return (
    <footer aria-label="状態" className="flex flex-wrap items-center gap-x-5 gap-y-1 border-t border-line bg-rail px-4 py-1.5 text-[11.5px] text-muted">
      {config && (
        <span>AI：{config.aiMode === "ai" ? config.model : "ダミー（AIにつないでいません）"}</span>
      )}
      {config?.passcodeRequired && !showInput && (
        <span>
          パスコード：入力済み（
          <button type="button" onClick={() => setEditing(true)} className="underline">
            変更
          </button>
          ）
        </span>
      )}
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
            <span className={needed ? "text-red-700" : ""}>
              {needed ? "パスコードが違うか、未入力です：" : "パスコード："}
            </span>
            <input
              type="password"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              autoComplete="off"
              aria-label="デモ用パスコード"
              className="w-32 rounded border border-line bg-white px-2 py-0.5 text-xs text-ink"
            />
          </label>
          <button type="submit" disabled={!draft.trim()} className="rounded bg-brand-700 px-2 py-0.5 text-xs text-white disabled:opacity-50">
            保存
          </button>
          {editing && (
            <button type="button" onClick={() => setEditing(false)} className="underline">
              やめる
            </button>
          )}
        </form>
      )}
      <span className="ml-auto">自動送信はしません</span>
    </footer>
  );
}
