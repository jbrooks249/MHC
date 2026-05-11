export interface Property {
  id: string
  name: string
  address: string | null
  city: string
  state: string
  region: string | null
  units: number
  occupancy: number | null
  cap_rate: number | null
  asking_price: number | null
  noi: number | null
  mom_pop: boolean
  ai_score: number | null
  source: string | null
  image_url: string | null
  created_at: string
  updated_at: string
}

export interface FilterState {
  search: string
  minUnits: number | null
  maxUnits: number | null
  minCapRate: number | null
  maxCapRate: number | null
  states: string[]
  sources: string[]
  momPopOnly: boolean
  minAiScore: number | null
  sortBy: 'ai_score' | 'asking_price' | 'units' | 'cap_rate' | 'created_at'
  sortOrder: 'asc' | 'desc'
}
