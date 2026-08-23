import json, urllib.request, time, os, sys
from concurrent.futures import ThreadPoolExecutor

BASE="https://www.postfinance.ch/pfch/rest/api"
CALC=f"{BASE}/calculator/logicalc/finance/budget-calculator/calculateBudget"
OUT="samples.jsonl"

def post(url, payload, tries=4):
    for t in range(tries):
        try:
            r=urllib.request.Request(url, data=json.dumps(payload).encode(),
                headers={"Content-Type":"application/json","Accept-Language":"de-CH",
                         "User-Agent":"Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/120.0 Safari/537.36"})
            with urllib.request.urlopen(r, timeout=30) as f:
                return json.loads(f.read().decode())
        except Exception as e:
            if t==tries-1: return {"error":str(e)}
            time.sleep(1.5*(t+1))

def taxloc(zipcode):
    with urllib.request.urlopen(f"{BASE}/calculator/logicalc/tax/searchTaxLocation/{zipcode}", timeout=30) as f:
        return json.loads(f.read().decode())["result"]

CITIES={"ZH":"8001","BE":"3011","LU":"6003","UR":"6460","SZ":"6430","OW":"6060","NW":"6370",
 "GL":"8750","ZG":"6300","FR":"1700","SO":"4500","BS":"4051","BL":"4410","SH":"8200",
 "AR":"9100","AI":"9050","SG":"9000","GR":"7000","AG":"5000","TG":"8500","TI":"6900",
 "VD":"1003","VS":"1950","NE":"2000","GE":"1201","JU":"2800"}

locs={}
for k,z in CITIES.items():
    res=taxloc(z)
    hit=[r for r in res if r["canton"]==k] or res
    locs[k]=hit[0]
    time.sleep(0.15)
json.dump(locs, open("taxlocations.json","w"), ensure_ascii=False, indent=1)
print("taxlocations:", len(locs), file=sys.stderr)

BERN=locs["BE"]
def profile(cs, children, gross, partner_gross, loc, denom="4", year=2008, pyear=2008, pdenom="4"):
    return {"civilStatus":cs,"children":str(children),"zipCode":loc["zipCode"],"city":loc["city"],
            "taxLocationId":loc["taxLocationID"],"sex":"1","year":year,"grossYearIncome":gross,
            "denomination":denom,"sexPartner":"2","yearPartner":pyear,
            "grossYearIncomePartner":partner_gross,"denominationPartner":pdenom}

jobs=[]
INCOMES=[20000,30000,40000,50000,60000,70000,85000,100000,120000,150000,200000,250000]
# A: Haushaltsraster am Referenzort Bern
for cs in ["1","2","3","4"]:
    for ch in range(6):
        for g in INCOMES:
            partners=[None] if cs=="1" else [0,40000,80000,120000]
            for pg in partners:
                jobs.append(("household", profile(cs,ch,g,pg,BERN)))
# B: Kantonsraster
CANTON_PROFILES=[("1",0,85000,None),("1",2,85000,None),("2",2,85000,60000),("1",0,150000,None)]
for k,loc in locs.items():
    for cs,ch,g,pg in CANTON_PROFILES:
        jobs.append(("canton", profile(cs,ch,g,pg,loc)))
    for d in ["1","2"]:
        jobs.append(("canton_denom", profile("1",0,85000,None,loc,denom=d,pdenom=d)))
# C: Alter (Netto-Einkommen / BVG-Staffelung)
# C: Alters-/BVG-Staffelung fuer das Netto-Einkommensmodell
for yr in [2009,2008,2007,2004,2001,1998,1995,1992,1990,1986,1982,1978,1974,1970,1966,1962,1961,1960,1958]:
    for g in [30000,50000,85000,120000,200000]:
        jobs.append(("age", profile("1",0,g,None,BERN,year=yr)))
# D: feines Einkommensraster fuer die Netto-Kurve (Alter = Live-Default)
for g in list(range(10000,300001,10000))+[22000,26000,88200,132000]:
    jobs.append(("income_fine", profile("1",0,g,None,BERN)))

print("jobs:", len(jobs), file=sys.stderr)
done=set()
if os.path.exists(OUT):
    for line in open(OUT):
        try: done.add(json.dumps(json.loads(line)["in"], sort_keys=True))
        except: pass
jobs=[(g,p) for g,p in jobs if json.dumps(p,sort_keys=True) not in done]
print("todo:", len(jobs), file=sys.stderr)

fh=open(OUT,"a")
n=0
def work(item):
    grp,p=item
    r=post(CALC,p)
    time.sleep(0.12)
    return {"group":grp,"in":p,"out":r.get("result") if isinstance(r,dict) else None,"err":r.get("error") if isinstance(r,dict) else "bad"}
with ThreadPoolExecutor(max_workers=4) as ex:
    for res in ex.map(work, jobs):
        fh.write(json.dumps(res,ensure_ascii=False)+"\n"); n+=1
        if n%100==0: fh.flush(); print("…",n, file=sys.stderr, flush=True)
fh.close()
print("done", n, file=sys.stderr)
