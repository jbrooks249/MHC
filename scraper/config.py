import os
from dotenv import load_dotenv

load_dotenv()

SUPABASE_URL = os.getenv('NEXT_PUBLIC_SUPABASE_URL')
SUPABASE_SERVICE_ROLE_KEY = os.getenv('SUPABASE_SERVICE_ROLE_KEY')

# Filters
MIN_UNITS = 45
EXCLUDED_STATES = {'CA', 'WA', 'OR'}

if not SUPABASE_URL or not SUPABASE_SERVICE_ROLE_KEY:
    raise ValueError(
        'Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env'
    )
