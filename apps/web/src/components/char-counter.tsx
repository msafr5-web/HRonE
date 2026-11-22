/** Bootstrap-progress character counter: teal → gold (≥90%) → red (at limit). */
export function CharCounter({ length, max, min }: { length: number; max: number; min?: number }) {
  const pct = Math.min(100, Math.round((length / max) * 100));
  const level = length >= max ? 'max' : pct >= 90 ? 'warn' : 'ok';
  return (
    <div className="hr-counter" data-level={level}>
      <div className="progress" role="progressbar" aria-label="عدد الأحرف" aria-valuemin={0} aria-valuemax={max} aria-valuenow={length}>
        <div className="progress-bar" style={{ width: `${pct}%` }} />
      </div>
      <p className="mt-1 text-xs text-mute">
        {length.toLocaleString('ar-SA')} / {max.toLocaleString('ar-SA')}
        {min && length < min ? ` — ${min.toLocaleString('ar-SA')} حرفاً على الأقل` : ''}
      </p>
    </div>
  );
}
