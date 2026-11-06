// Puts the scenes on one timeline, with one pointer travelling through all of them.
import React from 'react';
import { AbsoluteFill, useCurrentFrame } from 'remotion';
import { Backdrop, C, Caption, Click, ClickFx, Fmt, IG, PKey, Pointer, WEB, Word, iv, toScreen } from './kit';
import {
  SceneDef, budget, budgetCaption, ending, guests, guestsCaption, opening, openingCaption, seating, seatingCaption, tasks, tasksCaption,
} from './scenes';
import { inviteDesign, inviteGuest, inviteInfo, invitePlaces, inviteShare } from './invite';

const OVERLAP = 8;

type Placed = { def: SceneDef; from: number; caption?: Word[] };

const place = (list: { def: SceneDef; caption?: Word[]; from?: number }[]): Placed[] => {
  const out: Placed[] = [];
  let at = 0;
  for (const s of list) {
    const from = s.from ?? at;
    out.push({ def: s.def, from, caption: s.caption });
    at = from + s.def.dur - OVERLAP;
  }
  return out;
};

const compile = (fmt: Fmt, placed: Placed[]) => {
  const keys: PKey[] = [];
  const clicks: Click[] = [];
  const presses: number[] = [];
  const holds: [number, number][] = [];
  const val = (v: number | ((f: number) => number), f: number) => (typeof v === 'function' ? v(f) : v);
  for (const { def, from } of placed) {
    for (const k of def.keys) {
      keys.push({
        f: from + k.f,
        travel: k.travel ?? 0,
        at: (t) => {
          const f = t - from;
          const x = val(k.x, f);
          const y = val(k.y, f);
          return k.screen ? [x, y] : toScreen(fmt, def.cam(f), x, y);
        },
      });
    }
    for (const c of def.clicks) {
      presses.push(from + c.f);
      clicks.push({ f: from + c.f, kind: c.kind, at: (t) => toScreen(fmt, def.cam(t - from), c.x, c.y) });
    }
    for (const [a, b] of def.holds ?? []) holds.push([from + a, from + b]);
  }
  keys.sort((a, b) => a.f - b.f);
  return { keys, clicks, presses, holds };
};

/** `duration`: how many video frames the `length` frames of the story take; more than `length` runs it slower. */
const Timeline: React.FC<{ fmt: Fmt; placed: Placed[]; length: number; duration?: number }> = ({ fmt, placed, length, duration = length }) => {
  const t = (useCurrentFrame() * length) / duration;
  const { keys, clicks, presses, holds } = compile(fmt, placed);
  let bump = 0;
  for (const p of placed) bump = Math.max(bump, iv(t, p.from - 6, p.from + 6, 0, 1) * iv(t, p.from + 6, p.from + 30, 1, 0));
  return (
    <AbsoluteFill style={{ overflow: 'hidden' }}>
      <Backdrop fmt={fmt} t={t} bump={bump} length={length} />
      {placed.map(({ def, from }) => {
        const f = t - from;
        if (f < 0 || f > def.dur) return null;
        return <React.Fragment key={`${def.id}-${from}`}>{def.render(f)}</React.Fragment>;
      })}
      {fmt.captions ? (
        // cards slide under the text: an ivory band holds the top of the frame while captions are on
        <div
          style={{
            position: 'absolute', left: 0, right: 0, top: 0, height: fmt.regionTop + 6,
            background: `linear-gradient(180deg, ${C.ivory} 90%, rgba(250,247,242,0) 100%)`,
            opacity: iv(t, 66, 76, 0, 1) * iv(t, placed[placed.length - 1].from - 4, placed[placed.length - 1].from + 3, 1, 0),
          }}
        />
      ) : null}
      {placed.map(({ def, from, caption }) => {
        const f = t - from;
        if (!caption || f < 0 || f > def.dur) return null;
        return <Caption key={`c-${def.id}-${from}`} fmt={fmt} words={caption} f={f} dur={def.dur} start={def.id === 'opening' ? 66 : 6} />;
      })}
      <ClickFx fmt={fmt} clicks={clicks} t={t} />
      <Pointer fmt={fmt} keys={keys} presses={presses} holds={holds} t={t} />
    </AbsoluteFill>
  );
};

// ---------------------------------------------------------------- Instagram: hook, the tour, the call to action
const igList = () =>
  place([
    { def: opening(IG, true), caption: openingCaption },
    { def: tasks(IG), caption: tasksCaption },
    { def: budget(IG), caption: budgetCaption },
    { def: guests(IG), caption: guestsCaption },
    { def: seating(IG), caption: seatingCaption },
    { def: ending(IG) },
  ]);
export const igLength = (() => {
  const l = igList();
  const last = l[l.length - 1];
  return last.from + last.def.dur;
})();
export const Instagram: React.FC = () => <Timeline fmt={IG} placed={igList()} length={igLength} />;

// ---------------------------------------------------------------- website: the tour alone, looping without a seam
// The opening starts 20 frames before the clip, so at frame 0 its card has just settled. It comes in
// again over the last scene's exit at the same point of its life, so the last frame runs into the first.
const LEAD = 24;
const webList = () => place([{ def: opening(WEB, false), from: -LEAD }, { def: tasks(WEB) }, { def: budget(WEB) }, { def: guests(WEB) }, { def: seating(WEB) }]);
export const webLength = (() => {
  const l = webList();
  const last = l[l.length - 1];
  return last.from + last.def.dur - OVERLAP + LEAD;
})();
export const Website: React.FC = () => {
  const list = webList();
  const again = { ...list[0], from: webLength - LEAD };
  return <Timeline fmt={WEB} placed={[...list, again]} length={webLength} />;
};

// ---------------------------------------------------------------- invitations page: the same kind of loop, a little slower
const INVITE_PACE = 1.1;
const inviteList = () => place([{ def: inviteDesign(WEB), from: -LEAD }, { def: inviteInfo(WEB) }, { def: invitePlaces(WEB) }, { def: inviteGuest(WEB) }, { def: inviteShare(WEB) }]);
const inviteStory = (() => {
  const l = inviteList();
  const last = l[l.length - 1];
  return last.from + last.def.dur - OVERLAP + LEAD;
})();
export const inviteLength = Math.round(inviteStory * INVITE_PACE);
export const InviteClip: React.FC = () => {
  const list = inviteList();
  const again = { ...list[0], from: inviteStory - LEAD };
  return <Timeline fmt={WEB} placed={[...list, again]} length={inviteStory} duration={inviteLength} />;
};
