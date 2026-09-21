import { TECH_COLOR_META } from '../data/technologies';

/** Single tech-type icon (biotic / propulsion / cybernetic / warfare). */
export function TechTypeIcon({ color, size = 16, className = '', title }) {
  const meta = TECH_COLOR_META[color];
  if (!meta?.icon) return null;
  const px = typeof size === 'number' ? `${size}px` : size;
  return (
    <img
      src={meta.icon}
      alt={title || meta.label}
      title={title || meta.label}
      width={typeof size === 'number' ? size : undefined}
      height={typeof size === 'number' ? size : undefined}
      className={`inline-block object-contain flex-shrink-0 ${className}`}
      style={{ width: px, height: px }}
      draggable={false}
    />
  );
}

/** Row of prereq icons (one icon per required color pip). */
export function TechPrereqIcons({ prereqs = [], size = 14, className = '' }) {
  if (!prereqs.length) return null;
  return (
    <span className={`inline-flex items-center gap-0.5 ${className}`} title="Пререквизиты">
      {prereqs.map((color, idx) => (
        <TechTypeIcon key={`${color}-${idx}`} color={color} size={size} />
      ))}
    </span>
  );
}
