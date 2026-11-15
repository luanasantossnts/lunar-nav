// AI-assisted: written with Claude (Anthropic) and reviewed by Luana Santos. See AI_DISCLOSURE.md.
/**
 * Minimal, safe Markdown for analyst answers: headings, paragraphs, bullet and
 * numbered lists, tables, rules, **bold**, *italic*, `code`, and [n] citations.
 * Builds React elements only — never injects HTML.
 */

const isTableRow = (l) => /^\s*\|.*\|\s*$/.test(l);
const isTableSep = (l) => /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$/.test(l);
const cells = (l) => l.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map((c) => c.trim());

/** Parses Markdown text into a list of blocks. Exported for tests. */
export function parseBlocks(text) {
  const lines = String(text || '').replace(/\r\n?/g, '\n').split('\n');
  const blocks = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim()) { i++; continue; }
    let m;
    if ((m = line.match(/^\s*(#{1,6})\s+(.*)$/))) {
      blocks.push({ type: 'h', level: m[1].length, text: m[2].replace(/\s*#+\s*$/, '') }); i++; continue;
    }
    if (/^\s*([-*_])\s*(\1\s*){2,}$/.test(line)) { blocks.push({ type: 'hr' }); i++; continue; }
    if (isTableRow(line) && i + 1 < lines.length && isTableSep(lines[i + 1])) {
      const head = cells(line); const rows = []; i += 2;
      while (i < lines.length && isTableRow(lines[i])) { rows.push(cells(lines[i])); i++; }
      blocks.push({ type: 'table', head, rows }); continue;
    }
    if (/^\s*[-*•]\s+/.test(line)) {
      const items = [];
      while (i < lines.length && /^\s*[-*•]\s+/.test(lines[i])) { items.push(lines[i].replace(/^\s*[-*•]\s+/, '')); i++; }
      blocks.push({ type: 'ul', items }); continue;
    }
    if (/^\s*\d+[.)]\s+/.test(line)) {
      const items = [];
      while (i < lines.length && /^\s*\d+[.)]\s+/.test(lines[i])) { items.push(lines[i].replace(/^\s*\d+[.)]\s+/, '')); i++; }
      blocks.push({ type: 'ol', items }); continue;
    }
    const para = [];
    while (i < lines.length && lines[i].trim() && !/^\s*(#{1,6}\s|[-*•]\s|\d+[.)]\s)/.test(lines[i]) && !(isTableRow(lines[i]) && isTableSep(lines[i + 1] || ''))) {
      para.push(lines[i].trim()); i++;
    }
    blocks.push({ type: 'p', text: para.join('\n') });
  }
  return blocks;
}

/** Splits inline text into tokens. Exported for tests. */
export function parseInline(text) {
  const out = [];
  const re = /(\*\*([^*]+)\*\*|__([^_]+)__|`([^`]+)`|\*([^*\s][^*]*?)\*|\[(\d+)\])/g;
  let last = 0; let m;
  const s = String(text || '');
  while ((m = re.exec(s))) {
    if (m.index > last) out.push({ t: 'text', v: s.slice(last, m.index) });
    if (m[2] || m[3]) out.push({ t: 'b', v: m[2] || m[3] });
    else if (m[4]) out.push({ t: 'code', v: m[4] });
    else if (m[5]) out.push({ t: 'i', v: m[5] });
    else out.push({ t: 'cite', n: Number(m[6]) });
    last = re.lastIndex;
  }
  if (last < s.length) out.push({ t: 'text', v: s.slice(last) });
  return out;
}

/** Plain text for speech and exports: markup removed, citations dropped. */
export function stripMarkdown(text) {
  return parseBlocks(text).map((b) => {
    const flat = (x) => parseInline(x).map((t) => (t.t === 'cite' ? '' : t.v)).join('').replace(/\s+([.,;:])/g, '$1');
    if (b.type === 'hr') return '';
    if (b.type === 'table') return [b.head, ...b.rows].map((r) => r.map(flat).join(', ')).join('.\n');
    if (b.type === 'ul' || b.type === 'ol') return b.items.map(flat).join('.\n');
    return flat(b.text);
  }).filter(Boolean).join('\n\n');
}

function Inline({ text, onCite }) {
  return parseInline(text).map((tok, i) => {
    if (tok.t === 'b') return <strong key={i} className="font-semibold text-ink"><Inline text={tok.v} onCite={onCite} /></strong>;
    if (tok.t === 'i') return <em key={i}>{tok.v}</em>;
    if (tok.t === 'code') return <code key={i} className="font-mono text-[0.9em] px-1 bg-bg2 border border-line">{tok.v}</code>;
    if (tok.t === 'cite') {
      return (
        <button key={i} type="button" onClick={() => onCite?.(tok.n)} aria-label={`Tool call ${tok.n}`}
          className="align-super text-[10px] leading-none font-mono text-dim hover:text-ink px-0.5">{tok.n}</button>
      );
    }
    return tok.v.split('\n').map((seg, j, a) => <span key={`${i}-${j}`}>{seg}{j < a.length - 1 && <br />}</span>);
  });
}

const numeric = (s) => /^[\s\d.,%+−\-–/hº°:Z]+$/.test(s.replace(/\[\d+\]/g, '')) && /\d/.test(s);

export function Markdown({ text, onCite }) {
  const blocks = parseBlocks(text);
  return (
    <div className="flex flex-col gap-3 text-[15px] leading-relaxed text-ink">
      {blocks.map((b, i) => {
        if (b.type === 'h') {
          const cls = b.level <= 2 ? 'text-[16px] font-semibold text-ink mt-1' : 'text-[13px] font-semibold text-muted uppercase tracking-wide mt-1';
          return <p key={i} role="heading" aria-level={Math.min(b.level + 2, 6)} className={`m-0 ${cls}`}><Inline text={b.text} onCite={onCite} /></p>;
        }
        if (b.type === 'hr') return <hr key={i} className="border-0 border-t border-line m-0" />;
        if (b.type === 'ul' || b.type === 'ol') {
          const Tag = b.type;
          return (
            <Tag key={i} className={`m-0 pl-5 flex flex-col gap-1 ${b.type === 'ul' ? 'list-disc' : 'list-decimal'} marker:text-dim`}>
              {b.items.map((it, j) => <li key={j}><Inline text={it} onCite={onCite} /></li>)}
            </Tag>
          );
        }
        if (b.type === 'table') {
          return (
            <div key={i} className="overflow-x-auto border border-line">
              <table className="w-full border-collapse text-[13px]">
                <thead>
                  <tr className="bg-bg2">
                    {b.head.map((h, j) => <th key={j} scope="col" className="text-left font-medium text-muted px-3 py-2 border-b border-line whitespace-nowrap"><Inline text={h} onCite={onCite} /></th>)}
                  </tr>
                </thead>
                <tbody>
                  {b.rows.map((r, j) => (
                    <tr key={j} className="border-b border-line last:border-b-0">
                      {b.head.map((_, k) => {
                        const c = r[k] ?? '';
                        return (
                          <td key={k} className={`px-3 py-2 align-top ${k === 0 ? 'text-text2' : 'font-mono tabular'} ${k > 0 && numeric(c) ? 'whitespace-nowrap' : ''}`}>
                            <Inline text={c} onCite={onCite} />
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          );
        }
        return <p key={i} className="m-0"><Inline text={b.text} onCite={onCite} /></p>;
      })}
    </div>
  );
}
