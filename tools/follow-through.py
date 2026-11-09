import sys, json, copy
sys.path.insert(0,'/home/user/pin-high/tools')
import pl
from concurrent.futures import ThreadPoolExecutor
A='/home/user/pin-high/assets/raw/cand/address3.png'
def thru():
    r=pl.call('POST','/animate-with-text-v3',{'first_frame':pl.b64img(A),'last_frame':pl.b64img('finish3-aligned.png'),
     'action':'golf follow-through only: from impact the club swings on through and up, arms extend towards the target, hips and chest rotate to face away from us, head turns to follow the ball, ending in the finish pose',
     'frame_count':8,'no_background':True,'seed':4})
    j=pl.wait(r['background_job_id'])
    for i,im in enumerate((j.get('last_response') or {}).get('images') or []): pl.save(im,f'thru3-{i:02d}.png')
def putt():
    base=json.load(open('sw3-address-skeleton.json'))
    W=H=128
    first=[{'x':k['x'],'y':k['y'],'label':k['label']} for k in base]
    P={k['label']:[k['x']*W,k['y']*H] for k in base}
    frames=[]
    for o in [-2,-4,-6,-7,-4,0,4,7]:
        p=copy.deepcopy(P)
        for k in ['LEFT ARM','RIGHT ARM']: p[k][0]+=o; p[k][1]-=abs(o)*0.2
        for k in ['LEFT ELBOW','RIGHT ELBOW']: p[k][0]+=o*0.5
        frames.append([{'x':v[0]/W,'y':v[1]/H,'label':k} for k,v in p.items()])
    r=pl.call('POST','/animate-with-skeleton-v3',{'description':'golfer in a white polo shirt, navy blue trousers, white cap and white shoes, head down looking at the ball, holding a putter with both hands','action':'putting stroke','direction':'east','view':'side','first_frame':pl.b64img(A),'first_frame_keypoints':first,'keypoints':frames,'no_background':True,'seed':5})
    j=pl.wait(r['background_job_id'])
    for i,im in enumerate((j.get('last_response') or {}).get('images') or []): pl.save(im,f'pt3-{i:02d}.png')
with ThreadPoolExecutor(2) as ex: [f.result() for f in [ex.submit(thru), ex.submit(putt)]]
