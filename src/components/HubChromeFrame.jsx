/**
 * HUD lines traced from the AI reference image crops:
 *
 * TOP (desktop): left logo bay + high rail + right bay (45° troughs).
 * TOP (mobile): left logo bay + high rail to the right edge (no right bay).
 *      Dual parallel accent on segments. No separate top edge strip.
 * BOTTOM: high end stubs, 45° down into a center trough under the dock.
 *      Dual parallel accent + hotspots at joints.
 */

function HudFilters({ id }) {
  return (
    <defs>
      <linearGradient id={`${id}-core`} x1="0%" y1="0%" x2="100%" y2="0%">
        <stop offset="0%" stopColor="#c48a1a" />
        <stop offset="20%" stopColor="#f0c45a" />
        <stop offset="50%" stopColor="#ffe7a0" />
        <stop offset="80%" stopColor="#f0c45a" />
        <stop offset="100%" stopColor="#c48a1a" />
      </linearGradient>
      <filter id={`${id}-bloom`} x="-40%" y="-400%" width="180%" height="900%" colorInterpolationFilters="sRGB">
        <feGaussianBlur in="SourceGraphic" stdDeviation="1.6" result="b" />
        <feMerge>
          <feMergeNode in="b" />
          <feMergeNode in="SourceGraphic" />
        </feMerge>
      </filter>
    </defs>
  );
}

function Hotspot({ x, y }) {
  return (
    <g>
      <circle cx={x} cy={y} r="3.2" fill="rgba(255, 200, 80, 0.35)" />
      <circle cx={x} cy={y} r="1.7" fill="#ffe7a0" />
      <circle cx={x} cy={y} r="0.7" fill="#fff8e8" />
    </g>
  );
}

/** Full-width top HUD wire — matches reference top crop geometry. */
function TopHudArt() {
  const id = 'hubTop';
  /*
    viewBox 0 0 1440 96
    High rail y=18
    Bay floor y=58 (logo / menu trough)
    Bay width ~ 280px left, ~220px right
    Chamfer = 28px horizontal → 28px vertical (45°)
  */
  const yHi = 18;
  const yLo = 58;
  const cut = 28;
  const leftBayL = 36;
  const leftBayR = 320;
  const rightBayL = 1180;
  const rightBayR = 1404;

  // Left bay (logo) → high rail → right bay (mirror)
  const main = [
    `M ${leftBayL} ${yHi}`,
    `L ${leftBayL + cut} ${yLo}`,
    `L ${leftBayR - cut} ${yLo}`,
    `L ${leftBayR} ${yHi}`,
    `L ${rightBayL} ${yHi}`,
    `L ${rightBayL + cut} ${yLo}`,
    `L ${rightBayR - cut} ${yLo}`,
    `L ${rightBayR} ${yHi}`,
  ].join(' ');

  const yHi2 = yHi + 9;
  const yLo2 = yLo + 8;
  const inset = 10;
  const inner = [
    `M ${leftBayL + inset} ${yHi2}`,
    `L ${leftBayL + cut + inset * 0.3} ${yLo2}`,
    `L ${leftBayR - cut - inset * 0.3} ${yLo2}`,
    `L ${leftBayR - inset} ${yHi2}`,
    `L ${rightBayL + inset} ${yHi2}`,
    `L ${rightBayL + cut + inset * 0.3} ${yLo2}`,
    `L ${rightBayR - cut - inset * 0.3} ${yLo2}`,
    `L ${rightBayR - inset} ${yHi2}`,
  ].join(' ');

  return (
    <svg className="hub-hud-art hub-hud-art--top" viewBox="0 0 1440 96" preserveAspectRatio="none" aria-hidden="true">
      <HudFilters id={id} />
      <g fill="none" strokeLinecap="square" strokeLinejoin="miter" filter={`url(#${id}-bloom)`}>
        <path d={main} stroke="rgba(196,138,26,0.45)" strokeWidth="3.2" />
        <path d={main} stroke={`url(#${id}-core)`} strokeWidth="1.45" />
        <path d={inner} stroke="rgba(255,231,160,0.28)" strokeWidth="1" />
      </g>
      <g filter={`url(#${id}-bloom)`}>
        <Hotspot x={leftBayL} y={yHi} />
        <Hotspot x={leftBayL + cut} y={yLo} />
        <Hotspot x={leftBayR - cut} y={yLo} />
        <Hotspot x={leftBayR} y={yHi} />
        <Hotspot x={rightBayL} y={yHi} />
        <Hotspot x={rightBayL + cut} y={yLo} />
        <Hotspot x={rightBayR - cut} y={yLo} />
        <Hotspot x={rightBayR} y={yHi} />
      </g>
    </svg>
  );
}

/** Mobile top HUD — left logo bay, then clean high rail (no empty right bay). */
function TopHudArtMobile() {
  const id = 'hubTopM';
  /*
    viewBox 0 0 390 64 — designed for phone width, not stretched desktop art
    High rail y=12
    Bay floor y=42
    Logo bay ~ 12–168 (~40% width)
  */
  const yHi = 12;
  const yLo = 42;
  const cut = 14;
  const leftBayL = 10;
  const leftBayR = 168;
  const railEnd = 380;

  const main = [
    `M ${leftBayL} ${yHi}`,
    `L ${leftBayL + cut} ${yLo}`,
    `L ${leftBayR - cut} ${yLo}`,
    `L ${leftBayR} ${yHi}`,
    `L ${railEnd} ${yHi}`,
  ].join(' ');

  const yHi2 = yHi + 7;
  const yLo2 = yLo + 6;
  const inset = 7;
  const inner = [
    `M ${leftBayL + inset} ${yHi2}`,
    `L ${leftBayL + cut + inset * 0.25} ${yLo2}`,
    `L ${leftBayR - cut - inset * 0.25} ${yLo2}`,
    `L ${leftBayR - inset} ${yHi2}`,
    `L ${railEnd - inset} ${yHi2}`,
  ].join(' ');

  return (
    <svg className="hub-hud-art hub-hud-art--top-mobile" viewBox="0 0 390 64" preserveAspectRatio="none" aria-hidden="true">
      <HudFilters id={id} />
      <g fill="none" strokeLinecap="square" strokeLinejoin="miter" filter={`url(#${id}-bloom)`}>
        <path d={main} stroke="rgba(196,138,26,0.5)" strokeWidth="2.6" />
        <path d={main} stroke={`url(#${id}-core)`} strokeWidth="1.3" />
        <path d={inner} stroke="rgba(255,231,160,0.3)" strokeWidth="0.9" />
      </g>
      <g filter={`url(#${id}-bloom)`}>
        <Hotspot x={leftBayL} y={yHi} />
        <Hotspot x={leftBayL + cut} y={yLo} />
        <Hotspot x={leftBayR - cut} y={yLo} />
        <Hotspot x={leftBayR} y={yHi} />
        <Hotspot x={railEnd} y={yHi} />
      </g>
    </svg>
  );
}

/** Full-width bottom HUD wire — high ends, center trough under dock. */
function BottomHudArt() {
  const id = 'hubBot';
  /*
    viewBox 0 0 1440 72
    End stubs y=16 (high)
    Center trough floor y=48
    Steps near left/right ends
  */
  const yHi = 16;
  const yLo = 48;
  const cut = 26;
  const leftStep = 160;
  const rightStep = 1280;

  // High left stub → down into center trough → up to high right stub
  const main = [
    `M 40 ${yHi}`,
    `L ${leftStep} ${yHi}`,
    `L ${leftStep + cut} ${yLo}`,
    `L ${rightStep - cut} ${yLo}`,
    `L ${rightStep} ${yHi}`,
    `L 1400 ${yHi}`,
  ].join(' ');

  const yHi2 = yHi + 9;
  const yLo2 = yLo + 8;
  const inner = [
    `M 52 ${yHi2}`,
    `L ${leftStep + 4} ${yHi2}`,
    `L ${leftStep + cut + 4} ${yLo2}`,
    `L ${rightStep - cut - 4} ${yLo2}`,
    `L ${rightStep - 4} ${yHi2}`,
    `L 1388 ${yHi2}`,
  ].join(' ');

  return (
    <svg className="hub-hud-art hub-hud-art--bottom" viewBox="0 0 1440 72" preserveAspectRatio="none" aria-hidden="true">
      <HudFilters id={id} />
      <g fill="none" strokeLinecap="square" strokeLinejoin="miter" filter={`url(#${id}-bloom)`}>
        <path d={main} stroke="rgba(196,138,26,0.4)" strokeWidth="3.2" />
        <path d={main} stroke={`url(#${id}-core)`} strokeWidth="1.45" />
        <path d={inner} stroke="rgba(255,231,160,0.26)" strokeWidth="1" />
      </g>
      <g filter={`url(#${id}-bloom)`}>
        <Hotspot x={leftStep} y={yHi} />
        <Hotspot x={leftStep + cut} y={yLo} />
        <Hotspot x={rightStep - cut} y={yLo} />
        <Hotspot x={rightStep} y={yHi} />
      </g>
    </svg>
  );
}

export function HubHudTop({ children }) {
  return (
    <header className="hub-hud hub-hud--top">
      <TopHudArt />
      <TopHudArtMobile />
      <div className="hub-hud-content">{children}</div>
    </header>
  );
}

export function HubHudBottom() {
  return (
    <div className="hub-hud hub-hud--bottom" aria-hidden="true">
      <BottomHudArt />
    </div>
  );
}

export function HubChromeFrame() {
  return null;
}
