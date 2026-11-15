// AI-assisted: written with Claude (Anthropic) and reviewed by Luana Santos. See AI_DISCLOSURE.md.
import { useApp } from './lib/store.jsx';
import { Shell } from './components/Shell.jsx';
import Tour, { TOUR_PAGES } from './components/Tour.jsx';
import Briefing from './pages/Briefing.jsx';
import Planner from './pages/Planner.jsx';
import Compare from './pages/Compare.jsx';
import SkyView from './pages/SkyView.jsx';
import Charts from './pages/Charts.jsx';
import Analyst from './pages/Analyst.jsx';
import Methodology from './pages/Methodology.jsx';
import Report from './pages/Report.jsx';
import Help from './pages/Help.jsx';
import Privacy from './pages/Privacy.jsx';

const PAGES = {
  '/planner': Planner,
  '/compare': Compare,
  '/sky': SkyView,
  '/charts': Charts,
  '/analyst': Analyst,
  '/methodology': Methodology,
  '/report': Report,
  '/help': Help,
  '/privacy': Privacy,
};

export default function App() {
  const { route } = useApp();
  const tour = route.match(/^\/tour\/([1-5])$/);
  if (route === '/' || route === '') return <Briefing />;
  const step = tour ? Number(tour[1]) : null;
  const Page = PAGES[step ? TOUR_PAGES[step] : route] || Planner;
  return (
    <Shell>
      <Page />
      {step && <Tour step={step} />}
    </Shell>
  );
}
