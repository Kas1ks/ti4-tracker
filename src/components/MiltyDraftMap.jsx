import { useEffect, useMemo, useRef, useState } from 'react';
import { assembleDraftMap, calculateOffsets, BOARD_SIZE } from '../milty/assembleMap.js';
import { tileImageUrl } from '../milty/tiles.js';

/** Intrinsic tile size — desktop scales up to fill width; mobile scales down to fit. */
const TILE_W = 112;
const TILE_H = 97;

/**
 * Assembled milty galaxy: Mecatol + slices on a real hex grid, with hyperlanes for <6 players.
 * Seat rotation is view-only: cycles players around fixed home slots.
 */
export function MiltyDraftMap({ draft }) {
  const seatCount = draft?.playerOrder?.length || 0;
  const [seatOffset, setSeatOffset] = useState(0);
  const assembled = useMemo(
    () => (draft ? assembleDraftMap(draft, { seatOffset }) : null),
    [draft, seatOffset],
  );
  const offsets = useMemo(() => calculateOffsets(TILE_W, TILE_H), []);
  const [zoomId, setZoomId] = useState(null);
  const viewportRef = useRef(null);
  const [scale, setScale] = useState(1);

  useEffect(() => {
    setSeatOffset((prev) => {
      if (seatCount <= 0) return 0;
      return ((prev % seatCount) + seatCount) % seatCount;
    });
  }, [seatCount]);

  const bounds = useMemo(() => {
    if (!assembled) return null;
    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;
    for (let i = 0; i < BOARD_SIZE; i += 1) {
      const cell = assembled.cells[i];
      if (cell.tileId == null && cell.kind === 'empty') continue;
      const [dx, dy] = offsets[i];
      minX = Math.min(minX, dx);
      maxX = Math.max(maxX, dx + TILE_W);
      minY = Math.min(minY, dy);
      maxY = Math.max(maxY, dy + TILE_H);
    }
    if (!Number.isFinite(minX)) {
      minX = -TILE_W;
      maxX = TILE_W;
      minY = -TILE_H;
      maxY = TILE_H;
    }
    const pad = 10;
    return {
      minX,
      minY,
      pad,
      width: maxX - minX + pad * 2,
      height: maxY - minY + pad * 2,
    };
  }, [assembled, offsets]);

  useEffect(() => {
    const el = viewportRef.current;
    if (!el || !bounds) return undefined;

    const update = () => {
      const cw = el.clientWidth;
      const ch = el.clientHeight;
      if (cw < 8 || !bounds.width || !bounds.height) return;
      // Fit both axes so the galaxy sits on one screen (tiny scroll only if needed).
      const availH = ch > 48
        ? ch
        : Math.max(220, window.innerHeight * 0.68);
      const fit = Math.min(cw / bounds.width, availH / bounds.height);
      setScale(Math.max(0.12, fit * 0.98));
    };

    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    window.addEventListener('resize', update);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', update);
    };
  }, [bounds]);

  useEffect(() => {
    if (zoomId == null) return undefined;
    const onPointerDown = (e) => {
      if (e.target?.closest?.('.milty-galaxy__tile')) return;
      setZoomId(null);
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [zoomId]);

  if (!assembled || !bounds) return null;

  const { minX, minY, pad, width, height } = bounds;
  const scaledW = width * scale;
  const scaledH = height * scale;
  const canRotate = seatCount > 1;

  const rotateCw = () => {
    if (!canRotate) return;
    setSeatOffset((prev) => (prev + 1) % seatCount);
    setZoomId(null);
  };
  const rotateCcw = () => {
    if (!canRotate) return;
    setSeatOffset((prev) => (prev - 1 + seatCount) % seatCount);
    setZoomId(null);
  };

  return (
    <div className="milty-galaxy-wrap">
      <div className="milty-galaxy-toolbar" role="toolbar" aria-label="Поворот карты по местам">
        <button
          type="button"
          className="milty-galaxy-rotate"
          onClick={rotateCcw}
          disabled={!canRotate}
          title="Против часовой (сдвиг мест)"
          aria-label="Повернуть карту против часовой стрелки"
        >
          <i className="fa-solid fa-rotate-left" aria-hidden="true" />
          <span>Против</span>
        </button>
        <span className="milty-galaxy-rotate__meta" title="Сдвиг мест относительно Speaker">
          Места
          {seatOffset > 0 ? ` · +${seatOffset}` : ''}
        </span>
        <button
          type="button"
          className="milty-galaxy-rotate"
          onClick={rotateCw}
          disabled={!canRotate}
          title="По часовой (сдвиг мест)"
          aria-label="Повернуть карту по часовой стрелке"
        >
          <i className="fa-solid fa-rotate-right" aria-hidden="true" />
          <span>По час.</span>
        </button>
      </div>

      <div className="milty-galaxy" ref={viewportRef}>
        <div className="milty-galaxy__frame" style={{ width: scaledW, height: scaledH }}>
          <div
            className="milty-galaxy__board"
            style={{
              width,
              height,
              transform: `scale(${scale})`,
            }}
          >
            {assembled.cells.map((cell) => {
              if (cell.tileId == null && cell.kind === 'empty') return null;
              const [dx, dy] = offsets[cell.index];
              const left = dx - minX + pad;
              const top = dy - minY + pad;
              const zoomed = zoomId === cell.index;
              const showLabel = cell.kind === 'home' && cell.playerName;
              return (
                <div
                  key={cell.index}
                  className={`milty-galaxy__tile milty-galaxy__tile--${cell.kind}${zoomed ? ' is-zoomed' : ''}`}
                  style={{ left, top, width: TILE_W, height: TILE_H }}
                  title={cell.tileId != null ? `Система ${cell.tileId}` : undefined}
                  role={cell.tileId != null ? 'button' : undefined}
                  tabIndex={cell.tileId != null ? 0 : undefined}
                  onClick={(e) => {
                    if (cell.tileId == null) return;
                    e.stopPropagation();
                    setZoomId((prev) => (prev === cell.index ? null : cell.index));
                  }}
                  onKeyDown={(e) => {
                    if (cell.tileId == null) return;
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      setZoomId((prev) => (prev === cell.index ? null : cell.index));
                    }
                  }}
                >
                  {cell.tileId != null ? (
                    <img
                      className="milty-galaxy__img"
                      src={tileImageUrl(cell.tileId)}
                      alt=""
                      draggable={false}
                      style={{ transform: `rotate(${(cell.rotation || 0) * 60}deg)` }}
                    />
                  ) : (
                    <span className="milty-galaxy__ph" />
                  )}
                  {cell.tileId != null ? (
                    <span className="milty-galaxy__id">{cell.tileId}</span>
                  ) : null}
                  {showLabel ? (
                    <span className="milty-galaxy__name">{cell.playerName}</span>
                  ) : null}
                  {cell.kind === 'home' && cell.seatIndex === 0 ? (
                    <span className="milty-galaxy__spk">Spk</span>
                  ) : null}
                  {cell.tileId != null ? (
                    <img
                      className="milty-galaxy__zoom"
                      src={tileImageUrl(cell.tileId)}
                      alt=""
                      draggable={false}
                      style={{ transform: `translate(-50%, -50%) rotate(${(cell.rotation || 0) * 60}deg)` }}
                    />
                  ) : null}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
