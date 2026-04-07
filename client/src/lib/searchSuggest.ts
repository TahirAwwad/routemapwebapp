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

export function getSearchSuggestions(
  query: string,
  leads: Lead[],
  max = 8
): string[] {
  const q = query.trim();
  if (q.length < 1) return [];

  const seen = new Set<string>();
  const scored: { text: string; score: number }[] = [];

  for (const l of leads) {
    const candidates = [
      l.name,
      l.city,
      l.state,
      l.clientNumber,
      l.address,
    ].filter((x): x is string => Boolean(x && x.trim()));

    for (const c of candidates) {
      const t = c.trim();
      if (seen.has(t)) continue;
      const cl = t.toLowerCase();
      const ql = q.toLowerCase();

      let score = 0;
      if (cl.startsWith(ql)) score = 100;
      else if (cl.includes(ql)) score = 75;
      else if (tokenMatches(t, q)) score = 45;
      else continue;

      seen.add(t);
      scored.push({ text: t, score });
    }
  }

  scored.sort((a, b) => b.score - a.score || a.text.localeCompare(b.text));
  return scored.slice(0, max).map((x) => x.text);
}
