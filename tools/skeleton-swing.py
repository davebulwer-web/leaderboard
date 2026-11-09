import json, math, sys, copy
sys.path.insert(0, '/home/user/pin-high/tools')
import pl
W, H = 96, 128
base = json.load(open('skel-address.json'))['keypoints']
P = {k['label']: [k['x'] * W, k['y'] * H] for k in base}
# Wrist path through the swing (both hands together), and how far the body turns
# towards the finish (0 = address posture, 1 = upright facing the target).
WR = [(53, 61), (49, 59), (42, 54), (37, 45), (36, 35), (39, 26), (40, 24), (38, 36), (45, 53), (54, 62), (62, 57), (62, 42), (56, 30), (48, 23), (46, 22)]
UP = [0, 0, 0.05, 0.1, 0.15, 0.2, 0.2, 0.15, 0.05, 0, 0.2, 0.45, 0.7, 0.9, 1]
frames = []
for (wx, wy), up in zip(WR, UP):
    p = copy.deepcopy(P)
    # Stand up a little: lift the head and shoulders, push the hips forward.
    for k in ['NOSE', 'LEFT EYE', 'RIGHT EYE', 'LEFT EAR', 'RIGHT EAR', 'NECK', 'LEFT SHOULDER', 'RIGHT SHOULDER']:
        p[k][0] -= 6 * up; p[k][1] -= 4 * up
    for k in ['LEFT HIP', 'RIGHT HIP']:
        p[k][0] += 3 * up; p[k][1] -= 1 * up
    for k in ['LEFT KNEE']:
        p[k][0] += 3 * up
    # Head turns to follow the ball at the finish.
    for side in ['LEFT', 'RIGHT']:
        p[f'{side} ARM'] = [wx + (1 if side == 'LEFT' else -1), wy]
        sh = p[f'{side} SHOULDER']
        mx, my = (sh[0] + wx) / 2, (sh[1] + wy) / 2
        dx, dy = wx - sh[0], wy - sh[1]
        L = math.hypot(dx, dy) or 1
        bend = max(0, 9 - L * 0.3)  # bent elbows when the hands are close to the body
        p[f'{side} ELBOW'] = [mx + dy / L * bend, my - dx / L * bend]
    frames.append([{'x': max(0, min(1, v[0] / W)), 'y': max(0, min(1, v[1] / H)), 'label': k} for k, v in p.items()])
json.dump(frames, open('skel-frames.json', 'w'))
if len(sys.argv) > 1 and sys.argv[1] == 'go':
    first = [{'x': k['x'], 'y': k['y'], 'label': k['label']} for k in base]
    r = pl.call('POST', '/animate-with-skeleton-v3', {
        'description': 'golfer in a white polo shirt, navy blue trousers, white cap and white shoes, holding a golf club with both hands',
        'action': 'golf swing', 'direction': 'east', 'view': 'side',
        'first_frame': pl.b64img('/home/user/pin-high/assets/raw/golfer-address.png'),
        'first_frame_keypoints': first, 'keypoints': frames, 'no_background': True, 'seed': int(sys.argv[2]) if len(sys.argv) > 2 else 0})
    j = pl.wait(r['background_job_id'])
    imgs = (j.get('last_response') or {}).get('images') or []
    if not imgs: print(json.dumps(j)[:1500])
    for i, im in enumerate(imgs): pl.save(im, f'skswing-{i:02d}.png')
