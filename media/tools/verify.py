#!/usr/bin/env python3
"""ANON Cinema & Radio link and rights checker. No API keys needed.
Usage:  python3 media/tools/verify.py [path/to/media.json] [--json problems.json]
Checks:
  * cinema: archive.org embed URL loads (200); the item still exists (not dark/removed); its licenseurl
    still matches the value we recorded (archive_licence).
  * radio : direct mp3 URL loads (HEAD 200); the source item's licenseurl is unchanged.
  * tv + Watch ANON (youtube.json): YouTube oEmbed returns 200 (401 means embedding disabled, 404 means
    private or removed) and author_url is still the expected channel.
Prints one line per problem and exits 1 if there are any, so a weekly job can open a PR or remove items."""
import json,sys,os,urllib.request,urllib.parse,urllib.error
from concurrent.futures import ThreadPoolExecutor
here=os.path.dirname(os.path.abspath(__file__))
av=sys.argv[1:]
if '--json' in av: k=av.index('--json'); av=av[:k]+av[k+2:]
args=[a for a in av if not a.startswith('--')]
path=args[0] if args else os.path.join(here,'..','media.json')
ypath=os.path.join(os.path.dirname(path),'youtube.json')
UA={'User-Agent':'Mozilla/5.0 (ANON media verify)'}
def code(url,method='GET'):
    try:
        r=urllib.request.urlopen(urllib.request.Request(url,headers=UA,method=method),timeout=40); return r.status
    except urllib.error.HTTPError as e: return e.code
    except Exception as e: return str(e)[:60]
_meta={}
def meta(i):
    if i not in _meta:
        try: _meta[i]=json.load(urllib.request.urlopen(urllib.request.Request(f'https://archive.org/metadata/{i}',headers=UA),timeout=40))
        except Exception as e: _meta[i]={'_err':str(e)[:60]}
    return _meta[i]
def oembed(vid):
    u='https://www.youtube.com/oembed?format=json&url='+urllib.parse.quote(f'https://www.youtube.com/watch?v={vid}')
    try: return 200,json.load(urllib.request.urlopen(urllib.request.Request(u,headers=UA),timeout=30))
    except urllib.error.HTTPError as e: return e.code,{}
    except Exception as e: return str(e)[:60],{}
def chk_film(x):
    p=[];c=code(x['embed_url'])
    if c!=200: p.append(f'embed HTTP {c}')
    m=meta(x['id'])
    if '_err' in m or not m.get('metadata'): p.append('archive item missing or unreadable')
    elif m.get('is_dark'): p.append('archive item is dark (removed)')
    elif (m['metadata'].get('licenseurl','') or '')!=(x.get('archive_licence') or ''): p.append(f"licence changed: {x.get('archive_licence')!r} -> {m['metadata'].get('licenseurl')!r}")
    return p
def chk_track(x):
    p=[];c=code(x['url'],'HEAD')
    if c!=200: p.append(f'audio HTTP {c}')
    m=meta(x['source_url'].rstrip('/').rsplit('/',1)[1])
    if '_err' in m or not m.get('metadata'): p.append('source item missing')
    elif (m['metadata'].get('licenseurl','') or '')!=(x.get('archive_licence') or ''): p.append('source licence changed')
    return p
def chk_yt(vid,channel):
    c,o=oembed(vid)
    if c==401: return ['embedding disabled']
    if c!=200: return [f'not public (oEmbed {c})']
    if channel and o.get('author_url','').rstrip('/').lower()!=channel.rstrip('/').lower(): return [f"channel changed to {o.get('author_url')}"]
    return []
def main():
    d=json.load(open(path)); y=json.load(open(ypath)) if os.path.exists(ypath) else {'videos':[]}
    jobs=[('cinema',x['id'],x['title'],lambda x=x:chk_film(x)) for x in d.get('cinema',[]) if not x.get('flags')]
    jobs+=[('radio',x['id'],x['title'],lambda x=x:chk_track(x)) for x in d.get('radio',[]) if not x.get('flags')]
    jobs+=[('tv',x['id'],x['title'],lambda x=x:chk_yt(x['youtube_id'],x.get('channel'))) for x in d.get('tv',[]) if not x.get('flags')]
    jobs+=[('watch',v['id'],v['title'],lambda v=v:chk_yt(v['id'],y.get('channel'))) for v in y.get('videos',[]) if not v.get('flags')]
    with ThreadPoolExecutor(10) as ex: res=list(ex.map(lambda j:(j,j[3]()),jobs))
    probs=[dict(section=j[0],id=j[1],title=j[2],problems=p) for j,p in res if p]
    for p in probs: print(f"PROBLEM [{p['section']}] {p['id']} ({p['title']}): {'; '.join(p['problems'])}")
    print(f'checked {len(jobs)} items, {len(probs)} with problems')
    if '--json' in sys.argv: json.dump(probs,open(sys.argv[sys.argv.index('--json')+1],'w'),indent=1)
    sys.exit(1 if probs else 0)
main()
