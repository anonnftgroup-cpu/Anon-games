#!/usr/bin/env python3
"""Builds boosts.json: every ANON daily liquidity boost video ever found on youtube.com/@AnonNft.
Stdlib only. Read by the anonnfts.com Liquidity Boosts page (paste-once block).

YouTube's RSS feeds only return the latest 15 uploads, so this script ACCUMULATES: it loads the
existing boosts.json, adds any new boost videos from the channel, Shorts and long-video feeds,
and never drops old ones. If YouTube can't be reached, boosts.json is left alone (exit 0).

Run by hand:  python3 scripts/update_boosts.py
Also run automatically at the end of scripts/update_videos.py.

A video counts as a boost video when its title or description has "Day N" (N = 1..365) and
mentions a boost / liquidity / donation. Amount and collection are parsed from the description
where possible, e.g. "1 FUSD (about $1.08) donated to ANON Revenue Share NFTs"."""
import datetime, json, os, re, sys, time, urllib.request, xml.etree.ElementTree as ET

CHANNEL_ID = 'UCkyTtKuxLc6LHWSgt2VtvWQ'          # youtube.com/@AnonNft
HANDLE = '@AnonNft'
DAY1 = datetime.date(2026, 8, 10)                # Day 1 of the 365-day series (UK date)
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'boosts.json')
NS = {'a': 'http://www.w3.org/2005/Atom', 'yt': 'http://www.youtube.com/xml/schemas/2015', 'm': 'http://search.yahoo.com/mrss/'}
FEEDS = ['https://www.youtube.com/feeds/videos.xml?channel_id=' + CHANNEL_ID,
         'https://www.youtube.com/feeds/videos.xml?playlist_id=UULF' + CHANNEL_ID[2:],   # long videos
         'https://www.youtube.com/feeds/videos.xml?playlist_id=UUSH' + CHANNEL_ID[2:]]   # Shorts
SHORTS_FEED = FEEDS[2]

# Longest names first so "ANON King and Queen Apes" wins over "ANON Apes".
COLLECTIONS = [
    ('ANON King and Queen Apes', r'king\s*(?:and|&)\s*queen\s*apes?'),
    ('ANON Revenue Share NFTs', r'rev(?:enue)?\.?\s*share'),
    ('Grumpy Cat NFTs', r'grumpy\s*cat'),
    ('Ghost Dead Hand', r'ghost\s*dead\s*hand'),
    ('ACES by BESC', r'aces\s*by\s*besc|\bbesc\b'),
    ('ANON Skulls', r'anon\s*skulls?'),
    ('ANON Apes', r'anon\s*apes?\b'),
]
BANNED = re.compile(r'invest|passive\s*income|low[\s-]*risk|guarantee|\breturns?\b|profit|ninja|shadow|moon|100x|'
                    r'financial freedom|x\.com|twitter|absolutely|here are|here is|description|'
                    r'value|floor|\btrad(?:e|er|ers|ing)\b|reward|earn|hype|speculat|zero|crash|lose|wealth|cash|money|'
                    r'price|yield|gain|benefit|economics|sustainable|meme coin|learn more|participate|revenue generated|income|share of revenue', re.I)

def get(url):
    last = None
    for i in range(3):
        try:
            req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0 (ANON boosts.json updater)'})
            with urllib.request.urlopen(req, timeout=20) as r:
                return r.read()
        except Exception as e:
            last = e; time.sleep(3 * (i + 1))
    raise last

def entries(xml):
    out = []
    for e in ET.fromstring(xml).findall('a:entry', NS):
        vid = e.findtext('yt:videoId', '', NS)
        if not re.fullmatch(r'[A-Za-z0-9_-]{11}', vid or ''):
            continue
        g = e.find('m:group', NS)
        desc = (g.findtext('m:description', '', NS) if g is not None else '') or ''
        out.append({'id': vid, 'title': (e.findtext('a:title', '', NS) or '').strip(),
                    'published': e.findtext('a:published', '', NS), 'description': desc.strip()})
    return out

def parse_day(title, desc):
    for text in (title, desc[:400]):
        m = re.search(r'\bday\s*(\d{1,3})\b', text, re.I) or re.search(r'\b(\d{1,3})\s*days?\s+(?:of|in a row)', text, re.I)
        if m and 1 <= int(m.group(1)) <= 365:
            return int(m.group(1))
    return None

def is_boost(title, desc):
    if re.search(r'arcade|\bgame\b|solitaire|leaderboard', title, re.I):
        return False
    return parse_day(title, desc) is not None and bool(
        re.search(r'boost|liquidity|donat|cash injection|proof of work', title + ' ' + desc[:600], re.I))

def parse_collection(title, desc):
    text = title + '\n' + desc[:800]
    for name, pat in COLLECTIONS:
        if re.search(pat, text, re.I):
            return name
    return None

def parse_amount(desc):
    """Returns (usd, fusd) as floats or None."""
    usd = fusd = None
    m = re.search(r'about\s*\$\s*(\d{1,4}(?:\.\d{1,2})?)', desc, re.I) or \
        re.search(r'\$\s*(\d{1,4}(?:\.\d{1,2})?)\s*(?:donated|added|boost)', desc, re.I)
    if m: usd = float(m.group(1))
    m = re.search(r'(\d{1,4}(?:\.\d+)?)\s*FUSD\s*(?:\(about[^)]*\)\s*)?(?:donated|entered|added|boost)', desc, re.I) or \
        re.search(r'(?:donated|donate|added)\s*(\d{1,4}(?:\.\d+)?)\s*FUSD', desc, re.I)
    if m: fusd = float(m.group(1))
    return usd, fusd

def amount_text(usd, fusd):
    if usd is not None:
        return '$%.2f' % usd
    if fusd is not None:
        return ('%g' % fusd) + ' FUSD'
    return None

def clean_title(t):
    t = re.sub(r'\s*#shorts?\b', '', t, flags=re.I)
    t = re.sub(r'^\s*title:\s*', '', t, flags=re.I)
    t = t.replace('\U0001F977', '').replace('🥷', '')
    return re.sub(r'\s{2,}', ' ', t).strip()

def clean_desc(d, limit=700):
    """Short, compliant summary for the website card: no links, hashtags, X/Twitter or banned wording."""
    keep = []
    for line in d.splitlines():
        label = bool(re.search(r'(?::|\bat)\s*(?:https?://\S+|www\.\S+|\S+\.com\S*)?\s*$', line.strip(), re.I)) and len(line) < 90
        line = re.sub(r'https?://\S+|www\.\S+', '', line)
        if label or re.fullmatch(r'\W*(?:medium|tiktok|youtube|youtube shorts|instagram|website|x|facebook|linkedin)\W*', line.strip(), re.I):
            continue
        line = re.sub(r'(?:^|\s)#\w+', '', line).replace('🥷', '')
        line = re.sub(r'^\s*(?:title|description|youtube video|website|🌐\s*website)\s*:?\s*$', '', line, flags=re.I)
        line = re.sub(r'^\s*title:\s*', '', line, flags=re.I).strip(' \t-•🔹:')
        line = ' '.join(x for x in re.split(r'(?<=[.!?])\s+', line) if not BANNED.search(x)).strip()
        if not line or BANNED.search(line) or re.fullmatch(r'[\W\d_]*', line) or re.fullmatch(r'day\s*\d+\s*/\s*(?:365|∞)', line, re.I):
            continue
        if re.search(r'^(?:check the backing|every day of the series|anon nfts|explore|visit|read more|follow)\b.*:?$', line, re.I) and len(line) < 60:
            continue
        if keep and keep[-1] == line:
            continue
        keep.append(line)
    s = '\n'.join(keep)
    if len(s) > limit:
        s = s[:limit].rsplit(' ', 1)[0].rstrip(',;:') + '…'
    return s

def make(v, short, day=None, usd=None, fusd=None, collection=None):
    title, desc = v['title'], v.get('description', '')
    day = day or parse_day(title, desc)
    if usd is None and fusd is None:
        usd, fusd = parse_amount(desc)
    collection = collection or parse_collection(title, desc)
    short = short or bool(re.search(r'#shorts?\b', title, re.I))
    return {'id': v['id'], 'title': clean_title(title), 'published': v['published'], 'short': short,
            'day': day, 'boost_date': (DAY1 + datetime.timedelta(days=day - 1)).isoformat() if day else None,
            'collection': collection, 'amount': amount_text(usd, fusd), 'amount_usd': usd, 'amount_fusd': fusd,
            'url': ('https://www.youtube.com/shorts/' if short else 'https://www.youtube.com/watch?v=') + v['id'],
            'thumb': 'https://i.ytimg.com/vi/%s/mqdefault.jpg' % v['id'],
            'summary': clean_desc(desc), 'description': desc}

def load():
    try:
        with open(OUT) as f:
            return json.load(f)
    except Exception:
        return {'videos': []}

def save(videos, old):
    videos.sort(key=lambda x: (x['day'] or 0, not x['short'], x['published']), reverse=True)
    data = {'channel': 'https://www.youtube.com/' + HANDLE, 'start': DAY1.isoformat(),
            'activity': 'https://liquidnfts.finance/activities', 'count': len(videos),
            'days': len({v['day'] for v in videos if v['day']}), 'videos': videos}
    if old.get('videos') == videos:
        print('boosts.json: no new boost videos (%d kept)' % len(videos)); return False
    data['updated'] = time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime())
    with open(OUT, 'w') as f:
        json.dump(data, f, ensure_ascii=False, indent=1); f.write('\n')
    print('boosts.json: wrote %d boost videos over %d days' % (len(videos), data['days']))
    return True

def main():
    old = load()
    have = {v['id']: v for v in old.get('videos', [])}
    found, shorts, ok = {}, set(), False
    for url in FEEDS:
        try:
            es = entries(get(url)); ok = True
        except Exception as e:
            print('feed failed:', url, e); continue
        for e in es:
            found.setdefault(e['id'], e)
            if url == SHORTS_FEED: shorts.add(e['id'])
    if not ok:
        print('boosts.json: YouTube unreachable, keeping old file'); return 0
    for vid, e in found.items():
        if vid in have and have[vid].get('locked'):
            continue
        if vid in have:   # keep parsed facts, refresh title/description if edited on YouTube
            cur = have[vid]
            if e['title'] and clean_title(e['title']) != cur['title'] or (e['description'] and e['description'] != cur.get('description')):
                fresh = make(e, cur['short'] or vid in shorts)
                for k in ('day', 'collection', 'amount', 'amount_usd', 'amount_fusd'):
                    if fresh[k] is None or cur.get('locked'):
                        fresh[k] = cur.get(k)
                fresh['boost_date'] = (DAY1 + datetime.timedelta(days=fresh['day'] - 1)).isoformat() if fresh['day'] else None
                if cur.get('locked'): fresh['locked'] = True
                have[vid] = fresh
            continue
        if is_boost(e['title'], e['description']):
            have[vid] = make(e, vid in shorts)
            print('new boost video:', vid, have[vid]['title'])
    save(list(have.values()), old)
    return 0

if __name__ == '__main__':
    sys.exit(main())
