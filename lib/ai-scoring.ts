export interface PropertyData {
  units: number
  cap_rate: number
  occupancy: number
  mom_pop: boolean
  asking_price: number
  noi?: number
}

export function calculateAIScore(property: PropertyData): number {
  let score = 0

  // +20 if units >= 45
  if (property.units >= 45) {
    score += 20
  }

  // +25 if cap_rate > 7
  if (property.cap_rate > 7) {
    score += 25
  }

  // +15 if occupancy > 85
  if (property.occupancy > 85) {
    score += 15
  }

  // +30 if mom_pop == true
  if (property.mom_pop) {
    score += 30
  }

  // +10 if price_per_unit < 45000
  const pricePerUnit = property.asking_price / property.units
  if (pricePerUnit < 45000) {
    score += 10
  }

  return Math.min(score, 100) // Max 100
}

export function getScoreTier(
  score: number
): 'elite' | 'strong' | 'moderate' | 'fair' {
  if (score >= 85) return 'elite'
  if (score >= 70) return 'strong'
  if (score >= 50) return 'moderate'
  return 'fair'
}
