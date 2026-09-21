import { useEffect, useRef, useState } from 'react';
import { ALL_FACTIONS } from '../data/gameData';
import { EXPEDITION_SLICES, EXPEDITION_TOKEN_SRC, crestForSlice } from '../data/expedition';

/** Math degrees: 0 = right, CCW. */
function polar(cx, cy, r, angleDeg) {
  const rad = (angleDeg * Math.PI) / 180;
  return {
    x: cx + r * Math.cos(rad),
    y: cy + r * Math.sin(rad),
  };
}

/** Six wedges, first centered on top (−90°). */
function wedgePath(index, outerR = 49) {
  const start = -120 + index * 60;
  const end = start + 60;
  const a = polar(50, 50, outerR, start);
  const b = polar(50, 50, outerR, end);
  return `M 50 50 L ${a.x.toFixed(2)} ${a.y.toFixed(2)} A ${outerR} ${outerR} 0 0 1 ${b.x.toFixed(2)} ${b.y.toFixed(2)} Z`;
}

function useCalibrateMode() {
  const [on, setOn] = useState(false);
  useEffect(() => {
    const sync = () => {
      const q = new URLSearchParams(window.location.search);
      setOn(q.get('calibrateExpedition') === '1');
    };
    sync();
    window.addEventListener('popstate', sync);
    return () => window.removeEventListener('popstate', sync);
  }, []);
  return on;
}

function useIsMobileViewport() {
  const [isMobile, setIsMobile] = useState(() => (
    typeof window !== 'undefined' ? window.matchMedia('(max-width: 767px)').matches : false
  ));
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 767px)');
    const onChange = () => setIsMobile(mq.matches);
    onChange();
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);
  return isMobile;
}

function defaultCrestMap(isMobile) {
  const map = {};
  EXPEDITION_SLICES.forEach((s) => {
    map[s.id] = { ...crestForSlice(s, isMobile) };
  });
  return map;
}

/**
 * Expedition token with circular control tokens in each claim well.
 * Append ?calibrateExpedition=1 to drag-tune. Calibrate on phone → crestMobile.
 */
export function ExpeditionToken({
  expedition,
  players = [],
  canClaim = false,
  activePlayer = null,
  onClaimSlice,
  size = 'lg',
  interactive = true,
  className = '',
  onOpen,
}) {
  const calibrate = useCalibrateMode();
  const isMobile = useIsMobileViewport();
  const boardRef = useRef(null);
  const dragRef = useRef(null);
  const [crestMap, setCrestMap] = useState(() => defaultCrestMap(false));
  const [activeId, setActiveId] = useState(EXPEDITION_SLICES[0].id);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setCrestMap(defaultCrestMap(isMobile));
  }, [isMobile]);

  const slices = expedition?.slices || {};
  const locked = !!(expedition?.completed || expedition?.awaitingControlPick);
  const sizeClass = size === 'sm'
    ? 'max-w-[260px]'
    : size === 'md'
      ? 'max-w-[360px]'
      : 'max-w-full';

  const playerById = (id) => players.find(p => p.id === id) || null;
  const factionOf = (player) => (
    player ? ALL_FACTIONS.find(f => f.id === player.factionId) : null
  );

  const pctFromEvent = (e) => {
    const el = boardRef.current;
    if (!el) return null;
    const r = el.getBoundingClientRect();
    const x = ((e.clientX - r.left) / r.width) * 100;
    const y = ((e.clientY - r.top) / r.height) * 100;
    return {
      left: Math.max(0, Math.min(100, +x.toFixed(2))),
      top: Math.max(0, Math.min(100, +y.toFixed(2))),
    };
  };

  useEffect(() => {
    if (!calibrate) return undefined;
    const onMove = (e) => {
      const drag = dragRef.current;
      if (!drag) return;
      e.preventDefault();
      const pct = pctFromEvent(e);
      if (!pct) return;
      setCrestMap((prev) => ({
        ...prev,
        [drag.id]: { ...prev[drag.id], left: pct.left, top: pct.top },
      }));
    };
    const onUp = () => { dragRef.current = null; };
    window.addEventListener('pointermove', onMove, { passive: false });
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
    };
  }, [calibrate]);

  const copyJson = async () => {
    const key = isMobile ? 'crestMobile' : 'crest';
    const lines = EXPEDITION_SLICES.map((s) => {
      const c = crestMap[s.id];
      return `    ${key}: { left: ${c.left}, top: ${c.top}, size: ${c.size} }, // ${s.id}`;
    }).join('\n');
    const text = `device: ${isMobile ? 'mobile' : 'desktop'}\n${lines}\n\n${JSON.stringify({ device: isMobile ? 'mobile' : 'desktop', crests: crestMap }, null, 2)}`;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      window.prompt('Скопируй координаты:', text);
    }
  };

  const activeCrest = crestMap[activeId];

  return (
    <div className={`relative mx-auto w-full ${sizeClass} ${className}`}>
      {calibrate && (
        <div className="mb-2 rounded-lg border border-amber-500/50 bg-amber-950/40 p-2 text-[11px] text-amber-100 space-y-2 sticky top-0 z-40">
          <p className="font-semibold text-amber-200">
            Калибровка · {isMobile ? 'MOBILE' : 'DESKTOP'}
          </p>
          <p>
            С телефона открой эту же ссылку, расставь кружки по центрам колодцев,
            нажми «Копировать» и вставь в чат. Один раз — все 6 слотов.
          </p>
          <div className="flex flex-wrap gap-1">
            {EXPEDITION_SLICES.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => setActiveId(s.id)}
                className={`px-2 py-1 rounded border text-[10px] ${
                  activeId === s.id
                    ? 'border-amber-300 bg-amber-500/30'
                    : 'border-slate-600 bg-slate-900'
                }`}
              >
                {s.short}
              </button>
            ))}
          </div>
          {activeCrest && (
            <label className="flex items-center gap-2">
              <span className="whitespace-nowrap">size {activeCrest.size}</span>
              <input
                type="range"
                min={6}
                max={22}
                step={0.1}
                value={activeCrest.size}
                onChange={(e) => {
                  const sizeVal = +(+e.target.value).toFixed(1);
                  setCrestMap((prev) => ({
                    ...prev,
                    [activeId]: { ...prev[activeId], size: sizeVal },
                  }));
                }}
                className="flex-1"
              />
            </label>
          )}
          <button
            type="button"
            onClick={copyJson}
            className="w-full rounded bg-amber-500 text-black font-bold py-2.5 hover:bg-amber-400"
          >
            {copied ? 'Скопировано ✓' : 'Копировать координаты'}
          </button>
        </div>
      )}

      <div
        ref={boardRef}
        className={`relative w-full overflow-hidden select-none ${
          onOpen && !interactive && !calibrate ? 'cursor-pointer' : ''
        }`}
        style={{
          aspectRatio: '1 / 1',
          touchAction: calibrate ? 'none' : undefined,
        }}
        onClick={onOpen && !interactive && !calibrate ? onOpen : undefined}
        role={onOpen && !interactive && !calibrate ? 'button' : undefined}
        tabIndex={onOpen && !interactive && !calibrate ? 0 : undefined}
        onKeyDown={onOpen && !interactive && !calibrate ? (e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onOpen();
          }
        } : undefined}
        onWheel={calibrate ? (e) => {
          e.preventDefault();
          const delta = e.deltaY > 0 ? -0.2 : 0.2;
          setCrestMap((prev) => {
            const cur = prev[activeId];
            const next = Math.max(6, Math.min(22, +(cur.size + delta).toFixed(1)));
            return { ...prev, [activeId]: { ...cur, size: next } };
          });
        } : undefined}
      >
        <img
          src={EXPEDITION_TOKEN_SRC}
          alt="Экспедиция Грозового рубежа"
          className="absolute inset-0 h-full w-full max-w-none pointer-events-none"
          style={{ objectFit: 'fill' }}
          draggable={false}
        />

        {!calibrate && EXPEDITION_SLICES.map((slice) => {
          const ownerId = slices[slice.id];
          if (ownerId == null) return null;
          const owner = playerById(ownerId);
          const faction = factionOf(owner);
          if (!faction?.iconUrl) return null;
          const { left, top, size: diam } = crestForSlice(slice, isMobile);

          return (
            <div
              key={`crest-${slice.id}`}
              className="absolute z-10 pointer-events-none rounded-full flex items-center justify-center overflow-hidden"
              style={{
                left: `${left}%`,
                top: `${top}%`,
                width: `${diam}%`,
                height: `${diam}%`,
                transform: 'translate(-50%, -50%)',
                boxSizing: 'border-box',
                background: '#050505',
                border: `1.5px solid ${owner?.color || '#cbd5e1'}`,
                boxShadow: '0 1px 2px rgba(0,0,0,0.9)',
              }}
              title={`${owner?.name || ''} · ${slice.label}`}
            >
              <img
                src={faction.iconUrl}
                alt={faction.name}
                draggable={false}
                style={{ width: '80%', height: '80%', objectFit: 'contain' }}
              />
            </div>
          );
        })}

        {calibrate && EXPEDITION_SLICES.map((slice) => {
          const crest = crestMap[slice.id];
          const ownerId = slices[slice.id];
          const owner = ownerId != null ? playerById(ownerId) : null;
          const faction = factionOf(owner);
          const selected = activeId === slice.id;

          return (
            <div
              key={`cal-${slice.id}`}
              className="absolute z-30 rounded-full flex items-center justify-center overflow-hidden cursor-grab active:cursor-grabbing"
              style={{
                left: `${crest.left}%`,
                top: `${crest.top}%`,
                width: `${crest.size}%`,
                height: `${crest.size}%`,
                transform: 'translate(-50%, -50%)',
                boxSizing: 'border-box',
                background: faction ? '#050505' : 'rgba(251, 191, 36, 0.35)',
                border: selected
                  ? '2px solid #fde68a'
                  : `2px solid ${owner?.color || '#f59e0b'}`,
                boxShadow: selected
                  ? '0 0 0 2px rgba(245,158,11,0.8)'
                  : '0 1px 3px rgba(0,0,0,0.8)',
                touchAction: 'none',
              }}
              title={`${slice.label} · ${crest.left}, ${crest.top}, ${crest.size}`}
              onPointerDown={(e) => {
                e.preventDefault();
                e.stopPropagation();
                e.currentTarget.setPointerCapture?.(e.pointerId);
                setActiveId(slice.id);
                dragRef.current = { id: slice.id };
                const pct = pctFromEvent(e);
                if (pct) {
                  setCrestMap((prev) => ({
                    ...prev,
                    [slice.id]: { ...prev[slice.id], left: pct.left, top: pct.top },
                  }));
                }
              }}
            >
              {faction?.iconUrl ? (
                <img
                  src={faction.iconUrl}
                  alt=""
                  draggable={false}
                  className="pointer-events-none"
                  style={{ width: '80%', height: '80%', objectFit: 'contain' }}
                />
              ) : (
                <span className="pointer-events-none text-[9px] font-bold text-amber-100">
                  {slice.short}
                </span>
              )}
            </div>
          );
        })}

        {interactive && !calibrate && (
          <svg
            viewBox="0 0 100 100"
            className="absolute inset-0 w-full h-full z-20"
            aria-hidden={!canClaim}
          >
            {EXPEDITION_SLICES.map((slice, index) => {
              const ownerId = slices[slice.id];
              const free = ownerId == null && !locked;
              const claimable = free && canClaim && activePlayer;
              return (
                <path
                  key={slice.id}
                  d={wedgePath(index)}
                  fill={claimable ? 'rgba(255, 255, 255, 0.1)' : 'transparent'}
                  className={claimable
                    ? 'cursor-pointer hover:fill-white/20 transition-[fill] duration-150'
                    : 'pointer-events-none'}
                  onClick={() => {
                    if (claimable) onClaimSlice?.(activePlayer.id, slice.id);
                  }}
                >
                  <title>
                    {claimable
                      ? `Занять: ${slice.hint}`
                      : ownerId != null
                        ? `${slice.label} — ${playerById(ownerId)?.name || ''}`
                        : slice.hint}
                  </title>
                </path>
              );
            })}
          </svg>
        )}
      </div>
    </div>
  );
}
