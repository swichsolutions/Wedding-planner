// Each scene: real captured interface pieces, a camera, and where the pointer goes and clicks.
// Scene coordinates equal frame coordinates while the camera is at rest.
import React from 'react';
import { Img, staticFile } from 'remotion';
import { C, Cam, Cap, Fmt, NOTO, STATEMENT, Shell, Swap, Word, camPath, centre, easeIn, easeInOut, focusLeft, iv, lerp, manifest, money, pop, shadow } from './kit';

export type SKey = { f: number; travel?: number; x: number | ((f: number) => number); y: number | ((f: number) => number); screen?: boolean };
export type SClick = { f: number; x: number; y: number; kind: 'ring' | 'spark' };

export type SceneDef = {
  id: string;
  dur: number;
  cam: (f: number) => Cam;
  render: (f: number) => React.ReactNode;
  keys: SKey[];
  clicks: SClick[];
  holds?: [number, number][];
};

const num = (v: any): number => (typeof v === 'number' ? v : parseFloat(v));

// ================================================================ the opening
/** Instagram: the full photo with the hook; the photo then shrinks into the couple's real banner. */
export const opening = (fmt: Fmt, withHook: boolean): SceneDef => {
  const b = manifest.banner;
  const k = fmt.cardW / b.w;
  const bw = fmt.cardW;
  const bh = b.h * k;
  const x0 = (fmt.W - bw) / 2;
  const y0 = centre(fmt) - bh / 2;
  const morphAt = withHook ? 46 : -30;
  const shift = withHook ? 0 : -46; // the website clip has no hook: the same timing, earlier
  const dur = withHook ? 128 : 88;
  const cam = camPath([[0, { s: 1, fx: fmt.W / 2, fy: centre(fmt) }]]);
  const textAt = 76 + shift;
  return {
    id: 'opening',
    dur,
    cam,
    keys: withHook
      ? [
          { f: 0, x: fmt.W + 130, y: 1500, screen: true },
          { f: 44, travel: 26, x: fmt.W * 0.63, y: 912, screen: true },
          { f: 104, travel: 26, x: x0 + bw * 0.82, y: y0 + bh * 0.8 },
        ]
      : [{ f: 0, travel: 18, x: x0 + bw * 0.82, y: y0 + bh * 0.8 }],
    clicks: withHook ? [{ f: 44, x: fmt.W * 0.63, y: 912, kind: 'ring' }] : [],
    render: (f) => {
      const m = withHook ? iv(f, morphAt, morphAt + 30, 0, 1, easeInOut) : 1;
      const L = lerp(0, x0, m);
      const T = lerp(0, y0, m);
      const w = lerp(fmt.W, bw, m);
      const h = lerp(fmt.H, bh, m);
      const r = lerp(0, b.radius * k, m);
      const burns = withHook ? lerp(1.13, 1.0, iv(f, 0, morphAt + 30, 0, 1, (v) => v)) : 1;
      const photo = iv(m, 0.3, 0.95, 1, 0, (v) => v);
      const reveal = iv(f, textAt, textAt + 24, 0, 1, easeInOut);
      const push = 1 + iv(f, textAt, dur, 0, 0.035, (v) => v);
      const days = Math.round(lerp(380, 317, iv(f, textAt + 6, textAt + 34)));
      return (
        <Shell fmt={fmt} f={f} dur={dur} cam={cam(f)} noEnter={withHook}>
          <div style={{ position: 'absolute', left: L, top: T, width: w, height: h, borderRadius: r, overflow: 'hidden', boxShadow: m > 0.5 ? shadow(fmt) : undefined, transform: `scale(${push})` }}>
            <Img src={staticFile('cap/banner-notext.png')} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
            {photo > 0 ? (
              <Img src={staticFile('cap/hero-tall.webp')} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', opacity: photo, transform: `scale(${burns})` }} />
            ) : null}
            {photo > 0 ? <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, rgba(34,30,32,.15) 0%, rgba(34,30,32,.5) 42%, rgba(34,30,32,.2) 100%)', opacity: photo }} /> : null}
            {reveal > 0 ? (
              <>
                <Img
                  src={staticFile('cap/banner.png')}
                  style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', clipPath: `inset(0 ${(1 - reveal) * 100}% 0 0)` }}
                />
                <div
                  style={{
                    position: 'absolute', left: b.days.x * k, top: b.days.y * k, height: b.days.h * k, display: 'flex', alignItems: 'center', fontFamily: NOTO, fontWeight: 400,
                    fontSize: b.days.size * k, color: C.white, opacity: reveal, fontVariantNumeric: 'tabular-nums',
                  }}
                >
                  {days}
                </div>
              </>
            ) : null}
          </div>
          {withHook ? <Hook fmt={fmt} f={f} leaveAt={morphAt} /> : null}
        </Shell>
      );
    },
  };
};

const Hook: React.FC<{ fmt: Fmt; f: number; leaveAt: number }> = ({ fmt, f, leaveAt }) => {
  const out = iv(f, leaveAt, leaveAt + 14, 0, 1, easeIn);
  if (out >= 1) return null;
  const line = (i: number) => iv(f, -14 + i * 8, 4 + i * 8);
  const mark = iv(f, 2, 15, 0, 1, easeInOut);
  const size = 188;
  return (
    <div style={{ position: 'absolute', left: 80, right: 60, top: 640, transform: `translateY(${-out * 170}px)`, opacity: 1 - out, fontFamily: STATEMENT, fontWeight: 500, fontSize: size, lineHeight: 1.14 }}>
      <div style={{ overflow: 'hidden', paddingBottom: 18 }}>
        <div style={{ color: C.white, transform: `translateY(${(1 - line(0)) * 112}%)`, textShadow: '0 6px 34px rgba(34,30,32,.4)' }}>ქორწილს</div>
      </div>
      <div style={{ position: 'relative', overflow: 'hidden', display: 'inline-block', paddingBottom: 18 }}>
        <div style={{ position: 'absolute', left: 0, top: 16, bottom: 12, width: '100%', background: C.peach, borderRadius: 18, transform: `scaleX(${mark})`, transformOrigin: 'left center' }} />
        <div style={{ position: 'relative', padding: '0 26px', color: C.white, transform: `translateY(${(1 - line(1)) * 112}%)` }}>
          გეგმავ?
          <div style={{ position: 'absolute', left: 26, top: 0, color: C.charcoal, whiteSpace: 'nowrap', clipPath: `inset(-20% ${(1 - mark) * 112 - 6}% -20% -6%)` }}>გეგმავ?</div>
        </div>
      </div>
    </div>
  );
};

export const openingCaption: Word[] = [{ t: 'ყველაფერი' }, { t: '', br: true }, { t: 'ერთ' }, { t: 'ადგილას', mark: true }];

// ================================================================ tasks: two ticks, the bar grows
export const tasks = (fmt: Fmt): SceneDef => {
  const dur = 104;
  const k = fmt.cardW / manifest['tasks-stage-0'].w;
  const x = (fmt.W - fmt.cardW) / 2;
  const headH = manifest['tasks-head-0'].h * k;
  const stageH = manifest['tasks-stage-0'].h * k;
  const total = headH + 20 * k + stageH;
  const top = centre(fmt) - total / 2 + (fmt.captions ? 22 : 0);
  const stageY = top + headH + 20 * k;
  const chk = (i: number): [number, number] => {
    const c = manifest.tasks.checks[i];
    return [x + (c.x + c.w / 2) * k, stageY + (c.y + c.h / 2) * k];
  };
  const [c0x, c0y] = chk(0);
  const [c1x, c1y] = chk(1);
  const rest: Cam = { s: 1, fx: fmt.W / 2, fy: centre(fmt) };
  const zoom: Cam = { s: 1.3, fx: focusLeft(fmt, 1.3, x, 26 * fmt.u), fy: lerp(c0y, c1y, 0.5) + 150 * fmt.u };
  const cam = camPath([[14, rest], [30, zoom], [76, zoom], [90, rest]]);
  const T1 = 40;
  const T2 = 66;
  const track = manifest.tasks.barTrack;
  const bars = manifest.tasks.bar.map((b: any) => num(b.w));
  return {
    id: 'tasks',
    dur,
    cam,
    keys: [
      { f: T1, travel: 22, x: c0x, y: c0y },
      { f: T2, travel: 16, x: c1x, y: c1y },
      { f: 92, travel: 18, x: x + fmt.cardW * 0.86, y: stageY + stageH * 0.72 },
    ],
    clicks: [
      { f: T1, x: c0x, y: c0y, kind: 'spark' },
      { f: T2, x: c1x, y: c1y, kind: 'spark' },
    ],
    render: (f) => {
      const barW = lerp(lerp(bars[0], bars[1], iv(f, T1, T1 + 16)), bars[2], iv(f, T2, T2 + 16));
      return (
        <Shell fmt={fmt} f={f} dur={dur} cam={cam(f)}>
          {f < T2 ? (
            <Swap a="tasks-head-0" b="tasks-head-1" at={T1} f={f} x={x} y={top} k={k} />
          ) : (
            <Swap a="tasks-head-1" b="tasks-head-2" at={T2} f={f} x={x} y={top} k={k} />
          )}
          <div style={{ position: 'absolute', left: x + track.x * k, top: top + track.y * k, width: track.w * k, height: track.h * k * 1.5, borderRadius: 99, background: C.ivoryDeep, overflow: 'hidden' }}>
            <div style={{ width: barW * k, height: '100%', borderRadius: 99, background: C.charcoal }} />
          </div>
          <div style={{ position: 'absolute', left: x, top: stageY, width: fmt.cardW, height: stageH, borderRadius: manifest.tasks.stageRadius * k, background: C.white, boxShadow: shadow(fmt) }} />
          {f < T2 ? (
            <Swap a="tasks-stage-0" b="tasks-stage-1" at={T1} f={f} x={x} y={stageY} k={k} />
          ) : (
            <Swap a="tasks-stage-1" b="tasks-stage-2" at={T2} f={f} x={x} y={stageY} k={k} />
          )}
        </Shell>
      );
    },
  };
};
export const tasksCaption: Word[] = [{ t: 'რა' }, { t: 'უნდა' }, { t: 'გააკეთო' }, { t: '', br: true }, { t: 'და' }, { t: 'როდის', mark: true }];

// ================================================================ budget: a total typed in, services appear, numbers roll
export const budget = (fmt: Fmt): SceneDef => {
  const dur = 124;
  const pad = 34 * fmt.u;
  const x = (fmt.W - fmt.cardW) / 2;
  const k = (fmt.cardW - pad * 2) / manifest['budget-sum'].w;
  const sumH = manifest['budget-sum'].h * k + pad * 2;
  const top = fmt.regionTop;
  const ix = x + pad;
  const iy = top + pad;
  const b = manifest.budget;
  const tabsY = top + sumH + 26 * fmt.u;
  const input = b.total;
  const inputCx = ix + (input.x + input.w * 0.45) * k;
  const inputCy = iy + (input.y + input.h / 2) * k;
  const chipCx = ix + (b.tabs[0].x + b.tabs[0].w / 2) * k;
  const chipCy = tabsY + (b.tabs[0].y + b.tabs[0].h / 2) * k;
  const rest: Cam = { s: 1, fx: fmt.W / 2, fy: centre(fmt) };
  const lean: Cam = { s: 1.32, fx: focusLeft(fmt, 1.32, x, 30 * fmt.u), fy: inputCy + 210 * fmt.u };
  const cam = camPath([[10, rest], [24, lean], [50, lean], [66, rest]]);
  const PRESS = 24;
  const TYPE = 28;
  const ROLL = TYPE + 24;
  const CHIP = 90;
  const typed = '25000';
  return {
    id: 'budget',
    dur,
    cam,
    keys: [
      { f: PRESS, travel: 20, x: inputCx, y: inputCy },
      { f: CHIP, travel: 22, x: chipCx, y: chipCy },
      { f: 114, travel: 16, x: x + fmt.cardW * 0.8, y: tabsY + 170 * fmt.u },
    ],
    clicks: [
      { f: PRESS, x: inputCx, y: inputCy, kind: 'ring' },
      { f: CHIP, x: chipCx, y: chipCy, kind: 'ring' },
    ],
    render: (f) => {
      const chars = Math.floor(iv(f, TYPE, TYPE + 20, 0, typed.length, (v) => v));
      const focused = f >= PRESS;
      const caret = focused && Math.floor(f / 9) % 2 === 0;
      const planned = iv(f, ROLL, ROLL + 22);
      const agreed = iv(f, CHIP + 2, CHIP + 20);
      const finals = [25000, 10000, 3000, 7000];
      const shown = [finals[0] * planned, finals[1] * agreed, finals[2] * agreed, finals[3] * agreed];
      const fillP = [planned, agreed, agreed];
      return (
        <Shell fmt={fmt} f={f} dur={dur} cam={cam(f)}>
          <div style={{ position: 'absolute', left: x, top, width: fmt.cardW, height: sumH, borderRadius: 30 * fmt.u, background: C.white, boxShadow: shadow(fmt) }} />
          <Cap name="budget-sum" x={ix} y={iy} k={k} />
          {focused ? (
            <div style={{ position: 'absolute', left: ix + input.x * k, top: iy + input.y * k, width: input.w * k, height: input.h * k, borderRadius: 4 * k, boxShadow: `0 0 0 ${2.5 * fmt.u}px ${C.charcoal}`, opacity: iv(f, PRESS, PRESS + 5) * iv(f, ROLL + 6, ROLL + 14, 1, 0) }} />
          ) : null}
          <div
            style={{
              position: 'absolute', left: ix + (input.x + input.paddingLeft) * k, top: iy + input.y * k, height: input.h * k, display: 'flex', alignItems: 'center',
              fontFamily: NOTO, fontWeight: 600, fontSize: input.size * k, color: C.charcoal,
            }}
          >
            {typed.slice(0, chars)}
            {caret ? <span style={{ display: 'inline-block', width: 2.4 * k, height: input.size * k * 1.1, marginLeft: 2 * k, background: C.charcoal }} /> : null}
          </div>
          {b.values.map((v: any, i: number) => (
            <div
              key={i}
              style={{
                position: 'absolute', left: ix + v.x * k, top: iy + v.y * k, height: v.h * k, display: 'flex', alignItems: 'center', whiteSpace: 'nowrap',
                fontFamily: NOTO, fontWeight: 600, fontSize: v.size * k, color: C.charcoal, fontVariantNumeric: 'tabular-nums',
              }}
            >
              {money(shown[i])}
            </div>
          ))}
          {b.fills.map((v: any, i: number) => (
            <div
              key={i}
              style={{ position: 'absolute', left: ix + v.x * k, top: iy + v.y * k, width: b.final.fills[i] * k * fillP[i], height: v.h * k, borderRadius: 99, background: v.bg }}
            />
          ))}
          {b.tabs.map((t: any, i: number) => {
            const at = ROLL + 2 + i * 2;
            if (f < at) return null;
            const s = pop(f, at, 13);
            return <Cap key={i} name={t.name} x={ix + t.x * k} y={tabsY + t.y * k} k={k} style={{ transform: `scale(${s})`, opacity: iv(f, at, at + 5) }} />;
          })}
        </Shell>
      );
    },
  };
};
export const budgetCaption: Word[] = [{ t: 'ბიუჯეტი' }, { t: '', br: true }, { t: 'კონტროლის', mark: true }, { t: 'ქვეშ' }];

// ================================================================ guests: a reply comes in
export const guests = (fmt: Fmt): SceneDef => {
  const dur = 104;
  const k = fmt.cardW / manifest['guests-stats-0'].w;
  const x = (fmt.W - fmt.cardW) / 2;
  const statsH = manifest['guests-stats-0'].h * k;
  const r0 = manifest['guests-row-0'].h * k;
  const rB = manifest['guests-row-b'].h * k;
  const rC = manifest['guests-row-c'].h * k;
  const listH = r0 + rB + rC;
  const total = statsH + 26 * k * 0.6 + listH;
  const top = Math.max(fmt.regionTop, centre(fmt) - total / 2);
  const listY = top + statsH + 16 * k;
  const sel = manifest.guests.select;
  const selCx = x + (sel.x + sel.w * 0.5) * k;
  const selCy = listY + (sel.y + sel.h * 0.5) * k;
  const menuX = x + sel.x * k;
  const menuY = listY + (sel.y + sel.h + 4) * k;
  const optH = 42 * k;
  const OPEN = 30;
  const CHOOSE = 54;
  const yesCx = menuX + sel.w * 0.42 * k;
  const yesCy = menuY + optH * 0.5 + 6 * k;
  const stat = (i: number): [number, number] => {
    const s = manifest.guests.stats[i];
    return [x + (s.x + s.w * 0.5) * k, top + (s.y + s.h * 0.5) * k];
  };
  const rest: Cam = { s: 1, fx: fmt.W / 2, fy: centre(fmt) };
  const zoom: Cam = { s: 1.12, fx: fmt.W / 2, fy: listY + 130 * k };
  const cam = camPath([[12, rest], [26, zoom], [60, zoom], [74, rest]]);
  const [s0x, s0y] = stat(0);
  return {
    id: 'guests',
    dur,
    cam,
    keys: [
      { f: OPEN, travel: 20, x: selCx, y: selCy },
      { f: CHOOSE, travel: 16, x: yesCx, y: yesCy },
      { f: 84, travel: 22, x: s0x + 30 * fmt.u, y: s0y + 34 * fmt.u },
    ],
    clicks: [
      { f: OPEN, x: selCx, y: selCy, kind: 'ring' },
      { f: CHOOSE, x: yesCx, y: yesCy, kind: 'ring' },
      { f: CHOOSE + 18, x: s0x, y: s0y, kind: 'spark' },
    ],
    render: (f) => {
      const open = iv(f, OPEN, OPEN + 9) * iv(f, CHOOSE + 2, CHOOSE + 9, 1, 0);
      const hover = iv(f, CHOOSE - 12, CHOOSE - 4);
      const flash = iv(f, CHOOSE + 16, CHOOSE + 22) * iv(f, CHOOSE + 30, CHOOSE + 50, 1, 0);
      return (
        <Shell fmt={fmt} f={f} dur={dur} cam={cam(f)}>
          <Swap a="guests-stats-0" b="guests-stats-1" at={CHOOSE + 16} f={f} x={x} y={top} k={k} len={6} />
          {[0, 1].map((i) => {
            const s = manifest.guests.stats[i];
            return flash > 0 ? (
              <div key={i} style={{ position: 'absolute', left: x + s.x * k, top: top + s.y * k, width: s.w * k, height: s.h * k, borderRadius: 16 * k, boxShadow: `0 0 0 ${3.5 * fmt.u}px ${C.gold}`, opacity: flash }} />
            ) : null;
          })}
          <div style={{ position: 'absolute', left: x, top: listY - 6 * k, width: fmt.cardW, height: listH + 12 * k, borderRadius: 18 * k, background: C.white, boxShadow: shadow(fmt) }} />
          <Swap a="guests-row-0" b="guests-row-1" at={CHOOSE + 2} f={f} x={x} y={listY} k={k} />
          <Cap name="guests-row-b" x={x} y={listY + r0} k={k} />
          <Cap name="guests-row-c" x={x} y={listY + r0 + rB} k={k} />
          {open > 0 ? (
            <div
              style={{
                position: 'absolute', left: menuX, top: menuY, width: sel.w * k * 1.08, padding: `${6 * k}px 0`, borderRadius: 12 * k, background: C.white, boxShadow: `0 ${18 * fmt.u}px ${44 * fmt.u}px rgba(48,43,45,.26)`,
                transformOrigin: 'top left', transform: `scale(${lerp(0.9, 1, open)})`, opacity: open,
              }}
            >
              {manifest.guests.options.map((o: any, i: number) => (
                <div
                  key={o.value}
                  style={{
                    height: optH, display: 'flex', alignItems: 'center', padding: `0 ${14 * k}px`, fontFamily: NOTO, fontSize: 15 * k, color: C.charcoal,
                    background: i === 0 ? `rgba(242,206,187,${hover})` : 'transparent',
                  }}
                >
                  {o.text}
                </div>
              ))}
            </div>
          ) : null}
        </Shell>
      );
    },
  };
};
export const guestsCaption: Word[] = [{ t: 'ვინ' }, { t: 'მოდის', mark: true }, { t: '', br: true }, { t: 'და' }, { t: 'ვინ' }, { t: 'არა' }];

// ================================================================ seating: tables on the venue's real plan
export const seating = (fmt: Fmt): SceneDef => {
  const dur = 168;
  const planW = fmt.cardW;
  const k = planW / manifest.plan.w;
  const planH = manifest.plan.h * k;
  const x = (fmt.W - planW) / 2;
  const top = centre(fmt) - planH / 2 - (fmt.captions ? 40 : 0);
  const T = manifest.seating.tables;
  const centreOf = (i: number): [number, number] => [x + (T[i].x + T[i].w / 2) * k, top + (T[i].y + T[i].h / 2) * k];
  const DROP = [0, 2, 3, 4, 5, 7];
  const FIRST = 16;
  // table 7 (index 6) is dragged in by hand, from the empty floor beside the entrance
  const [t6x, t6y] = centreOf(6);
  const dragFromX = t6x + 250 * k;
  const dragFromY = t6y + 118 * k;
  const GRAB = 62;
  const DROPPED = 90;
  const dragP = (f: number) => iv(f, GRAB + 2, DROPPED, 0, 1, easeInOut);
  const dragX = (f: number) => lerp(dragFromX, t6x, dragP(f));
  const dragY = (f: number) => lerp(dragFromY, t6y, dragP(f));
  // then a guest takes a seat at table 2 (index 1)
  const [t1x, t1y] = centreOf(1);
  const seat = manifest.seating.seat;
  const seatX = x + (T[1].x + seat.x) * k;
  const seatY = top + (T[1].y + seat.y) * k;
  const chipW = manifest['guest-chip'].w * k * 0.95;
  const chipH = manifest['guest-chip'].h * k * 0.95;
  const chipFromX = t1x + 128 * k;
  const chipFromY = t1y + 142 * k;
  const CHIP_IN = 96;
  const CHIP_GRAB = 112;
  const SEATED = 136;
  const chipP = (f: number) => iv(f, CHIP_GRAB + 2, SEATED, 0, 1, easeInOut);
  const chipX = (f: number) => lerp(chipFromX, seatX, chipP(f));
  const chipY = (f: number) => lerp(chipFromY, seatY, chipP(f));
  const rest: Cam = { s: 1, fx: fmt.W / 2, fy: centre(fmt) };
  const low: Cam = { s: 1.28, fx: focusLeft(fmt, 1.28, x + planW * 0.2, 0), fy: t6y - 190 * k };
  const zoom: Cam = { s: 2.05, fx: t1x, fy: t1y + 110 * k };
  const cam = camPath([[48, rest], [64, low], [92, low], [112, zoom], [146, zoom], [160, rest]]);
  return {
    id: 'seating',
    dur,
    cam,
    holds: [[GRAB, DROPPED], [CHIP_GRAB, SEATED]],
    keys: [
      { f: GRAB, travel: 26, x: dragFromX, y: dragFromY },
      { f: GRAB + 1, travel: 0, x: dragX, y: dragY },
      { f: CHIP_GRAB, travel: 20, x: chipFromX, y: chipFromY },
      { f: CHIP_GRAB + 1, travel: 0, x: chipX, y: chipY },
      { f: 160, travel: 18, x: t1x + 190 * k, y: t1y + 130 * k },
    ],
    clicks: [
      { f: DROPPED, x: t6x, y: t6y, kind: 'ring' },
      { f: SEATED, x: seatX, y: seatY, kind: 'spark' },
    ],
    render: (f) => {
      const wipe = iv(f, 2, 22, 0, 1, easeInOut);
      const lifted = iv(f, GRAB, GRAB + 6) * iv(f, DROPPED - 2, DROPPED + 2, 1, 0);
      const land = f >= DROPPED ? pop(f, DROPPED, 12) : 1;
      const t = (i: number) => {
        const m = manifest[`table-${i}`];
        return { w: m.w * k, h: m.h * k };
      };
      const size = t(0);
      const chipOn = iv(f, CHIP_IN, CHIP_IN + 10) * iv(f, SEATED - 2, SEATED + 2, 1, 0);
      const chipGrab = iv(f, CHIP_GRAB, CHIP_GRAB + 5);
      return (
        <Shell fmt={fmt} f={f} dur={dur} cam={cam(f)}>
          <div style={{ position: 'absolute', left: x, top, width: planW, height: planH, borderRadius: 26 * fmt.u, background: C.white, boxShadow: shadow(fmt), overflow: 'hidden' }}>
            <div style={{ position: 'absolute', inset: 0, clipPath: `inset(0 ${(1 - wipe) * 100}% 0 0)` }}>
              <Cap name="plan" x={0} y={0} k={k} />
            </div>
          </div>
          {DROP.map((i, n) => {
            const at = FIRST + n * 5;
            if (f < at) return null;
            const [cx, cy] = centreOf(i);
            const s = lerp(1.7, 1, iv(f, at, at + 12)) * (f > at + 11 ? pop(f, at + 8, 8) : 1);
            return <Cap key={i} name={`table-${i}`} x={cx - size.w / 2} y={cy - size.h / 2} k={k} style={{ transform: `scale(${s})`, opacity: iv(f, at, at + 5) }} />;
          })}
          {f >= FIRST + 30 ? (
            f < SEATED ? (
              <Cap name="table-1" x={t1x - size.w / 2} y={t1y - size.h / 2} k={k} style={{ opacity: iv(f, FIRST + 30, FIRST + 36), transform: `scale(${lerp(1.7, 1, iv(f, FIRST + 30, FIRST + 42))})` }} />
            ) : (
              <Cap name="table-1-seated" x={t1x - size.w / 2} y={t1y - size.h / 2} k={k} />
            )
          ) : null}
          {f >= GRAB - 22 ? (
            <Cap
              name="table-6"
              x={dragX(f) - size.w / 2}
              y={dragY(f) - size.h / 2}
              k={k}
              style={{
                opacity: iv(f, GRAB - 22, GRAB - 14),
                transform: `scale(${(1 + lifted * 0.1) * land})`,
                filter: lifted > 0.02 ? `drop-shadow(0 ${22 * fmt.u * lifted}px ${22 * fmt.u * lifted}px rgba(48,43,45,.3))` : undefined,
              }}
            />
          ) : null}
          {chipOn > 0 ? (
            <div
              style={{
                position: 'absolute', left: chipX(f) - chipW / 2, top: chipY(f) - chipH / 2, width: chipW, height: chipH, opacity: chipOn, borderRadius: 99,
                background: C.white, boxShadow: `0 ${(8 + chipGrab * 14) * fmt.u}px ${(16 + chipGrab * 22) * fmt.u}px rgba(48,43,45,.26)`,
                transform: `scale(${lerp(0.82, 1, iv(f, CHIP_IN, CHIP_IN + 12)) * lerp(1, 0.72, chipP(f))})`,
              }}
            >
              <Cap name="guest-chip" x={0} y={0} k={k * 0.95} />
            </div>
          ) : null}
        </Shell>
      );
    },
  };
};
export const seatingCaption: Word[] = [{ t: 'მაგიდები' }, { t: '', br: true }, { t: 'დარბაზის\u00a0გეგმაზე', mark: true }];

// ================================================================ the ending: the knot draws itself
const KNOT = 'M32 32 C23.3 14.6 5.9 17.5 5.9 32 C5.9 46.5 23.3 49.4 32 32 C40.7 14.6 58.1 17.5 58.1 32 C58.1 46.5 40.7 49.4 32 32 Z';

export const ending = (fmt: Fmt): SceneDef => {
  const dur = 100;
  const cy = centre(fmt);
  const rest: Cam = { s: 1, fx: fmt.W / 2, fy: cy };
  const cam = camPath([[0, rest]]);
  const btnW = 760;
  const btnH = 148;
  const btnY = 1000;
  const CLICK = 66;
  return {
    id: 'ending',
    dur,
    cam,
    keys: [
      { f: CLICK, travel: 26, x: fmt.W / 2 + 130, y: btnY + btnH * 0.56, screen: true },
      { f: 92, travel: 18, x: fmt.W / 2 + 330, y: btnY + 330, screen: true },
    ],
    clicks: [{ f: CLICK, x: fmt.W / 2 + 130, y: btnY + btnH * 0.56, kind: 'spark' }],
    render: (f) => {
      const draw = iv(f, 6, 40, 0, 1, easeInOut);
      const word = iv(f, 26, 44);
      const btn = f >= 36 ? pop(f, 36, 16) : 0;
      const press = iv(f, CLICK - 3, CLICK) * iv(f, CLICK, CLICK + 8, 1, 0);
      const url = iv(f, 48, 64);
      const wm = manifest.wordmark;
      const wmK = 640 / wm.w;
      return (
        <Shell fmt={fmt} f={f} dur={dur} cam={cam(f)} noExit>
          <svg width={330} height={330} viewBox="0 0 64 64" style={{ position: 'absolute', left: fmt.W / 2 - 165, top: 430, overflow: 'visible' }}>
            <path d={KNOT} fill="none" stroke={C.gold} strokeWidth={6.4} strokeLinecap="round" pathLength={1} strokeDasharray={1} strokeDashoffset={1 - draw} />
          </svg>
          <div style={{ position: 'absolute', left: 0, right: 0, top: 790, height: wm.h * wmK, opacity: word, transform: `translateY(${(1 - word) * 36}px)` }}>
            <Cap name="wordmark" x={fmt.W / 2 - (wm.w * wmK) / 2} y={0} k={wmK} />
          </div>
          <div
            style={{
              position: 'absolute', left: fmt.W / 2 - btnW / 2, top: btnY, width: btnW, height: btnH, borderRadius: 99, background: C.evergreen, display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontFamily: STATEMENT, fontWeight: 500, fontSize: 66, color: C.white, transform: `scale(${btn * (1 - press * 0.05)})`, boxShadow: shadow(fmt),
            }}
          >
            დაიწყე უფასოდ
          </div>
          <div style={{ position: 'absolute', left: 0, right: 0, top: btnY + btnH + 54, textAlign: 'center', fontFamily: STATEMENT, fontWeight: 500, fontSize: 58, color: C.charcoal, opacity: url, transform: `translateY(${(1 - url) * 26}px)` }}>
            weddingplanner.ge
          </div>
        </Shell>
      );
    },
  };
};
