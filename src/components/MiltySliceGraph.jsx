import { useEffect, useState } from 'react';
import { tileImageUrl } from '../milty/tiles.js';

function SliceTile({ id, index, zoomed, onToggleZoom }) {
  return (
    <span
      className={`milty-slice-graph__tile milty-slice-graph__tile--${index}${zoomed ? ' is-zoomed' : ''}`}
      role="button"
      tabIndex={0}
      aria-label={`Система ${id}`}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onToggleZoom(index);
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          e.stopPropagation();
          onToggleZoom(index);
        }
      }}
    >
      <img
        className="milty-slice-graph__tile-img"
        src={tileImageUrl(id)}
        alt=""
        loading="lazy"
        draggable={false}
      />
      <img
        className="milty-slice-graph__zoom"
        src={tileImageUrl(id)}
        alt=""
        draggable={false}
      />
    </span>
  );
}

/**
 * Hex layout for a milty slice (5 systems + home placeholder), matching miltydraft positions.
 * Desktop: hover enlarges a system. Mobile: tap toggles enlarge.
 */
export function MiltySliceGraph({ tileIds = [], homeTileId = 0, className = '' }) {
  const [zoomedIndex, setZoomedIndex] = useState(null);

  useEffect(() => {
    if (zoomedIndex == null) return undefined;
    const onPointerDown = (e) => {
      if (e.target?.closest?.('.milty-slice-graph__tile')) return;
      setZoomedIndex(null);
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [zoomedIndex]);

  const toggleZoom = (index) => {
    setZoomedIndex((prev) => (prev === index ? null : index));
  };

  return (
    <div className={`milty-slice-graph ${className}`.trim()}>
      <div className="milty-slice-graph__wrap">
        {tileIds.map((id, i) => (
          <SliceTile
            key={`${id}-${i}`}
            id={id}
            index={i}
            zoomed={zoomedIndex === i}
            onToggleZoom={toggleZoom}
          />
        ))}
        <SliceTile
          id={homeTileId}
          index="h"
          zoomed={zoomedIndex === 'h'}
          onToggleZoom={toggleZoom}
        />
      </div>
    </div>
  );
}
