import sys, json
sys.path.insert(0, '/home/user/pin-high/tools')
import pl
from concurrent.futures import ThreadPoolExecutor
pal = pl.b64img('/home/user/pin-high/assets/raw/cand/address2.png')
desc = ('golfer at the finish of his golf swing, seen from behind: back of his head and back of his white polo shirt towards us, '
        'turned to face away towards the target, both hands up by his left ear, golf club resting behind his neck and shoulders, '
        'weight on front foot, back heel raised, navy blue trousers, white cap, white shoes, full body, 16-bit sports game sprite')
def go(seed):
    return pl.pixflux(desc, 128, 128, f'fin-{seed}.png', no_background=True, view='side', direction='north-east',
        outline='single color black outline', shading='medium shading', seed=seed, color_image=pal)
with ThreadPoolExecutor(4) as ex: list(ex.map(go, [3, 9, 14, 27]))
