#!/usr/bin/env python3
"""Tiny Pixellab v2 client: pixflux images and text animations, saved as PNGs."""
import base64, json, os, sys, time, urllib.request, urllib.error

API = 'https://api.pixellab.ai/v2'
KEY = os.environ['PIXELLAB_API_KEY']

def call(method, path, body=None):
    req = urllib.request.Request(API + path, method=method,
        data=json.dumps(body).encode() if body is not None else None,
        headers={'Authorization': 'Bearer ' + KEY, 'Content-Type': 'application/json'})
    for attempt in range(8):
        try:
            with urllib.request.urlopen(req, timeout=600) as r:
                return json.loads(r.read())
        except urllib.error.HTTPError as e:
            if e.code != 429 or attempt == 7: raise
            time.sleep(10 * (attempt + 1))

def b64img(path):
    return {'type': 'base64', 'base64': base64.b64encode(open(path, 'rb').read()).decode(), 'format': 'png'}

def save(img, path):
    data = img['base64'] if isinstance(img, dict) else img
    if data.startswith('data:'): data = data.split(',', 1)[1]
    open(path, 'wb').write(base64.b64decode(data))
    print('saved', path)

def wait(job):
    while True:
        j = call('GET', f'/background-jobs/{job}')
        if j.get('status') in ('completed', 'failed', 'cancelled'): return j
        time.sleep(4)

def pixflux(desc, w, h, out, **kw):
    body = {'description': desc, 'image_size': {'width': w, 'height': h}, **kw}
    r = call('POST', '/create-image-pixflux', body)
    if 'image' not in r: print(json.dumps(r)[:800])
    save(r['image'], out)
    return r

def animate(first, action, out_prefix, frames=8, **kw):
    r = call('POST', '/animate-with-text-v3', {'first_frame': b64img(first), 'action': action, 'frame_count': frames, **kw})
    j = wait(r['background_job_id'])
    imgs = (j.get('last_response') or {}).get('images') or []
    if not imgs: print(json.dumps(j)[:1500])
    for i, im in enumerate(imgs): save(im, f'{out_prefix}-{i:02d}.png')
    return j

if __name__ == '__main__':
    cmd = sys.argv[1]
    if cmd == 'pixflux':
        _, _, desc, w, h, out, *rest = sys.argv
        kw = json.loads(rest[0]) if rest else {}
        pixflux(desc, int(w), int(h), out, **kw)
    elif cmd == 'animate':
        _, _, first, action, prefix, *rest = sys.argv
        kw = json.loads(rest[0]) if rest else {}
        animate(first, action, prefix, **kw)
