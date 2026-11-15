// AI-assisted: written with Claude (Anthropic) and reviewed by Luana Santos. See AI_DISCLOSURE.md.
import { useState } from 'react';
import { useKids } from '../App.jsx';
import { DATA } from '../lib/data.js';
import { kidNumber } from '../lib/lang.js';
import { MissionBar } from '../components/Frame.jsx';

const LETTERS = ['A', 'B', 'C', 'D'];

/** Certificate seal: the Sun, Earth, the arc of the lunar horizon and a coral star. */
function Seal() {
  return (
    <svg className="seal" viewBox="0 0 120 120" aria-hidden="true" focusable="false">
      <circle cx="60" cy="60" r="56" fill="#1e1b52" />
      <circle cx="42" cy="46" r="20" fill="#ffc94a" opacity="0.3" />
      <circle cx="42" cy="46" r="13" fill="#ffc94a" />
      <circle cx="80" cy="40" r="12" fill="#3ba7ff" />
      <path d="M73 37 q5 -7 10 -2 q2 5 -3 7z" fill="#7fe0b8" />
      <path d="M14 88 Q60 58 106 88" fill="none" stroke="#9e97d6" strokeWidth="8" strokeLinecap="round" />
      <path d="M60 70 l4.5 9 10 1.5 -7.2 7 1.7 10 -9 -4.7 -9 4.7 1.7 -10 -7.2 -7 10 -1.5z" fill="#ff7a59" />
    </svg>
  );
}

function Certificate() {
  const { t, lang } = useKids();
  const date = new Intl.DateTimeFormat(lang === 'pt' ? 'pt-BR' : lang, { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date());
  return (
    <section id="certificate" className="stack" aria-labelledby="cert-title" style={{ gap: 14 }}>
      <div className="certificate">
        <Seal />
        <p className="label">CERTIFICATE</p>
        <h2 id="cert-title">Junior Lunar Navigator</h2>
        <p>{t('cert.text')}</p>
        <p className="small">{date} · Lunar Nav Kids · kids.lunarnav.space</p>
        <p className="small">{t('footer.data')}</p>
      </div>
      <p className="no-print"><button type="button" className="btn big" onClick={() => window.print()}>{t('cert.print')}</button></p>
    </section>
  );
}

/**
 * Five questions and the certificate, side by side on wide screens. Answers are checked at once;
 * the score is shown here only and is never saved or sent anywhere.
 */
export default function Quiz() {
  const { t, lang } = useKids();
  const [q, setQ] = useState(0);
  const [picked, setPicked] = useState(null);
  const [right, setRight] = useState(0);
  const questions = t('quiz.questions');
  const vars = { night: kidNumber(DATA.sites.im2_athena.kids.night_days, lang), sunniest: t(`sites.${DATA.sunniest[0]}.name`) };
  const fill = (s) => s.replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? `{${k}}`);
  const done = q >= questions.length;
  const cur = done ? null : questions[q];
  const choose = (i) => { if (picked !== null) return; setPicked(i); if (i === cur.answer) setRight((r) => r + 1); };
  const next = () => { setPicked(null); setQ((x) => x + 1); };

  return (
    <div className="stack">
      <MissionBar />
      <div className="grid2 even" style={{ alignItems: 'start' }}>
        <section className="stack no-print" aria-labelledby="quiz-q" style={{ gap: 16 }}>
          {!done ? (
            <>
              <p className="q-count">{t('quiz.progress', { n: q + 1, total: questions.length })}</p>
              <h1 id="quiz-q" style={{ fontSize: 'clamp(30px, 4.6vw, 42px)' }}>{fill(cur.q)}</h1>
              <div className="choices" role="group" aria-labelledby="quiz-q">
                {cur.options.map((o, i) => {
                  const isRight = picked !== null && i === cur.answer;
                  const isWrong = picked !== null && i === picked && i !== cur.answer;
                  return (
                    <button key={o} type="button" className={`choice ${isRight ? 'right' : ''} ${isWrong ? 'wrong' : ''}`}
                      aria-pressed={picked === i} disabled={picked !== null && !isRight && !isWrong} onClick={() => choose(i)}>
                      <span className="letter" aria-hidden="true">{LETTERS[i]}</span>
                      <span>{fill(o)}</span>
                      {isRight && <span className="mark" aria-hidden="true">✓</span>}
                    </button>
                  );
                })}
              </div>
              <p className="explain" role="status">
                {picked !== null && (picked === cur.answer
                  ? <><strong className="yes">{t('quiz.right')}</strong> {fill(cur.why)}</>
                  : <><strong className="no">{t('quiz.wrong')}</strong> {fill(cur.why)}</>)}
              </p>
              {picked !== null && <p><button type="button" className="btn big" onClick={next}>{q + 1 < questions.length ? t('quiz.next') : t('quiz.finish')} →</button></p>}
            </>
          ) : (
            <>
              <p className="q-count">{t('quiz.doneTitle')}</p>
              <h1 id="quiz-q">{t('quiz.score', { n: right, total: questions.length })}</h1>
              <p style={{ fontSize: 20 }}>{t('quiz.doneText')}</p>
              <p><button type="button" className="btn ghost" onClick={() => { setQ(0); setPicked(null); setRight(0); }}>{t('quiz.again')}</button></p>
            </>
          )}
        </section>
        <Certificate />
      </div>
    </div>
  );
}
