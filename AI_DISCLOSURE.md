# Use of AI in Lunar Nav

Space Apps asks every team to declare how AI was used. This file is the declaration; the same text is summarised on the Methodology screen and in the submission form.

## 0. What AI did not do

The solution idea was not created by AI. It is the author's own: she chose the challenge, conceived the solution and its improvements from her own study, and made the product and design decisions. AI was used as a tool to refine the technical plan and to speed up implementation, writing and review, as the Space Apps rules allow.

## 1. AI used to build the project

| What | Tool | Human role |
|---|---|---|
| Source code (PHP API, React front end, Python preprocessing, tests) | Claude (Anthropic), in an assisted-coding workflow | Luana Santos defined the problem, requirements and design direction, ran the real JPL Horizons tests, reviewed and accepted every change |
| Code review of the Horizons test script and of the specification | Claude Code (Anthropic) and ChatGPT (OpenAI) | Findings were checked and applied by the author |
| Planning and specification documents | Claude (Anthropic) | Reviewed and edited by the author |
| Lunar Nav Kids (`kids/`: the children's site, its SVG drawings and mascot, data export and tests) | Claude (Anthropic), in an assisted-coding workflow; drawings are hand-written SVG and CSS, no image generator; no AI inside the running kids site | Luana Santos defined the audience, content and rules; numbers come only from the Lunar Nav API export |
| Team mark and colour palette | Designed by the author. Claude (Anthropic) produced the vector (SVG) files and colour variants from her design in code; no image generator was used | Author approved every file |

No AI-generated images or video are used in the app. If any are added (for example in the demo video), they will carry a visible "AI-generated" watermark, as the rules require.

## 2. AI inside the running app

| Feature | Model / service | Rules it follows |
|---|---|---|
| Analyst (questions in plain language) | Claude (Anthropic). | The model may only call Lunar Nav tools (site metrics, compare, delay, date search, sensitivity). The system prompt forbids numbers that do not come from tool results and requires a citation [n] for each one. Every tool call is shown on screen. Answers are labelled as AI text. |
| Read answers aloud | ElevenLabs text-to-speech — active in the live demo | Read aloud uses ElevenLabs (AI voice; labelled); if unavailable, the browser's built-in speech. The summary (conclusion and trade-off) is read by default. The audio carries an `X-AI-Generated` header. |
| Speak a question | ElevenLabs speech-to-text — active in the live demo | Speech input uses ElevenLabs speech-to-text. The transcript is placed in the question box; nothing is sent until you press Run. |

All numbers in Lunar Nav (sunlight, Earth in view, dark periods, dates) are computed by deterministic code from JPL Horizons and NASA LOLA data. No number is produced by an AI model.

## 3. Where AI use is marked

- Every source file starts with an `AI-assisted:` header comment.
- `frontend/package.json` has an `x-ai-assisted` field.
- In the app, analyst answers are labelled as AI text and spoken answers as AI voice.

## 4. Data sent to AI services

To Claude: the question, the mode (Technical/Learn), the language, the scenario on screen (sites, dates, horizon, delay, power inputs) and the tool results. To ElevenLabs: the text to be read, or the recorded question (up to 30 s). No personal data. API keys stay on the server. Answers and audio are cached on the server to avoid repeated calls; the cache keys contain no IP address or other personal data.

## 5. Privacy & legal

- No user identifier is sent to the AI services: Claude receives the question, mode, language, scenario and tool results; ElevenLabs receives the text to read or the recorded question. Both are in the USA (international transfer); each processes data under its own terms.
- The Analyst asks users not to include personal data; questions that look like personal data are not cached. Cached answers (90 days) hold no question text, address or personal data.
- Microphone recordings are not stored by Lunar Nav; the first use shows a notice.
- Client addresses are only used as salted hashes for hourly limits and deleted after 48 hours.
- Full details, rights under the LGPD and terms of use: the *Privacy & Terms* page in the app (`#/privacy`) and the "Privacy & legal" section of the README.

