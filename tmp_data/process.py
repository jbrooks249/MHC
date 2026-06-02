import json, re

appendix=json.load(open("tmp_data/appendix.json"))
shortlist=json.load(open("tmp_data/shortlist.json"))
db=json.load(open("tmp_data/db.json"))

US_STATES=set("AL AK AZ AR CA CO CT DE FL GA HI ID IL IN IA KS KY LA ME MD MA MI MN MS MO MT NE NV NH NJ NM NY NC ND OH OK OR PA RI SC SD TN TX UT VT VA WA WV WI WY DC".split())
# also canadian provinces seen: AB BC
PROV=set("AB BC ON QC".split())

def num(s):
    if not s: return None
    s=s.replace("$","").replace(",","").replace("%","").strip()
    if s=="": return None
    try:
        f=float(s)
        return f
    except: return None

def to_int(s):
    n=num(s)
    return int(n) if n is not None else None

def split_market(m):
    m=(m or "").strip()
    if not m: return ("","")
    # ends with state code
    parts=m.rsplit(",",1)
    if len(parts)==2:
        city=parts[0].strip()
        st=parts[1].strip().upper()
        return (city, st)
    # bare state
    up=m.strip().upper()
    if up in US_STATES or up in PROV:
        return ("", up)
    return (m, "")

def norm_name(n):
    n=(n or "").lower()
    n=re.sub(r"[^a-z0-9 ]"," ",n)
    n=re.sub(r"\s+"," ",n).strip()
    return n

def key(name,city,state):
    return (norm_name(name), norm_name(city), (state or "").upper())

# Build shortlist lookup by (name,state)
sl={}
for s in shortlist:
    c,st=split_market(s["market"])
    sl[key(s["property"],c,st)]={
        "noi":num(s["noi"]),"cap":num(s["cap"]),"occ":num(s["occ"]),"score":num(s["score"]),
        "lots":to_int(s["lots"]),"toh":to_int(s["toh"]),"poh":to_int(s["poh"]),"price":num(s["price"])
    }

# Build merged unique listings from appendix
merged={}
order=[]
for a in appendix:
    c,st=split_market(a["market"])
    k=key(a["property"],c,st)
    rec=merged.get(k)
    item={
        "name":a["property"].strip(),
        "city":c,"state":st,
        "price":num(a["price"]),
        "lots":to_int(a["lots"]),
        "toh":to_int(a["toh"]),
        "poh":to_int(a["poh"]),
        "noi":num(a["noi"]),
        "cap":num(a["cap"]),
        "occ":num(a["occ"]),
        "plot":num(a["plot"]),
        "source":a["source"],
        "flags":a["flags"],
        "strength":a["strength"],
    }
    # enrich from shortlist
    s=sl.get(k)
    if s:
        for f in ["noi","cap","occ","price","lots","toh","poh"]:
            if item.get(f) is None and s.get(f) is not None:
                item[f]=s[f]
        item["score"]=s.get("score")
    if rec is None:
        merged[k]=item
        order.append(k)
    else:
        # merge: prefer non-null, prefer financial-rich source
        for f in ["price","lots","toh","poh","noi","cap","occ","plot","flags","score"]:
            if rec.get(f) in (None,"") and item.get(f) not in (None,""):
                rec[f]=item[f]
        # combine sources
        srcs=set(rec["source"].split(" + "))|{item["source"]}
        rec["source"]=" + ".join(sorted(srcs))

# also add shortlist-only entries not present in appendix
for s in shortlist:
    c,st=split_market(s["market"])
    k=key(s["property"],c,st)
    if k not in merged:
        merged[k]={
            "name":s["property"].strip(),"city":c,"state":st,
            "price":num(s["price"]),"lots":to_int(s["lots"]),"toh":to_int(s["toh"]),
            "poh":to_int(s["poh"]),"noi":num(s["noi"]),"cap":num(s["cap"]),"occ":num(s["occ"]),
            "plot":None,"source":"Shortlist","flags":"","strength":"","score":num(s["score"])
        }
        order.append(k)

unique=[merged[k] for k in order]
json.dump(unique, open("tmp_data/unique.json","w"), indent=1)
print("Appendix raw rows:", len(appendix))
print("Shortlist rows:", len(shortlist))
print("UNIQUE merged listings:", len(unique))

# Now compare to DB
dbkeys={}
for d in db:
    dbkeys.setdefault(key(d["name"],d["city"],d["state"]), []).append(d)

matched=0; unmatched_pdf=[]
for k in order:
    if k in dbkeys: matched+=1
    else: unmatched_pdf.append(k)
print("PDF listings matched to existing DB:", matched)
print("PDF listings NOT in DB (need insert):", len(unmatched_pdf))

# DB rows not in PDF
pdfkeys=set(order)
db_not_pdf=[d for d in db if key(d["name"],d["city"],d["state"]) not in pdfkeys]
print("DB rows NOT in PDF:", len(db_not_pdf))
for d in db_not_pdf[:80]:
    print("   -", d["name"],"|",d["city"],d["state"],"| status",d["status"],"| src",d["source"])
