import { BootstrapContext, bootstrapApplication } from '@angular/platform-browser';
import { setActiveConsumer } from '@angular/core/primitives/signals';
import { App } from './app/app';
import { config } from './app/app.config.server';

// A render killed for CPU never runs Angular's cleanup, which leaves its "inside a reactive context"
// flag set for the whole isolate: every later render in it then dies with NG0600 until Cloudflare
// replaces the isolate (the outages of 2026-11-06). No reactive work spans renders, so each one can
// start clean. It has to be here: the Worker's own bundle (server.mjs) holds a separate copy of the flag.
const bootstrap = (context: BootstrapContext) => {
    setActiveConsumer(null);
    return bootstrapApplication(App, config, context);
};

export default bootstrap;
