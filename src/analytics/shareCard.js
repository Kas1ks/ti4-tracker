/**
 * Plain-text share blurb for a finished game record (chat / clipboard).
 */
export function buildShareCardText(summary) {
  if (!summary) return '';
  const expansions = [
    summary.expansions?.pok && 'PoK',
    summary.expansions?.te && 'TE',
  ].filter(Boolean).join('+') || 'Base';

  const lines = [
    `TI4 · ${summary.date || ''} · ${expansions}`,
    `🏆 ${summary.winner}${summary.winningFaction ? ` (${summary.winningFaction})` : ''} · ${summary.roundsCount || '?'}R · цель ${summary.targetScore ?? '?'}`,
  ];

  const board = [...(summary.players || [])]
    .sort((a, b) => (b.score || 0) - (a.score || 0))
    .slice(0, 8)
    .map((p) => `${p.isWinner ? '★ ' : ''}${p.name}: ${p.score}`)
    .join(' · ');
  if (board) lines.push(board);

  const topObj = (summary.objectives || [])
    .filter((o) => (o.scoredBy || []).length > 0)
    .slice(0, 3)
    .map((o) => o.title)
    .filter(Boolean);
  if (topObj.length) lines.push(`Цели: ${topObj.join('; ')}`);

  const digest = (summary.eventDigest || []).slice(-3);
  if (digest.length) {
    lines.push('…');
    digest.forEach((e) => {
      const text = typeof e === 'string' ? e : (e.text || e.message || '');
      if (text) lines.push(`• ${text}`);
    });
  }

  return lines.join('\n');
}
