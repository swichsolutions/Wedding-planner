// Byte ranges for videos on the Cloudflare Worker. Workers Static Assets ignores the Range header
// and always answers 200 with the whole file, but Safari and every iOS browser ask for video in
// ranges and won't play it from a server that doesn't honour them. So wrangler.jsonc sends
// /media/*.mp4 here first (assets.run_worker_first). Pure, so server.video.spec.ts can test it.

/** The part of the ASSETS binding used here. */
export interface AssetFetcher {
  fetch(req: Request): Promise<Response>;
}

export const isVideoPath = (pathname: string): boolean => /^\/media\/[^/]+\.mp4$/.test(pathname);

export async function serveVideo(req: Request, assets: AssetFetcher): Promise<Response> {
  const range = req.method === 'GET' ? req.headers.get('range') : null;
  if (!range) {
    return withRanges(await assets.fetch(req));
  }

  // Ask for the whole file: the headers of the original request could turn this into a 304.
  const asset = await assets.fetch(new Request(req.url));
  if (asset.status !== 200) {
    return asset;
  }

  // If-Range: the client's copy is out of date, so it needs the whole new file.
  const ifRange = req.headers.get('if-range');
  if (ifRange && ifRange !== asset.headers.get('etag')) {
    return withRanges(asset);
  }

  const body = await asset.arrayBuffer();
  const total = body.byteLength;
  const parsed = parseRange(range, total);
  const headers = new Headers(asset.headers);
  headers.set('accept-ranges', 'bytes');
  if (parsed === 'whole') {
    return new Response(body, { status: 200, headers });
  }
  if (parsed === 'unsatisfiable') {
    headers.delete('content-length');
    headers.set('content-range', `bytes */${total}`);
    return new Response(null, { status: 416, headers });
  }
  const [start, end] = parsed;
  headers.set('content-range', `bytes ${start}-${end}/${total}`);
  headers.set('content-length', String(end - start + 1));
  return new Response(body.slice(start, end + 1), { status: 206, headers });
}

function withRanges(res: Response): Response {
  const out = new Response(res.body, res);
  out.headers.set('accept-ranges', 'bytes');
  return out;
}

/** Inclusive [start, end]. Anything but one plain range (a list, say) may be answered whole. */
function parseRange(range: string, total: number): [number, number] | 'whole' | 'unsatisfiable' {
  const m = /^bytes=(\d*)-(\d*)$/.exec(range.trim());
  if (!m || (m[1] === '' && m[2] === '')) {
    return 'whole';
  }
  if (m[1] === '') {
    // the last n bytes
    const n = Number(m[2]);
    return n === 0 || total === 0 ? 'unsatisfiable' : [Math.max(0, total - n), total - 1];
  }
  const start = Number(m[1]);
  const end = m[2] === '' ? total - 1 : Math.min(Number(m[2]), total - 1);
  return start >= total || end < start ? 'unsatisfiable' : [start, end];
}
