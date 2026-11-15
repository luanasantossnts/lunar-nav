// AI-assisted: written with Claude (Anthropic) and reviewed by Luana Santos. See AI_DISCLOSURE.md.
import { describe, it, expect } from 'vitest';
import { parseBlocks, parseInline, stripMarkdown } from './markdown.jsx';

const SAMPLE = `**Conclusão:** Shackleton é melhor [2].

| 01–31/07/2030 | Shackleton | Athena |
|---|---|---|
| Sol (fração / h) | 1,0 / 720 h [2] | 0,5457 / 392,88 h [2] |

**Trade-off:**
- **Shackleton:** Sol contínuo [2].
- Athena: noite de 231,3 h.

1. um
2. dois`;

describe('markdown', () => {
  it('parses paragraph, table, lists', () => {
    const b = parseBlocks(SAMPLE);
    expect(b.map((x) => x.type)).toEqual(['p', 'table', 'p', 'ul', 'ol']);
    expect(b[1].head).toEqual(['01–31/07/2030', 'Shackleton', 'Athena']);
    expect(b[1].rows[0][2]).toBe('0,5457 / 392,88 h [2]');
    expect(b[3].items).toHaveLength(2);
  });
  it('parses bold and citations inline', () => {
    const t = parseInline('**Conclusão:** ok [12] and `code`');
    expect(t.map((x) => x.t)).toEqual(['b', 'text', 'cite', 'text', 'code']);
    expect(t[2].n).toBe(12);
  });
  it('strips markup for speech', () => {
    const s = stripMarkdown(SAMPLE);
    expect(s).not.toMatch(/\*\*|\||\[\d+\]/);
    expect(s).toContain('Conclusão: Shackleton é melhor.');
  });
  it('treats raw HTML as text', () => {
    expect(parseInline('<img src=x onerror=alert(1)>')[0]).toEqual({ t: 'text', v: '<img src=x onerror=alert(1)>' });
  });
});
