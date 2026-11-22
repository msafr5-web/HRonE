import { Fragment, type ReactNode } from 'react';
import { LABOR_ARTICLES, LABOR_DISCLAIMER, toWesternDigits } from '@/lib/labor-articles';

// «المادة 77» / «مادة (80)» / «المادة ٨١» — Arabic-Indic digits supported.
const RE = /((?:ال)?مادة)\s*[(\[]?\s*([0-9٠-٩]{1,3})\s*[)\]]?/g;

/**
 * Renders plain text, turning known Saudi Labor Law article mentions into popover triggers
 * (Bootstrap popover, initialised by <BootstrapClient/>). Unknown articles stay plain text.
 * Use only where the text is NOT already inside a link/button (no nested interactive elements).
 */
export function RichText({ text }: { text: string }): ReactNode {
  const out: ReactNode[] = [];
  let last = 0;
  let m: RegExpExecArray | null;
  RE.lastIndex = 0;
  while ((m = RE.exec(text))) {
    const art = LABOR_ARTICLES[Number(toWesternDigits(m[2]))];
    if (!art) continue;
    if (m.index > last) out.push(text.slice(last, m.index));
    out.push(
      <span
        key={`${m.index}-${m[2]}`}
        className="labor-ref"
        role="button"
        tabIndex={0}
        data-labor-article={toWesternDigits(m[2])}
        data-bs-toggle="popover"
        data-bs-title={art.title}
        data-bs-content={`${art.summary} — ${LABOR_DISCLAIMER}`}
      >
        {m[0]}
      </span>,
    );
    last = m.index + m[0].length;
  }
  if (last === 0) return text;
  if (last < text.length) out.push(text.slice(last));
  return <Fragment>{out}</Fragment>;
}
