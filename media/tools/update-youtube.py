#!/usr/bin/env python3
"""Refresh media/youtube.json from the ANON NFTs YouTube channel RSS feed (no API key).
Usage: python3 media/tools/update-youtube.py [output path]   then commit youtube.json.
The feed carries the latest 15 uploads. ALL videos are included (the owner chose to show every video).
The shelf shows only each title plus a neutral generated line; video descriptions are not copied.
Titles containing wording that's off-limits on the site (guarantees, returns, investors, passive income)
are still included, but listed as WARNINGS so you can review them."""
import sys,re,json,html,urllib.request,datetime,os
CHANNEL_ID='UCkyTtKuxLc6LHWSgt2VtvWQ'   # youtube.com/@anonnft
FEED=f'https://www.youtube.com/feeds/videos.xml?channel_id={CHANNEL_ID}'
WORDING=re.compile(r'guarantee|returns?\b|investors?|passive income',re.I)
out=sys.argv[1] if len(sys.argv)>1 else os.path.join(os.path.dirname(__file__),'..','youtube.json')
x=urllib.request.urlopen(urllib.request.Request(FEED,headers={'User-Agent':'Mozilla/5.0'}),timeout=30).read().decode()
vids=[]
for e in re.findall(r'<entry>(.*?)</entry>',x,re.S):
    g=lambda p:(re.search(p,e,re.S) or [None,''])[1]
    vid=g(r'<yt:videoId>([^<]+)'); t=html.unescape(g(r'<title>([^<]+)')).strip()
    pub=g(r'<published>([^<]+)')[:10]
    short='#short' in t.lower() or '/shorts/' in e
    try: nice=datetime.date.fromisoformat(pub).strftime('%-d %b %Y')
    except Exception: nice=pub
    vids.append(dict(id=vid,title=t,published=pub,short=short,
        line=f"{'Short' if short else 'Video'} from the ANON NFTs YouTube channel, posted {nice}.",
        embed_url=f'https://www.youtube-nocookie.com/embed/{vid}',
        thumb=f'https://i.ytimg.com/vi/{vid}/hqdefault.jpg',source_url=f'https://www.youtube.com/watch?v={vid}',
        rights="ANON NFTs' own upload on youtube.com/@anonnft",flags=[]))
    if WORDING.search(t): print('WARNING: review title wording:',vid,t)
json.dump(dict(channel='https://www.youtube.com/@anonnft',channel_id=CHANNEL_ID,updated=datetime.date.today().isoformat(),
    disclaimer='NFTs and cryptoassets are high-risk. Not financial advice.',videos=vids),open(out,'w'),ensure_ascii=False,indent=1)
print(f'wrote {len(vids)} videos to {out}')
