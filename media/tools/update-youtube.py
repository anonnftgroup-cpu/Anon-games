#!/usr/bin/env python3
"""Refresh media/youtube.json from the ANON NFTs YouTube channel RSS feed (no API key).
Usage: python3 media/tools/update-youtube.py   (run from the site root, or pass the output path)
Then commit youtube.json. The feed carries the latest 15 uploads."""
import sys,re,json,html,urllib.request,datetime,os
CHANNEL_ID='UCkyTtKuxLc6LHWSgt2VtvWQ'   # youtube.com/@anonnft
FEED=f'https://www.youtube.com/feeds/videos.xml?channel_id={CHANNEL_ID}'
out=sys.argv[1] if len(sys.argv)>1 else os.path.join(os.path.dirname(__file__),'..','youtube.json')
x=urllib.request.urlopen(urllib.request.Request(FEED,headers={'User-Agent':'Mozilla/5.0'}),timeout=30).read().decode()
vids=[]
# AdSense safety: financial / investment-style videos are flagged and hidden from the hub (no financial claims on-site).
RISKY=re.compile(r'revenue share|liquidity|fusd|\bboost|profit|invest|yield|token|crypto|airdrop|staking|returns|passive income|\$',re.I)
def flags_for(text):
    m=RISKY.search(text)
    return [f'financial/investment topic ("{m.group(0)}"), hidden for AdSense safety'] if m else []
for e in re.findall(r'<entry>(.*?)</entry>',x,re.S):
    g=lambda p:(re.search(p,e,re.S) or [None,''])[1]
    vid=g(r'<yt:videoId>([^<]+)'); t=html.unescape(g(r'<title>([^<]+)'))
    desc=html.unescape(g(r'<media:description>(.*?)</media:description>')).strip()
    desc=re.sub(r'https?://\S+','',desc); desc=re.sub(r'\s+',' ',desc).strip()[:240]
    vids.append(dict(id=vid,title=t,published=g(r'<published>([^<]+)')[:10],
        short='#short' in (t+desc).lower() or '/shorts/' in e,
        description=desc,embed_url=f'https://www.youtube-nocookie.com/embed/{vid}',
        thumb=f'https://i.ytimg.com/vi/{vid}/hqdefault.jpg',source_url=f'https://www.youtube.com/watch?v={vid}',
        rights='ANON NFTs\' own upload on youtube.com/@anonnft',flags=flags_for(t+' '+desc)))
json.dump(dict(channel='https://www.youtube.com/@anonnft',channel_id=CHANNEL_ID,updated=datetime.date.today().isoformat(),videos=vids),open(out,'w'),ensure_ascii=False,indent=1)
print(f'wrote {len(vids)} videos to {out}')
