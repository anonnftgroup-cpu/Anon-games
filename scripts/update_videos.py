#!/usr/bin/env python3
"""Builds videos.json (latest ANON NFTs YouTube videos) from the channel's public RSS feed.
Stdlib only. Run by .github/workflows/videos.yml every 6 hours, or by hand: python3 scripts/update_videos.py
If YouTube can't be reached, the old videos.json is left alone (exit 0, no commit)."""
import json, os, re, sys, time, urllib.request, xml.etree.ElementTree as ET

CHANNEL_ID = 'UCkyTtKuxLc6LHWSgt2VtvWQ'          # youtube.com/@AnonNft
HANDLE = '@AnonNft'
KEEP = 8
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'videos.json')
NS = {'a': 'http://www.w3.org/2005/Atom', 'yt': 'http://www.youtube.com/xml/schemas/2015', 'm': 'http://search.yahoo.com/mrss/'}

def get(url):
    last = None
    for i in range(3):
        try:
            req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0 (ANON Arcade videos.json updater)'})
            with urllib.request.urlopen(req, timeout=20) as r:
                return r.read()
        except Exception as e:
            last = e; time.sleep(3 * (i + 1))
    raise last

def entries(xml):
    root = ET.fromstring(xml)
    out = []
    for e in root.findall('a:entry', NS):
        vid = e.findtext('yt:videoId', '', NS)
        if not re.fullmatch(r'[A-Za-z0-9_-]{11}', vid or ''):
            continue
        out.append({'id': vid, 'title': (e.findtext('a:title', '', NS) or '').strip(), 'published': e.findtext('a:published', '', NS)})
    return out

def main():
    try:
        feed = entries(get('https://www.youtube.com/feeds/videos.xml?channel_id=' + CHANNEL_ID))
    except Exception as e:
        print('feed failed, keeping old videos.json:', e); return 0
    if not feed:
        print('feed empty, keeping old videos.json'); return 0
    shorts = set()
    try:  # UUSH... = the channel's Shorts playlist
        shorts = {x['id'] for x in entries(get('https://www.youtube.com/feeds/videos.xml?playlist_id=UUSH' + CHANNEL_ID[2:]))}
    except Exception as e:
        print('shorts feed failed, using #shorts in titles only:', e)
    feed.sort(key=lambda x: x['published'], reverse=True)
    vids = []
    for v in feed[:KEEP]:
        short = v['id'] in shorts or bool(re.search(r'#shorts?\b', v['title'], re.I))
        title = re.sub(r'\s*#shorts?\b', '', v['title'], flags=re.I).strip()
        vids.append({'id': v['id'], 'title': title, 'date': v['published'][:10], 'published': v['published'], 'short': short,
                     'url': ('https://www.youtube.com/shorts/' if short else 'https://www.youtube.com/watch?v=') + v['id'],
                     'thumb': 'https://i.ytimg.com/vi/%s/mqdefault.jpg' % v['id']})
    data = {'channel': 'https://www.youtube.com/' + HANDLE, 'subscribe': 'https://www.youtube.com/' + HANDLE + '?sub_confirmation=1', 'videos': vids}
    try:
        with open(OUT) as f:
            old = json.load(f)
        if old.get('videos') == vids:
            print('no new videos'); return 0
    except Exception:
        pass
    data['updated'] = time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime())
    with open(OUT, 'w') as f:
        json.dump(data, f, ensure_ascii=False, indent=1); f.write('\n')
    print('wrote', len(vids), 'videos')
    return 0

if __name__ == '__main__':
    sys.exit(main())
