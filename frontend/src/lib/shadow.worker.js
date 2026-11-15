// AI-assisted: written with Claude (Anthropic) and reviewed by Luana Santos. See AI_DISCLOSURE.md.
/**
 * Web Worker for the terrain shadow ray-march (lib/shadow.js), so the 3D view keeps its frame
 * rate while shadows are recomputed. Messages: {type:'heights', z, n, cell} once per tile, then
 * {type:'sun', id, az, el} → {id, vis} (vis transferred, not copied).
 */
import { sunVisibility } from './shadow.js';

let tile = null;
self.onmessage = (e) => {
  const m = e.data;
  if (m.type === 'heights') { tile = m; return; }
  if (m.type === 'sun' && tile) {
    const vis = sunVisibility(tile.z, tile.n, tile.cell, m.az, m.el);
    self.postMessage({ id: m.id, vis }, [vis.buffer]);
  }
};
