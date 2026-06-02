import json, re
u=json.load(open("tmp_data/unique.json"))
US_STATES=set("AL AK AZ AR CA CO CT DE FL GA HI ID IL IN IA KS KY LA ME MD MA MI MN MS MO MT NE NV NH NJ NM NY NC ND OH OK OR PA RI SC SD TN TX UT VT VA WA WV WI WY DC".split())

REGION={
 "WA":"Pacific NW","OR":"Pacific NW","ID":"Pacific NW",
 "CA":"Pacific","AK":"Pacific","HI":"Pacific",
 "AZ":"Southwest","NM":"Southwest","NV":"Southwest","TX":"Southwest","OK":"Southwest",
 "CO":"Mountain","UT":"Mountain","MT":"Mountain","WY":"Mountain",
 "ND":"Central","SD":"Central","NE":"Central","KS":"Central",
 "IA":"Midwest","IN":"Midwest","MI":"Midwest","MN":"Midwest","MO":"Midwest","WI":"Midwest","OH":"Midwest","IL":"Midwest",
 "AL":"Southeast","FL":"Southeast","GA":"Southeast","KY":"Southeast","NC":"Southeast","SC":"Southeast","TN":"Southeast","VA":"Southeast","WV":"Southeast","AR":"Southeast","LA":"Southeast","MS":"Southeast",
 "MD":"Northeast","NJ":"Northeast","NY":"Northeast","PA":"Northeast","CT":"Northeast","ME":"Northeast","VT":"Northeast","NH":"Northeast","RI":"Northeast","MA":"Northeast","DE":"Northeast","DC":"Northeast",
 "AB":"Canada","BC":"Canada","ON":"Canada","QC":"Canada",
}

FULLNAME={"alabama":"AL","alaska":"AK","arizona":"AZ","arkansas":"AR","california":"CA","colorado":"CO","connecticut":"CT","delaware":"DE","florida":"FL","georgia":"GA","hawaii":"HI","idaho":"ID","illinois":"IL","indiana":"IN","iowa":"IA","kansas":"KS","kentucky":"KY","louisiana":"LA","maine":"ME","maryland":"MD","massachusetts":"MA","michigan":"MI","minnesota":"MN","mississippi":"MS","missouri":"MO","montana":"MT","nebraska":"NE","nevada":"NV","ohio":"OH","oklahoma":"OK","oregon":"OR","pennsylvania":"PA","tennessee":"TN","texas":"TX","utah":"UT","vermont":"VT","virginia":"VA","washington":"WA","wisconsin":"WI","wyoming":"WY"}

# recover city/state from name when state missing
recovered=0
for x in u:
    if not x["state"]:
        st=None; cityhint=None
        m=re.search(r",\s*([A-Z]{2})\b", x["name"])
        if m and m.group(1) in US_STATES:
            st=m.group(1); pre=x["name"][:m.start()]
            cm=re.search(r"[-–,]\s*([A-Za-z .']+)$", pre)
            if cm: cityhint=cm.group(1).strip()
        if not st:
            m=re.search(r",\s*([A-Za-z]+)\b", x["name"])
            if m and m.group(1).lower() in FULLNAME:
                st=FULLNAME[m.group(1).lower()]; pre=x["name"][:m.start()]
                cm=re.search(r"[-–,]\s*([A-Za-z .']+)$", pre)
                if cm: cityhint=cm.group(1).strip()
        if not st:
            m=re.search(r"[-–]\s*([A-Za-z .']+?)\s+([A-Z]{2})\s*$", x["name"])
            if m and m.group(2) in US_STATES:
                st=m.group(2); cityhint=m.group(1).strip()
        if st:
            x["state"]=st
            if cityhint and not x["city"]: x["city"]=cityhint
            recovered+=1

records=[]
for x in u:
    lots=x["lots"]; toh=x["toh"]; poh=x["poh"]
    vacant=None
    if lots is not None and toh is not None and poh is not None:
        v=lots-toh-poh
        vacant=v if v>=0 else None
    notes_parts=[]
    if x.get("strength"): notes_parts.append(f"Lead strength: {x['strength']}.")
    if x.get("flags"): notes_parts.append(f"Flags: {x['flags']}.")
    if x.get("score") is not None: notes_parts.append(f"Acquisition score: {x['score']}.")
    notes=" ".join(notes_parts) or None
    city=x["city"] or None
    state=x["state"] or None
    address=", ".join([p for p in [city,state] if p]) or None
    flags=(x.get("flags") or "").lower()
    mom_pop = ("mom" in flags) or ("pop" in flags)
    rec={
        "name":x["name"],
        "address":address,
        "city":city,
        "state":state,
        "region":REGION.get(state) if state else None,
        "units":lots if lots is not None else 1,
        "occupancy":x["occ"],
        "cap_rate":x["cap"],
        "asking_price":x["price"],
        "noi":x["noi"],
        "mom_pop":mom_pop,
        "ai_score":x.get("score"),
        "source":x["source"] or "MHC Acquisition DB",
        "lot_rent":None,
        "toh":toh,
        "poh":poh,
        "vacant":vacant,
        "notes":notes,
        "price_per_pad":x["plot"],
        "status":"active",
    }
    records.append(rec)

json.dump(records, open("tmp_data/inserts.json","w"), indent=1)
print("recovered states:", recovered)
print("records:", len(records))
print("still no state:", sum(1 for r in records if not r["state"]))
print("with price:", sum(1 for r in records if r["asking_price"]))
print("with noi:", sum(1 for r in records if r["noi"]))
print("with score:", sum(1 for r in records if r["ai_score"] is not None))
print("regions:", sorted(set(r["region"] for r in records if r["region"])))
