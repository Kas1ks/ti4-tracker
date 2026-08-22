export function formatTime(totalSeconds) {
  const mins = Math.floor((totalSeconds || 0) / 60);
  const secs = (totalSeconds || 0) % 60;
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

export function shuffleArray(array) {
  const copy = [...array];
  for (let currentIndex = copy.length; currentIndex > 0; currentIndex -= 1) {
    const randomIndex = Math.floor(Math.random() * currentIndex);
    const lastIndex = currentIndex - 1;
    [copy[lastIndex], copy[randomIndex]] = [copy[randomIndex], copy[lastIndex]];
  }
  return copy;
}
