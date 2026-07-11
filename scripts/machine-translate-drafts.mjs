import { execFileSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import path from "node:path";

import { interpolationTokens, readJson, root } from "./common.mjs";

const localeConfig = {
  "ja-JP": { name: "Japanese", target: "ja" },
  "ko-KR": { name: "Korean", target: "ko" }
};
const requestedLocales = process.argv.slice(2);
const locales = requestedLocales.length === 0
  ? Object.keys(localeConfig)
  : requestedLocales;
const sourceManifest = readJson(path.join(root, "source", "source-manifest.v1.json"));
const source = Object.fromEntries(
  sourceManifest.entries.map(({ key, source: value }) => [key, value])
);
const token = execFileSync("gh", ["auth", "token"], { encoding: "utf8" }).trim();
const sleep = (milliseconds) =>
  new Promise((resolve) => {
    setTimeout(resolve, milliseconds);
  });

if (token.length === 0) {
  throw new Error("GitHub authentication is required to create machine translation drafts");
}

const createBatches = (entries) => {
  const batches = [];
  let batch = [];
  let size = 0;
  for (const entry of entries) {
    const entrySize = JSON.stringify(entry).length;
    if (batch.length > 0 && (batch.length >= 50 || size + entrySize > 7_000)) {
      batches.push(batch);
      batch = [];
      size = 0;
    }
    batch.push(entry);
    size += entrySize;
  }
  if (batch.length > 0) {
    batches.push(batch);
  }
  return batches;
};

const parseModelResponse = (raw, records) => {
  const body = JSON.parse(raw);
  const content = body.choices?.[0]?.message?.content;
  if (typeof content !== "string") {
    throw new Error(`GitHub Models returned no translation content: ${raw}`);
  }
  const normalized = content
    .replace(/^```json\s*/iu, "")
    .replace(/^```\s*/u, "")
    .replace(/\s*```$/u, "");
  const translated = JSON.parse(normalized);
  if (typeof translated !== "object" || translated === null || Array.isArray(translated)) {
    throw new Error("GitHub Models returned an invalid translation object");
  }
  const result = {};
  for (const { key, value } of records) {
    const next = translated[key];
    if (typeof next !== "string") {
      throw new Error(`GitHub Models omitted ${key}`);
    }
    if (interpolationTokens(next).join(",") !== interpolationTokens(value).join(",")) {
      throw new Error(`GitHub Models changed interpolation tokens for ${key}`);
    }
    result[key] = next;
  }
  return result;
};

const translateBatch = async (records, config) => {
  const payload = JSON.stringify({
    model: "gpt-4o-mini",
    temperature: 0,
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content: [
          `Translate Lyra desktop UI copy from English to ${config.name}.`,
          "Return only one JSON object mapping every input key to its translated string.",
          "Translate all natural-language text, including tooltip text and ||-separated variants.",
          "Preserve exactly all {interpolationTokens}, URLs, file paths, Markdown, code spans, model IDs, product names, keyboard shortcuts, line breaks, and punctuation required by the source.",
          "Do not add commentary, do not omit keys, and do not leave English source text unchanged unless it is a proper noun, acronym, URL, code, or identifier."
        ].join(" ")
      },
      {
        role: "user",
        content: JSON.stringify(records)
      }
    ]
  });
  let failure = null;
  for (let attempt = 1; attempt <= 5; attempt += 1) {
    try {
      const raw = execFileSync(
        "curl",
        [
          "--silent",
          "--show-error",
          "--fail-with-body",
          "--connect-timeout",
          "15",
          "--max-time",
          "120",
          "--request",
          "POST",
          "https://models.inference.ai.azure.com/chat/completions",
          "--header",
          `Authorization: Bearer ${token}`,
          "--header",
          "Content-Type: application/json",
          "--header",
          "Accept: application/json",
          "--data-binary",
          "@-"
        ],
        { encoding: "utf8", input: payload }
      );
      return parseModelResponse(raw, records);
    } catch (error) {
      const response = typeof error === "object" && error !== null
        ? String((error).stdout ?? "")
        : "";
      const waitSeconds = /Please wait (\d+) seconds/iu.exec(response)?.[1];
      if (waitSeconds !== undefined && attempt < 5) {
        const delaySeconds = Number(waitSeconds) + 2;
        console.log(`[language-packs] rate limited; waiting ${delaySeconds}s before retrying`);
        await sleep(delaySeconds * 1_000);
        continue;
      }
      failure = new Error(
        `GitHub Models request failed${waitSeconds === undefined ? "" : " after rate-limit retries"}`
      );
    }
  }
  throw failure;
};

for (const locale of locales) {
  const config = localeConfig[locale];
  if (config === undefined) {
    throw new Error(`unsupported locale: ${locale}`);
  }
  const entries = sourceManifest.entries.map(({ key, source: value }) => ({ key, value }));
  const translated = {};
  const batches = createBatches(entries);
  for (const [index, batch] of batches.entries()) {
    console.log(`[language-packs] ${locale}: translating batch ${index + 1}/${batches.length}`);
    Object.assign(translated, await translateBatch(batch, config));
  }
  const unchanged = Object.keys(source).filter((key) => translated[key] === source[key]);
  const coverage = 1 - unchanged.length / Object.keys(source).length;
  if (coverage < 0.8) {
    throw new Error(`${locale}: translation coverage is only ${(coverage * 100).toFixed(1)}%`);
  }
  writeFileSync(
    path.join(root, "packs", `${locale}.json`),
    `${JSON.stringify(translated, null, 2)}\n`,
    "utf8"
  );
  console.log(`[language-packs] ${locale}: wrote ${Object.keys(translated).length} keys`);
}
