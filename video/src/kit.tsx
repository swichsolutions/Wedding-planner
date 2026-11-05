// The shared pieces of the clips: formats, brand, easing, and the animated pointer.
import React from 'react';
import { Easing, Img, interpolate, staticFile } from 'remotion';
import { loadFont } from '@remotion/fonts';
import { loadFont as loadNoto } from '@remotion/google-fonts/NotoSansGeorgian';
import cap from './cap-manifest.json';

export const manifest = cap as unknown as Record<string, any>;

// ---------------------------------------------------------------- brand (frontend/src/styles/_tokens.scss)
export const C = {
  ivory: '#faf7f2',
  ivoryDeep: '#f0ece6',
  charcoal: '#302b2d',
  charcoal600: '#585454',
  peach: '#f2cebb',
  gold: '#b69a68',
  evergreen: '#29483f',
  white: '#ffffff',
};

loadFont({ family: 'FiraGO', url: staticFile('cap/FiraGO-Medium.woff2'), weight: '500' });
export const NOTO = loadNoto('normal', { weights: ['400', '600', '700'], subsets: ['georgian', 'latin'] }).fontFamily;
export const STATEMENT = "'FiraGO', sans-serif";

// ---------------------------------------------------------------- formats
export type Fmt = {
  id: 'ig' | 'web';
  W: number;
  H: number;
  captions: boolean;
  cardW: number;
  regionTop: number;
  regionBottom: number;
  /** Scale of the fixed-size details (pointer, sparks, shadows) relative to the 1080px format. */
  u: number;
};

/** Instagram: vertical; text stays clear of the top and bottom edges, where Instagram's own buttons sit. */
export const IG: Fmt = { id: 'ig', W: 1080, H: 1920, captions: true, cardW: 930, regionTop: 500, regionBottom: 1790, u: 1 };
/** Website: fills the phone on the home page's organizer section. */
export const WEB: Fmt = { id: 'web', W: 720, H: 1536, captions: false, cardW: 664, regionTop: 90, regionBottom: 1450, u: 0.667 };

export const centre = (fmt: Fmt) => (fmt.regionTop + fmt.regionBottom) / 2;

// ---------------------------------------------------------------- timing helpers
export const easeOut = Easing.bezier(0.22, 1, 0.36, 1);
export const easeInOut = Easing.bezier(0.65, 0, 0.35, 1);
export const easeIn = Easing.bezier(0.55, 0, 1, 0.45);

export const iv = (f: number, a: number, b: number, from = 0, to = 1, easing: (t: number) => number = easeOut) =>
  interpolate(f, [a, b], [from, to], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing });

export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/** A small overshoot on landing: 0 to 1, passing about 1.08. */
export const pop = (f: number, start: number, len = 14) => {
  const t = iv(f, start, start + len, 0, 1, (x) => x);
  const c = 2.2;
  return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2);
};

// ---------------------------------------------------------------- camera
export type Cam = { s: number; fx: number; fy: number };

/** Mapping from a scene's coordinates to the frame: the focus point lands on the frame's working centre. */
export const toScreen = (fmt: Fmt, cam: Cam, x: number, y: number): [number, number] => [
  fmt.W / 2 + (x - cam.fx) * cam.s,
  centre(fmt) + (y - cam.fy) * cam.s,
];

/** Eased moves between camera positions: [[frame, cam], ...]. */
export const camPath = (keys: [number, Cam][]) => (f: number): Cam => {
  let cam = keys[0][1];
  for (let i = 1; i < keys.length; i++) {
    const [a, ca] = keys[i - 1];
    const [b, cb] = keys[i];
    if (f >= a) {
      const t = iv(f, a, b, 0, 1, easeInOut);
      cam = { s: lerp(ca.s, cb.s, t), fx: lerp(ca.fx, cb.fx, t), fy: lerp(ca.fy, cb.fy, t) };
    }
  }
  return cam;
};

/** The focus x that keeps scene x `left` at `margin` from the frame's left edge at zoom `s`. */
export const focusLeft = (fmt: Fmt, s: number, left: number, margin: number) => left + (fmt.W / 2 - margin) / s;

// ---------------------------------------------------------------- captured interface pieces
export const Cap: React.FC<{ name: string; x: number; y: number; k: number; style?: React.CSSProperties }> = ({ name, x, y, k, style }) => {
  const m = manifest[name];
  return (
    <Img
      src={staticFile(`cap/${name}.png`)}
      style={{ position: 'absolute', left: x, top: y, width: m.w * k, height: m.h * k, maxWidth: 'none', ...style }}
    />
  );
};

/** Two states of the same element, crossfading at frame `at`. */
export const Swap: React.FC<{ a: string; b: string; at: number; f: number; x: number; y: number; k: number; len?: number }> = ({ a, b, at, f, x, y, k, len = 5 }) => {
  const t = iv(f, at, at + len, 0, 1, (v) => v);
  return (
    <>
      <Cap name={a} x={x} y={y} k={k} />
      {t > 0 ? <Cap name={b} x={x} y={y} k={k} style={{ opacity: t }} /> : null}
    </>
  );
};

// ---------------------------------------------------------------- the pointer
export type PKey = { f: number; travel: number; at: (t: number) => [number, number] };
export type Click = { f: number; at: (t: number) => [number, number]; kind: 'ring' | 'spark' };

export const pointerAt = (keys: PKey[], t: number): [number, number] => {
  let i = -1;
  for (let j = 0; j < keys.length; j++) if (keys[j].f - keys[j].travel <= t) i = j;
  if (i < 0) return keys[0].at(t);
  const k = keys[i];
  if (i === 0 || t >= k.f || k.travel === 0) return k.at(t);
  const [ax, ay] = keys[i - 1].at(t);
  const [bx, by] = k.at(t);
  const p = easeInOut((t - (k.f - k.travel)) / k.travel);
  // a gentle arc, the way a hand moves a mouse
  const dx = bx - ax;
  const dy = by - ay;
  const bow = Math.sin(Math.PI * p) * 0.1;
  return [lerp(ax, bx, p) - dy * bow, lerp(ay, by, p) + dx * bow];
};

const Arrow: React.FC<{ size: number; fill: string; stroke: string; strokeWidth?: number; style?: React.CSSProperties }> = ({ size, fill, stroke, strokeWidth = 2.2, style }) => (
  <svg width={size} height={size} viewBox="0 0 32 32" style={{ position: 'absolute', left: 0, top: 0, overflow: 'visible', ...style }}>
    <path
      d="M3 2.5 L3 25.5 L9.2 20 L13.2 29.2 L18 27.1 L14 18.2 L22.6 17.6 Z"
      fill={fill}
      stroke={stroke}
      strokeWidth={strokeWidth}
      strokeLinejoin="round"
    />
  </svg>
);

export const Pointer: React.FC<{ fmt: Fmt; keys: PKey[]; presses: number[]; holds: [number, number][]; t: number }> = ({ fmt, keys, presses, holds, t }) => {
  const size = 86 * fmt.u;
  const [x, y] = pointerAt(keys, t);
  let press = 0;
  for (const p of presses) press = Math.max(press, iv(t, p - 4, p, 0, 1) * iv(t, p, p + 8, 1, 0));
  for (const [a, b] of holds) press = Math.max(press, iv(t, a - 4, a, 0, 0.7) * iv(t, b, b + 6, 1, 0));
  const scale = 1 - press * 0.2;
  // a soft gold trail while the pointer travels fast
  const ghosts = [1, 2, 3, 4].map((n) => {
    const [gx, gy] = pointerAt(keys, t - n * 1.25);
    const speed = Math.hypot(x - gx, y - gy) / fmt.u;
    return { n, gx, gy, o: Math.min(speed / 90, 1) * (0.34 - n * 0.07) };
  });
  return (
    <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
      {ghosts.map(({ n, gx, gy, o }) =>
        o > 0.01 ? (
          <div key={n} style={{ position: 'absolute', left: gx, top: gy, opacity: o, width: size, height: size }}>
            <Arrow size={size} fill={C.gold} stroke={C.gold} strokeWidth={0} />
          </div>
        ) : null,
      )}
      <div style={{ position: 'absolute', left: x, top: y, width: size, height: size, transform: `scale(${scale})`, transformOrigin: '9% 8%', filter: `drop-shadow(0 ${(9 - press * 5) * fmt.u}px ${(14 - press * 6) * fmt.u}px rgba(34,30,32,.32))` }}>
        <Arrow size={size} fill={C.charcoal} stroke={C.white} />
      </div>
    </div>
  );
};

/** What a click leaves behind: a gold ring with a peach wash; a tick also throws small sparks. */
export const ClickFx: React.FC<{ fmt: Fmt; clicks: Click[]; t: number }> = ({ fmt, clicks, t }) => (
  <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
    {clicks.map((c, i) => {
      const age = t - c.f;
      if (age < 0 || age > 26) return null;
      const [x, y] = c.at(t);
      const grow = iv(age, 0, 22);
      const r = lerp(8, 92, grow) * fmt.u;
      const fade = iv(age, 6, 24, 1, 0, (v) => v);
      return (
        <div key={i} style={{ position: 'absolute', left: x, top: y }}>
          <div style={{ position: 'absolute', left: -r, top: -r, width: r * 2, height: r * 2, borderRadius: '50%', background: 'rgba(242,206,187,.42)', opacity: fade * 0.8 }} />
          <div style={{ position: 'absolute', left: -r, top: -r, width: r * 2, height: r * 2, borderRadius: '50%', border: `${4 * fmt.u}px solid ${C.gold}`, opacity: fade, boxSizing: 'border-box' }} />
          {c.kind === 'spark'
            ? Array.from({ length: 10 }).map((_, n) => {
                const ang = (n / 10) * Math.PI * 2 + 0.3;
                const fly = iv(age, 0, 20) * (n % 2 ? 128 : 96) * fmt.u;
                const dot = (n % 2 ? 9 : 6) * fmt.u * iv(age, 8, 24, 1, 0, (v) => v);
                return (
                  <div
                    key={n}
                    style={{ position: 'absolute', left: Math.cos(ang) * fly - dot / 2, top: Math.sin(ang) * fly - dot / 2, width: dot, height: dot, borderRadius: '50%', background: n % 3 === 0 ? C.peach : C.gold }}
                  />
                );
              })
            : null}
        </div>
      );
    })}
  </div>
);

// ---------------------------------------------------------------- caption: words rise, one word gets a peach marker
export type Word = { t: string; mark?: boolean; br?: boolean };

export const Caption: React.FC<{ fmt: Fmt; words: Word[]; f: number; dur: number; start?: number }> = ({ fmt, words, f, dur, start = 6 }) => {
  if (!fmt.captions) return null;
  const out = iv(f, dur - 14, dur - 2, 0, 1, easeIn);
  return (
    <div
      style={{
        position: 'absolute', left: 70, right: 70, bottom: fmt.H - fmt.regionTop + 42, display: 'flex', flexWrap: 'wrap', columnGap: 24, rowGap: 6,
        transform: `translateY(${-out * 90}px)`, opacity: 1 - out,
      }}
    >
      {words.map((w, i) => {
        if (w.br) return <div key={i} style={{ flexBasis: '100%', height: 0 }} />;
        const s = start + i * 3;
        const rise = iv(f, s, s + 16);
        const mark = w.mark ? iv(f, s + 9, s + 21, 0, 1, easeInOut) : 0;
        return (
          <span key={i} style={{ position: 'relative', display: 'inline-block', overflow: 'hidden', paddingBottom: 12, paddingTop: 6 }}>
            {w.mark ? (
              <span style={{ position: 'absolute', left: 0, top: 10, bottom: 8, width: '100%', background: C.peach, borderRadius: 10, transform: `scaleX(${mark})`, transformOrigin: 'left center' }} />
            ) : null}
            <span
              style={{
                position: 'relative', display: 'inline-block', padding: w.mark ? '0 14px' : 0, fontFamily: STATEMENT, fontWeight: 500, fontSize: 86, lineHeight: 1.16, color: C.charcoal,
                transform: `translateY(${(1 - rise) * 118}%)`,
              }}
            >
              {w.t}
            </span>
          </span>
        );
      })}
    </div>
  );
};

// ---------------------------------------------------------------- the backdrop: ivory and one slow gold ring
export const Backdrop: React.FC<{ fmt: Fmt; t: number; bump: number; length: number }> = ({ fmt, t, bump, length }) => {
  const r = fmt.W * 0.62;
  const turn = (t / length) * Math.PI * 2;
  const cx = fmt.W * 0.5 + Math.sin(turn) * 26 * fmt.u;
  const cy = centre(fmt) + Math.cos(turn) * 34 * fmt.u;
  return (
    <div style={{ position: 'absolute', inset: 0, background: C.ivory }}>
      <svg width={fmt.W} height={fmt.H} style={{ position: 'absolute', inset: 0 }}>
        <g transform={`rotate(${(t / length) * 360} ${cx} ${cy}) translate(${cx} ${cy}) scale(${1 + bump * 0.06}) translate(${-cx} ${-cy})`}>
          <circle cx={cx} cy={cy} r={r} fill="none" stroke={C.gold} strokeOpacity={0.55} strokeWidth={2.4 * fmt.u} />
          <circle cx={cx} cy={cy} r={r * 0.965} fill="none" stroke={C.gold} strokeOpacity={0.3} strokeWidth={1.2 * fmt.u} strokeDasharray={`${3 * fmt.u} ${16 * fmt.u}`} />
          <circle cx={cx + r} cy={cy} r={9 * fmt.u} fill={C.gold} fillOpacity={0.8} />
        </g>
      </svg>
    </div>
  );
};

// ---------------------------------------------------------------- how a scene comes in and leaves
export const Shell: React.FC<{ fmt: Fmt; f: number; dur: number; cam: Cam; noEnter?: boolean; noExit?: boolean; children: React.ReactNode }> = ({ fmt, f, dur, cam, noEnter, noExit, children }) => {
  const enter = noEnter ? 1 : iv(f, 0, 20, 0, 1, Easing.bezier(0.16, 1, 0.3, 1));
  const exit = noExit ? 0 : iv(f, dur - 17, dur - 5, 0, 1, easeIn);
  const y = (1 - enter) * fmt.H * 0.46 - exit * fmt.H * 0.24;
  const scale = lerp(0.9, 1, enter) * lerp(1, 0.9, exit);
  const tilt = (1 - enter) * 24 - exit * 12;
  return (
    <div style={{ position: 'absolute', inset: 0, perspective: 2400 * fmt.u, opacity: Math.min(enter * 2.4, 1) * (1 - exit), filter: exit > 0.01 ? `blur(${exit * 7 * fmt.u}px)` : undefined }}>
      <div style={{ position: 'absolute', inset: 0, transform: `translateY(${y}px) rotateX(${tilt}deg) scale(${scale})`, transformOrigin: '50% 60%' }}>
        <div
          style={{
            position: 'absolute', left: 0, top: 0, width: fmt.W, height: fmt.H, transformOrigin: '0 0',
            transform: `translate(${fmt.W / 2}px, ${centre(fmt)}px) scale(${cam.s}) translate(${-cam.fx}px, ${-cam.fy}px)`,
          }}
        >
          {children}
        </div>
      </div>
    </div>
  );
};

export const shadow = (fmt: Fmt) => `0 ${26 * fmt.u}px ${60 * fmt.u}px rgba(48,43,45,.14), 0 ${4 * fmt.u}px ${12 * fmt.u}px rgba(48,43,45,.06)`;

export const money = (n: number) => `${Math.round(n).toLocaleString('en-US').replace(/,/g, ' ')} ₾`;
