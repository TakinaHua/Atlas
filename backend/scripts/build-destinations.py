"""Build the bundled Atlas search snapshot from GeoNames US.zip (CC BY 4.0).
Usage: python3 backend/scripts/build-destinations.py /path/to/US.zip
"""
import sys, json, zipfile, io, hashlib
from datetime import datetime, timezone
from pathlib import Path
codes=set('AL AK AZ AR CA CO CT DE FL GA HI ID IL IN IA KS KY LA ME MD MA MI MN MS MO MT NE NV NH NJ NM NY NC ND OH OK OR PA RI SC SD TN TX UT VT VA WA WV WI WY DC'.split())
archive=Path(sys.argv[1])
with zipfile.ZipFile(archive) as z:
    rows=[line.rstrip('\n').split('\t') for line in io.TextIOWrapper(z.open('US.txt'),encoding='utf-8')]
states={r[10]:r for r in rows if len(r)>=19 and r[6]=='A' and r[7]=='ADM1' and r[10] in codes}
assert len(states)==51, f'Expected 50 states plus DC, got {len(states)}'
records=[]
for r in rows:
    if len(r)<19 or r[8]!='US' or r[10] not in states: continue
    is_state=r[6]=='A' and r[7]=='ADM1'
    population=int(r[14] or 0)
    if not is_state and not (r[7] in {'PPL','PPLA','PPLA2','PPLA3','PPLA4','PPLC'} and (population>=500 or r[7]!='PPL')): continue
    code=r[10]; state=states[code][1]
    name=state if is_state else r[1]
    aliases=sorted({a for a in [r[2],*r[3].split(',')] if a and a!=name and a.isascii() and len(a)<=60})
    records.append(dict(id='geonames-'+r[0],name=name,label=f'{name}, United States' if is_state else f'{name}, {state}',kind='state' if is_state else 'city',state=state,stateCode=code,latitude=float(r[4]),longitude=float(r[5]),zoom=({'AK':3,'CA':5,'TX':5,'MT':5,'DC':10}.get(code,6) if is_state else 11),population=population,aliases=aliases))
records.sort(key=lambda r:r['id'])
output=Path(__file__).resolve().parents[1]/'assets/us-destinations.json'
output.parent.mkdir(parents=True,exist_ok=True)
result=dict(source='https://download.geonames.org/export/dump/US.zip',license='https://creativecommons.org/licenses/by/4.0/',retrievedAt=datetime.now(timezone.utc).isoformat(),sourceSha256=hashlib.sha256(archive.read_bytes()).hexdigest(),coverage='50 states plus DC; populated places with population >=500 or administrative-seat status; territories excluded',records=records)
output.write_text(json.dumps(result,ensure_ascii=False,separators=(',',':'))+'\n')
print(f'{len(records)} records: {sum(r["kind"]=="state" for r in records)} states/DC; {output.stat().st_size} bytes')
