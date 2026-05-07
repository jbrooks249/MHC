## MHC Acquisition Intelligence Platform

A production-ready institutional platform for discovering and analyzing manufactured housing community (MHC) acquisition opportunities nationwide.

---

## Features

### 🎯 Core Functionality

- **Nationwide MHC Database** – Searchable, filterable inventory of 45+ unit properties
- **AI Scoring Engine** – Algorithmic ranking (0–100) based on acquisition fundamentals
- **Real Estate Dashboard** – Zillow-style grid layout with dark theme
- **Mom-and-Pop Detection** – Automatic identification of family-owned operators
- **Multi-Source Ingestion** – Ready for LoopNet, Crexi, and institutional feeds

### ✅ Built-in Filters

All data automatically filtered for:
- ✓ **Minimum 45 units** (institutional investment grade)
- ✓ **Exclude West Coast** (CA, WA, OR)
- ✓ **Ranked by AI Score** (highest quality opportunities first)

### 🔬 AI Scoring Rules

Proprietary score (max 100):
- **+20** if units ≥ 45
- **+25** if cap rate > 7%
- **+15** if occupancy > 85%
- **+30** if mom-and-pop owner ⭐
- **+10** if price/unit < $45,000

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Frontend** | Next.js 14 (App Router) + TypeScript + Tailwind CSS |
| **Backend** | Supabase (PostgreSQL) |
| **Data Ingestion** | Python scraper service |
| **Deployment** | Vercel |

---

## Quick Start

### Prerequisites

- Node.js 18+
- Python 3.9+
- Supabase account & project

### 1️⃣ Setup Supabase

1. Create a new Supabase project at [supabase.com](https://supabase.com)
2. In the SQL Editor, run the contents of `supabase_schema.sql`
3. Copy your **Project URL** and **Anon Key** from Settings → API

### 2️⃣ Setup Frontend

```bash
# Install dependencies
npm install

# Create environment file
cp .env.local.example .env.local

# Add your Supabase credentials to .env.local
NEXT_PUBLIC_SUPABASE_URL=your_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key

# Run development server
npm run dev
```

Visit `http://localhost:3000`

### 3️⃣ Setup Scraper (Optional)

```bash
cd scraper

# Create virtual environment
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Create .env file for scraper
echo "NEXT_PUBLIC_SUPABASE_URL=your_project_url" > ../.env
echo "SUPABASE_SERVICE_ROLE_KEY=your_service_role_key" >> ../.env

# Run scraper
python run.py
```

---

## Project Structure

```
mhc-platform/
├── app/
│   ├── page.tsx                 # Main dashboard
│   ├── layout.tsx               # Root layout
│   └── globals.css              # Global styles
├── components/
│   ├── PropertyCard.tsx          # Reusable listing card
│   └── SearchBar.tsx             # Search UI
├── lib/
│   ├── supabase.ts              # Supabase client & types
│   ├── ai-scoring.ts            # AI scoring engine
│   └── formatting.ts            # Currency/number formatting
├── scraper/
│   ├── run.py                   # Main scraper entry point
│   ├── config.py                # Configuration
│   ├── data_source.py           # Data source abstractions
│   ├── database.py              # Supabase operations
│   ├── scoring.py               # AI scoring (Python)
│   └── requirements.txt          # Python dependencies
├── public/
├── package.json
├── tsconfig.json
├── tailwind.config.ts
├── supabase_schema.sql          # Database schema
└── README.md
```

---

## Database Schema

### properties table

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `name` | TEXT | Property name |
| `address` | TEXT | Street address |
| `city` | TEXT | City |
| `state` | TEXT | 2-letter state code |
| `region` | TEXT | Region identifier |
| `units` | INTEGER | Number of units (≥45) |
| `occupancy` | DECIMAL | 0–100 occupancy % |
| `cap_rate` | DECIMAL | Cap rate % |
| `asking_price` | NUMERIC | Price in dollars |
| `noi` | NUMERIC | Annual NOI |
| `mom_pop` | BOOLEAN | Family-owned flag ⭐ |
| `ai_score` | DECIMAL | 0–100 ranking |
| `source` | TEXT | LoopNet, Crexi, etc. |
| `created_at` | TIMESTAMP | Created timestamp |

---

## Frontend Usage

### Main Dashboard (`/app/page.tsx`)

- **Auto-filters** by rules (45+ units, no West Coast)
- **Real-time search** by name, city, state
- **Sorted by AI Score** (highest first)
- **Responsive grid** (1 col mobile, 2 tablet, 3 desktop)

### Property Card Component

Displays:
- Property name & location
- Unit count & occupancy
- Cap rate & price/unit
- Asking price & annual NOI
- AI Score tier badge
- Mom-and-pop owner indicator

---

## Python Scraper

### Overview

The scraper module provides:
- **Data source abstractions** for LoopNet, Crexi
- **Hard filtering** (45+ units, exclude West Coast)
- **AI scoring** before database insertion
- **Deduplication** logic
- **Bulk upsert** to Supabase

### Extending the Scraper

1. **Add new data source:**
   ```python
   class NewSourceName(PropertyDataSource):
       def fetch_properties(self):
           # Your scraping logic
           return list_of_properties
   ```

2. **Update `merge_properties()` in `data_source.py`:**
   ```python
   sources = [
       LoopNetSource(),
       CrexiSource(),
       NewSourceName(),  # Add here
   ]
   ```

3. **Run:**
   ```bash
   python scraper/run.py
   ```

---

## AI Scoring Examples

### Example 1: Strong Mom-and-Pop Target
```
Units: 120
Cap Rate: 8.5%
Occupancy: 90%
Price: $4.8M (40k/unit)
Mom-and-Pop: YES ⭐

Score: 20 + 25 + 15 + 30 + 10 = 100 ✓
```

### Example 2: Solid Institutional Deal
```
Units: 200
Cap Rate: 6.8%
Occupancy: 82%
Price: $12M (60k/unit)
Mom-and-Pop: NO

Score: 20 + 0 + 0 + 0 + 0 = 20
```

### Example 3: Great Value
```
Units: 95
Cap Rate: 7.5%
Occupancy: 88%
Price: $3.5M (37k/unit)
Mom-and-Pop: YES ⭐

Score: 20 + 25 + 15 + 30 + 10 = 100 ✓
```

---

## Environment Variables

### Frontend (`.env.local`)

```env
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIs...
```

### Scraper (`.env`)

```env
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIs...
```

---

## Deployment

### Vercel (Frontend)

```bash
npm run build
vercel deploy
```

### Supabase (Database)

Hosted automatically. Set up via web dashboard.

### Scraper Scheduling (Optional)

- **GitHub Actions** – Scheduled workflow
- **AWS Lambda** – Daily trigger
- **Railway** – Background jobs
- **Cron job** – On your server

---

## Performance Optimizations

- **Database indexes** on `ai_score`, `state`, `units`, `source`
- **Client-side filtering** for fast search
- **Tailwind CSS purge** for minimal bundle
- **Image optimization** ready (Next.js built-in)
- **API response caching** (Supabase)

---

## Security

- **Row Level Security (RLS)** enabled on properties table
- **Service role key** used only for scraper (server-side)
- **Anon key** for frontend (read-only by default)
- **No API keys in frontend code** (environment variables)

### Recommended RLS Policies

```sql
-- Public read access
CREATE POLICY "Read access to all"
  ON properties FOR SELECT
  USING (true);

-- Service role write (scraper only)
CREATE POLICY "Service role write"
  ON properties FOR INSERT
  WITH CHECK (true);
```

---

## Common Issues

### No properties showing?
- [ ] Run `supabase_schema.sql` in Supabase dashboard
- [ ] Run scraper: `python scraper/run.py`
- [ ] Check `.env.local` has correct credentials

### Scraper fails?
- [ ] Install Python deps: `pip install -r scraper/requirements.txt`
- [ ] Copy `.env` in project root (not just scraper/)
- [ ] Check `SUPABASE_SERVICE_ROLE_KEY` is valid

### Styling looks wrong?
- [ ] Clear cache: `rm -rf .next`
- [ ] Rebuild: `npm run build`
- [ ] Check Tailwind config is loading

---

## Roadmap

- [ ] Integration with real LoopNet API
- [ ] Crexi data connector
- [ ] User authentication & saved lists
- [ ] Deal pipeline management
- [ ] Financial modeling tools
- [ ] Mobile app (React Native)
- [ ] ML model refinement (scoring)
- [ ] Market alerts & notifications

---

## License

Proprietary – MHC Acquisition Platform

---

## Support

For issues or questions:
1. Check this README
2. Review `supabase_schema.sql` for DB setup
3. Check environment variables
4. Review browser console (frontend) or terminal (scraper) for errors

---

**Built for institutional MHC acquisition teams. Optimize for clarity, scalability, and investor results.**
