import json, urllib.request, time, os, sys
from concurrent.futures import ThreadPoolExecutor
CALC="https://www.postfinance.ch/pfch/rest/api/calculator/logicalc/finance/budget-calculator/calculateBudget"
OUT="samples2.jsonl"
locs=json.load(open("taxlocations.json"))
BERN=locs["BE"]
def post(p, tries=4):
    for t in range(tries):
        try:
            r=urllib.request.Request(CALC,data=json.dumps(p).encode(),
              headers={"Content-Type":"application/json","Accept-Language":"de-CH",
              "User-Agent":"Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/120.0 Safari/537.36"})
            with urllib.request.urlopen(r,timeout=30) as f: return json.loads(f.read().decode())
        except Exception as e:
            if t==tries-1: return {"error":str(e)}
            time.sleep(1.5*(t+1))
def profile(cs,ch,g,pg,loc,denom="4",year=2008,pyear=2008):
    return {"civilStatus":cs,"children":str(ch),"zipCode":loc["zipCode"],"city":loc["city"],
            "taxLocationId":loc["taxLocationID"],"sex":"1","year":year,"grossYearIncome":g,
            "denomination":denom,"sexPartner":"2","yearPartner":pyear,
            "grossYearIncomePartner":pg,"denominationPartner":denom if pg is not None else None}
jobs=[]
# A: feiner Scan fuer die Einkommensklassen-Grenzen
for g in list(range(30000,160001,1000))+list(range(162000,320001,4000)):
    jobs.append(("scan_s0", profile("1",0,g,None,BERN)))
for g in list(range(30000,160001,2000))+list(range(164000,320001,8000)):
    jobs.append(("scan_c2", profile("2",2,g,60000,BERN)))
# B: Steuerraster pro Kanton
TAXI=[30000,50000,70000,85000,100000,120000,150000,200000,250000]
for k,loc in locs.items():
    for g in TAXI:
        for cs,ch,pg in [("1",0,None),("1",2,None),("2",0,60000),("2",2,60000)]:
            jobs.append(("tax", profile(cs,ch,g,pg,loc)))
    # Konfessionsfaktor
    for d in ["1","2","3","9"]:
        jobs.append(("denom", profile("1",0,85000,None,loc,denom=d)))
print("jobs:",len(jobs),file=sys.stderr)
done=set()
if os.path.exists(OUT):
    for l in open(OUT):
        try: done.add(json.dumps(json.loads(l)["in"],sort_keys=True))
        except: pass
jobs=[(g,p) for g,p in jobs if json.dumps(p,sort_keys=True) not in done]
print("todo:",len(jobs),file=sys.stderr)
fh=open(OUT,"a"); n=0
def work(it):
    grp,p=it; r=post(p); time.sleep(0.12)
    return {"group":grp,"in":p,"out":r.get("result") if isinstance(r,dict) else None,"err":r.get("error") if isinstance(r,dict) else "bad"}
with ThreadPoolExecutor(max_workers=4) as ex:
    for res in ex.map(work,jobs):
        fh.write(json.dumps(res,ensure_ascii=False)+"\n"); n+=1
        if n%200==0: fh.flush(); print("…",n,file=sys.stderr,flush=True)
fh.close(); print("done",n,file=sys.stderr)
