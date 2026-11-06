// The invitation clip: a design picked, the names typed, the venue added, the finished invitation
// scrolled, the link shared and a guest's reply coming in. Same kit and pointer as the organizer clip.
import React from 'react';
import { Img, staticFile } from 'remotion';
import { C, Cam, Fmt, NOTO, Shell, camPath, centre, easeInOut, iv, lerp, pop, shadow } from './kit';
import { SceneDef } from './scenes';
import cap from './cap-invite.json';

const m = cap as unknown as Record<string, any>;

const ICap: React.FC<{ name: string; x: number; y: number; k: number; style?: React.CSSProperties }> = ({ name, x, y, k, style }) => (
  <Img src={staticFile(`cap-invite/${name}.png`)} style={{ position: 'absolute', left: x, top: y, width: m[name].w * k, height: m[name].h * k, maxWidth: 'none', ...style }} />
);

const fade = (f: number, at: number, len = 8) => iv(f, at, at + len, 0, 1, (v) => v);

/** Two captured states of one element, crossfading. They're transparent, so the old one has to leave too, or it shows through. */
const Over: React.FC<{ a: string; b: string; at: number; f: number; x: number; y: number; k: number; len?: number }> = ({ a, b, at, f, x, y, k, len = 7 }) => {
  const t = fade(f, at, len);
  return (
    <>
      {t < 1 ? <ICap name={a} x={x} y={y} k={k} style={{ opacity: 1 - t }} /> : null}
      {t > 0 ? <ICap name={b} x={x} y={y} k={k} style={{ opacity: t }} /> : null}
    </>
  );
};

const Card: React.FC<{ fmt: Fmt; x: number; y: number; w: number; h: number; children?: React.ReactNode }> = ({ fmt, x, y, w, h, children }) => (
  <div style={{ position: 'absolute', left: x, top: y, width: w, height: h, borderRadius: 30 * fmt.u, background: C.white, boxShadow: shadow(fmt), overflow: 'hidden' }}>{children}</div>
);

/** Text arriving in a real input: the focus ring, the letters one by one, the caret. */
const Typed: React.FC<{ fmt: Fmt; r: any; ox: number; oy: number; k: number; text: string; f: number; press: number; start: number; end: number }> = ({ fmt, r, ox, oy, k, text, f, press, start, end }) => {
  if (f < press) return null;
  const chars = Math.floor(iv(f, start, end, 0, text.length, (v) => v));
  const focused = f < end + 8;
  const caret = focused && Math.floor(f / 9) % 2 === 0;
  return (
    <>
      <div style={{ position: 'absolute', left: ox + r.x * k, top: oy + r.y * k, width: r.w * k, height: r.h * k, borderRadius: r.radius * k, boxShadow: `0 0 0 ${2.5 * fmt.u}px ${C.charcoal}`, opacity: iv(f, press, press + 5) * iv(f, end + 2, end + 10, 1, 0) }} />
      <div style={{ position: 'absolute', left: ox + (r.x + r.paddingLeft) * k, top: oy + r.y * k, height: r.h * k, display: 'flex', alignItems: 'center', whiteSpace: 'nowrap', fontFamily: NOTO, fontWeight: 400, fontSize: r.size * k, color: C.charcoal }}>
        {text.slice(0, chars)}
        {caret ? <span style={{ display: 'inline-block', width: 2.4 * fmt.u, height: r.size * k * 1.15, marginLeft: 2 * k, background: C.charcoal }} /> : null}
      </div>
    </>
  );
};

const centreOf = (r: any, ox: number, oy: number, k: number, at = 0.5): [number, number] => [ox + (r.x + r.w * at) * k, oy + (r.y + r.h / 2) * k];

const rest = (fmt: Fmt): Cam => ({ s: 1, fx: fmt.W / 2, fy: centre(fmt) });

// ================================================================ 1. a design: each pick redraws the invitation
export const inviteDesign = (fmt: Fmt): SceneDef => {
  const dur = 170;
  const x = (fmt.W - fmt.cardW) / 2;
  const kT = fmt.cardW / m['title-design'].w;
  const kG = fmt.cardW / m['designs-0'].w;
  const kH = fmt.cardW / m['hero-glow'].w;
  const titleY = 78;
  const gridY = titleY + m['title-design'].h * kT + 22 * fmt.u * 1.5;
  const heroY = gridY + m['designs-0'].h * kG + 18;
  const heroH = m['hero-glow'].h * kH;
  const heroes = ['hero-tbilisi', 'hero-sunrise', 'hero-pardagi', 'hero-glow'];
  const picks = [
    { f: 50, at: centreOf(m.designs.buttons.sunrise, x, gridY, kG) },
    { f: 86, at: centreOf(m.designs.buttons.pardagi, x, gridY, kG) },
    { f: 122, at: centreOf(m.designs.buttons.glow, x, gridY, kG) },
  ];
  const cam = camPath([[0, rest(fmt)]]);
  return {
    id: 'invite-design',
    dur,
    cam,
    keys: [
      { f: 0, travel: 18, x: x + fmt.cardW * 0.8, y: heroY + heroH * 0.7 },
      ...picks.map((p) => ({ f: p.f, travel: 22, x: p.at[0], y: p.at[1] })),
    ],
    clicks: picks.map((p) => ({ f: p.f, x: p.at[0], y: p.at[1], kind: 'ring' as const })),
    render: (f) => {
      const done = picks.filter((p) => f >= p.f).length;
      const pulse = 1 + 0.018 * Math.max(...picks.map((p) => iv(f, p.f, p.f + 5) * iv(f, p.f + 5, p.f + 20, 1, 0)));
      return (
        <Shell fmt={fmt} f={f} dur={dur} cam={cam(f)}>
          <ICap name="title-design" x={x} y={titleY} k={kT} />
          {done === 0 ? <ICap name="designs-0" x={x} y={gridY} k={kG} /> : <Over a={`designs-${done - 1}`} b={`designs-${done}`} at={picks[done - 1].f} f={f} x={x} y={gridY} k={kG} len={5} />}
          <div style={{ position: 'absolute', left: x, top: heroY, width: fmt.cardW, height: heroH, borderRadius: 30 * fmt.u, overflow: 'hidden', boxShadow: shadow(fmt), transform: `scale(${pulse})` }}>
            <ICap name={heroes[0]} x={0} y={0} k={kH} />
            {picks.map((p, n) => (f >= p.f ? <ICap key={n} name={heroes[n + 1]} x={0} y={0} k={kH} style={{ opacity: fade(f, p.f + 1) }} /> : null))}
          </div>
        </Shell>
      );
    },
  };
};

// ================================================================ 2. the names: typed, and they appear on the invitation
export const inviteInfo = (fmt: Fmt): SceneDef => {
  const dur = 148;
  const pad = 22;
  const x = (fmt.W - fmt.cardW) / 2;
  const kT = fmt.cardW / m['title-info'].w;
  const k = (fmt.cardW - pad * 2) / m['info-empty'].w;
  const kH = fmt.cardW / m['hero-bare'].w;
  const titleY = 100;
  const cardY = titleY + m['title-info'].h * kT + 30;
  const cardH = m['info-empty'].h * k + pad * 2;
  const formX = x + pad;
  const formY = cardY + pad;
  const heroY = cardY + cardH + 24;
  const heroH = m['hero-bare'].h * kH;
  const I = m.info;
  const bits = m.heroBits;
  const T = { first: [20, 23, 37], partner: [45, 48, 63], date: [70, 73, 87], time: [93, 95, 103] };
  const lean: Cam = { s: 1.06, fx: fmt.W / 2, fy: heroY - 70 };
  const cam = camPath([[8, rest(fmt)], [24, lean], [92, lean], [108, rest(fmt)]]);
  const at = (r: any, a = 0.3) => centreOf(r, formX, formY, k, a);
  const [ax, ay] = at(I.first);
  const [bx, by] = at(I.partner);
  const [cx, cy] = at(I.date);
  const [dx, dy] = at(I.time);
  return {
    id: 'invite-info',
    dur,
    cam,
    keys: [
      { f: T.first[0], travel: 22, x: ax, y: ay },
      { f: T.partner[0], travel: 16, x: bx, y: by },
      { f: T.date[0], travel: 16, x: cx, y: cy },
      { f: T.time[0], travel: 14, x: dx, y: dy },
      { f: 118, travel: 14, x: x + fmt.cardW * 0.82, y: heroY + heroH * 0.52 },
    ],
    clicks: [
      { f: T.first[0], x: ax, y: ay, kind: 'ring' },
      { f: T.partner[0], x: bx, y: by, kind: 'ring' },
      { f: T.date[0], x: cx, y: cy, kind: 'ring' },
      { f: T.time[0], x: dx, y: dy, kind: 'ring' },
    ],
    render: (f) => {
      const names = 0.44 * iv(f, T.first[1], T.first[2], 0, 1, (v) => v) + 0.56 * iv(f, T.partner[1], T.partner[2], 0, 1, (v) => v);
      return (
        <Shell fmt={fmt} f={f} dur={dur} cam={cam(f)}>
          <ICap name="title-info" x={x} y={titleY} k={kT} />
          <Card fmt={fmt} x={x} y={cardY} w={fmt.cardW} h={cardH} />
          <ICap name="info-empty" x={formX} y={formY} k={k} />
          <Typed fmt={fmt} r={I.first} ox={formX} oy={formY} k={k} text="ნინო" f={f} press={T.first[0]} start={T.first[1]} end={T.first[2]} />
          <Typed fmt={fmt} r={I.partner} ox={formX} oy={formY} k={k} text="გიორგი" f={f} press={T.partner[0]} start={T.partner[1]} end={T.partner[2]} />
          <Typed fmt={fmt} r={I.date} ox={formX} oy={formY} k={k} text="18.09.2027" f={f} press={T.date[0]} start={T.date[1]} end={T.date[2]} />
          <Typed fmt={fmt} r={I.time} ox={formX} oy={formY} k={k} text="16:00" f={f} press={T.time[0]} start={T.time[1]} end={T.time[2]} />
          <div style={{ position: 'absolute', left: x, top: heroY, width: fmt.cardW, height: heroH, borderRadius: 30 * fmt.u, overflow: 'hidden', boxShadow: shadow(fmt) }}>
            <ICap name="hero-bare" x={0} y={0} k={kH} />
            <ICap name="ws-names" x={bits['ws-names'].x * kH} y={bits['ws-names'].y * kH} k={kH} style={{ clipPath: `inset(-20% ${(1 - names) * 100}% -20% 0)` }} />
            <ICap name="ws-meta" x={bits['ws-meta'].x * kH} y={bits['ws-meta'].y * kH} k={kH} style={{ opacity: iv(f, T.date[1] + 4, T.date[2] + 4) }} />
            {f >= T.time[2] ? <ICap name="ws-count" x={bits['ws-count'].x * kH} y={bits['ws-count'].y * kH} k={kH} style={{ opacity: fade(f, T.time[2], 6), transform: `scale(${pop(f, T.time[2], 13)})` }} /> : null}
          </div>
        </Shell>
      );
    },
  };
};

// ================================================================ 3. the venue: filled in, and its card lands on the invitation
export const invitePlaces = (fmt: Fmt): SceneDef => {
  const dur = 150;
  const x = (fmt.W - fmt.cardW) / 2;
  const kT = fmt.cardW / m['title-places'].w;
  const k = fmt.cardW / m['places-empty'].w;
  const kC = fmt.cardW / m['place-card'].w;
  const hForm = m['places-empty'].h * k;
  const hCard = m['place-card'].h * kC;
  const hTitle = m['title-places'].h * kT;
  const total = hTitle + 30 + hForm + 28 + hCard;
  const titleY = centre(fmt) - total / 2;
  const formY = titleY + hTitle + 30;
  const cardY = formY + hForm + 28;
  const P = m.places;
  const T = { name: [20, 23, 49], time: [56, 58, 66], addr: [72, 74, 92] };
  const [ax, ay] = centreOf(P.name, x, formY, k, 0.3);
  const [bx, by] = centreOf(P.time, x, formY, k, 0.3);
  const [cx, cy] = centreOf(P.addr, x, formY, k, 0.3);
  const LAND = 94;
  const cam = camPath([[0, rest(fmt)]]);
  return {
    id: 'invite-places',
    dur,
    cam,
    keys: [
      { f: T.name[0], travel: 22, x: ax, y: ay },
      { f: T.time[0], travel: 16, x: bx, y: by },
      { f: T.addr[0], travel: 16, x: cx, y: cy },
      { f: 112, travel: 14, x: x + fmt.cardW * 0.8, y: cardY + hCard * 0.82 },
    ],
    clicks: [
      { f: T.name[0], x: ax, y: ay, kind: 'ring' },
      { f: T.time[0], x: bx, y: by, kind: 'ring' },
      { f: T.addr[0], x: cx, y: cy, kind: 'ring' },
    ],
    render: (f) => {
      const land = iv(f, LAND, LAND + 16);
      return (
        <Shell fmt={fmt} f={f} dur={dur} cam={cam(f)}>
          <ICap name="title-places" x={x} y={titleY} k={kT} />
          <div style={{ position: 'absolute', left: x, top: formY + 16 * k, width: fmt.cardW, height: hForm - 16 * k, borderRadius: 30 * fmt.u, background: C.white, boxShadow: shadow(fmt) }} />
          <ICap name="places-empty" x={x} y={formY} k={k} />
          <Typed fmt={fmt} r={P.name} ox={x} oy={formY} k={k} text="წმინდა გიორგის ეკლესია" f={f} press={T.name[0]} start={T.name[1]} end={T.name[2]} />
          <Typed fmt={fmt} r={P.time} ox={x} oy={formY} k={k} text="16:00" f={f} press={T.time[0]} start={T.time[1]} end={T.time[2]} />
          <Typed fmt={fmt} r={P.addr} ox={x} oy={formY} k={k} text="თბილისი, ვარდების ქუჩა 12" f={f} press={T.addr[0]} start={T.addr[1]} end={T.addr[2]} />
          {f >= LAND ? (
            <div style={{ position: 'absolute', left: x, top: cardY + (1 - land) * 90, width: fmt.cardW, height: hCard, borderRadius: 30 * fmt.u, overflow: 'hidden', boxShadow: shadow(fmt), opacity: fade(f, LAND, 8) }}>
              <ICap name="place-card" x={0} y={0} k={kC} />
            </div>
          ) : null}
        </Shell>
      );
    },
  };
};

// ================================================================ 4. the finished invitation, as a guest scrolls it
export const inviteGuest = (fmt: Fmt): SceneDef => {
  const dur = 176;
  const g = m['guest-full'];
  const k = fmt.W / g.w;
  const max = g.h * k - fmt.H;
  const stops: [number, number][] = [[24, 0], [58, Math.min(max, 720)], [72, Math.min(max, 720)], [106, Math.min(max, (g.stops.places - 40) * k)], [118, Math.min(max, (g.stops.places - 40) * k)], [150, max]];
  const scroll = (f: number) => {
    let y = stops[0][1];
    for (let i = 1; i < stops.length; i++) if (f >= stops[i - 1][0]) y = lerp(stops[i - 1][1], stops[i][1], iv(f, stops[i - 1][0], stops[i][0], 0, 1, easeInOut));
    return y;
  };
  const cam = camPath([[0, rest(fmt)]]);
  const px = fmt.W * 0.86;
  return {
    id: 'invite-guest',
    dur,
    cam,
    keys: [
      { f: 16, travel: 18, x: px, y: 1120, screen: true },
      { f: 58, travel: 34, x: px, y: 980, screen: true },
      { f: 72, travel: 12, x: px, y: 1120, screen: true },
      { f: 106, travel: 34, x: px, y: 980, screen: true },
      { f: 118, travel: 12, x: px, y: 1120, screen: true },
      { f: 150, travel: 32, x: px, y: 980, screen: true },
    ],
    clicks: [],
    render: (f) => (
      <Shell fmt={fmt} f={f} dur={dur} cam={cam(f)}>
        <div style={{ position: 'absolute', left: 0, top: 0, width: fmt.W, height: fmt.H, overflow: 'hidden' }}>
          <Img src={staticFile('cap-invite/guest-full.png')} style={{ position: 'absolute', left: 0, top: -scroll(f), width: fmt.W, height: g.h * k, maxWidth: 'none' }} />
        </div>
      </Shell>
    ),
  };
};

// ================================================================ 5. shared: the link is copied, a guest answers
export const inviteShare = (fmt: Fmt): SceneDef => {
  const dur = 164;
  const pad = 22;
  const x = (fmt.W - fmt.cardW) / 2;
  const kT = fmt.cardW / m['title-share'].w;
  const k = fmt.cardW / m['share-general'].w;
  const kL = (fmt.cardW - pad * 2) / m['parties-0'].w;
  const hTitle = m['title-share'].h * kT;
  const hGen = m['share-general'].h * k;
  const hCount = m['count-0'].h * kL;
  const hList = m['parties-0'].h * kL;
  const hBox = hCount + 8 + hList + pad * 2;
  const total = hTitle + 24 + hGen + 22 + hBox;
  const titleY = centre(fmt) - total / 2;
  const genY = titleY + hTitle + 24;
  const boxY = genY + hGen + 22;
  const countY = boxY + pad;
  const listY = countY + hCount + 8;
  const S = m.share;
  const [cx, cy] = centreOf(S.copy, x, genY, k);
  const COPY = 34;
  const REPLY = 104;
  const row = S.first;
  const rowCx = x + pad + row.w * kL * 0.82;
  const rowCy = listY + (row.y + row.h / 2) * kL;
  const toastK = (fmt.cardW * 0.82) / m['share-toast'].w;
  const toastY = boxY + hBox * 0.42;
  const cam = camPath([[0, rest(fmt)]]);
  return {
    id: 'invite-share',
    dur,
    cam,
    keys: [
      { f: COPY, travel: 24, x: cx, y: cy },
      { f: 88, travel: 22, x: x + fmt.cardW * 0.8, y: genY + hGen * 0.5 },
      { f: 146, travel: 26, x: x + fmt.cardW * 0.82, y: boxY - 10 },
    ],
    clicks: [
      { f: COPY, x: cx, y: cy, kind: 'ring' },
    ],
    render: (f) => {
      const toast = iv(f, COPY + 2, COPY + 12) * iv(f, COPY + 46, COPY + 56, 1, 0);
      const flash = iv(f, REPLY, REPLY + 6) * iv(f, REPLY + 26, REPLY + 42, 1, 0);
      const age = f - REPLY;
      return (
        <Shell fmt={fmt} f={f} dur={dur} cam={cam(f)}>
          <ICap name="title-share" x={x} y={titleY} k={kT} />
          <Card fmt={fmt} x={x} y={genY} w={fmt.cardW} h={hGen} />
          <ICap name="share-general" x={x} y={genY} k={k} />
          <Card fmt={fmt} x={x} y={boxY} w={fmt.cardW} h={hBox} />
          <Over a="count-0" b="count-1" at={REPLY} f={f} x={x + pad} y={countY} k={kL} />
          <Over a="parties-0" b="parties-1" at={REPLY} f={f} x={x + pad} y={listY} k={kL} />
          {flash > 0 ? (
            <div style={{ position: 'absolute', left: x + 10, top: listY + row.y * kL + 2, width: fmt.cardW - 20, height: row.h * kL - 4, borderRadius: 16 * fmt.u, background: 'rgba(242,206,187,.32)', boxShadow: `0 0 0 ${2.5 * fmt.u}px ${C.gold}`, opacity: flash }} />
          ) : null}
          {age >= 0 && age <= 24
            ? Array.from({ length: 10 }).map((_, n) => {
                const ang = (n / 10) * Math.PI * 2 + 0.3;
                const fly = iv(age, 0, 20) * (n % 2 ? 128 : 96) * fmt.u;
                const dot = (n % 2 ? 9 : 6) * fmt.u * iv(age, 8, 24, 1, 0, (v) => v);
                return <div key={n} style={{ position: 'absolute', left: rowCx + Math.cos(ang) * fly - dot / 2, top: rowCy + Math.sin(ang) * fly - dot / 2, width: dot, height: dot, borderRadius: '50%', background: n % 3 === 0 ? C.peach : C.gold }} />;
              })
            : null}
          {toast > 0 ? (
            <ICap name="share-toast" x={(fmt.W - m['share-toast'].w * toastK) / 2} y={toastY + (1 - toast) * 40} k={toastK} style={{ opacity: toast, filter: `drop-shadow(0 ${10 * fmt.u}px ${22 * fmt.u}px rgba(48,43,45,.22))` }} />
          ) : null}
        </Shell>
      );
    },
  };
};
