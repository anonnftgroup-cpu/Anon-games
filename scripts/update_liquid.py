#!/usr/bin/env python3
"""Builds backing-checker/collections.json and backing-checker/listings.json for the
Liquid NFT Backing Checker (backing-checker/index.html).

Source: the public read endpoints the liquidnfts.finance site itself uses
(api.liquidnfts.finance /allNftCollections and /marketplaceListedNfts). That API only
allows liquidnfts.finance in the browser (CORS), so this script snapshots the lists.
The page then re-reads every price and every NFT's liquidity live from the chain,
so these files only say WHICH collections and listings to look at.
Stdlib only. Run by hand or by the 12pm/8pm refresh routine:
    python3 scripts/update_liquid.py
If the API can't be reached, the old files are left alone (exit 0)."""
import json, os, sys, time, datetime, urllib.request

API = 'https://api.liquidnfts.finance'
CHAINS = [137, 2372, 56, 1]
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'backing-checker')

def get(path):
    last = None
    for i in range(3):
        try:
            req = urllib.request.Request(API + path, headers={'User-Agent': 'Mozilla/5.0 (ANON NFTs backing checker updater)'})
            with urllib.request.urlopen(req, timeout=40) as r:
                return json.load(r)
        except Exception as e:
            last = e; time.sleep(3 * (i + 1))
    raise last

def img(u):
    if not u: return ''
    return u if u.startswith('http') else API + ('' if u.startswith('/') else '/') + u

def hidden(x, pre=''):
    cat = x.get(pre + 'category') or []
    cat = cat if isinstance(cat, list) else [cat]
    return bool(x.get(pre + 'is_hidden') or x.get(pre + 'explicit_content') or any(str(c).strip().lower() == '18+' for c in cat))

def main():
    now = datetime.datetime.now(datetime.timezone.utc).isoformat(timespec='minutes')
    cols, lst = [], []
    try:
        for ch in CHAINS:
            for x in get(f'/allNftCollections?chain_id={ch}&merch=false'):
                if hidden(x) or x.get('chain_id', ch) != ch: continue
                cols.append(dict(c=ch, a=x['nft_collection_address'], n=(x.get('name') or '').strip(),
                    std=x.get('standard'), st=x.get('start_token_id') or 0, m=x.get('minted_supply') or 0,
                    mx=x.get('max_supply') or 0, act=x.get('active_supply') or 0, img=img(x.get('image_card_url') or x.get('image'))))
            d = get(f'/marketplaceListedNfts?chain_id={ch}&limit=1000')
            for x in d.get('marketplace_listed_nfts', []):
                if hidden(x, 'collection_') or x.get('isHidden'): continue
                c = x.get('chain_id') or x.get('collection_chain_id')
                if c != ch: continue
                lst.append(dict(c=ch, a=x['nft_address'], id=x['token_id'], n=(x.get('name') or '').strip(),
                    coll=(x.get('collection_name') or '').strip(), img=img(x.get('image')),
                    type=x.get('listing_type'), at=x.get('listed_at')))
    except Exception as e:
        print('Liquid API not reachable, files left alone:', e); return 0
    if not cols:
        print('No collections returned, files left alone'); return 0
    cols.sort(key=lambda x: (x['n'].lower(), x['c']))
    lst.sort(key=lambda x: x.get('at') or '', reverse=True)
    os.makedirs(OUT, exist_ok=True)
    for fn, data in (('collections.json', cols), ('listings.json', lst)):
        p = os.path.join(OUT, fn)
        old = None
        try: old = json.load(open(p)).get('items')
        except Exception: pass
        if old == data: print(fn, 'unchanged'); continue
        json.dump({'updated': now, 'source': API, 'items': data}, open(p, 'w'), separators=(',', ':'), ensure_ascii=False)
        print(fn, len(data), 'written')
    return 0

if __name__ == '__main__':
    sys.exit(main())
