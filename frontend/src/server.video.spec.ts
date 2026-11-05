import { describe, expect, it } from 'vitest';
import { AssetFetcher, isVideoPath, serveVideo } from './server.video';

const FILE = new Uint8Array(1000).map((_, i) => i % 251);
const URL_ = 'https://weddingplanner.ge/media/organizer.mp4';

/** Like Workers Static Assets: ignores Range, answers 304 to a matching If-None-Match. */
const assets: AssetFetcher = {
  fetch: async (req) =>
    req.headers.get('if-none-match') === '"v1"'
      ? new Response(null, { status: 304, headers: { etag: '"v1"' } })
      : new Response(FILE, { status: 200, headers: { 'content-type': 'video/mp4', etag: '"v1"', 'content-length': '1000' } }),
};

const get = (headers: Record<string, string> = {}, method = 'GET') => serveVideo(new Request(URL_, { method, headers }), assets);

describe('serveVideo', () => {
  it('answers the first probe Safari sends, bytes=0-1, with exactly two bytes', async () => {
    const res = await get({ range: 'bytes=0-1' });
    expect(res.status).toBe(206);
    expect(res.headers.get('content-range')).toBe('bytes 0-1/1000');
    expect(res.headers.get('content-length')).toBe('2');
    expect(res.headers.get('content-type')).toBe('video/mp4');
    expect(res.headers.get('accept-ranges')).toBe('bytes');
    expect(new Uint8Array(await res.arrayBuffer())).toEqual(FILE.slice(0, 2));
  });

  it('serves a middle range, an open range and a suffix range', async () => {
    const mid = await get({ range: 'bytes=100-199' });
    expect(mid.headers.get('content-range')).toBe('bytes 100-199/1000');
    expect(new Uint8Array(await mid.arrayBuffer())).toEqual(FILE.slice(100, 200));

    const open = await get({ range: 'bytes=900-' });
    expect(open.headers.get('content-range')).toBe('bytes 900-999/1000');
    expect((await open.arrayBuffer()).byteLength).toBe(100);

    const suffix = await get({ range: 'bytes=-10' });
    expect(suffix.headers.get('content-range')).toBe('bytes 990-999/1000');
    expect(new Uint8Array(await suffix.arrayBuffer())).toEqual(FILE.slice(990));
  });

  it('clamps an end past the file', async () => {
    const res = await get({ range: 'bytes=990-5000' });
    expect(res.status).toBe(206);
    expect(res.headers.get('content-range')).toBe('bytes 990-999/1000');
  });

  it('answers 416 to a range outside the file', async () => {
    for (const range of ['bytes=1000-', 'bytes=-0', 'bytes=5-2']) {
      const res = await get({ range });
      expect(res.status).toBe(416);
      expect(res.headers.get('content-range')).toBe('bytes */1000');
    }
  });

  it('answers whole, and says ranges work, with no Range, a list, or a stale If-Range', async () => {
    const cases: Record<string, string>[] = [{}, { range: 'bytes=0-1,5-6' }, { range: 'bytes=0-1', 'if-range': '"old"' }];
    for (const headers of cases) {
      const res = await get(headers);
      expect(res.status).toBe(200);
      expect(res.headers.get('accept-ranges')).toBe('bytes');
      expect((await res.arrayBuffer()).byteLength).toBe(1000);
    }
  });

  it('honours a matching If-Range, and a range despite If-None-Match', async () => {
    expect((await get({ range: 'bytes=0-1', 'if-range': '"v1"' })).status).toBe(206);
    expect((await get({ range: 'bytes=0-1', 'if-none-match': '"v1"' })).status).toBe(206);
  });

  it('keeps 304 for a revalidation, and ignores Range on HEAD', async () => {
    expect((await get({ 'if-none-match': '"v1"' })).status).toBe(304);
    expect((await get({ range: 'bytes=0-1' }, 'HEAD')).status).toBe(200);
  });

  it('passes a missing file through', async () => {
    const missing: AssetFetcher = { fetch: async () => new Response('nope', { status: 404 }) };
    const res = await serveVideo(new Request(URL_, { headers: { range: 'bytes=0-1' } }), missing);
    expect(res.status).toBe(404);
  });
});

describe('isVideoPath', () => {
  it('matches only MP4s directly in /media', () => {
    expect(isVideoPath('/media/organizer.mp4')).toBe(true);
    expect(isVideoPath('/media/organizer.jpg')).toBe(false);
    expect(isVideoPath('/media/cat/x.mp4')).toBe(false);
    expect(isVideoPath('/vendors')).toBe(false);
  });
});
