import pdfplumber, json, re
pdf = pdfplumber.open("tmp_data/real.pdf")

def clean(c):
    if c is None: return ""
    return re.sub(r"\s+"," ", c.replace("\n"," ")).strip()

appendix=[]
shortlist=[]
for pi,p in enumerate(pdf.pages):
    for t in p.extract_tables():
        hdr=[clean(c) for c in t[0]]
        if hdr[0]=="#" and "Strength" in hdr:
            for row in t[1:]:
                r=[clean(c) for c in row]
                appendix.append(dict(num=r[0],strength=r[1],source=r[2],property=r[3],market=r[4],
                    price=r[5],lots=r[6],toh=r[7],poh=r[8],noi=r[9],cap=r[10],occ=r[11],plot=r[12],flags=r[13]))
        elif hdr[0]=="#" and "Score" in hdr:
            for row in t[1:]:
                r=[clean(c) for c in row]
                shortlist.append(dict(num=r[0],property=r[1],market=r[2],price=r[3],lots=r[4],toh=r[5],
                    poh=r[6],noi=r[7],cap=r[8],occ=r[9],score=r[10],next=r[11]))
json.dump(appendix, open("tmp_data/appendix.json","w"), indent=1)
json.dump(shortlist, open("tmp_data/shortlist.json","w"), indent=1)
print("appendix rows:", len(appendix))
print("shortlist rows:", len(shortlist))
# show a few appendix with financials
for a in appendix:
    if a["noi"]:
        print(a["num"],a["property"],"|",a["market"],"| p",a["price"],"lots",a["lots"],"noi",a["noi"],"cap",a["cap"],"occ",a["occ"])
