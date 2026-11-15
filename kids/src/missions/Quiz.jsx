// AI-assisted: written with Claude (Anthropic) and reviewed by Luana Santos. See AI_DISCLOSURE.md.
import { useState } from 'react';
import { useKids } from '../App.jsx';
import { DATA } from '../lib/data.js';
import { kidNumber } from '../lib/lang.js';
import { MissionNav } from '../components/Frame.jsx';

/**
 * Five questions about the missions. Answers are checked at once; the score is shown on this screen
 * only and is never saved or sent anywhere. Numbers in the questions come from kids-data.json.
 */
export default function Quiz() {
  const { t, lang, go } = useKids();
  const [q, setQ] = useState(0);
  const [picked, setPicked] = useState(null);
  const [right, setRight] = useState(0);
  const questions = t('quiz.questions');
  const vars = {
    night: kidNumber(DATA.sites.im2_athena.kids.night_days, lang),
    sunniest: t(`sites.${DATA.sunniest[0]}.short`),
  };
  const fill = (s) => s.replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? `{${k}}`);
  const done = q >= questions.length;
  const cur = done ? null : questions[q];

  const choose = (i) => {
    if (picked !== null) return;
    setPicked(i);
    if (i === cur.answer) setRight((r) => r + 1);
  };
  const next = () => { setPicked(null); setQ((x) => x + 1); };

  return (
    <div className="stack">
      <div className="stack" style={{ gap: 8 }}>
        <p className="kicker">{t('quiz.kicker')}</p>
        <h1>{t('quiz.title')}</h1>
        {!done && <p>{t('quiz.progress', { n: q + 1, total: questions.length })}</p>}
      </div>

      {!done && (
        <section className="card stack" aria-labelledby="quiz-q">
          <h2 id="quiz-q" style={{ fontSize: 26 }}>{fill(cur.q)}</h2>
          <div className="choices" role="group" aria-labelledby="quiz-q">
            {cur.options.map((o, i) => {
              const cls = picked === null ? '' : i === cur.answer ? 'right' : i === picked ? 'wrong' : '';
              return (
                <button key={o} type="button" className={`btn ghost choice ${cls}`} aria-pressed={picked !== null && (i === picked || i === cur.answer)} onClick={() => choose(i)} disabled={picked !== null && i !== picked && i !== cur.answer}>
                  {fill(o)}
                </button>
              );
            })}
          </div>
          <p className="feedback" aria-live="polite">
            {picked !== null && (picked === cur.answer ? <span className="yes" style={{ color: 'var(--good)' }}>{t('quiz.right')} {fill(cur.why)}</span> : <span style={{ color: 'var(--bad)' }}>{t('quiz.wrong')} {fill(cur.why)}</span>)}
          </p>
          {picked !== null && <button type="button" className="btn" style={{ alignSelf: 'flex-start' }} onClick={next}>{q + 1 < questions.length ? t('quiz.next') : t('quiz.finish')} →</button>}
        </section>
      )}

      {done && (
        <section className="card stack" aria-labelledby="quiz-done">
          <h2 id="quiz-done">{t('quiz.doneTitle')}</h2>
          <p className="big-number" aria-live="polite">{t('quiz.score', { n: right, total: questions.length })}</p>
          <p>{t('quiz.doneText')}</p>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <a className="btn" href="#/certificate" onClick={(e) => { e.preventDefault(); go('/certificate'); }}>{t('quiz.certificate')} →</a>
            <button type="button" className="btn ghost" onClick={() => { setQ(0); setPicked(null); setRight(0); }}>{t('quiz.again')}</button>
          </div>
        </section>
      )}

      <MissionNav />
    </div>
  );
}
