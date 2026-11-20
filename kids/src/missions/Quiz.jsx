// AI-assisted: written with Claude (Anthropic) and reviewed by Luana Santos. See AI_DISCLOSURE.md.
import { useEffect, useState } from 'react';
import { useKids } from '../App.jsx';
import { DATA, certificateUnlocked } from '../lib/data.js';
import { kidNumber } from '../lib/lang.js';
import { MissionBar } from '../components/Frame.jsx';
import Certificate from '../components/Certificate.jsx';
import { certificateReady } from '../lib/progress.js';

const LETTERS = ['A', 'B', 'C', 'D'];

/**
 * Five questions and the certificate, side by side on wide screens. Answers are checked at once;
 * the score is shown here only and is never saved or sent anywhere.
 */
export default function Quiz() {
  const { t, lang, progress, passQuiz } = useKids();
  const [q, setQ] = useState(0);
  const [picked, setPicked] = useState(null);
  const [right, setRight] = useState(0);
  const questions = t('quiz.questions');
  const vars = { night: kidNumber(DATA.sites.im2_athena.kids.night_days, lang), sunniest: t(`sites.${DATA.sunniest[0]}.name`) };
  const fill = (s) => s.replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? `{${k}}`);
  const done = q >= questions.length;
  const unlocked = certificateUnlocked(right, questions.length, done);
  // 5 of 5 opens the Cadet certificate; that is saved on this device with the rest of the progress.
  useEffect(() => { if (unlocked) passQuiz(); }, [unlocked, passQuiz]);
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
              <p className="status" role="status">{unlocked ? <span className="yes-text">{t('cert.unlocked')}</span> : <span className="no-text">{t('cert.needAll', { total: questions.length })}</span>}</p>
              <p style={{ fontSize: 20 }}>{t('quiz.doneText')}</p>
              <p><button type="button" className="btn ghost" onClick={() => { setQ(0); setPicked(null); setRight(0); }}>{t('quiz.again')}</button></p>
            </>
          )}
        </section>
        <Certificate phaseId={1} unlocked={unlocked || certificateReady(progress, 1)} />
      </div>
    </div>
  );
}
