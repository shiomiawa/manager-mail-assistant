// クリップボードへのコピー（ブラウザ側で使う）

/** 見た目ごとコピーする（HTMLとテキストの両方を入れる。貼り付け先が選んで使う） */
export async function copyRich(html: string, text: string): Promise<void> {
  if (typeof ClipboardItem !== "undefined" && navigator.clipboard?.write) {
    try {
      await navigator.clipboard.write([
        new ClipboardItem({
          "text/html": new Blob([html], { type: "text/html" }),
          "text/plain": new Blob([text], { type: "text/plain" }),
        }),
      ]);
      return;
    } catch {
      // 下の方法で試す
    }
  }
  // 古いブラウザ向け：画面外に本文を置いて選択し、コピーする
  const holder = document.createElement("div");
  holder.contentEditable = "true";
  holder.style.position = "fixed";
  holder.style.left = "-10000px";
  holder.innerHTML = html;
  document.body.appendChild(holder);
  const range = document.createRange();
  range.selectNodeContents(holder);
  const selection = window.getSelection();
  selection?.removeAllRanges();
  selection?.addRange(range);
  const ok = document.execCommand("copy");
  selection?.removeAllRanges();
  holder.remove();
  if (!ok) throw new Error("コピーできませんでした。");
}

export async function copyText(text: string): Promise<void> {
  await navigator.clipboard.writeText(text);
}
