import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

import { readJson, root } from "./common.mjs";

const manifest = readJson(path.join(root, "source", "source-manifest.v1.json"));
const source = Object.fromEntries(manifest.entries.map(({ key, source: value }) => [key, value]));
const nativeTranslations = {
  "ja-JP": {
    "nativeMenu.back": "戻る",
    "nativeMenu.forward": "進む",
    "nativeMenu.reload": "再読み込み",
    "nativeMenu.copy": "コピー",
    "nativeMenu.cut": "切り取り",
    "nativeMenu.paste": "貼り付け",
    "nativeMenu.copyLink": "リンクをコピー",
    "nativeMenu.openLinkInNewTab": "新しいタブでリンクを開く",
    "nativeMenu.citeSelection": "選択範囲を AI に引用",
    "nativeMenu.citeLink": "リンクを AI に引用",
    "nativeMenu.citePage": "ページを AI に引用"
  },
  "ko-KR": {
    "nativeMenu.back": "뒤로",
    "nativeMenu.forward": "앞으로",
    "nativeMenu.reload": "새로 고침",
    "nativeMenu.copy": "복사",
    "nativeMenu.cut": "잘라내기",
    "nativeMenu.paste": "붙여넣기",
    "nativeMenu.copyLink": "링크 복사",
    "nativeMenu.openLinkInNewTab": "새 탭에서 링크 열기",
    "nativeMenu.citeSelection": "선택 영역을 AI에 인용",
    "nativeMenu.citeLink": "링크를 AI에 인용",
    "nativeMenu.citePage": "페이지를 AI에 인용"
  }
};

mkdirSync(path.join(root, "packs"), { recursive: true });
for (const [locale, native] of Object.entries(nativeTranslations)) {
  writeFileSync(
    path.join(root, "packs", `${locale}.json`),
    `${JSON.stringify({ ...source, ...native }, null, 2)}\n`,
    "utf8"
  );
}
