# Poses a side-on golf swing with Pixellab's skeleton animation: one skeleton per
# frame. Head stays down on the ball until impact, then turns to the target so
# only the back of the head shows. Usage: python3 skel2.py ADDRESS.png OUTPREFIX [go] [seed]
import json, math, sys, copy
sys.path.insert(0, '/home/user/pin-high/tools')
import pl
src, out = sys.argv[1], sys.argv[2]
from PIL import Image
W, H = Image.open(src).size
r = pl.call('POST', '/estimate-skeleton', {'image': pl.b64img(src)})
base = r['keypoints']
json.dump(base, open(out + '-address-skeleton.json', 'w'))
P = {k['label']: [k['x'] * W, k['y'] * H] for k in base}
sh = P['RIGHT SHOULDER']; wr0 = [(P['LEFT ARM'][0] + P['RIGHT ARM'][0]) / 2, (P['LEFT ARM'][1] + P['RIGHT ARM'][1]) / 2]
print('shoulder', sh, 'wrists', wr0)
# Hands relative to the shoulder, in units of the address arm length.
arm = math.hypot(wr0[0] - sh[0], wr0[1] - sh[1])
dirs = [  # (angle in degrees from straight down, towards the back is negative; reach as a fraction of arm length)
  None, (-12, 0.97), (-35, 0.9), (-70, 0.8), (-110, 0.72), (-150, 0.62), (-158, 0.6),
  (-95, 0.75), (-40, 0.92), None, (30, 0.95), (75, 0.85), (120, 0.75), (155, 0.65), (165, 0.6)]
UP = [0, 0, 0.03, 0.06, 0.1, 0.14, 0.14, 0.1, 0.03, 0, 0.15, 0.4, 0.65, 0.85, 1]
TURN = [0] * 10 + [0.5, 1, 1, 1, 1]  # head turned away to follow the ball
a0 = math.degrees(math.atan2(wr0[0] - sh[0], wr0[1] - sh[1]))  # address angle (towards the ball is positive)
frames = []
for d, up, turn in zip(dirs, UP, TURN):
    p = copy.deepcopy(P)
    if d is None: wx, wy = wr0
    else:
        ang = math.radians(a0 + d[0]) if d[0] < 0 else math.radians(a0 + d[0] * (180 - a0) / 165)
        wx, wy = sh[0] + math.sin(ang) * arm * d[1], sh[1] + math.cos(ang) * arm * d[1]
    for k in ['NOSE', 'LEFT EYE', 'RIGHT EYE', 'LEFT EAR', 'RIGHT EAR', 'NECK', 'LEFT SHOULDER', 'RIGHT SHOULDER']:
        p[k][0] -= 8 * up; p[k][1] -= 5 * up
    for k in ['LEFT HIP', 'RIGHT HIP']:
        p[k][0] += 3 * up
    s2 = p['RIGHT SHOULDER']
    if d is not None: wx, wy = wx - 8 * up, wy - 5 * up
    for side in ['LEFT', 'RIGHT']:
        p[f'{side} ARM'] = [wx + (1 if side == 'LEFT' else -1), wy]
        s = p[f'{side} SHOULDER']
        dx, dy = wx - s[0], wy - s[1]
        L = math.hypot(dx, dy) or 1
        bend = max(0, (arm - L) * 0.45)
        p[f'{side} ELBOW'] = [(s[0] + wx) / 2 + dy / L * bend, (s[1] + wy) / 2 - dx / L * bend]
    kp = [{'x': max(0, min(1, v[0] / W)), 'y': max(0, min(1, v[1] / H)), 'label': k} for k, v in p.items()]
    if turn:
        # Face away from the camera: the face joints go behind the head.
        ear = p['RIGHT EAR']
        for k in kp:
            if k['label'] in ('NOSE', 'LEFT EYE', 'RIGHT EYE'):
                k['x'] = (ear[0] + 1) / W; k['y'] = (ear[1] - 1) / H
                k['depth'] = 40; k['z_index'] = -3
    frames.append(kp)
json.dump(frames, open(out + '-skeleton.json', 'w'))
if 'go' in sys.argv:
    seed = int(sys.argv[sys.argv.index('go') + 1]) if len(sys.argv) > sys.argv.index('go') + 1 else 0
    first = [{'x': k['x'], 'y': k['y'], 'label': k['label']} for k in base]
    r = pl.call('POST', '/animate-with-skeleton-v3', {
        'description': 'golfer in a white polo shirt, navy blue trousers, white cap and white shoes, holding a long golf club with both hands',
        'action': 'golf swing', 'direction': 'east', 'view': 'side', 'first_frame': pl.b64img(src),
        'first_frame_keypoints': first, 'keypoints': frames[1:], 'no_background': True, 'seed': seed})
    j = pl.wait(r['background_job_id'])
    imgs = (j.get('last_response') or {}).get('images') or []
    if not imgs: print(json.dumps(j)[:1500])
    for i, im in enumerate(imgs): pl.save(im, f'{out}-{i + 1:02d}.png')
