import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// Parsed listings from the Monday Leads Export PDF
const MONDAY_LEADS_LISTINGS = [
  // First batch - Active leads
  { name: "Crestview MHC", city: "Concord", state: "NC", address: "3715 Patricia Drive NW, Concord, NC 28027", units: null, price: null, lot_rent: null, toh: null, poh: null, vacant: null, notes: "Minimal info. Address only.", email: null },
  { name: "Shady Acres MHC", city: "Knightdale", state: "NC", address: "104 Shady Cir, Knightdale, NC", units: null, price: null, lot_rent: null, toh: null, poh: null, vacant: null, notes: "Minimal info. Address only.", email: null },
  { name: "Green Hills Mobile Home Park", city: "Old Hickory", state: "TN", address: "14200 Lebanon Rd, Old Hickory, TN 37138", units: null, price: null, lot_rent: null, toh: null, poh: null, vacant: null, notes: "Minimal info. Address only.", email: null },
  { name: "Webster's Crossing Mobile Home Park", city: "Auburn", state: "AL", address: "425 Webster Rd, Auburn, AL", units: 126, price: 20000000, lot_rent: 373, price_per_pad: 158730, toh: 53, poh: null, vacant: null, notes: "Owner attorney: Patrick C. Davidson. Sellers firm at $20M, no negotiations. ~$4M capital gains hit. Median income: $42,717.", email: "rick@davidsonumbach.com" },
  { name: "Cedar Grove Manufactured Home Community", city: "Copperas Cove", state: "TX", address: "100 Cedar Grove Dr, Copperas Cove, TX", units: 675, price: 80000000, lot_rent: 300, price_per_pad: 118519, toh: 43, poh: 607, vacant: 25, notes: "675 total spaces. ~90% POH, ~10% TOH. Year built: 1965. Asking $80M for 675 sites (~$118K/pad). Median income: $70,629.", email: null },
  { name: "East Garden Village", city: "Garden City", state: "KS", address: "4101 E US Hwy 50, Garden City, KS 67846", units: 634, price: null, lot_rent: 345, toh: 430, poh: null, vacant: 204, notes: "Owner: Rob Martin. All TOHs. 430 occupied. City water/sewer, direct billed.", email: "egv@wkh-llc.com" },
  { name: "Lake Powell Mobile Home Village / Chapman Mobile Home Park", city: "Page", state: "AZ", address: "606 lots total", units: 606, price: 39000000, lot_rent: 582, price_per_pad: 64356, toh: 556, poh: null, vacant: 50, notes: "2-park portfolio. Lake Powell MHV: 452 lots. Chapman MHP: 154 lots. 606 total lots, 556 occupied TOH, 50 vacant. Median income: $83,299.", email: null },
  { name: "Parkview MHP", city: "Green Bay", state: "WI", address: "1331 Bellevue St, Green Bay, WI", units: 510, price: null, lot_rent: 350, toh: 510, poh: null, vacant: 0, notes: "510 lots, 100% fully occupied, all TOH. Lot rent $350/mo + $20 for 2-stall garage. Multiple owners. Median income: $55,772.", email: null },
  { name: "Bali Hai Estates", city: "Hiawatha", state: "IA", address: "1405 Robins Road, Hiawatha, IA", units: 430, price: 35000000, lot_rent: 395, price_per_pad: 81395, toh: 387, poh: null, vacant: 43, notes: "430 spaces, 90% occupancy. All TOH. 150 acres, 14 acres undeveloped. Asking price $35M. Median income: $66,497.", email: null },
  { name: "Harston Wood Manufactured Home Community", city: "Euless", state: "TX", address: "10920 Harston Woods Dr, Euless, TX", units: 423, price: null, lot_rent: 733, toh: 352, poh: null, vacant: 71, notes: "423 total lots, 71 vacant. All TOH. Lot rent: $715-$785 (avg $733). Median income: $65,132.", email: null },
  { name: "Westbrook Village", city: "Noblesville", state: "IN", address: "17301 River Avenue, Noblesville, IN", units: 410, price: null, lot_rent: 405, toh: 410, poh: null, vacant: 0, notes: "410 total lots confirmed, all occupied, all TOH. Lot rent $400-$410/mo. Median income: $120,100.", email: null },
  { name: "Cedar Heights Mobile Home Park", city: "Louisville", state: "KY", address: "7600 Heights Dr, Louisville, KY 40291", units: 393, price: null, lot_rent: 500, toh: null, poh: null, vacant: 3, notes: "Owner: Judy Allen. ~50-60 acres. City water/sewer. SW lot rent $500, DW $600. POH RTO ~$1,300/mo.", email: null },
  { name: "Troy Villa Community", city: "Perrysburg", state: "OH", address: "3561 Truman Rd, Perrysburg, OH", units: 330, price: 20000000, lot_rent: 430, price_per_pad: 60606, toh: null, poh: null, vacant: null, notes: "330 lots, mix of TOH and POH. ~50% vacant. Asking ~$20M. Median income: $95,846.", email: "nathan@freeholdre.com" },
  { name: "Eastview Mobile Home Park", city: "Annandale", state: "MN", address: "60-B Sycamore St, Annandale, MN", units: 305, price: null, lot_rent: 350, toh: 267, poh: null, vacant: 38, notes: "305 lots, all TOH, 267 occupied, 38 vacant. Owner Marvin (89 yrs old). Not for sale. Median income: $78,194.", email: "emhpannandale@gmail.com" },
  { name: "Oak Crest Pointe MHC", city: "San Antonio", state: "TX", address: "6435 Crestway Dr, San Antonio, TX", units: 304, price: null, lot_rent: 638, toh: 274, poh: null, vacant: 2, notes: "304 lots, 302 occupied. ~90% TOH. Lot rent: Singles $628, Doubles $648. Owner William T Connell, 90 years old. Median income: $70,098.", email: "oakcrestpointe@gmail.com" },
  { name: "Lake Pan RV Village / Tarpon Lakeview MHP", city: "Lake Panasoffkee / Palm Harbor", state: "FL", address: "190 NW 4th Dr, Lake Panasoffkee, FL 33538 / 37376 US Highway 19 N, Palm Harbor, FL 34684", units: 303, price: 27200000, lot_rent: 650, toh: null, poh: null, vacant: 2, notes: "2-park portfolio. Lake Pan: 138 sites, mixed RV/MH. Tarpon: 165 sites, all TOH.", email: null },
  { name: "Friendly Village", city: "Tucson", state: "AZ", address: "101 West River Road, Tucson, AZ", units: 295, price: null, lot_rent: 657, toh: 295, poh: null, vacant: 0, notes: "295 total lots, 100% occupied, all TOH. Median income: $76,915.", email: null },
  { name: "Stadium MHP", city: "Key West", state: "FL", address: "1213 14th St, Key West, FL", units: 278, price: null, lot_rent: 1485, toh: 272, poh: null, vacant: 6, notes: "278 total lots, 98% occupied, all TOH. Lot rent $1,485/mo. Median income: $86,586.", email: null },
  { name: "Colony Mobile Home Park", city: "Virginia Beach", state: "VA", address: "913 Virginia Beach Blvd, Virginia Beach, VA", units: 240, price: 60000000, lot_rent: 963, price_per_pad: 250000, toh: 220, poh: null, vacant: 20, notes: "240 spaces, 220 occupied, 20 vacant. All TOH. Family-owned 75-80 years. Firm at $60M. Median income: $97,945.", email: "wchaplain1@gmail.com" },
  { name: "Sunrise Village Active 55+ Community", city: "Mesa", state: "AZ", address: "5402 E. Mckellips Rd, Mesa, AZ 85215", units: 230, price: null, lot_rent: 835, toh: 217, poh: 13, vacant: 0, notes: "55+ community. 217 occupied TOHs + 13 vacant POHs for sale/RTO.", email: null },
  { name: "Urban Village MHP / Knob Hill Mobile Home Park", city: "Boonville / Newburgh", state: "IN", address: "398 Lark Ln / 1000 State Route 662 W", units: 226, price: null, lot_rent: 390, toh: 178, poh: null, vacant: 48, notes: "2-park portfolio. Urban Village: 98 lots, 60 occupied. Knob Hill: 128 lots, 8 vacant. Owner considering selling.", email: "howardwells911@gmail.com" },
  { name: "Oakwood Campsite", city: "Wild Rose", state: "WI", address: "N5428 24th Ave, Wild Rose, WI 54984", units: 215, price: 4250000, lot_rent: 400, price_per_pad: 19767, toh: 65, poh: null, vacant: null, notes: "65 MH lots (all TOH, $400 rent) + 150 seasonal campsites. Owner asking $4.25-4.5M.", email: null },
  { name: "Riviera Mobile Home Park", city: "Scottsdale", state: "AZ", address: "601 North Hayden Road, Scottsdale, AZ", units: 210, price: null, lot_rent: 610, toh: 210, poh: null, vacant: 0, notes: "210 total spaces, 100% occupied, all TOH. Lot rent $595-$625/mo. Median income: $86,962.", email: null },
  { name: "Homestead Park", city: "Columbus", state: "IN", address: "2667 Milmar Court, Columbus, IN", units: 188, price: null, lot_rent: 310, toh: null, poh: null, vacant: null, notes: null, email: "ddoup@tbcci.com" },
  { name: "Palm Terrace", city: "Bunnell", state: "FL", address: "2250 Old Moody Blvd #16, Bunnell, FL", units: 182, price: null, lot_rent: 375, toh: 135, poh: 47, vacant: 3, notes: "182 total spaces: 135 MH + 47 RV. 179 occupied. MH lot rent $375/mo, RV lot rent $500/mo. Owner not interested in selling.", email: "gjlorbeck@aol.com" },
  { name: "Country Club Estates MHP / Spring River RV Park", city: "Artesia / Roswell", state: "NM", address: "401 N 26th St, Artesia NM / 950 E College Blvd, Roswell NM", units: 180, price: 3000000, lot_rent: 350, toh: 105, poh: null, vacant: 0, notes: "2-park portfolio. Country Club: 80 lots. Spring River: 100 lots. Owner recently lost his wife. Asking ~$3M for Spring River.", email: "enchantedmesa65@gmail.com" },
  { name: "Fairhaven Mobile Home Park", city: "St. Petersburg", state: "FL", address: "5757 66th St N, St. Petersburg, FL 33709", units: 180, price: null, lot_rent: 640, toh: 176, poh: null, vacant: 4, notes: "All TOH. City water/sewer. Owner turned down $22M offer. Not selling now.", email: null },
  { name: "Hillview Mobile Home Court", city: "Brownstown", state: "IN", address: "420 S Asher St, Brownstown, IN 47220", units: 173, price: null, lot_rent: 350, toh: 120, poh: null, vacant: 53, notes: "Owner: Sharon Smith Wills. Son Matt manages. 120 occupied, 80% TOH / 20% POH.", email: "lawills@bright.net" },
  { name: "Avalon MHP / Greenhill Estates", city: "Kennedale / Roanoke", state: "TX", address: "520 North Rd, Kennedale TX / 800 N Walnut St, Roanoke TX", units: 170, price: null, lot_rent: 635, toh: 162, poh: null, vacant: 8, notes: "2-park portfolio. Avalon: 98 lots. Greenhill: 72 lots. All TOH.", email: "grjones@flash.net" },
  { name: "Lake Arlington Ranch", city: "Fort Worth", state: "TX", address: "5137 Big Fork Drive, Fort Worth, TX", units: 170, price: 34000000, lot_rent: 700, price_per_pad: 200000, toh: 170, poh: null, vacant: 0, notes: "170 lots, all occupied, all TOH. $2M in home notes. Asking $200K/pad (~$34M). Median income: $46,537.", email: "vinsumerlin@yahoo.com" },
  { name: "Meadows Mobile Home Park", city: "Mountain Home", state: "ID", address: "1075 W 6th S St, Mountain Home, ID", units: 163, price: 13000000, lot_rent: 550, price_per_pad: 79755, toh: 83, poh: 80, vacant: 0, notes: "163 lots: 80 POH, 83 TOH. Lot rent $550 + utilities. Asking $13M. Significant infrastructure upgrades. Median income: $57,769.", email: "cblack@newmarkmw.com" },
  { name: "Suburban Estates MHP", city: "Noblesville", state: "IN", address: "3288 Cicero Rd, Noblesville, IN", units: 151, price: null, lot_rent: 435, toh: 148, poh: null, vacant: 3, notes: "151 lots, 3 vacant, all TOH. Lot rent $435/mo. Recently turned down $12M offer. Median income: $91,918.", email: null },
  { name: "Miami MHP", city: "Miami", state: "FL", address: "939 NW 81st St, Miami, FL", units: 150, price: 30000000, lot_rent: 850, price_per_pad: 200000, toh: 150, poh: null, vacant: 0, notes: "150 total lots, fully occupied. All TOH. Code enforcement liens need resolution. Asking $30M firm. Median income: $40,802.", email: null },
  { name: "Jefferson Mobile Home Court", city: "Jeffersonville", state: "IN", address: "1800 Dutch Ln, Jeffersonville, IN", units: 148, price: null, lot_rent: 303, toh: 148, poh: null, vacant: 0, notes: "148 lots, all occupied, all TOH. Owned since 1985. Not actively looking to sell. Median income: $70,290.", email: null },
  { name: "El Retiro Mobile Home Park", city: "Miami", state: "FL", address: "3586 NW 41st St, Miami, FL", units: 146, price: 26000000, lot_rent: 1000, price_per_pad: 178082, toh: 146, poh: null, vacant: 0, notes: "146 lots, all occupied, all TOH. City requiring connection to city water (~$1-1.5M). Asking $26M.", email: null },
  { name: "Robbins Mobile Village", city: "Waterford", state: "MI", address: "3300 Elizabeth Lake Rd, Waterford, MI", units: 143, price: 7000000, lot_rent: 650, price_per_pad: 48951, toh: 123, poh: 20, vacant: 12, notes: "143 spaces, 20 POH, ~12 vacants. Willing to sell for $7M.", email: null },
  { name: "Chubbuck Mobile Home Park", city: "Pocatello", state: "ID", address: "210 Circle Inn Dr, Pocatello, ID", units: 135, price: null, lot_rent: 395, toh: 121, poh: 14, vacant: 0, notes: "135 lots, all occupied. 14 rent-to-own, rest TOH. Recently received $8.1M offer. Median income: $68,118.", email: "1hodgie@gmail.com" },
  { name: "Camptown Mobile Home Park", city: "Show Low", state: "AZ", address: "1241 West McNeil, Show Low, AZ", units: 122, price: 9000000, lot_rent: 550, price_per_pad: 73770, toh: 116, poh: null, vacant: 6, notes: "122 total sites, ~95% occupied, all TOH. Might sell for $9M. Median income: $60,313.", email: null },
  { name: "Sullivan's Mobile Home Park", city: "Eight Mile", state: "AL", address: "5925 US-45, Eight Mile, AL", units: 120, price: 8000000, lot_rent: 350, price_per_pad: 66667, toh: 80, poh: 40, vacant: 0, notes: "120 spaces, all occupied, 80 TOH, 40 POH. ~42 acres. Asking $8M. Median income: $49,317.", email: "jerryncathy@comcast.net" },
  { name: "Avilla Mobile Home Park", city: "Avilla", state: "IN", address: "900 Autumn Hills Dr, Avilla, IN", units: 115, price: 6000000, lot_rent: 300, price_per_pad: 52174, toh: 50, poh: 65, vacant: 26, notes: "115 lots, 89 occupied, 26 vacant. 65 POH, ~50 TOH. Wants $6M. Median income: $84,408.", email: "steve.castleman@yahoo.com" },
  { name: "Mesa Grande Mobile Home Park", city: "Mesa", state: "AZ", address: "2912 East McKellips Road, Mesa, AZ", units: 110, price: null, lot_rent: null, toh: null, poh: null, vacant: null, notes: "110 lots. Median income: $100,671.", email: null },
  { name: "Maplewood Village", city: "Appleton", state: "WI", address: "W3130 E. Broadway Drive, Appleton, WI", units: 110, price: null, lot_rent: 395, toh: 110, poh: null, vacant: 0, notes: "110 lots + 1 SFH, all TOH. Lot rent $395. Would sell within 30-60 days if offer is strong. Median income: $103,149.", email: "rickrand@gvhinc.net" },
  { name: "Boise MHP", city: "Boise", state: "ID", address: "2512 Barrington Ln, Boise, ID", units: 102, price: 14280000, lot_rent: 400, price_per_pad: 140000, toh: 75, poh: 26, vacant: 1, notes: "102 total lots, 1 vacant. 75 TOH, 26 POH. Asking $140K/pad (~$14.28M). Median income: $81,000.", email: null },
  { name: "Key Allegro Villas", city: "Fairhope", state: "AL", address: "9528 Key W Dr, Fairhope, AL", units: 97, price: 8500000, lot_rent: 345, price_per_pad: 87629, toh: 93, poh: 4, vacant: 0, notes: "97 spaces, all occupied. 4 POH, 93 TOH. Asking $8.5M. Median income: $86,026.", email: "ddebourge@yahoo.com" },
  { name: "Southwood Village", city: "Alabaster", state: "AL", address: "328 Cox Lane, Alabaster, AL", units: 96, price: 7000000, lot_rent: null, toh: null, poh: null, vacant: null, notes: "96 mobile home spaces + 8 single-family homes. Offered $7M all-cash. May pass property to children.", email: null },
  { name: "Beaverbrook Manor Mobile Home Park", city: "Franklin", state: "VA", address: "2210 Elmwood Dr, Franklin, VA", units: 92, price: 8000000, lot_rent: 363, price_per_pad: 86957, toh: 52, poh: 40, vacant: 1, notes: "92 spaces, 1 vacant, 52 TOH, 40 POH. Asking at least $8M. Median income: $73,333.", email: "cjbryant57@verizon.net" },
  { name: "Bear Creek MHC", city: "Douglas", state: "GA", address: "50 Bear Creek Road, Douglas, GA 31535", units: 89, price: 3000000, lot_rent: 200, price_per_pad: 33708, toh: 62, poh: 27, vacant: 3, notes: "89 total lots, 3 vacant. 27 POH, 62 TOH. Lot rent $200/mo.", email: null },
  { name: "Coastal Homes of Topsail Island", city: "Surf City", state: "NC", address: "164 Now Boys Loop, Surf City, NC", units: 85, price: 11000000, lot_rent: 338, price_per_pad: 129412, toh: 74, poh: 11, vacant: 0, notes: "85 lots, fully occupied. 74 TOH, 11 POH. Turned down $9M and $10M offers. Asking $11M. Median income: $84,016.", email: null },
  { name: "Fair Meadows Estates", city: "Hixson", state: "TN", address: "6225 Dayton Blvd, Hixson, TN", units: 83, price: 1500000, lot_rent: null, toh: null, poh: null, vacant: null, notes: "83 lots. Median income: $79,177.", email: "p.schierholz@tsmmortgage.com" },
  { name: "Rol Park Village", city: "Millersville", state: "MD", address: "8049 Veterans Hwy, Millersville, MD 21108", units: 82, price: null, lot_rent: 800, toh: 80, poh: null, vacant: 2, notes: "Owner: Gordon D Clement. 80 occupied. $800/mo lot rent. Turned down $150K/pad (~$12M). Unlikely to sell.", email: "gordon@clementhardware.com" },
  { name: "Midway Manor Park", city: "Leesburg", state: "FL", address: "36033 Emeralda Ave, Leesburg, FL", units: 80, price: null, lot_rent: 300, toh: 80, poh: null, vacant: 0, notes: "80 lots, fully occupied, all TOH. Lot rent kept low for long-term tenants. Median income: $57,477.", email: "midwaymanor@gmail.com" },
  { name: "Belknap Terrace", city: "Superior", state: "WI", address: "3556 Belknap St, Superior, WI 54880", units: 79, price: null, lot_rent: 450, toh: 79, poh: null, vacant: 0, notes: "All occupied. 15 rent-to-own, rest TOH. City water/sewer.", email: null },
  { name: "Lake Fox Village", city: "Winter Haven", state: "FL", address: "317 Lakeview Ln SE, Winter Haven, FL 33884", units: 77, price: 9250000, lot_rent: 570, toh: 77, poh: null, vacant: 0, notes: "All TOH, fully occupied. City water/sewer.", email: null },
  { name: "Buffalo Run Mobile Home Park", city: "Camp Verde", state: "AZ", address: "2223 North Arena Del Loma, Camp Verde, AZ 86322", units: 77, price: null, lot_rent: null, toh: 73, poh: null, vacant: 4, notes: "All TOH. Private water/sewer incl in rent. Asking $5M-$5.5M.", email: null },
  { name: "Little River Mobile Home Park", city: "Miami", state: "FL", address: "215 NW 79th St, Miami, FL", units: 76, price: 20000000, lot_rent: 870, price_per_pad: 263158, toh: 76, poh: null, vacant: 0, notes: "76 lots, fully occupied, all TOH. Asking $20M firm. Median income: $40,802.", email: "cory@rentify.live" },
  { name: "Worldwide Park", city: "Lumberton", state: "TX", address: "207 S Lhs Dr, Lumberton, TX", units: 76, price: 6080000, lot_rent: 395, price_per_pad: 80000, toh: 51, poh: 25, vacant: 7, notes: "76 spaces, ~20-25 POH, ~6-8 vacant lots. Pricing ~$80K/pad. Median income: $93,225.", email: "wwwtwb@aol.com" },
  { name: "Oak Crest Mobile Park", city: "Orlando", state: "FL", address: "5455 W Washington St, Orlando, FL", units: 75, price: 6000000, lot_rent: 625, price_per_pad: 80000, toh: 75, poh: null, vacant: 0, notes: "75 lots, fully occupied, all TOH. Offered $6M all-cash but not motivated to sell. Median income: $52,124.", email: "oak5455@aol.com" },
  { name: "Seven C's Community", city: "American Fork", state: "UT", address: "120 N 350 W St, American Fork, UT", units: 74, price: 15000000, lot_rent: 800, price_per_pad: 202703, toh: 74, poh: null, vacant: 0, notes: "74 sites, all occupied, all TOH. 55+ community. Previously offered $15M. Median income: $95,823.", email: "dpriz@ymail.com" },
  { name: "Country Road Estates", city: "Galesville", state: "WI", address: "15454 Co Rd K, Galesville, WI", units: 74, price: null, lot_rent: 363, toh: 74, poh: null, vacant: 0, notes: "74 spaces, all occupied, all TOH. ~23 acres. Asking $5-6M. Median income: $88,429.", email: "countryroadestates1@yahoo.com" },
  { name: "Suburbia Mobile Home Park", city: "Killeen", state: "TX", address: "5003 Saddle Ridge Dr, Killeen, TX", units: 73, price: 5500000, lot_rent: 550, price_per_pad: 74324, toh: 73, poh: null, vacant: 0, notes: "73 spaces, all occupied, all TOH. Asking $6M-$6.5M range. Median income: $62,536.", email: "linda@waco.twcbc.com" },
  { name: "Country Place Park", city: "Mt Pleasant", state: "MI", address: "4151 E Jordan Rd, Mt Pleasant, MI", units: 70, price: 2500000, lot_rent: 350, price_per_pad: 35714, toh: 61, poh: 9, vacant: 4, notes: "70 spaces, 66 occupied, 4 vacant. ~9 POH, ~61 TOH. Asking $2.5M. Median income: $48,794.", email: "robertldidur@gmail.com" },
  { name: "Fox Creek MHP / Oakwood Park / Durbin Creek MHC", city: "Simpsonville", state: "SC", address: "491 Chapman Rd, Fountain Inn, SC / 311 Goldsmith Rd, Simpsonville, SC / 17 Montague Dr, Fountain Inn, SC", units: 69, price: null, lot_rent: null, toh: null, poh: 55, vacant: null, notes: "3-park portfolio. 69 pads, 55 POHs. Private septic. Electric direct billed.", email: null },
  { name: "Palm Harbour Estates Mobile Home & RV Park", city: "Tucson", state: "AZ", address: "1560 W Fort Lowell Rd, Tucson, AZ", units: 69, price: 3500000, lot_rent: 607, price_per_pad: 50725, toh: 31, poh: null, vacant: 2, notes: "69 total sites, 31 MH + 38 RV. All TOH. Premium park with security cameras. Open to offer at $3.5M.", email: null },
  { name: "Sleepy Hollow MH Park / Green Acres", city: "Dodge City", state: "KS", address: "908 Rath Ave, Dodge City, KS / Green Acres Dr, Fort Dodge, KS", units: 68, price: null, lot_rent: null, toh: null, poh: null, vacant: null, notes: "2-park portfolio. Sleepy Hollow: city water/sewer. Green Acres: city water + lagoon.", email: null },
  { name: "Meridian Cherry Lane", city: "Meridian", state: "ID", address: "314 West Cherry Lane, Meridian, ID", units: 68, price: null, lot_rent: 575, toh: 68, poh: null, vacant: 0, notes: "68 lots, all occupied, all TOH. Good chance they'd move forward. Median income: $96,361.", email: "spcady54@gmail.com" },
  { name: "Fortney Homes", city: "Hagerstown", state: "MD", address: "14243 Pennsylvania Ave, Hagerstown, MD 21742", units: 67, price: null, lot_rent: null, toh: null, poh: null, vacant: null, notes: "Owner: William E Pennington. 67 lots. Has excess land for ~150% more homes.", email: "Meghan@forestdrivesp.com" },
  { name: "Brandon Mobile Home Park", city: "Brandon", state: "MS", address: "450 Overby St, Brandon, MS 39042", units: 67, price: null, lot_rent: 450, toh: null, poh: null, vacant: 1, notes: "Owner: Sara Cook. Lot rent $350-$550. POH rent $900-$1,200. Price ~$50K/pad.", email: "saracook2025@gmail.com" },
  { name: "Mount Joy MHP", city: "Davenport", state: "IA", address: "21445 Scott Park Road, Davenport, IA", units: 66, price: null, lot_rent: 410, toh: 66, poh: null, vacant: 0, notes: "66 lots, all TOH. Would consider selling at $3.8M. Median income: $73,682.", email: "bdpeete58@gmail.com" },
  { name: "Osceola Mobile Home Park", city: "New Port Richey", state: "FL", address: "9821 Hopi Ln, New Port Richey, FL", units: 65, price: null, lot_rent: 360, toh: 65, poh: null, vacant: 0, notes: "65 total lots, no vacancies, mostly TOH. Median income: $73,222.", email: null },
  { name: "Garden City Mobile Home Park", city: "Columbus", state: "IN", address: "926 Jonesville Road, Columbus, IN", units: 55, price: null, lot_rent: null, toh: 55, poh: null, vacant: 0, notes: "In acquisition mode. All TOH. Median income: $83,958.", email: null },
  { name: "Countryside Village", city: "Twin Falls", state: "ID", address: "1605 Grandview Drive NW, Twin Falls, ID", units: 54, price: null, lot_rent: 485, toh: 54, poh: null, vacant: 0, notes: "54 lots, 100% occupied, all TOH. 55+ community. Lot rent increasing to $500. Median income: $62,647.", email: "mbj@icon-media.com" },
  { name: "Oak Ridge MHP", city: "Ridgeland", state: "SC", address: "700 N Green St, Ridgeland, SC 29936", units: 54, price: 2750000, lot_rent: 400, price_per_pad: 50926, toh: 51, poh: null, vacant: 3, notes: "All TOH. $400 lot rent. Price $2.75M.", email: null },
  { name: "Riverside Mobile Home Park", city: "Hardeeville", state: "SC", address: "57 Riverside Dr, Hardeeville, SC 29927", units: 53, price: null, lot_rent: null, toh: 53, poh: null, vacant: 0, notes: "52 lots + 1 apartment ($700/mo). 100% occupied. All TOH.", email: null },
  { name: "Country Oaks Arbor Mobile Home Park", city: "Manvel", state: "TX", address: "3318 Old Chocolate Bayou Rd, Manvel, TX", units: 51, price: 4000000, lot_rent: 580, price_per_pad: 78431, toh: 43, poh: 8, vacant: 0, notes: "51 lots, 100% occupied, all TOH. Wants $4M total ($2M down + $2M financed). Median income: $132,571.", email: null },
  { name: "Country Acres MHC", city: "Yankton", state: "SD", address: "100 Par Ln, Yankton, SD 57078", units: 50, price: null, lot_rent: 185, toh: null, poh: null, vacant: 14, notes: "~36 occupied. Majority POH. Lot rent $180-$190. POH rent $700-$1,300.", email: null },
  { name: "Highland Park MHC", city: "North Charleston", state: "SC", address: "6826 Rivers Ave, Charleston, SC 29406", units: 45, price: null, lot_rent: null, toh: 45, poh: null, vacant: 0, notes: "All TOH, all occupied. Turned down $3M offer. May consider $3.2M.", email: null },
  { name: "Washington Resort Trailer Park", city: "Shawano", state: "WI", address: "W5035 Resort Road, Shawano, WI", units: 44, price: null, lot_rent: 250, toh: 44, poh: null, vacant: 0, notes: "44 lots, all occupied, all TOH. Lot rent: $3,000/yr ($250/mo). Median income: $64,643.", email: "krisrobaidek@gmail.com" },
  { name: "Sunny Meadows Mobile Home Park", city: "Scottsburg", state: "IN", address: "251 S Lake Rd N, Scottsburg, IN 47170", units: 41, price: 1200000, lot_rent: 305, price_per_pad: 29268, toh: 41, poh: null, vacant: 0, notes: "Owners: Rick & Anne Mastain. 5 RTO POHs. Asking $1.2M. Trying to negotiate to ~$2M.", email: "rickmastain@gmail.com" },
  { name: "Woodbine Oaks", city: "Butler", state: "PA", address: "539 Chicora Rd, Butler, PA 16001", units: 38, price: 1050000, lot_rent: 435, toh: 31, poh: null, vacant: 7, notes: "31 occupied (all TOH). Own water system + septic. Owner Monty, 72yo, diagnosed with brain tumor, ready to sell. Asking $1.05M.", email: null },
  { name: "Ardis MHP", city: "Hixson", state: "TN", address: "7019 Highway 153 Blvd, Hixson, TN", units: 32, price: null, lot_rent: 350, toh: 32, poh: null, vacant: 0, notes: "32 sites, fully occupied, all TOH. Holding for now.", email: "lynncenn905@aol.com" },
  { name: "Lake Shore Mobile Home Park", city: "Grand Prairie", state: "TX", address: "2101 Hardy Road, Grand Prairie, TX 75051", units: 32, price: 2000000, lot_rent: null, toh: null, poh: null, vacant: 0, notes: "Owner: Ram Konara. 3 POHs being filled. Asking $2M.", email: "Rkonara@yahoo.com" },
  { name: "Edgemont Mobile Home Park", city: "Wendell", state: "NC", address: "2081 Wendell Blvd, Wendell, NC 27591", units: 31, price: null, lot_rent: 490, toh: null, poh: null, vacant: 1, notes: "30 occupied. Avg lot rent ~$490. Well/septic - can connect to public water for $70K.", email: null },
  { name: "Highland Heights Mobile Village", city: "Sturgeon Bay", state: "WI", address: "1329 W Walnut Dr, Sturgeon Bay, WI", units: 30, price: 2000000, lot_rent: 400, price_per_pad: 66667, toh: 14, poh: 16, vacant: 0, notes: "30 spaces, all occupied. 14 TOH, 16 POH. Would need more than $2M. Median income: $68,141.", email: "davedemmin@yahoo.com" },
  { name: "Congaree Village", city: "West Columbia", state: "SC", address: "1535 Daniel Rd, West Columbia, SC 29170", units: 30, price: 1200000, lot_rent: 540, price_per_pad: 40000, toh: 22, poh: null, vacant: 8, notes: "22 occupied. City water & septic. Median income: $68,141.", email: null },
  { name: "Williams Mobile Home Park", city: "Joppatowne", state: "MD", address: "578 Trimble Rd, Joppatowne, MD 21085", units: 25, price: 4000000, lot_rent: 625, price_per_pad: 160000, toh: null, poh: null, vacant: null, notes: null, email: null },
  { name: "Skyline Park", city: "Knoxville", state: "TN", address: "3167 Rifle Range Rd, Knoxville, TN 37918", units: 19, price: 690000, lot_rent: 450, price_per_pad: 36316, toh: null, poh: null, vacant: null, notes: null, email: null },
  
  // ICE Section - Additional properties
  { name: "Shadow Lake Village", city: "Mason", state: "OH", address: "2479 North Mason Montgomery Road, Mason, OH 45040", units: 300, price: 12000000, lot_rent: 400, price_per_pad: 40000, toh: null, poh: null, vacant: null, notes: null, email: null },
  { name: "Sunnydale Mobile Home Community / Eldorado Estates", city: "St. Charles / St. Peters", state: "MO", address: "301 Sunnydale Dr, Saint Charles, MO / 1 Eldorado Ct, St Peters, MO", units: 697, price: null, lot_rent: null, toh: null, poh: null, vacant: null, notes: "2-park portfolio.", email: null },
  { name: "Trails End MHC", city: "Washington", state: "NC", address: "12 Trails End S, Washington, NC 27889", units: 48, price: null, lot_rent: 160, toh: 48, poh: null, vacant: 0, notes: null, email: null },
  { name: "Woodland Village RV/MH Park", city: "Portage", state: "IN", address: "5757 Melton Road, Portage, IN 46368", units: 190, price: null, lot_rent: 745, toh: null, poh: null, vacant: null, notes: null, email: null },
  { name: "Acacia MHP", city: "Las Vegas", state: "NV", address: "1832 N Walnut Rd, Las Vegas, NV 89115", units: 61, price: null, lot_rent: 840, toh: 56, poh: null, vacant: 4, notes: null, email: null },
  { name: "Alta Vista Trailer Park", city: "Henderson", state: "NV", address: "711 E Lake Mead Pkwy, Henderson, NV 89015", units: 150, price: 25000000, lot_rent: 850, price_per_pad: 166667, toh: 133, poh: 12, vacant: null, notes: null, email: null },
  { name: "Deerfield Estates", city: "Flat Rock", state: "MI", address: "26211 Telegraph Rd, Flat Rock, MI 48134", units: 820, price: 123000000, lot_rent: 600, price_per_pad: 150000, toh: 78, poh: 820, vacant: null, notes: null, email: null },
  { name: "Casa Linda Republic", city: "Las Vegas", state: "NV", address: "5250 E Lake Mead Blvd, Las Vegas, NV", units: 107, price: 11500000, lot_rent: 790, price_per_pad: 107477, toh: 102, poh: 2, vacant: null, notes: null, email: null },
  { name: "Stahla Mobile Home Park", city: "Lexington", state: "NE", address: "Rimpley Ln, Lexington, NE", units: 36, price: 1000000, lot_rent: 226, price_per_pad: 27778, toh: 33, poh: 3, vacant: null, notes: null, email: null },
]

// Generate a listing URL based on property name and location
function generateListingUrl(name: string, city: string, state: string): string {
  const searchQuery = encodeURIComponent(`${name} ${city} ${state} mobile home park for sale`)
  // Try common commercial real estate listing sites
  return `https://www.loopnet.com/search/mobile-home-parks/${city.toLowerCase().replace(/\s/g, '-')}-${state.toLowerCase()}/for-sale/`
}

// Calculate AI score based on property attributes
function calculateAIScore(property: typeof MONDAY_LEADS_LISTINGS[0]): number {
  let score = 50 // Base score

  // Units scoring
  if (property.units) {
    if (property.units >= 100) score += 15
    else if (property.units >= 50) score += 10
    else if (property.units >= 25) score += 5
  }

  // Price per pad scoring
  if (property.price_per_pad) {
    if (property.price_per_pad <= 50000) score += 15
    else if (property.price_per_pad <= 75000) score += 10
    else if (property.price_per_pad <= 100000) score += 5
  }

  // Occupancy scoring (based on vacant)
  if (property.units && property.vacant !== null) {
    const occupancy = ((property.units - property.vacant) / property.units) * 100
    if (occupancy >= 95) score += 10
    else if (occupancy >= 85) score += 5
    else if (occupancy < 70) score -= 5
  }

  // Contact info available
  if (property.email) score += 5

  // Notes indicate seller motivation
  if (property.notes) {
    if (property.notes.toLowerCase().includes('asking') || 
        property.notes.toLowerCase().includes('would sell') ||
        property.notes.toLowerCase().includes('open to')) {
      score += 5
    }
    if (property.notes.toLowerCase().includes('not looking to sell') ||
        property.notes.toLowerCase().includes('turned down')) {
      score -= 10
    }
  }

  return Math.max(0, Math.min(100, score))
}

// POST: Import all listings
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}))
    const { dryRun = false } = body

    const results = {
      total: MONDAY_LEADS_LISTINGS.length,
      inserted: 0,
      updated: 0,
      skipped: 0,
      errors: [] as string[]
    }

    for (const listing of MONDAY_LEADS_LISTINGS) {
      try {
        // Check if property already exists by name and city/state
        const { data: existing } = await supabase
          .from('properties')
          .select('id, name, asking_price')
          .ilike('name', `%${listing.name.split(' ')[0]}%`)
          .eq('city', listing.city)
          .eq('state', listing.state)
          .limit(1)
          .single()

        const aiScore = calculateAIScore(listing)
        const listingUrl = generateListingUrl(listing.name, listing.city, listing.state)
        
        // Calculate occupancy
        let occupancy = null
        if (listing.units && listing.vacant !== null) {
          occupancy = Math.round(((listing.units - listing.vacant) / listing.units) * 100)
        }

        // Determine mom_pop status
        const momPop = listing.notes?.toLowerCase().includes('mom') || 
                       listing.notes?.toLowerCase().includes('family') ||
                       listing.units !== null && listing.units < 100

        const propertyData = {
          name: listing.name,
          address: listing.address,
          city: listing.city,
          state: listing.state,
          region: getRegion(listing.state),
          units: listing.units || 0,
          occupancy,
          asking_price: listing.price,
          lot_rent: listing.lot_rent,
          price_per_pad: listing.price_per_pad,
          toh: listing.toh,
          poh: listing.poh,
          vacant: listing.vacant,
          notes: listing.notes,
          contact_email: listing.email,
          listing_url: listingUrl,
          ai_score: aiScore,
          mom_pop: momPop,
          source: 'Monday Leads Export',
          status: 'active' as const,
          updated_at: new Date().toISOString(),
        }

        if (dryRun) {
          results.skipped++
          continue
        }

        if (existing) {
          // Update existing property
          const { error } = await supabase
            .from('properties')
            .update(propertyData)
            .eq('id', existing.id)

          if (error) {
            results.errors.push(`Update failed for ${listing.name}: ${error.message}`)
          } else {
            results.updated++
          }
        } else {
          // Insert new property
          const { error } = await supabase
            .from('properties')
            .insert({
              ...propertyData,
              created_at: new Date().toISOString(),
            })

          if (error) {
            results.errors.push(`Insert failed for ${listing.name}: ${error.message}`)
          } else {
            results.inserted++
          }
        }
      } catch (error) {
        results.errors.push(`Error processing ${listing.name}: ${error instanceof Error ? error.message : 'Unknown error'}`)
      }
    }

    return NextResponse.json({
      success: true,
      results,
      message: `Processed ${results.total} listings: ${results.inserted} inserted, ${results.updated} updated, ${results.skipped} skipped, ${results.errors.length} errors`
    })
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

// GET: Preview import data
export async function GET() {
  const preview = MONDAY_LEADS_LISTINGS.slice(0, 10).map(listing => ({
    name: listing.name,
    city: listing.city,
    state: listing.state,
    units: listing.units,
    price: listing.price,
    ai_score: calculateAIScore(listing)
  }))

  return NextResponse.json({
    total: MONDAY_LEADS_LISTINGS.length,
    preview,
    message: `Ready to import ${MONDAY_LEADS_LISTINGS.length} listings. POST to /api/import-listings to execute.`
  })
}

// Helper function to get region from state
function getRegion(state: string): string {
  const regions: Record<string, string> = {
    // Southeast
    'AL': 'Southeast', 'FL': 'Southeast', 'GA': 'Southeast', 'KY': 'Southeast',
    'MS': 'Southeast', 'NC': 'Southeast', 'SC': 'Southeast', 'TN': 'Southeast', 'VA': 'Southeast',
    // Southwest
    'AZ': 'Southwest', 'NM': 'Southwest', 'NV': 'Southwest', 'TX': 'Southwest', 'UT': 'Southwest',
    // Midwest
    'IA': 'Midwest', 'IL': 'Midwest', 'IN': 'Midwest', 'KS': 'Midwest', 'MI': 'Midwest',
    'MN': 'Midwest', 'MO': 'Midwest', 'NE': 'Midwest', 'OH': 'Midwest', 'SD': 'Midwest', 'WI': 'Midwest',
    // West
    'ID': 'West', 'WA': 'West', 'OR': 'West', 'CA': 'West', 'CO': 'West',
    // Northeast
    'MD': 'Northeast', 'PA': 'Northeast', 'NY': 'Northeast', 'NJ': 'Northeast',
  }
  return regions[state] || 'Other'
}
