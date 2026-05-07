-- Enable necessary extensions
create extension if not exists "uuid-ossp";

-- Create properties table
create table public.properties (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  address text,
  city text not null,
  state text not null,
  region text,
  units integer not null,
  occupancy numeric(5, 2) default 0,
  cap_rate numeric(5, 2) default 0,
  asking_price numeric(15, 2) not null,
  noi numeric(15, 2) default 0,
  mom_pop boolean default false,
  ai_score numeric(5, 2) default 0,
  source text,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

-- Create indexes for performance
create index idx_properties_state on public.properties(state);
create index idx_properties_units on public.properties(units);
create index idx_properties_ai_score on public.properties(ai_score desc);
create index idx_properties_cap_rate on public.properties(cap_rate desc);
create index idx_properties_mom_pop on public.properties(mom_pop);
create index idx_properties_source on public.properties(source);
create index idx_properties_city on public.properties(city);

-- Enable RLS
alter table public.properties enable row level security;

-- RLS Policies
create policy "Enable read access for all users"
  on public.properties
  for select
  using (true);

create policy "Enable insert for service role only"
  on public.properties
  for insert
  with check (true);

create policy "Enable update for service role only"
  on public.properties
  for update
  using (true);

-- Insert sample data
insert into public.properties 
  (name, address, city, state, region, units, occupancy, cap_rate, asking_price, noi, mom_pop, ai_score, source)
values
  ('Sunset Ridge Community', '123 Main St', 'Austin', 'TX', 'South', 150, 92.5, 8.2, 6500000, 533000, true, 100, 'LoopNet'),
  ('Pine Valley Estates', '456 Oak Ave', 'Dallas', 'TX', 'South', 120, 88.0, 7.5, 5200000, 390000, true, 95, 'Crexi'),
  ('Meadowbrook Park', '789 Park Blvd', 'Houston', 'TX', 'South', 200, 85.5, 6.8, 11000000, 748000, false, 60, 'LoopNet'),
  ('Cedar Springs', '321 Pine Ln', 'Phoenix', 'AZ', 'Southwest', 95, 91.0, 7.8, 4100000, 319800, true, 98, 'Crexi'),
  ('Desert View MHC', '654 Desert Way', 'Las Vegas', 'NV', 'Southwest', 180, 87.0, 7.2, 7800000, 561600, false, 80, 'LoopNet'),
  ('Shady Oaks Village', '987 Forest Rd', 'Nashville', 'TN', 'South', 110, 84.0, 6.5, 4200000, 273000, true, 75, 'LoopNet'),
  ('River Valley MHC', '234 River Rd', 'Memphis', 'TN', 'South', 160, 89.5, 7.9, 6800000, 537200, false, 85, 'Crexi'),
  ('Hillside Terrace', '567 Hill St', 'Atlanta', 'GA', 'South', 140, 86.5, 7.1, 5900000, 418900, true, 85, 'LoopNet'),
  ('Greenfield Homes', '890 Green Ln', 'Charlotte', 'NC', 'South', 125, 90.0, 7.4, 5100000, 377400, false, 80, 'Crexi'),
  ('Sunny Acres Park', '111 Sunshine Ave', 'Miami', 'FL', 'South', 175, 93.5, 6.9, 8200000, 565800, true, 88, 'LoopNet'),
  ('Lakeside Community', '222 Lake Dr', 'Kansas City', 'MO', 'Midwest', 145, 87.0, 7.3, 6100000, 445300, false, 75, 'Crexi'),
  ('Prairie Estates', '333 Prairie Ave', 'Minneapolis', 'MN', 'Midwest', 130, 85.5, 6.8, 4800000, 326400, true, 70, 'LoopNet');
