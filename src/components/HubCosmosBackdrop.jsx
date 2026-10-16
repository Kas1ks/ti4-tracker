import { useEffect, useRef } from 'react';

/**
 * Living hub sky: locked HQ photo + canvas life (stars, dust, meteors)
 * + soft dawn pulse / mouse parallax on glow only.
 */
export function HubCosmosBackdrop() {
  const rootRef = useRef(null);
  const canvasRef = useRef(null);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return undefined;

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduceMotion) return undefined;

    const onMove = (e) => {
      const nx = (e.clientX / Math.max(window.innerWidth, 1) - 0.5) * 2;
      const ny = (e.clientY / Math.max(window.innerHeight, 1) - 0.5) * 2;
      root.style.setProperty('--hub-mx', nx.toFixed(3));
      root.style.setProperty('--hub-my', ny.toFixed(3));
    };
    window.addEventListener('pointermove', onMove, { passive: true });
    return () => window.removeEventListener('pointermove', onMove);
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;

    const ctx = canvas.getContext('2d', { alpha: true });
    if (!ctx) return undefined;

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let raf = 0;
    let stars = [];
    let dust = [];
    let meteors = [];
    let nextMeteorAt = 0;
    let w = 0;
    let h = 0;
    let dpr = 1;

    const seed = () => {
      const starCount = Math.min(160, Math.floor((w * h) / 12000));
      stars = Array.from({ length: starCount }, () => {
        const bright = Math.random() > 0.88;
        return {
          x: Math.random() * w * 0.78,
          y: Math.random() * h,
          r: bright ? Math.random() * 1.6 + 0.9 : Math.random() * 1.1 + 0.2,
          base: bright ? Math.random() * 0.35 + 0.45 : Math.random() * 0.4 + 0.12,
          speed: Math.random() * 2.2 + 0.6,
          phase: Math.random() * Math.PI * 2,
          warm: Math.random() > 0.72,
          spike: bright,
        };
      });

      const dustCount = Math.min(55, Math.floor((w * h) / 35000));
      dust = Array.from({ length: dustCount }, () => ({
        x: Math.random() * w,
        y: Math.random() * h,
        r: Math.random() * 2.2 + 0.6,
        vx: (Math.random() - 0.35) * 0.08,
        vy: (Math.random() - 0.5) * 0.04,
        a: Math.random() * 0.12 + 0.04,
        phase: Math.random() * Math.PI * 2,
      }));

      meteors = [];
      nextMeteorAt = performance.now() + 2500 + Math.random() * 4000;
    };

    const spawnMeteor = (now) => {
      const fromTop = Math.random() > 0.35;
      meteors.push({
        x: fromTop ? Math.random() * w * 0.7 : -20,
        y: fromTop ? -20 : Math.random() * h * 0.45,
        vx: 3.2 + Math.random() * 2.4,
        vy: 1.6 + Math.random() * 1.4,
        life: 0,
        maxLife: 48 + Math.floor(Math.random() * 28),
        len: 40 + Math.random() * 50,
      });
      nextMeteorAt = now + 4500 + Math.random() * 9000;
    };

    const resize = () => {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = window.innerWidth;
      h = window.innerHeight;
      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      seed();
      if (reduceMotion) paint(0);
    };

    const paint = (t) => {
      ctx.clearRect(0, 0, w, h);

      for (const s of stars) {
        const twinkle = reduceMotion
          ? s.base
          : s.base * (0.35 + 0.65 * (0.5 + 0.5 * Math.sin(t * 0.0015 * s.speed + s.phase)));
        const color = s.warm
          ? `rgba(255, 220, 170, ${twinkle})`
          : `rgba(230, 240, 255, ${twinkle})`;

        if (s.spike && twinkle > 0.55) {
          const arm = s.r * (2.8 + twinkle * 2);
          ctx.strokeStyle = color;
          ctx.lineWidth = 0.7;
          ctx.beginPath();
          ctx.moveTo(s.x - arm, s.y);
          ctx.lineTo(s.x + arm, s.y);
          ctx.moveTo(s.x, s.y - arm);
          ctx.lineTo(s.x, s.y + arm);
          ctx.stroke();
        }

        ctx.beginPath();
        ctx.fillStyle = color;
        ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
        ctx.fill();
      }

      if (!reduceMotion) {
        for (const d of dust) {
          d.x += d.vx;
          d.y += d.vy;
          if (d.x < -10) d.x = w + 10;
          if (d.x > w + 10) d.x = -10;
          if (d.y < -10) d.y = h + 10;
          if (d.y > h + 10) d.y = -10;
          const pulse = d.a * (0.7 + 0.3 * Math.sin(t * 0.0008 + d.phase));
          ctx.beginPath();
          ctx.fillStyle = `rgba(255, 210, 150, ${pulse})`;
          ctx.arc(d.x, d.y, d.r, 0, Math.PI * 2);
          ctx.fill();
        }

        if (t >= nextMeteorAt) spawnMeteor(t);

        meteors = meteors.filter((m) => {
          m.life += 1;
          m.x += m.vx;
          m.y += m.vy;
          const fade = 1 - m.life / m.maxLife;
          if (fade <= 0) return false;
          const tx = m.x - m.vx * (m.len / 8);
          const ty = m.y - m.vy * (m.len / 8);
          const grad = ctx.createLinearGradient(tx, ty, m.x, m.y);
          grad.addColorStop(0, 'rgba(255,240,210,0)');
          grad.addColorStop(1, `rgba(255,230,180,${0.85 * fade})`);
          ctx.strokeStyle = grad;
          ctx.lineWidth = 1.6;
          ctx.beginPath();
          ctx.moveTo(tx, ty);
          ctx.lineTo(m.x, m.y);
          ctx.stroke();
          ctx.beginPath();
          ctx.fillStyle = `rgba(255,255,255,${fade})`;
          ctx.arc(m.x, m.y, 1.4, 0, Math.PI * 2);
          ctx.fill();
          return true;
        });
      }
    };

    const loop = (t) => {
      paint(t);
      raf = requestAnimationFrame(loop);
    };

    resize();
    window.addEventListener('resize', resize);
    if (!reduceMotion) raf = requestAnimationFrame(loop);
    else paint(0);

    return () => {
      window.removeEventListener('resize', resize);
      cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <div ref={rootRef} className="hub-cosmos" aria-hidden="true">
      <div className="hub-cosmos-nebula">
        <img
          src="/hub/cosmos.png?v=7"
          alt=""
          width={1983}
          height={793}
          decoding="async"
          fetchPriority="high"
          draggable={false}
        />
      </div>
      <div className="hub-cosmos-aurora" />
      <canvas ref={canvasRef} className="hub-cosmos-stars-canvas" />
      <div className="hub-cosmos-glow" />
      <div className="hub-cosmos-veil" />
    </div>
  );
}
