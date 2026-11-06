import React from 'react';
import { Composition, registerRoot } from 'remotion';
import { IG, WEB } from './kit';
import { Instagram, InviteClip, Website, igLength, inviteLength, webLength } from './Story';

const Root: React.FC = () => (
  <>
    <Composition id="Instagram" component={Instagram} durationInFrames={igLength} fps={30} width={IG.W} height={IG.H} />
    <Composition id="Website" component={Website} durationInFrames={webLength} fps={30} width={WEB.W} height={WEB.H} />
    <Composition id="Invitation" component={InviteClip} durationInFrames={inviteLength} fps={30} width={WEB.W} height={WEB.H} />
  </>
);

registerRoot(Root);
