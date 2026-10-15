"""Build the bounded ODbL walking demonstration graph from an OSM XML extract."""
import sys, json, math, hashlib, datetime
from pathlib import Path
import xml.etree.ElementTree as ET

BOUNDS = [-80.016, 40.437, -79.999, 40.447]  # west,south,east,north
ALLOWED = {'footway', 'path', 'pedestrian', 'steps', 'residential', 'living_street', 'service', 'unclassified', 'tertiary', 'secondary', 'primary'}
PERMITTED = {'yes', 'designated', 'permissive'}
def tags(element):
    return {t.attrib['k']: t.attrib['v'] for t in element.findall('tag')}
def accessible(t):
    if any('conditional' in k for k in t) or t.get('indoor') == 'yes': return False
    if 'foot' in t: return t['foot'] in PERMITTED
    return t.get('access', 'yes') in PERMITTED

def meters(a, b):
    lon1, lat1, lon2, lat2 = map(math.radians, [*a, *b])
    h = math.sin((lat2-lat1)/2)**2 + math.cos(lat1)*math.cos(lat2)*math.sin((lon2-lon1)/2)**2
    return round(6371008.8 * 2 * math.asin(min(1, math.sqrt(h))), 3)

def build(source):
    root = ET.fromstring(source)
    nodes = {}
    for node in root.findall('node'):
        t = tags(node); lon, lat = float(node.attrib['lon']), float(node.attrib['lat'])
        if not (BOUNDS[0] <= lon <= BOUNDS[2] and BOUNDS[1] <= lat <= BOUNDS[3]): continue
        if not accessible(t) or (t.get('barrier') and t.get('foot') not in PERMITTED): continue
        nodes[node.attrib['id']] = [lon, lat]
    edges = []
    for way in root.findall('way'):
        t = tags(way)
        if t.get('highway') not in ALLOWED or t.get('area') == 'yes' or not accessible(t): continue
        direction = t.get('oneway:foot', 'no')
        if direction not in {'no', 'yes', '1', 'true', '-1'}: continue
        ids = [n.attrib['ref'] for n in way.findall('nd')]
        for a, b in zip(ids, ids[1:]):
            if a not in nodes or b not in nodes or a == b: continue
            cost = meters(nodes[a], nodes[b])
            if direction != '-1': edges.append([a, b, cost, way.attrib['id']])
            if direction not in {'yes', '1', 'true'}: edges.append([b, a, cost, way.attrib['id']])
    used = {v for edge in edges for v in edge[:2]}
    return {'bounds': BOUNDS, 'source': 'https://api.openstreetmap.org/api/0.6/map?bbox=-80.016,40.437,-79.999,40.447', 'sourceSha256': hashlib.sha256(source).hexdigest(), 'retrievedAt': datetime.datetime.now(datetime.timezone.utc).isoformat(), 'license': 'ODbL-1.0', 'attribution': '© OpenStreetMap contributors', 'nodes': {k: v for k, v in nodes.items() if k in used}, 'edges': edges}

if __name__ == '__main__':
    data = build(Path(sys.argv[1]).read_bytes())
    target = Path(__file__).resolve().parent.parent / 'assets/pittsburgh-walking.json'
    target.write_text(json.dumps(data, separators=(',', ':')) + '\n')
    print(f"{len(data['nodes'])} nodes, {len(data['edges'])} directed edges")
