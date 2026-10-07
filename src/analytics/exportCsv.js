/** Escape one CSV cell (RFC-style quotes). */
function csvCell(value) {
  const s = value == null ? '' : String(value);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function toCsv(rows) {
  return rows.map((row) => row.map(csvCell).join(',')).join('\r\n');
}

/** Flat per-game summary rows. */
export function gamesToCsv(history) {
  const header = [
    'id', 'date', 'savedAt', 'schema', 'rounds', 'players', 'target',
    'winner', 'winningFaction', 'pok', 'te', 'custodians', 'teController',
  ];
  const rows = [header];
  (history || []).forEach((g) => {
    rows.push([
      g.id,
      g.date,
      g.savedAt || '',
      g.sourceSchemaVersion ?? g.schemaVersion,
      g.roundsCount,
      g.playerCount,
      g.targetScore,
      g.winner,
      g.winningFaction,
      g.expansions?.pok ? 1 : 0,
      g.expansions?.te ? 1 : 0,
      g.custodians || '',
      g.teController?.name || '',
    ]);
  });
  return toCsv(rows);
}

/** One row per player per game (good for pivot tables). */
export function playersToCsv(history) {
  const header = [
    'gameId', 'date', 'player', 'faction', 'score', 'winner',
    'damage', 'breakthrough', 'eliminated', 'elimRound',
    'timeSec', 'vpSecrets', 'vpObjectives', 'vpCustodians', 'vpSupport', 'vpExtra',
  ];
  const rows = [header];
  (history || []).forEach((g) => {
    (g.players || []).forEach((p) => {
      const b = p.scoreBreakdown || {};
      rows.push([
        g.id,
        g.date,
        p.name,
        p.faction || p.factionId || '',
        p.score,
        p.isWinner ? 1 : 0,
        p.damageDealt || 0,
        p.breakthrough ? 1 : 0,
        p.eliminated ? 1 : 0,
        p.eliminatedRound ?? '',
        p.totalTime || 0,
        b.secrets ?? '',
        b.objectives ?? '',
        b.custodians ?? '',
        b.support ?? '',
        b.extra ?? '',
      ]);
    });
  });
  return toCsv(rows);
}

export function downloadCsv(filename, csvText) {
  const blob = new Blob([`\uFEFF${csvText}`], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
