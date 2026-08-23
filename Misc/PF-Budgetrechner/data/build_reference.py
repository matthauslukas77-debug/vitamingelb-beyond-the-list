import json, math
from collections import defaultdict
CATS=['reside','insurance','health','mobility','consumption']
rows=[json.loads(l) for l in open('samples.jsonl')]+[json.loads(l) for l in open('samples2.jsonl')]
rows=[r for r in rows if r['out']]

# ---- A) Ausgabenklassen je Haushaltstyp (cs, kinder) ------------------------
# Alle Samples nutzen (auch Kantons-/Steuersamples), Klasse = (ratio, shares)
buckets=defaultdict(dict)   # (cs,kids) -> {classKey: {"nets":[], "ratio":x, "shares":[..]}}
for r in rows:
    i=r['in']; o=r['out']
    net=o['householdIncomeNetMonth']; rest=o['sumExpensesMonth']-o['taxesMonthAmount']
    if net<=0 or rest<=0: continue
    ratio=o['sumExpensesMonth']/net
    shares=[o[c+'MonthAmount']/rest for c in CATS]
    key=(i['civilStatus'], int(i['children']))
    ck=round(ratio,2)
    b=buckets[key].setdefault(ck, {"nets":[], "ratios":[], "shares":[[] for _ in CATS]})
    b["nets"].append(net); b["ratios"].append(ratio)
    for j,s in enumerate(shares): b["shares"][j].append(s)

table={}
for (cs,kids),cls in sorted(buckets.items()):
    entries=[]
    for ck,b in cls.items():
        entries.append({
            "netMin": min(b["nets"]), "netMax": max(b["nets"]),
            "n": len(b["nets"]),
            "expenseRatio": round(sum(b["ratios"])/len(b["ratios"]), 5),
            "shares": {c: round(sum(b["shares"][j])/len(b["shares"][j]), 5) for j,c in enumerate(CATS)},
        })
    entries.sort(key=lambda e: e["netMin"])
    # Klassengrenzen: geometrisches Mittel zwischen benachbarten Klassen
    for a,b in zip(entries, entries[1:]):
        edge=round(math.sqrt(a["netMax"]*b["netMin"]))
        a["netUpperBound"]=edge; b["netLowerBound"]=edge
    entries[0]["netLowerBound"]=0; entries[-1]["netUpperBound"]=None
    table[f"{cs}|{kids}"]=entries

# ---- B) Steuertabelle je Steuerort -----------------------------------------
tax=defaultdict(lambda: defaultdict(list))
for r in rows:
    if r['group'] not in ('tax','canton','household','scan_s0','scan_c2','income_fine'): continue
    i=r['in']
    if i['denomination']!='4': continue
    loc=i['taxLocationId']
    hh_gross=(i['grossYearIncome'] or 0)+(i['grossYearIncomePartner'] or 0)
    earners=2 if (i['grossYearIncomePartner'] or 0)>0 else 1
    key=f"{i['civilStatus']}|{int(i['children'])}|{earners}"
    tax[loc][key].append((hh_gross, r['out']['taxesYearAmount']))
taxtable={}
for loc,d in tax.items():
    out_d={}
    for k,v in d.items():
        agg=defaultdict(list)
        for g,t in v: agg[g].append(t)
        pts=[[g, round(sum(ts)/len(ts))] for g,ts in sorted(agg.items())]
        if len(pts)>=3: out_d[k]=pts
    taxtable[str(loc)]=out_d

# ---- C) Konfessionsfaktor je Steuerort --------------------------------------
denom=defaultdict(dict)
for r in rows:
    i=r['in']
    if i['civilStatus']=='1' and i['children']=='0' and i['grossYearIncome']==85000 and i['grossYearIncomePartner'] is None:
        denom[str(i['taxLocationId'])][i['denomination']]=r['out']['taxesYearAmount']
denomfactor={}
for loc,d in denom.items():
    if '4' not in d or d['4']==0: continue
    denomfactor[loc]={k: round(v/d['4'],4) for k,v in sorted(d.items())}

locs=json.load(open('taxlocations.json'))
out={
  "_source":"https://www.postfinance.ch/de/privat/anlegen/tools-rechner/budget-erstellen.html",
  "_sampled":"2026-08-22",
  "_samples":len(rows),
  "_note":"Richtwerte des PostFinance-Budgetrechners, gemessen ueber die oeffentliche API. Siehe ../MODELL.md",
  "categories":["taxes"]+CATS,
  "expenseClasses":table,
  "taxByLocation":taxtable,
  "denominationFactor":denomfactor,
  "taxLocations":locs,
}
json.dump(out, open('reference.json','w'), ensure_ascii=False, indent=1)
print("Haushaltstypen:",len(table),"| Steuerorte:",len(taxtable),"| Samples:",len(rows))
for k in ['1|0','1|2','2|2','4|0']:
    print(f"\n{k}:")
    for e in table[k]:
        print(f"  netto {e['netLowerBound']:>6}–{str(e['netUpperBound']):>6}  ratio {e['expenseRatio']}  n={e['n']:3}  shares={e['shares']}")
