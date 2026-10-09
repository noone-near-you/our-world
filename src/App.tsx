import { Suspense, lazy } from 'react';
import { Hud } from './ui/Hud';
import { AutoFullscreen } from './ui/AutoFullscreen';
const Bedroom = lazy(() => import('./worlds/Bedroom'));
export default function App() {
  return (<>
    <Suspense fallback={<div className="gate"><p className="eyebrow">Loading</p></div>}><Bedroom /></Suspense>
    <Hud />
    <AutoFullscreen />
    <div className="rotate"><p>Please turn your phone sideways</p></div>
  </>);
}
