#!/usr/bin/env python3
"""Build public/metra-data.js: every Metra station and the track of all 11 lines.

Source: Metra static GTFS (public, no key; check published.txt). Its headers have leading spaces.
  - Stations: stops.txt, with the lines that serve them from trips/stop_times.
  - Accessibility (k): 'y' = elevator, from Metra's published elevator list (ELEVATORS below, our reading of
    metra.com/elevatorsites, not feed data); 'a' = accessible platform (wheelchair_boarding 1: level or ramped,
    boarding by the accessible car's bridge plate); 'n' = not accessible (NOT_ACCESSIBLE below); 'u' = not marked
    accessible (wheelchair_boarding 0, which GTFS defines as "no information", and not in Metra's designations;
    none as of Oct 2026, the build warns about any).
    Metra's station designations (A/P/N on its sector access maps, linked from metra.com/accessibility) fill in the
    stations GTFS leaves at 0: NOT_ACCESSIBLE ('n'), FULLY_ACCESSIBLE ('a' with fix), and PARTIAL (marked partial,
    still 'a': Metra says wheelchair users can reach the platforms and board there).
    GTFS says 0 at four elevator stations (79th, 87th, 103rd on the ME, Grand/Cicero): the elevator list wins.
    Every station where our status differs from GTFS gets fix; app.js labels that as our correction.
  - Tracks: outbound shapes. A line's branches share its trunk, so each branch keeps only what an earlier shape
    of the same line doesn't already cover. Where lines share a corridor they're drawn side by side: d (pixel
    offset, one per point) from the lines within SHARE of each point, in ORDER.
  - Line names (routes.txt) for the key.
  - Line labels: points on stretches where a line runs alone, LABEL_EVERY miles apart and clear of stations; one
    primary label per line (shown at every zoom), the rest from zoom 11.
  - alt for every station: along every stop pattern, the nearest accessible station inbound and outbound, per
    line. app.js shows it for stations not marked accessible, and for the others while they have an alert.

Downtown stations stay hand-maintained in METRA in public/app.js and override these by stop ID, field by field.

Usage: python3 scripts/build_metra.py [--cache DIR]   (standard library only; shares helpers with build_data.py)
"""
import argparse, csv, io, json, math, os, re, sys, urllib.request, zipfile
from datetime import date

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from build_data import compass, fetch, miles, rdp, ROOT   # noqa: E402

GTFS_URL = 'https://schedules.metrarail.com/gtfs/schedule.zip'
PUBLISHED_URL = 'https://schedules.metrarail.com/gtfs/published.txt'   # not inside the zip
OUT = os.path.join(ROOT, 'public', 'metra-data.js')

# metra.com/elevatorsites, read 2026-10-15 (GTFS stop IDs). Millennium's only elevator is closed until winter
# 2026-27; app.js overrides it. Lisle's elevators are maintained by the village.
ELEVATORS = {'MILLENNIUM', 'VANBUREN', 'MUSEUM', 'MCCORMICK', '51ST-53RD', '55-56-57TH', '79TH-UP', '87TH-UP',
             '103RD-UP', 'KENSINGTN', 'IVANHOE', '147TH-UP', 'HARVEY', 'CALUMET', 'HOMEWOOD', 'FLOSSMOOR',
             'OTC', 'MAINST', 'WINNETKA', 'KENOSHA', 'CUS', 'GRAND-CIC', 'LSS', 'JOLIET', 'LISLE', 'ROSEMONT'}
# Metra's station accessibility designations (metra.com north/west/south sector access maps for customers with
# disabilities, read 2026-10-18; GTFS stop IDs). Only stations GTFS doesn't already mark accessible, plus PARTIAL.
# "N: Not Accessible ... usually elevated and only have stairs to reach the platforms."
NOT_ACCESSIBLE = {'18TH-UP', '27TH-UP', '47TH-UP', '59TH-UP', '63RD-UP', '75TH-UP', '83RD-UP', '91ST-UP', '107TH-UP',
                  '111TH-UP', 'ASHLAND', 'BURROAK', 'MATTESON', 'OLYMPIA', 'RACINE', 'RIVERDALE', 'STATEST',
                  'STEWARTRID', 'WPULLMAN', 'GRESHAM', '123RD-BEV', 'PRAIRIEST', 'CLYBOURN', 'HUBARDWOOD',
                  'INDIANHILL', 'MAYFAIR', 'FORESTGLEN', 'GLADSTONEP', 'MANNHEIM', 'KEDZIE', 'RIVRFOREST', 'HALSTED',
                  'BNWESTERN', 'CONGRESSPK'}
# "A: Fully Accessible", though GTFS says 0 (no information).
FULLY_ACCESSIBLE = {'CICERO', 'CUMBERLAND', 'HANSONPK', 'HAZELCREST', 'HIGHLANDS', 'STONEAVE'}
# "P: Partially Accessible": platforms reachable from the street; ramps, ticket windows, buildings and shelters may
# not fully conform to ADA guidelines. GTFS marks all of these 1.
PARTIAL = {'91ST-BEV', 'LONGWOOD', '107TH-BEV', '115TH-BEV', '119TH-BEV', 'BRAESIDE', 'RIVERSIDE', 'BROOKFIELD',
           'CLARNDNHIL', 'FAIRVIEWDG'}
# Side-by-side order across a shared corridor, left to right facing outbound.
ORDER = ['UP-N', 'UP-NW', 'UP-W', 'MD-N', 'NCS', 'MD-W', 'BNSF', 'HC', 'SWS', 'RI', 'ME']
SHARE = 0.04       # miles (~65 m): lines this close share a corridor
STEP = 0.06        # miles between densified points, so changes in sharing land near where they happen
SPACING = 5        # pixels between side-by-side lines
DOWNTOWN = (41.8812, -87.6298)
LABEL_EVERY = 8    # miles between line labels along a track piece
LABEL_CLEAR = 0.35 # miles a label keeps from any station


def table(z, name):
    r = csv.reader(io.TextIOWrapper(z.open(name), encoding='utf-8-sig'))
    head = [h.strip() for h in next(r)]
    return [dict(zip(head, (v.strip() for v in row))) for row in r]


def flat(p):
    """Miles on a local flat projection, for point-segment distances."""
    return (p[1] * 51.45, p[0] * 69.05)


def seg_dist(p, a, b):
    (px, py), (ax, ay), (bx, by) = flat(p), flat(a), flat(b)
    dx, dy = bx - ax, by - ay
    t = max(0.0, min(1.0, ((px - ax) * dx + (py - ay) * dy) / ((dx * dx + dy * dy) or 1e-12)))
    return math.hypot(px - ax - t * dx, py - ay - t * dy)


class Near:
    """Point-to-polyline distance with a coarse grid index."""
    CELL = 0.01   # degrees

    def __init__(self, line):
        self.grid = {}
        for a, b in zip(line, line[1:]):
            for i in range(int(min(a[0], b[0]) // self.CELL) - 1, int(max(a[0], b[0]) // self.CELL) + 2):
                for j in range(int(min(a[1], b[1]) // self.CELL) - 1, int(max(a[1], b[1]) // self.CELL) + 2):
                    self.grid.setdefault((i, j), []).append((a, b))

    def dist(self, p):
        segs = self.grid.get((int(p[0] // self.CELL), int(p[1] // self.CELL)), [])
        return min((seg_dist(p, a, b) for a, b in segs), default=99)


def densify(pts):
    out = [pts[0]]
    for a, b in zip(pts, pts[1:]):
        n = max(1, int(miles(a, b) / STEP))
        out += [(a[0] + (b[0] - a[0]) * k / n, a[1] + (b[1] - a[1]) * k / n) for k in range(1, n + 1)]
    return out


def simplify(run):
    """Douglas-Peucker within stretches of constant offset, keeping every point where the offset changes."""
    out, start = [], 0
    for i in range(1, len(run) + 1):
        if i == len(run) or run[i][1] != run[start][1]:
            part = rdp([p for p, _ in run[start:i]], 0.00005)
            out += [(p, run[start][1]) for p in part]
            start = i
    return out


def place_labels(route, pts, alone, stations):
    """Labels along one track piece (densified points): the first point past each target distance where the line runs
    alone and no station is within LABEL_CLEAR. The primary label, shown at every zoom, is the one nearest the middle
    of the piece, so zoomed-out labels spread across the region; short branch pieces (under 10 mi) get none."""
    along = [0.0]
    for a, b in zip(pts, pts[1:]):
        along.append(along[-1] + miles(a, b))
    length = along[-1]
    out, target = [], min(3.0, length / 2)
    for p, d, solo in zip(pts, along, alone):
        if d >= target and solo and all(miles(p, q) > LABEL_CLEAR for q in stations):
            out.append((d, p))
            target = d + LABEL_EVERY
    if not out:
        return []
    main_ = min(out, key=lambda x: abs(x[0] - length / 2)) if length >= 10 else None
    return [{'c': route, 'll': [round(p[0], 5), round(p[1], 5)], 'z': 0 if (d, p) == main_ else 11} for d, p in out]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--cache', default=os.path.join(ROOT, '.cache'))
    args = ap.parse_args()
    os.makedirs(args.cache, exist_ok=True)
    z = zipfile.ZipFile(fetch(GTFS_URL, os.path.join(args.cache, 'metra_gtfs.zip')))
    req = urllib.request.Request(PUBLISHED_URL, headers={'User-Agent': 'step-free-chicago-transit build script'})
    with urllib.request.urlopen(req) as r:   # "10/03/26 02:20:03 AM America/Chicago"
        m = re.match(r'(\d\d)/(\d\d)/(\d\d)', r.read().decode())
    published = f"20{m[3]}-{m[1]}-{m[2]}" if m else ''
    # Re-download when Metra has published a newer feed than the cached copy.
    stamp = os.path.join(args.cache, 'metra_published.txt')
    if published and (not os.path.exists(stamp) or open(stamp).read() != published):
        if os.path.exists(os.path.join(args.cache, 'metra_gtfs.zip')):
            os.remove(os.path.join(args.cache, 'metra_gtfs.zip'))
        z = zipfile.ZipFile(fetch(GTFS_URL, os.path.join(args.cache, 'metra_gtfs.zip')))
        open(stamp, 'w').write(published)

    stops = {s['stop_id']: s for s in table(z, 'stops.txt')}
    trips = {t['trip_id']: t for t in table(z, 'trips.txt')}
    seq = {}
    for r in table(z, 'stop_times.txt'):
        seq.setdefault(r['trip_id'], []).append((int(r['stop_sequence']), r['stop_id']))
    lines_at = {}
    for tid, s in seq.items():
        for _, sid in s:
            lines_at.setdefault(sid, set()).add(trips[tid]['route_id'])
    # Every distinct stop pattern, in outbound order (a shape's trips don't all stop alike), and each shape's line.
    ll = {sid: (float(s['stop_lat']), float(s['stop_lon'])) for sid, s in stops.items()}
    patterns, shape_route = set(), {}
    for tid, s in seq.items():
        t = trips[tid]
        st = [sid for _, sid in sorted(s)]
        if miles(ll[st[0]], DOWNTOWN) > miles(ll[st[-1]], DOWNTOWN):
            st = st[::-1]
        patterns.add((t['route_id'], tuple(st)))
        shape_route[t['shape_id']] = t['route_id']

    k = {sid: 'y' if sid in ELEVATORS else 'n' if sid in NOT_ACCESSIBLE else
         'a' if s['wheelchair_boarding'] == '1' or sid in FULLY_ACCESSIBLE else 'u' for sid, s in stops.items()}
    # Display names: GTFS names without trailing periods ("Lake Forest."), plus the line where that repeats.
    base = {sid: s['stop_name'].rstrip('.').strip() for sid, s in stops.items()}
    count = {}
    for n in base.values():
        count[n] = count.get(n, 0) + 1
    order = lambda ls: sorted(ls, key=ORDER.index)
    names = {sid: n if count[n] == 1 else f"{n} ({'/'.join(order(lines_at.get(sid, [])))})" for sid, n in base.items()}
    # Downtown display names live in METRA in app.js ("Ogilvie (OTC)"); use the same ones in alternatives.
    app = open(os.path.join(ROOT, 'public', 'app.js')).read()
    for sid, nm in re.findall(r"\{id:'([^']+)',name:'((?:[^'\\]|\\.)*)'", app):
        if sid in names:
            names[sid] = nm.replace("\\'", "'")

    # Nearest accessible station inbound and outbound along each pattern; per line and direction only the nearest
    # (a line's shapes include express patterns that skip it).
    near_ = {}
    for route, st in patterns:
        for i, m in enumerate(st):
            for step, way in ((-1, 'inbound'), (1, 'outbound')):
                j = i + step
                while 0 <= j < len(st) and k[st[j]] in ('u', 'n'):
                    j += step
                if 0 <= j < len(st):
                    key, cand = (m, route, way), (miles(ll[m], ll[st[j]]), abs(j - i), st[j])
                    if key not in near_ or cand < near_[key]:
                        near_[key] = cand
    alts = {}
    for (m, route, way), (_, hops, n) in near_.items():
        best = alts.setdefault(m, {})
        if n not in best or hops < best[n]['hops']:
            best[n] = {'hops': hops, 'way': way, 'lines': {route}}
        elif hops == best[n]['hops']:
            best[n]['lines'].add(route)

    stations = []
    for sid, s in sorted(stops.items()):
        if sid not in lines_at:
            continue
        st = {'id': sid, 'name': names[sid], 'll': [round(ll[sid][0], 5), round(ll[sid][1], 5)],
              'k': k[sid], 'lines': order(lines_at[sid])}
        if k[sid] in ('y', 'a') and s['wheelchair_boarding'] != '1':
            st['fix'] = True   # accessible per Metra's elevator list or designations though GTFS says 0
        if sid in PARTIAL:
            st['partial'] = True
        if k[sid] == 'n' and s['wheelchair_boarding'] == '1':
            st['fix'] = True   # Metra's designations say not accessible though GTFS marks it accessible
        if sid in alts:
            rows = []
            for n, info in alts[sid].items():
                d = miles(ll[sid], ll[n])
                hop = 'next stop' if info['hops'] == 1 else f"{info['hops']} stops"
                on = '/'.join(order(info['lines'])) + ', ' if len(st['lines']) > 1 else ''
                rows.append((d, [names[n], f"{d:.1f} mi · {on}{hop} {info['way']}"]))
            st['alt'] = [r for _, r in sorted(rows)][:4]
        stations.append(st)

    # Tracks: outbound shapes, each line's trunk once, then side-by-side offsets in shared corridors.
    shape_pts = {}
    for r in table(z, 'shapes.txt'):
        shape_pts.setdefault(r['shape_id'], []).append((int(r['shape_pt_sequence']), float(r['shape_pt_lat']), float(r['shape_pt_lon'])))
    use = sorted((shape for shape in shape_route if '_OB_' in shape), key=lambda s: (ORDER.index(shape_route[s]), s))
    full = {}
    for shape in use:
        pts = [(la, lo) for _, la, lo in sorted(shape_pts[shape])]
        if miles(pts[0], DOWNTOWN) > miles(pts[-1], DOWNTOWN):
            pts = pts[::-1]
        full[shape] = pts
    per_route = {}
    for shape in use:
        per_route.setdefault(shape_route[shape], []).append(shape)
    route_near = {r: [Near(full[s]) for s in shapes] for r, shapes in per_route.items()}
    pieces, done, labels = [], {}, []
    served = [ll[s['id']] for s in stations]
    for shape in use:
        route = shape_route[shape]
        earlier = done.setdefault(route, [])
        run, alone = [], []
        for p in densify(full[shape]) + [None]:
            if p is not None and not any(n.dist(p) < SHARE for n in earlier):
                with_ = [r for r in ORDER if r == route or any(n.dist(p) < SHARE for n in route_near.get(r, []))]
                run.append((p, round((with_.index(route) - (len(with_) - 1) / 2) * SPACING, 1)))
                alone.append(len(with_) == 1)
                continue
            if len(run) >= 2:
                pieces.append((route, simplify(run)))
                labels += place_labels(route, [q for q, _ in run], alone, served)
            run, alone = [], []
        earlier.append(Near(full[shape]))
    lines = [{'c': route, 'p': [[round(a, 5), round(b, 5)] for (a, b), _ in run], 'd': [d for _, d in run]}
             for route, run in pieces]
    for l in lines:
        if len(set(l['d'])) == 1:
            l['d'] = l['d'][0]

    # Line names for the key, in ORDER.
    routes = {r['route_id']: r['route_long_name'] for r in table(z, 'routes.txt')}
    routes = {r: routes[r] for r in ORDER if r in routes}
    data = {'generated': date.today().isoformat(), 'published': published, 'routes': routes, 'stations': stations,
            'lines': lines, 'labels': labels}
    with open(OUT, 'w') as f:
        f.write('// Generated by scripts/build_metra.py from Metra static GTFS and metra.com/elevatorsites. Do not edit.\n')
        f.write('const METRA_DATA = ' + json.dumps(data, ensure_ascii=False, separators=(',', ':')) + ';\n')
    for s in stations:
        if s['k'] == 'u':
            print(f"note: {s['id']} {s['name']}: GTFS has no accessibility information and it's not in Metra's "
                  "designations; check metra.com and add it to NOT_ACCESSIBLE or FULLY_ACCESSIBLE", file=sys.stderr)
    for sid in ELEVATORS | NOT_ACCESSIBLE | FULLY_ACCESSIBLE | PARTIAL:
        if sid not in {s['id'] for s in stations}:
            print(f"note: {sid} is in a hand list but not a served GTFS stop", file=sys.stderr)
    print(f"wrote {OUT}: {len(stations)} stations ({sum(s['k'] == 'y' for s in stations)} elevator, "
          f"{sum(s['k'] == 'a' for s in stations)} accessible, {sum(s['k'] == 'n' for s in stations)} not accessible, "
          f"{sum(s['k'] == 'u' for s in stations)} not marked), "
           f"{len(lines)} track pieces, {sum(len(l['p']) for l in lines)} points, {len(labels)} line labels, {os.path.getsize(OUT)//1024} KiB; "
          f"GTFS published {published}", file=sys.stderr)


if __name__ == '__main__':
    main()
