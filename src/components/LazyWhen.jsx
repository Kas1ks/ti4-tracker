import { Suspense, useEffect, useState } from 'react';

/**
 * Mount children the first time `active` becomes true, then keep them mounted
 * (minimize/restore must not remount). Wraps in Suspense for lazy() chunks.
 */
export function LazyWhen({ active, children, fallback = null }) {
  const [seen, setSeen] = useState(() => !!active);

  useEffect(() => {
    if (active) setSeen(true);
  }, [active]);

  if (!seen) return null;
  return <Suspense fallback={fallback}>{children}</Suspense>;
}
