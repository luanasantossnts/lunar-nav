// AI-assisted: written with Claude (Anthropic) and reviewed by Luana Santos. See AI_DISCLOSURE.md.
import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { api } from '../lib/api.js';
import { useApp } from '../lib/store.jsx';
import { isoMin, pct } from '../lib/format.js';
import { bodyStatus, positionAt } from '../lib/visibility.js';
import { direction, sunVisibility } from '../lib/shadow.js';
import { cameraPosition, initialView } from '../lib/camera3d.js';

/** Vertical exaggeration: ×2 for gentle tiles; ×1 where the relief is deep (Shackleton, Malapert), so the opening view can step back. */
export const exaggeration = (reliefM) => (reliefM > 2500 ? 1 : 2);
// The 3D view is a lunar sky: always dark, in both themes (same colour as the container).
const SKY_HEX = '#08090a';
const ALBEDO = 0.55;
const AMBIENT = 0.07; // never fully black
const EARTH_TINT = [0.62, 0.75, 1.0];
const EARTH_GAIN = 0.16;
const FADE = 0.07; // share of the tile over which the edge fades into the background
const MIN_ELEVATION = 35; // lowest camera elevation allowed when orbiting (degrees above the horizontal)

/**
 * 3D terrain around a site from the LOLA heightmap. Lighting is computed per vertex:
 * the Sun's light reaches a vertex only where the terrain does not hide it (ray-marched on
 * the heightmap, with lunar curvature and the solar disc), plus a faint blue earthlight when
 * Earth is above the site's skyline, and a small ambient term so the relief is never black.
 */
export default function Terrain3D({ site, result, mask }) {
  const { t, cursor } = useApp();
  const mount = useRef(null);
  const ctx = useRef({});
  const [state, setState] = useState('loading');
  const [exag, setExag] = useState(2);
  const [light, setLight] = useState(null); // { text, sun } describing what lights the terrain now

  useEffect(() => {
    let disposed = false;
    const el = mount.current;
    setState('loading');
    (async () => {
      try {
        const meta = await fetch(api.terrainAsset(site.id, 'heightmap.json')).then((r) => { if (!r.ok) throw new Error('none'); return r.json(); });
        const buf = await fetch(api.terrainAsset(site.id, 'heightmap.bin')).then((r) => r.arrayBuffer());
        if (disposed) return;
        const n = meta.size;
        const z = new Float32Array(buf);
        const scene = new THREE.Scene();
        const w = el.clientWidth || 800;
        const h = el.clientHeight || 480;
        const camera = new THREE.PerspectiveCamera(45, w / h, 10, 200000);
        const renderer = new THREE.WebGLRenderer({ antialias: true });
        renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
        renderer.setSize(w, h);
        el.appendChild(renderer.domElement);

        const ext = meta.extent_m;
        const geo = new THREE.PlaneGeometry(ext, ext, n - 1, n - 1); // row 0 = north (+y), column 0 = west
        const pos = geo.attributes.position;
        const EXAG = exaggeration(meta.max_m - meta.min_m);
        for (let i = 0; i < pos.count; i++) pos.setZ(i, (z[i] - meta.min_m) * EXAG);
        geo.computeVertexNormals();
        geo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(pos.count * 3), 3));
        const mesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ vertexColors: true }));
        mesh.rotation.x = -Math.PI / 2; // plane in XZ, +Y up; north towards −Z, east +X
        scene.add(mesh);

        // Marker on the site: the surface height at the tile centre (mean of the 4 central pixels).
        const c = n / 2;
        const zc = (z[(c - 1) * n + c - 1] + z[(c - 1) * n + c] + z[c * n + c - 1] + z[c * n + c]) / 4;
        const centre = (zc - meta.min_m) * EXAG;
        // Opening view: oblique from above (40–45°), centred on the site, with every ray through the
        // frame border landing on the tile (ray-marched on the heightmap), so no tile edge shows.
        const target = [0, centre, 0];
        const view = initialView({ z, n, ext, min: meta.min_m, exag: EXAG }, target, { fovDeg: 45, aspect: w / h, fade: FADE });
        const marker = new THREE.Mesh(new THREE.ConeGeometry(view.d / 90, view.d / 22, 12), new THREE.MeshBasicMaterial({ color: 0xfacc15 }));
        marker.position.set(0, centre + view.d / 44, 0);
        marker.rotation.x = Math.PI;
        scene.add(marker);

        camera.position.set(...cameraPosition(target, view.az, view.el, view.d));
        const controls = new OrbitControls(camera, renderer.domElement);
        controls.target.set(...target);
        controls.enableDamping = true;
        controls.enablePan = false; // the view stays centred on the site
        controls.maxDistance = view.d; // zooming out never goes past the opening view
        controls.minDistance = view.d * 0.2;
        controls.minPolarAngle = 0;
        controls.maxPolarAngle = (90 - MIN_ELEVATION) * (Math.PI / 180); // never below the tile's horizon
        controls.update();

        let raf;
        const loop = () => { controls.update(); renderer.render(scene, camera); raf = requestAnimationFrame(loop); };
        loop();
        const onResize = () => {
          const ww = el.clientWidth; const hh = el.clientHeight;
          camera.aspect = ww / hh; camera.updateProjectionMatrix(); renderer.setSize(ww, hh);
        };
        window.addEventListener('resize', onResize);
        ctx.current = { scene, geo, z, n, cell: meta.cell_m, normals: geo.attributes.normal.array, last: null, dispose: () => {
          cancelAnimationFrame(raf); window.removeEventListener('resize', onResize);
          controls.dispose(); geo.dispose(); renderer.dispose(); el.innerHTML = '';
        } };
        setExag(EXAG);
        setState('ready');
      } catch {
        if (!disposed) setState('missing');
      }
    })();
    return () => { disposed = true; ctx.current.dispose?.(); ctx.current = {}; };
  }, [site.id]);

  // Relight when the time or the data change (throttled).
  useEffect(() => {
    const k = ctx.current;
    if (!k.scene || !result?.series || !cursor) return undefined;
    const id = setTimeout(() => {
      const sun = positionAt(result.series.sun, cursor);
      const earth = positionAt(result.series.earth, cursor);
      if (!sun || !earth) return;
      // Hex colours are sRGB; THREE.Color stores them linear, as the vertex colours are.
      const sky = new THREE.Color(SKY_HEX);
      const bg = [sky.r, sky.g, sky.b];
      k.scene.background = sky;
      // The ray-march is redone only when the Sun has moved enough to matter.
      if (!k.vis || !k.last || Math.abs(k.last.az - sun.az) > 0.1 || Math.abs(k.last.el - sun.el) > 0.02) {
        k.vis = sunVisibility(k.z, k.n, k.cell, sun.az, sun.el);
        k.last = sun;
      }
      const sunAt = bodyStatus(result.series.sun, mask, cursor);
      const earthAt = bodyStatus(result.series.earth, mask, cursor);
      const earthLit = earthAt?.status === 'visible';
      const S = direction(sun.az, sun.el);
      const E = direction(earth.az, earth.el);
      const col = k.geo.attributes.color.array;
      const N = k.normals;
      const fadeCells = Math.max(1, k.n * FADE);
      for (let r = 0; r < k.n; r++) {
        for (let cc = 0; cc < k.n; cc++) {
          const i = r * k.n + cc;
          const nx = N[i * 3]; const ny = N[i * 3 + 1]; const nz = N[i * 3 + 2]; // east, north, up
          const ns = Math.max(0, nx * S[0] + ny * S[1] + nz * S[2]);
          const sunTerm = k.vis[i] * Math.pow(ns, 0.6) * 1.15; // grazing light compressed for display
          const ne = earthLit ? Math.max(0, nx * E[0] + ny * E[1] + nz * E[2]) * EARTH_GAIN : 0;
          const f = Math.min(1, Math.min(r, cc, k.n - 1 - r, k.n - 1 - cc) / fadeCells);
          for (let ch = 0; ch < 3; ch++) {
            const lit = Math.min(1, ALBEDO * (AMBIENT + sunTerm + ne * EARTH_TINT[ch]) + 0.02);
            col[i * 3 + ch] = bg[ch] * (1 - f) + lit * f;
          }
        }
      }
      k.geo.attributes.color.needsUpdate = true;
      if (sunAt && sunAt.status !== 'visible') {
        const where = sunAt.el > 0 ? t('sky.sunBehindTerrain') : t('sky.sunBelow');
        setLight({ text: t(earthLit ? 'sky.litEarth' : 'sky.litNone', { where }), sun: false });
      } else setLight({ text: t('sky.litSun'), sun: true });
    }, 120);
    return () => clearTimeout(id);
  }, [cursor, result, state, mask, t]);

  return (
    <div className="w-full border border-line">
      <div className="relative w-full h-[520px]" style={{ background: SKY_HEX }}>
        <div ref={mount} className="absolute inset-0" role="img"
          aria-label={t('sky.terrainSummary', { site: site.name, time: isoMin(cursor), p: pct(result?.metrics?.sun?.fraction) })} />
        {/* Fixed light-on-dark text: the 3D sky is dark in both themes. */}
        {state === 'loading' && <p className="absolute left-3 top-3 text-sm" style={{ color: '#b8b9bc' }}>{t('common.loading')}</p>}
        {state === 'missing' && <p className="absolute inset-0 grid place-items-center text-sm p-6 text-center" style={{ color: '#b8b9bc' }}>{t('sky.noTerrain')}</p>}
        {state === 'ready' && light && !light.sun && (
          <p role="status" className="absolute left-3 top-3 m-0 px-2.5 py-1.5 text-xs rounded" style={{ color: '#eceae6', background: '#141518', border: '1px solid #3a3d44' }}>{light.text}</p>
        )}
      </div>
      {state === 'ready' && <p className="m-0 px-3 py-2 border-t border-line bg-panel text-xs text-dim">{t('sky.caption3d', { n: exag, light: light?.text ?? t('sky.litSun') })}</p>}
    </div>
  );
}
