import { canonicalTag } from "./tags";

export type VoiceTask = { title: string; tag: string | null };
const separator = /^[\s、,。.:：]+/u;

/** Speech engines often omit spaces between Japanese words. */
export function parseVoiceTask(transcript: string, tags: string[]): VoiceTask | null {
  const text = transcript.normalize("NFKC").trim().replace(/[。．.]+$/u, "").trim();
  if (!text) return null;
  const prefixes: [string, string | null][] = [
    ["タグなし", null], ["タグ無し", null],
    ["買い物", "買物"], ["買物", "買物"], ["勉強", "勉強"],
    ...tags.map((tag): [string, string] => [tag.normalize("NFKC"), canonicalTag(tag)]),
  ];
  prefixes.sort((a, b) => b[0].length - a[0].length);
  for (const [prefix, tag] of prefixes) {
    if (!text.toLocaleLowerCase("ja").startsWith(prefix.toLocaleLowerCase("ja"))) continue;
    const rest = text.slice(prefix.length);
    // A one-character tag such as 猫 must not turn 猫砂 into 砂.
    if (prefix.length === 1 && rest && !separator.test(rest)) continue;
    const title = rest.replace(separator, "").trim();
    return title ? { title, tag } : null;
  }
  return { title: text, tag: "買物" };
}
