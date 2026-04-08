import type { Lead } from "@/lib/leads";

function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () =>
    Array<number>(n + 1).fill(0)
  );
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + cost
      );
    }
  }
  return dp[m][n];
}

/** Typo-tolerant when query has 3+ chars: match token or short edit distance. */
function tokenMatches(haystack: string, needle: string): boolean {
  const n = needle.toLowerCase();
  if (n.length < 3) return false;
  const parts = haystack.toLowerCase().split(/[\s,/#]+/).filter((p) => p.length > 1);
  for (const p of parts) {
    if (p.startsWith(n) || p.includes(n)) return true;
    if (p.length <= 24 && n.length <= 24 && levenshtein(p, n) <= 2) return true;
  }
  return false;
}

export interface SearchSuggestion {
  /** Row label in the dropdown */
  display: string;
  /** Value written into the search field when the row is chosen */
  applyText: string;
}

export function getSearchSuggestions(
  query: string,
  leads: Lead[],
  max = 8
): SearchSuggestion[] {
  const q = query.trim();
  if (q.length < 1) return [];

  const ql = q.toLowerCase();
  const seen = new Set<string>();
  const scored: { display: string; applyText: string; score: number }[] = [];

  for (const l of leads) {
    const name = l.name.trim();
    const code = l.clientNumber.trim();
    if (!name && !code) continue;

    const nameL = name.toLowerCase();
    const codeL = code.toLowerCase();

    let score = 0;
    let matches = false;

    if (codeL) {
      if (codeL.startsWith(ql)) {
        matches = true;
        score = 110;
      } else if (codeL.includes(ql)) {
        matches = true;
        score = 90;
      } else if (tokenMatches(code, q)) {
        matches = true;
        score = 48;
      }
    }

    if (!matches && nameL) {
      if (nameL.startsWith(ql)) {
        matches = true;
        score = Math.max(score, 100);
      } else if (nameL.includes(ql)) {
        matches = true;
        score = Math.max(score, 75);
      } else if (tokenMatches(name, q)) {
        matches = true;
        score = Math.max(score, 42);
      }
    }

    if (!matches) continue;

    const key = `${code}|${name}`;
    if (seen.has(key)) continue;
    seen.add(key);

    const display = code ? `${code} · ${name || "—"}` : name;
    const codeHit = codeL.startsWith(ql) || codeL.includes(ql) || tokenMatches(code, q);
    const applyText = code && codeHit ? code : name || code;

    scored.push({ display, applyText, score });
  }

  scored.sort((a, b) => b.score - a.score || a.display.localeCompare(b.display));
  return scored.slice(0, max).map(({ display, applyText }) => ({ display, applyText }));
}
