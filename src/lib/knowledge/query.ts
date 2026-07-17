export function tokenizeQuery(query: string) {
  return query.toLowerCase().split(/[^a-z0-9]+/).filter((token) => token.length > 2).slice(0, 12);
}

export function scoreCitationText(query: string, content: string) {
  const tokens = tokenizeQuery(query);
  const normalized = content.toLowerCase();
  return tokens.reduce((score, token) => score + (normalized.includes(token) ? 1 : 0), 0);
}
