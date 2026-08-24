const stopWords = new Set([
  "a",
  "an",
  "and",
  "are",
  "as",
  "at",
  "be",
  "by",
  "for",
  "from",
  "in",
  "is",
  "it",
  "of",
  "on",
  "or",
  "shall",
  "should",
  "that",
  "the",
  "this",
  "to",
  "with",
]);

function tokens(value: string) {
  return (
    value
      .normalize("NFKC")
      .toLowerCase()
      .match(/[a-z]+(?:[-_/][a-z0-9]+)*|\d+(?:\.\d+)?/g)
      ?.filter((token) => token.length > 1 && !stopWords.has(token)) ?? []
  );
}

function controlledFragments(value: string) {
  const lines = value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const fragments = lines.flatMap((line) => {
    if (line.length <= 500) return [line];
    return line
      .split(/(?<=[.!?;])\s+/)
      .map((part) => part.trim())
      .filter(Boolean);
  });
  return fragments.filter((fragment) => fragment.length >= 4);
}

/**
 * Selects an exact, unchanged fragment from a controlled target region.
 * PDF extraction commonly stores a whole page in one source region. Comparing
 * the first number on that page is unsafe, so this deterministic selector
 * chooses the fragment with the strongest requirement-token overlap while
 * preserving the original citation boundary and text verbatim.
 */
export function selectControlledTargetExcerpt(
  requirement: string,
  targetRegionText: string,
) {
  const fragments = controlledFragments(targetRegionText);
  if (!fragments.length) return targetRegionText.trim().slice(0, 4000);

  const requirementTokens = tokens(requirement);
  const requirementSet = new Set(requirementTokens);
  const requirementNumbers = new Set(
    requirementTokens.filter((token) => /^\d/.test(token)),
  );

  const scored = fragments
    .map((fragment, index) => {
      const fragmentTokens = tokens(fragment);
      const fragmentSet = new Set(fragmentTokens);
      const overlap = [...requirementSet].filter((token) =>
        fragmentSet.has(token),
      ).length;
      const nonNumericOverlap = [...requirementSet].filter(
        (token) => !/^\d/.test(token) && fragmentSet.has(token),
      ).length;
      const numericOverlap = [...requirementNumbers].filter((token) =>
        fragmentSet.has(token),
      ).length;
      const measurementSignal =
        /\d\s*(?:kpa|pa|bar|psi|kv|v|mw|kw|w|hz|°c|c|%|l\/s|lpm|m3\/h|m³\/h|rpm|mm|cm|m)\b/i.test(
          fragment,
        )
          ? 1
          : 0;
      const controlledSignal =
        /\b(?:shall|must|required|rating|type|class|material|provided|available|value|capacity|pressure|temperature|flow|voltage)\b/i.test(
          fragment,
        )
          ? 1
          : 0;
      return {
        fragment,
        index,
        score:
          nonNumericOverlap * 5 +
          overlap * 2 +
          numericOverlap * 2 +
          measurementSignal +
          controlledSignal,
      };
    })
    .sort(
      (left, right) => right.score - left.score || left.index - right.index,
    );

  return scored[0].fragment.slice(0, 4000);
}
