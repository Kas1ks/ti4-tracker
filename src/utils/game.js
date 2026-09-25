export function formatTime(totalSeconds) {
  const mins = Math.floor((totalSeconds || 0) / 60);
  const secs = (totalSeconds || 0) % 60;
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

/** Unbiased index in [0, max) via crypto when available. */
function randomIndex(max) {
  if (max <= 1) return 0;
  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    const limit = Math.floor(0x100000000 / max) * max;
    const buf = new Uint32Array(1);
    let x;
    do {
      crypto.getRandomValues(buf);
      x = buf[0];
    } while (x >= limit);
    return x % max;
  }
  return Math.floor(Math.random() * max);
}

export function shuffleArray(array) {
  const copy = [...array];
  for (let currentIndex = copy.length; currentIndex > 0; currentIndex -= 1) {
    const randomIdx = randomIndex(currentIndex);
    const lastIndex = currentIndex - 1;
    [copy[lastIndex], copy[randomIdx]] = [copy[randomIdx], copy[lastIndex]];
  }
  return copy;
}

/**
 * Shuffle so cards whose ids are in `avoidIds` tend to land later in deal order
 * (deck stays complete — draw still walks from the front).
 */
export function shufflePreferFresh(array, avoidIds = []) {
  if (!array.length) return [];
  const avoid = new Set(
    (Array.isArray(avoidIds) ? avoidIds : [])
      .map(id => String(id))
      .filter(Boolean),
  );
  if (avoid.size === 0) return shuffleArray(array);

  const fresh = [];
  const recent = [];
  array.forEach((item) => {
    const id = item?.id != null ? String(item.id) : '';
    if (id && avoid.has(id)) recent.push(item);
    else fresh.push(item);
  });
  // If everything was recent, just reshuffle the whole pool.
  if (fresh.length === 0) return shuffleArray(array);
  return [...shuffleArray(fresh), ...shuffleArray(recent)];
}

export function isAgendaFullyVoted(agenda, votingPlayers) {
  if (!agenda?.type || !votingPlayers?.length) return false;
  return votingPlayers.every((player) => !!agenda.locked?.[player.id]);
}
