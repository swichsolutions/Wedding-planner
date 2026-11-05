import React from 'react';
import { Composition, registerRoot } from 'remotion';
import { IG, WEB } from './kit';
import { Instagram, Website, igLength, webLength } from './Story';

const Root: React.FC = () => (
  <>
    <Composition id="Instagram" component={Instagram} durationInFrames={igLength} fps={30} width={IG.W} height={IG.H} />
    <Composition id="Website" component={Website} durationInFrames={webLength} fps={30} width={WEB.W} height={WEB.H} />
  </>
);

registerRoot(Root);
