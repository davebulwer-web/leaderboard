import sys, json
sys.path.insert(0, '/home/user/pin-high/tools')
import pl
from concurrent.futures import ThreadPoolExecutor
pal = pl.b64img(sys.argv[1] if len(sys.argv) > 1 else '/home/user/pin-high/assets/raw/cand/address3.png')
desc = ('golfer at the finish of his golf swing, seen from behind: back of his head and back of his white polo shirt towards us, '
        'turned to face away towards the target, both hands up by his left ear, golf club resting behind his neck and shoulders, '
        'standing tall and balanced, belt buckle facing the target, weight on front foot, back heel raised, back straight, navy blue trousers, white cap, white shoes, full body, 16-bit sports game sprite')
def go(seed):
    return pl.pixflux(desc, 128, 128, f'fin3-{seed}.png', no_background=True, view='side', direction='north-east',
        outline='single color black outline', shading='medium shading', seed=seed, color_image=pal)
with ThreadPoolExecutor(4) as ex: list(ex.map(go, [9, 31, 44, 58]))
