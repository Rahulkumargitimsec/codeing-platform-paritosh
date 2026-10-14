// Small, safe renderers (no dangerouslySetInnerHTML)

// "10^5" -> 10<sup>5</sup>, `code` -> <code>
function inline(text, keyBase = '') {
  const parts = [];
  const re = /(`[^`]+`|\*\*[^*]+\*\*|\b\d+\^-?\d+\b)/g;
  let last = 0, m, i = 0;
  while ((m = re.exec(text))) {
    if (m.index > last) parts.push(text.slice(last, m.index));
    const t = m[0];
    const k = `${keyBase}-${i++}`;
    if (t.startsWith('`')) parts.push(<code key={k}>{t.slice(1, -1)}</code>);
    else if (t.startsWith('**')) parts.push(<strong key={k}>{t.slice(2, -2)}</strong>);
    else { const [b, e] = t.split('^'); parts.push(<span key={k}>{b}<sup>{e}</sup></span>); }
    last = m.index + t.length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return parts;
}

const HEADINGS = /^(input format|output format|input|output|constraints|example|examples|note|notes|follow[- ]up):?$/i;

// Problem statements: blank-line paragraphs, short "Constraints"-style lines become headings
export function ProblemText({ text = '' }) {
  const blocks = String(text).replace(/\r\n/g, '\n').split(/\n{2,}/);
  return (
    <div className="prose-problem">
      {blocks.map((block, bi) => {
        const lines = block.split('\n');
        if (HEADINGS.test(lines[0].trim())) {
          return (
            <div key={bi}>
              <h3>{lines[0].trim().replace(/:$/, '')}</h3>
              {lines.length > 1 && (
                <ul className="list-none p-0 m-0 mb-3 space-y-1">
                  {lines.slice(1).map((l, li) => <li key={li} className="text-ink-2">{inline(l, `${bi}-${li}`)}</li>)}
                </ul>
              )}
            </div>
          );
        }
        return (
          <p key={bi}>
            {lines.map((l, li) => <span key={li}>{li > 0 && <br />}{inline(l, `${bi}-${li}`)}</span>)}
          </p>
        );
      })}
    </div>
  );
}

// Chat messages: fenced code blocks, inline code, bold, paragraphs
export function ChatText({ text = '' }) {
  const segments = String(text).split(/```/);
  return (
    <div className="space-y-2">
      {segments.map((seg, i) => {
        if (i % 2 === 1) {
          const body = seg.replace(/^[a-zA-Z+#]*\n/, '');
          return <pre key={i} className="code-block text-[0.78rem] max-h-72">{body.replace(/\n$/, '')}</pre>;
        }
        return seg.split(/\n{2,}/).filter((p) => p.trim()).map((p, j) => (
          <p key={`${i}-${j}`} className="whitespace-pre-wrap">{inline(p.trim(), `${i}-${j}`)}</p>
        ));
      })}
    </div>
  );
}
