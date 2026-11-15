// AI-assisted: written with Claude (Anthropic) and reviewed by Luana Santos. See AI_DISCLOSURE.md.
import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { api } from '../lib/api.js';
import { useApp } from '../lib/store.jsx';
import { isoMin, pct, plain } from '../lib/format.js';
import { bodyStatus, positionAt } from '../lib/visibility.js';
import { direction, sunVisibility } from '../lib/shadow.js';
import { cameraPosition } from '../lib/camera3d.js';
import { darkFraction, loadViewMode, openingView, regolith, ringProfile, saveViewMode, sideView, skyPosition } from '../lib/sky3d.js';

/** Vertical exaggeration: ×2 for gentle tiles; ×1 where the relief is deep (Shackleton, Malapert). */
export const exaggeration = (reliefM) => (reliefM > 2500 ? 1 : 2);
const SKY_HEX = '#000000'; // airless sky: black
const FADE = 0.07; // share of the tile over which the edge fades into the black sky
const MIN_ELEVATION = 3; // the camera never goes below the horizon (degrees above the horizontal)
const SUN_RADIUS_DEG = 0.267;
const EARTH_RADIUS_DEG = 0.95;

/** A soft radial glow texture for the Sun. */
function glowTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grad.addColorStop(0, 'rgba(255,250,235,1)');
  grad.addColorStop(0.12, 'rgba(255,244,210,0.85)');
  grad.addColorStop(0.35, 'rgba(255,225,160,0.25)');
  grad.addColorStop(1, 'rgba(255,210,140,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** A bright round solar disc with a soft edge. */
function sunTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(32, 32, 0, 32, 32, 30);
  grad.addColorStop(0, '#fffdf6');
  grad.addColorStop(0.8, '#fff4d6');
  grad.addColorStop(1, 'rgba(255,240,200,0)');
  g.fillStyle = grad;
  g.beginPath(); g.arc(32, 32, 30, 0, Math.PI * 2); g.fill();
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** A small Earth disc: blue with a lighter limb. */
function earthTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(26, 26, 2, 32, 32, 30);
  grad.addColorStop(0, '#9fd3ff');
  grad.addColorStop(0.6, '#2f7fd6');
  grad.addColorStop(1, '#174a8c');
  g.fillStyle = grad;
  g.beginPath(); g.arc(32, 32, 30, 0, Math.PI * 2); g.fill();
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/**
 * 3D terrain around a site from the NASA LOLA heightmap, lit like the airless Moon: hard
 * sunlight with terrain shadows (ray-marched on the heightmap, in a Web Worker), almost black
 * shadows, faint blue earthlight when the Sun is down. The Sun and Earth are drawn in the black
 * sky at their real direction for the cursor time, behind a ring showing the distant skyline
 * from the 150 km horizon mask (what hides the Sun beyond the 20 km tile).
 */
export default function Terrain3D({ site, result, mask }) {
  const { t, cursor } = useApp();
  const mount = useRef(null);
  const ctx = useRef({});
  const [state, setState] = useState('loading');
  const [exag, setExag] = useState(2);
  const [light, setLight] = useState(null); // { text, sun } describing what lights the terrain now
  const [view, setView] = useState(loadViewMode); // 'side' (side light, default) or 'sun' (toward the Sun)
  const [dark, setDark] = useState(false); // most of the frame black in side light (very low Sun)
  const viewRef = useRef(view);
  viewRef.current = view;

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
        const ext = meta.extent_m;
        const scene = new THREE.Scene();
        scene.background = new THREE.Color(SKY_HEX); // no fog: there is no air
        const w = el.clientWidth || 800;
        const h = el.clientHeight || 480;
        const camera = new THREE.PerspectiveCamera(45, w / h, 10, ext * 12);
        const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
        renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
        renderer.setSize(w, h);
        el.appendChild(renderer.domElement);

        const geo = new THREE.PlaneGeometry(ext, ext, n - 1, n - 1); // row 0 = north (+y), column 0 = west
        const pos = geo.attributes.position;
        const EXAG = exaggeration(meta.max_m - meta.min_m);
        for (let i = 0; i < pos.count; i++) pos.setZ(i, (z[i] - meta.min_m) * EXAG);
        geo.computeVertexNormals();
        geo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(pos.count * 3), 3));
        const mesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ vertexColors: true }));
        mesh.rotation.x = -Math.PI / 2; // plane in XZ, +Y up; north towards −Z, east +X
        scene.add(mesh);
        // Low-detail copy (every 2nd vertex) shown only while the camera moves on a slow device.
        const nLo = Math.floor((n - 1) / 2) + 1;
        const geoLo = new THREE.PlaneGeometry(ext * ((nLo - 1) * 2) / (n - 1), ext * ((nLo - 1) * 2) / (n - 1), nLo - 1, nLo - 1);
        geoLo.translate(-ext / 2 + (ext * ((nLo - 1) * 2) / (n - 1)) / 2, ext / 2 - (ext * ((nLo - 1) * 2) / (n - 1)) / 2, 0);
        const posLo = geoLo.attributes.position;
        for (let r = 0; r < nLo; r++) for (let cc = 0; cc < nLo; cc++) posLo.setZ(r * nLo + cc, (z[(2 * r) * n + 2 * cc] - meta.min_m) * EXAG);
        geoLo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(posLo.count * 3), 3));
        const meshLo = new THREE.Mesh(geoLo, mesh.material);
        meshLo.rotation.x = -Math.PI / 2;
        meshLo.visible = false;
        scene.add(meshLo);

        const c = n / 2;
        const zc = (z[(c - 1) * n + c - 1] + z[(c - 1) * n + c] + z[c * n + c - 1] + z[c * n + c]) / 4;
        const centre = (zc - meta.min_m) * EXAG;
        const target = [0, centre, 0];

        // Distant skyline (150 km NASA LOLA mask) as a dark ring with a faint outline.
        const skyR = ext * 2.6; const ringR = ext * 2.2;
        if (mask?.elevations?.length) {
          const { top, bottom } = ringProfile(mask, target, ringR, 720);
          const verts = [];
          for (let s = 0; s < top.length / 3 - 1; s++) {
            const a = s * 3; const b = (s + 1) * 3;
            verts.push(bottom[a], bottom[a + 1], bottom[a + 2], top[a], top[a + 1], top[a + 2], top[b], top[b + 1], top[b + 2]);
            verts.push(bottom[a], bottom[a + 1], bottom[a + 2], top[b], top[b + 1], top[b + 2], bottom[b], bottom[b + 1], bottom[b + 2]);
          }
          const rg = new THREE.BufferGeometry();
          rg.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
          scene.add(new THREE.Mesh(rg, new THREE.MeshBasicMaterial({ color: 0x000000, side: THREE.DoubleSide })));
          const lg = new THREE.BufferGeometry();
          lg.setAttribute('position', new THREE.Float32BufferAttribute(top, 3));
          scene.add(new THREE.Line(lg, new THREE.LineBasicMaterial({ color: 0x3a3d44 })));
        }

        // Sun (disc + glow) and Earth (small blue disc) at the sky distance; terrain and ring hide them.
        const sunDisc = new THREE.Sprite(new THREE.SpriteMaterial({ map: sunTexture(), depthWrite: false, transparent: true }));
        const discPx = 2 * skyR * Math.tan((SUN_RADIUS_DEG * Math.PI) / 180);
        sunDisc.scale.set(discPx * 2.2, discPx * 2.2, 1); // a little larger than true size so it stays visible
        const sunGlow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
        sunGlow.scale.set(discPx * 26, discPx * 26, 1);
        const earth = new THREE.Sprite(new THREE.SpriteMaterial({ map: earthTexture(), depthWrite: false, transparent: true }));
        const earthPx = 2 * skyR * Math.tan((EARTH_RADIUS_DEG * Math.PI) / 180) * 1.3;
        earth.scale.set(earthPx, earthPx, 1);
        [sunGlow, sunDisc, earth].forEach((s) => { s.visible = false; scene.add(s); });

        const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
        const controls = new OrbitControls(camera, renderer.domElement);
        controls.target.set(...target);
        controls.enableDamping = !reduceMotion;
        controls.enablePan = false; // the view stays centred on the site
        controls.minPolarAngle = 0;
        controls.maxPolarAngle = (90 - MIN_ELEVATION) * (Math.PI / 180); // never below the horizon

        // Render on demand (camera moves, relight, resize): no work while nothing changes.
        // Adaptive detail: if frames take longer than 33 ms (< 30 fps) while the camera moves, the
        // low-detail mesh is drawn until it stops; then one full-detail frame is drawn.
        let raf = 0; let slow = false; let idleTimer = 0; let lastT = 0;
        const draw = () => { renderer.render(scene, camera); };
        const frame = (now) => {
          raf = 0;
          const moving = controls.update();
          if (lastT && now - lastT > 34 && moving) slow = true;
          lastT = moving ? now : 0;
          meshLo.visible = slow && moving; mesh.visible = !meshLo.visible;
          draw();
          if (moving) raf = requestAnimationFrame(frame);
          clearTimeout(idleTimer);
          if (meshLo.visible) idleTimer = setTimeout(() => { meshLo.visible = false; mesh.visible = true; draw(); measure(); }, 250);
          else if (!moving) measure();
        };
        // Share of near-black pixels, read right after an idle full-detail frame (not every frame).
        const measure = () => {
          if (!k.onDark || !k.vis) return;
          const gl = renderer.getContext();
          const px = new Uint8Array(gl.drawingBufferWidth * gl.drawingBufferHeight * 4);
          gl.readPixels(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight, gl.RGBA, gl.UNSIGNED_BYTE, px);
          k.darkFrac = darkFraction(px);
          k.onDark(k.darkFrac);
        };
        const request = () => { if (!raf) raf = requestAnimationFrame(frame); };
        controls.addEventListener('change', request);
        const onResize = () => {
          const ww = el.clientWidth; const hh = el.clientHeight;
          camera.aspect = ww / hh; camera.updateProjectionMatrix(); renderer.setSize(ww, hh); request();
        };
        window.addEventListener('resize', onResize);

        // Shadows in a worker (falls back to the main thread where workers are unavailable).
        let worker = null;
        try {
          worker = new Worker(new URL('../lib/shadow.worker.js', import.meta.url), { type: 'module' });
          worker.postMessage({ type: 'heights', z, n, cell: meta.cell_m });
        } catch { worker = null; }

        let k = null;
        k = {
          scene, geo, geoLo, nLo, mesh, meshLo, z, n, cell: meta.cell_m, normals: geo.attributes.normal.array, camera, controls, target, ext,
          sunDisc, sunGlow, earth, skyR, request, worker, reqId: 0, framed: false, darkFrac: null,
          hm: { z, n, ext, min: meta.min_m, exag: EXAG },
          // For checks: average render time over a few frames, at the current size.
          bench: (frames = 30, low = false) => {
            mesh.visible = !low; meshLo.visible = low;
            const gl = renderer.getContext(); const px = new Uint8Array(4);
            const t0 = performance.now();
            for (let i = 0; i < frames; i++) { renderer.render(scene, camera); gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px); } // readPixels waits for the GPU
            const ms = (performance.now() - t0) / frames;
            mesh.visible = true; meshLo.visible = false;
            return ms;
          },
          dispose: () => {
            cancelAnimationFrame(raf); window.removeEventListener('resize', onResize);
            clearTimeout(idleTimer); worker?.terminate(); controls.dispose(); geo.dispose(); geoLo.dispose(); renderer.dispose(); el.innerHTML = '';
          },
        };
        if (worker) {
          worker.onmessage = (e) => { if (e.data.id === k.reqId && k.applyVis) k.applyVis(e.data.vis); };
        }
        k.onDark = (f) => setDark(f > 0.6);
        el.__lunar3d = k;
        ctx.current = k;
        setExag(EXAG);
        setState('ready');
      } catch {
        if (!disposed) setState('missing');
      }
    })();
    return () => { disposed = true; ctx.current.dispose?.(); ctx.current = {}; };
  }, [site.id, mask]);

  // Relight, move the Sun and Earth, and frame the opening view, when the time or the data change.
  useEffect(() => {
    const k = ctx.current;
    if (!k.scene || !result?.series || !cursor) return undefined;
    const id = setTimeout(() => {
      const sun = positionAt(result.series.sun, cursor);
      const earth = positionAt(result.series.earth, cursor);
      if (!sun || !earth) return;
      const sunAt = bodyStatus(result.series.sun, mask, cursor);
      const earthAt = bodyStatus(result.series.earth, mask, cursor);
      const earthLit = earthAt?.status === 'visible';
      const S = direction(sun.az, sun.el);
      const E = direction(earth.az, earth.el);

      // Opening view for the chosen mode: side light (camera at the Sun's azimuth ± 90°, ~30° up,
      // the side that shows more sunlit terrain) or toward the Sun (low, behind the site).
      k.frame = (mode) => {
        const opts = { aspect: k.camera.aspect, fovDeg: k.camera.fov };
        const v = mode === 'sun' || !k.vis ? openingView(k.sunPos.az, k.ext, opts) : sideView(k.hm, k.normals, k.vis, k.S, k.sunPos.az, k.target, opts);
        k.camera.position.set(...cameraPosition(k.target, v.az, v.el, v.d));
        k.controls.maxDistance = v.d * 1.8;
        k.controls.minDistance = v.d * 0.15;
        if (!k.marker) {
          k.marker = new THREE.Mesh(new THREE.ConeGeometry(v.d / 120, v.d / 30, 12), new THREE.MeshBasicMaterial({ color: 0xfacc15 }));
          k.marker.position.set(k.target[0], k.target[1] + v.d / 60, k.target[2]);
          k.marker.rotation.x = Math.PI;
          k.scene.add(k.marker);
        }
        k.controls.update();
        k.framed = true;
        k.request();
      };
      k.sunPos = sun;
      k.S = S;

      k.sunDisc.position.set(...skyPosition(k.target, sun.az, sun.el, k.skyR));
      k.sunGlow.position.copy(k.sunDisc.position);
      k.earth.position.set(...skyPosition(k.target, earth.az, earth.el, k.skyR * 0.98));
      // Drawn only near or above the horizon; the terrain and the distant-skyline ring hide them when they are behind relief.
      k.sunDisc.visible = k.sunGlow.visible = sun.el > -3;
      k.earth.visible = earth.el > -3;

      k.applyVis = (vis) => {
        k.vis = vis;
        const col = k.geo.attributes.color.array;
        const N = k.normals;
        const fadeCells = Math.max(1, k.n * FADE);
        const rgb = [0, 0, 0];
        for (let r = 0; r < k.n; r++) {
          for (let cc = 0; cc < k.n; cc++) {
            const i = r * k.n + cc;
            regolith(N[i * 3], N[i * 3 + 1], N[i * 3 + 2], S, E, vis[i], earthLit, rgb);
            const f = Math.min(1, Math.min(r, cc, k.n - 1 - r, k.n - 1 - cc) / fadeCells); // edge fades to the black sky
            col[i * 3] = rgb[0] * f; col[i * 3 + 1] = rgb[1] * f; col[i * 3 + 2] = rgb[2] * f;
          }
        }
        k.geo.attributes.color.needsUpdate = true;
        const lo = k.geoLo.attributes.color.array;
        for (let r = 0; r < k.nLo; r++) for (let cc = 0; cc < k.nLo; cc++) {
          const j = (r * k.nLo + cc) * 3; const i = ((2 * r) * k.n + 2 * cc) * 3;
          lo[j] = col[i]; lo[j + 1] = col[i + 1]; lo[j + 2] = col[i + 2];
        }
        k.geoLo.attributes.color.needsUpdate = true;
        if (!k.framed) k.frame(viewRef.current); // needs the shadows to pick the side-light side
        k.request();
      };
      // The ray-march is redone only when the Sun has moved enough to matter.
      if (!k.vis || !k.last || Math.abs(k.last.az - sun.az) > 0.1 || Math.abs(k.last.el - sun.el) > 0.02) {
        k.last = sun;
        k.reqId += 1;
        if (k.worker) k.worker.postMessage({ type: 'sun', id: k.reqId, az: sun.az, el: sun.el });
        else k.applyVis(sunVisibility(k.z, k.n, k.cell, sun.az, sun.el));
      } else {
        k.applyVis(k.vis); // Earth or earthlight changed only
      }
      if (sunAt && sunAt.status !== 'visible') {
        const where = sunAt.el > 0 ? t('sky.sunBehindTerrain') : t('sky.sunBelow');
        setLight({ text: t(earthLit ? 'sky.litEarth' : 'sky.litNone', { where }), sun: false });
      } else setLight({ text: t('sky.litSun'), sun: true });
    }, 120);
    return () => clearTimeout(id);
  }, [cursor, result, state, mask, t]);

  // Switching the framing: re-frame now (the choice is remembered for the browser session).
  useEffect(() => {
    saveViewMode(view);
    const k = ctx.current;
    if (k.frame && k.vis) k.frame(view);
    if (view === 'sun') setDark(false);
  }, [view]);

  return (
    <div className="w-full border border-line">
      <div className="relative w-full h-[520px]" style={{ background: SKY_HEX }}>
        <div ref={mount} className="absolute inset-0" role="img"
          aria-label={t('sky.terrainSummary', { site: site.name, time: isoMin(cursor), p: pct(result?.metrics?.sun?.fraction) })} />
        {/* Fixed light-on-dark text: the 3D sky is black in both themes. */}
        {state === 'loading' && <p className="absolute left-3 top-3 text-sm" style={{ color: '#b8b9bc' }}>{t('common.loading')}</p>}
        {state === 'missing' && <p className="absolute inset-0 grid place-items-center text-sm p-6 text-center" style={{ color: '#b8b9bc' }}>{t('sky.noTerrain')}</p>}
        {state === 'ready' && (
          <div role="group" aria-label={t('sky.viewGroup')} className="absolute right-2 top-2 flex text-xs">
            {[['side', t('sky.viewSide')], ['sun', t('sky.viewSun')]].map(([m, label], i) => (
              <button key={m} type="button" aria-pressed={view === m} onClick={() => setView(m)}
                className={`hit44 min-h-[32px] px-2.5 border ${i === 0 ? 'rounded-l' : 'rounded-r -ml-px'}`}
                style={view === m ? { color: '#0b0c0e', background: '#eceae6', borderColor: '#eceae6' } : { color: '#eceae6', background: 'rgba(20,21,24,0.85)', borderColor: '#3a3d44' }}>
                {label}
              </button>
            ))}
          </div>
        )}
        {state === 'ready' && view === 'side' && dark && (
          <p role="status" className="absolute left-3 bottom-3 right-3 sm:right-auto sm:max-w-[60%] m-0 px-2.5 py-1.5 text-xs rounded" style={{ color: '#eceae6', background: '#141518', border: '1px solid #3a3d44' }}>{t('sky.lowSun')}</p>
        )}
        {state === 'ready' && light && !light.sun && (
          <p role="status" className="absolute left-3 right-3 sm:right-auto top-[52px] sm:top-3 sm:max-w-[55%] m-0 px-2.5 py-1.5 text-xs rounded" style={{ color: '#eceae6', background: '#141518', border: '1px solid #3a3d44' }}>{light.text}</p>
        )}
      </div>
      {state === 'ready' && <p className="m-0 px-3 py-2 border-t border-line bg-panel text-xs text-dim">{t('sky.caption3d', { n: plain(exag), light: light?.text ?? t('sky.litSun') })}</p>}
    </div>
  );
}
