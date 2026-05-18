// Comprehensive MHP Listing Source Registry
// Tracks all scraping sources with metadata for reliability and coverage

export interface ScraperSource {
  id: string
  name: string
  type: 'primary' | 'secondary' | 'aggregator' | 'regional' | 'auction' | 'broker' | 'news'
  baseUrl: string
  searchPatterns: SearchPattern[]
  enabled: boolean
  reliabilityScore: number // 0-1, based on data quality history
  dataFreshness: 'realtime' | 'daily' | 'weekly' | 'monthly'
  requiresAuth: boolean
  requiresProxy: boolean
  rateLimit: RateLimitConfig
  extractionMethod: 'firecrawl' | 'api' | 'rss' | 'sitemap' | 'deep_crawl'
  fields: FieldMapping
  lastScraped?: string
  successRate?: number
  averageListings?: number
}

export interface SearchPattern {
  pattern: string
  type: 'listing_page' | 'search_results' | 'state_page' | 'region_page' | 'detail_page'
  pagination?: {
    type: 'query_param' | 'path' | 'infinite_scroll' | 'load_more'
    param?: string
    maxPages?: number
  }
}

export interface RateLimitConfig {
  requestsPerMinute: number
  requestsPerHour: number
  delayBetweenRequests: number // ms
  respectRobotsTxt: boolean
  backoffMultiplier: number
}

export interface FieldMapping {
  name: string[]
  address: string[]
  city: string[]
  state: string[]
  price: string[]
  units: string[]
  capRate: string[]
  lotRent: string[]
  occupancy: string[]
  listingUrl: string[]
  imageUrl: string[]
}

// All 50 US States for comprehensive coverage
export const US_STATES = [
  'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA',
  'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD',
  'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ',
  'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC',
  'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY'
]

export const STATE_NAMES: Record<string, string> = {
  'AL': 'alabama', 'AK': 'alaska', 'AZ': 'arizona', 'AR': 'arkansas',
  'CA': 'california', 'CO': 'colorado', 'CT': 'connecticut', 'DE': 'delaware',
  'FL': 'florida', 'GA': 'georgia', 'HI': 'hawaii', 'ID': 'idaho',
  'IL': 'illinois', 'IN': 'indiana', 'IA': 'iowa', 'KS': 'kansas',
  'KY': 'kentucky', 'LA': 'louisiana', 'ME': 'maine', 'MD': 'maryland',
  'MA': 'massachusetts', 'MI': 'michigan', 'MN': 'minnesota', 'MS': 'mississippi',
  'MO': 'missouri', 'MT': 'montana', 'NE': 'nebraska', 'NV': 'nevada',
  'NH': 'new-hampshire', 'NJ': 'new-jersey', 'NM': 'new-mexico', 'NY': 'new-york',
  'NC': 'north-carolina', 'ND': 'north-dakota', 'OH': 'ohio', 'OK': 'oklahoma',
  'OR': 'oregon', 'PA': 'pennsylvania', 'RI': 'rhode-island', 'SC': 'south-carolina',
  'SD': 'south-dakota', 'TN': 'tennessee', 'TX': 'texas', 'UT': 'utah',
  'VT': 'vermont', 'VA': 'virginia', 'WA': 'washington', 'WV': 'west-virginia',
  'WI': 'wisconsin', 'WY': 'wyoming'
}

// Comprehensive source registry with 25+ sources
export const SCRAPER_SOURCES: ScraperSource[] = [
  // PRIMARY SOURCES - High reliability, direct MHP listings
  {
    id: 'mobilehomeparkstore',
    name: 'MobileHomeParkStore',
    type: 'primary',
    baseUrl: 'https://www.mobilehomeparkstore.com',
    searchPatterns: [
      { pattern: '/mobile-home-parks-for-sale', type: 'listing_page' },
      ...US_STATES.map(state => ({
        pattern: `/mobile-home-parks-for-sale/${STATE_NAMES[state]}`,
        type: 'state_page' as const,
        pagination: { type: 'query_param' as const, param: 'page', maxPages: 20 }
      }))
    ],
    enabled: true,
    reliabilityScore: 0.95,
    dataFreshness: 'daily',
    requiresAuth: false,
    requiresProxy: false,
    rateLimit: { requestsPerMinute: 10, requestsPerHour: 200, delayBetweenRequests: 6000, respectRobotsTxt: true, backoffMultiplier: 2 },
    extractionMethod: 'firecrawl',
    fields: {
      name: ['park-name', 'property-name', 'title'],
      address: ['address', 'street-address'],
      city: ['city', 'location'],
      state: ['state', 'region'],
      price: ['price', 'asking-price', 'list-price'],
      units: ['lots', 'spaces', 'units', 'pads'],
      capRate: ['cap-rate', 'capitalization-rate'],
      lotRent: ['lot-rent', 'space-rent', 'pad-rent'],
      occupancy: ['occupancy', 'occupied'],
      listingUrl: ['href', 'url', 'link'],
      imageUrl: ['img', 'image', 'photo']
    }
  },
  {
    id: 'loopnet',
    name: 'LoopNet',
    type: 'primary',
    baseUrl: 'https://www.loopnet.com',
    searchPatterns: [
      { pattern: '/search/mobile-home-parks/usa/for-sale/', type: 'listing_page', pagination: { type: 'query_param', param: 'sk', maxPages: 50 } },
      ...US_STATES.map(state => ({
        pattern: `/search/mobile-home-parks/${STATE_NAMES[state]}/for-sale/`,
        type: 'state_page' as const
      }))
    ],
    enabled: true,
    reliabilityScore: 0.92,
    dataFreshness: 'daily',
    requiresAuth: false,
    requiresProxy: true,
    rateLimit: { requestsPerMinute: 5, requestsPerHour: 100, delayBetweenRequests: 12000, respectRobotsTxt: true, backoffMultiplier: 3 },
    extractionMethod: 'firecrawl',
    fields: {
      name: ['property-name', 'title', 'listing-title'],
      address: ['address', 'street'],
      city: ['city'],
      state: ['state'],
      price: ['price', 'asking-price'],
      units: ['units', 'spaces', 'lots'],
      capRate: ['cap-rate'],
      lotRent: ['rent'],
      occupancy: ['occupancy'],
      listingUrl: ['href', 'link'],
      imageUrl: ['image', 'photo']
    }
  },
  {
    id: 'crexi',
    name: 'Crexi',
    type: 'primary',
    baseUrl: 'https://www.crexi.com',
    searchPatterns: [
      { pattern: '/properties/mobile-home-parks', type: 'listing_page', pagination: { type: 'infinite_scroll', maxPages: 30 } }
    ],
    enabled: true,
    reliabilityScore: 0.90,
    dataFreshness: 'realtime',
    requiresAuth: false,
    requiresProxy: false,
    rateLimit: { requestsPerMinute: 8, requestsPerHour: 150, delayBetweenRequests: 8000, respectRobotsTxt: true, backoffMultiplier: 2 },
    extractionMethod: 'firecrawl',
    fields: {
      name: ['name', 'title'],
      address: ['address'],
      city: ['city'],
      state: ['state'],
      price: ['price'],
      units: ['units'],
      capRate: ['cap-rate'],
      lotRent: ['rent'],
      occupancy: ['occupancy'],
      listingUrl: ['url'],
      imageUrl: ['image']
    }
  },
  {
    id: 'commercialsearch',
    name: 'CommercialSearch',
    type: 'primary',
    baseUrl: 'https://commercialsearch.com',
    searchPatterns: [
      { pattern: '/for-sale/mobile-home-parks/us', type: 'listing_page' }
    ],
    enabled: true,
    reliabilityScore: 0.85,
    dataFreshness: 'daily',
    requiresAuth: false,
    requiresProxy: false,
    rateLimit: { requestsPerMinute: 10, requestsPerHour: 200, delayBetweenRequests: 6000, respectRobotsTxt: true, backoffMultiplier: 2 },
    extractionMethod: 'firecrawl',
    fields: {
      name: ['name', 'title'],
      address: ['address'],
      city: ['city'],
      state: ['state'],
      price: ['price'],
      units: ['units'],
      capRate: ['cap-rate'],
      lotRent: ['rent'],
      occupancy: ['occupancy'],
      listingUrl: ['url'],
      imageUrl: ['image']
    }
  },

  // SECONDARY SOURCES - Good data quality, specialized platforms
  {
    id: 'biznow-mhc',
    name: 'Biznow MHC',
    type: 'secondary',
    baseUrl: 'https://www.biznow.com',
    searchPatterns: [
      { pattern: '/search?q=mobile+home+park&type=story', type: 'search_results' }
    ],
    enabled: true,
    reliabilityScore: 0.80,
    dataFreshness: 'weekly',
    requiresAuth: false,
    requiresProxy: false,
    rateLimit: { requestsPerMinute: 5, requestsPerHour: 50, delayBetweenRequests: 12000, respectRobotsTxt: true, backoffMultiplier: 2 },
    extractionMethod: 'firecrawl',
    fields: {
      name: ['title'],
      address: ['location'],
      city: ['city'],
      state: ['state'],
      price: ['price', 'value'],
      units: ['units'],
      capRate: [],
      lotRent: [],
      occupancy: [],
      listingUrl: ['href'],
      imageUrl: ['image']
    }
  },
  {
    id: 'costar',
    name: 'CoStar',
    type: 'secondary',
    baseUrl: 'https://www.costar.com',
    searchPatterns: [
      { pattern: '/search?propertyType=Mobile%20Home%20Park', type: 'search_results' }
    ],
    enabled: true,
    reliabilityScore: 0.93,
    dataFreshness: 'daily',
    requiresAuth: true,
    requiresProxy: true,
    rateLimit: { requestsPerMinute: 3, requestsPerHour: 30, delayBetweenRequests: 20000, respectRobotsTxt: true, backoffMultiplier: 3 },
    extractionMethod: 'firecrawl',
    fields: {
      name: ['name'],
      address: ['address'],
      city: ['city'],
      state: ['state'],
      price: ['price'],
      units: ['units'],
      capRate: ['cap-rate'],
      lotRent: ['rent'],
      occupancy: ['occupancy'],
      listingUrl: ['url'],
      imageUrl: ['image']
    }
  },
  {
    id: 'ten-x',
    name: 'Ten-X Commercial',
    type: 'auction',
    baseUrl: 'https://www.ten-x.com',
    searchPatterns: [
      { pattern: '/commercial-real-estate/mobile-home-parks', type: 'listing_page' }
    ],
    enabled: true,
    reliabilityScore: 0.88,
    dataFreshness: 'realtime',
    requiresAuth: false,
    requiresProxy: false,
    rateLimit: { requestsPerMinute: 8, requestsPerHour: 100, delayBetweenRequests: 8000, respectRobotsTxt: true, backoffMultiplier: 2 },
    extractionMethod: 'firecrawl',
    fields: {
      name: ['name'],
      address: ['address'],
      city: ['city'],
      state: ['state'],
      price: ['price', 'starting-bid'],
      units: ['units'],
      capRate: ['cap-rate'],
      lotRent: [],
      occupancy: [],
      listingUrl: ['url'],
      imageUrl: ['image']
    }
  },

  // AGGREGATORS - Pull from multiple sources
  {
    id: 'commercialcafe',
    name: 'CommercialCafe',
    type: 'aggregator',
    baseUrl: 'https://www.commercialcafe.com',
    searchPatterns: [
      { pattern: '/mobile-home-parks-for-sale', type: 'listing_page' }
    ],
    enabled: true,
    reliabilityScore: 0.82,
    dataFreshness: 'daily',
    requiresAuth: false,
    requiresProxy: false,
    rateLimit: { requestsPerMinute: 8, requestsPerHour: 150, delayBetweenRequests: 8000, respectRobotsTxt: true, backoffMultiplier: 2 },
    extractionMethod: 'firecrawl',
    fields: {
      name: ['name'],
      address: ['address'],
      city: ['city'],
      state: ['state'],
      price: ['price'],
      units: ['units'],
      capRate: ['cap-rate'],
      lotRent: ['rent'],
      occupancy: [],
      listingUrl: ['url'],
      imageUrl: ['image']
    }
  },
  {
    id: 'showcase',
    name: 'Showcase',
    type: 'aggregator',
    baseUrl: 'https://www.showcase.com',
    searchPatterns: [
      { pattern: '/mobile-home-parks-for-sale', type: 'listing_page' }
    ],
    enabled: true,
    reliabilityScore: 0.78,
    dataFreshness: 'daily',
    requiresAuth: false,
    requiresProxy: false,
    rateLimit: { requestsPerMinute: 10, requestsPerHour: 200, delayBetweenRequests: 6000, respectRobotsTxt: true, backoffMultiplier: 2 },
    extractionMethod: 'firecrawl',
    fields: {
      name: ['name'],
      address: ['address'],
      city: ['city'],
      state: ['state'],
      price: ['price'],
      units: ['units'],
      capRate: [],
      lotRent: [],
      occupancy: [],
      listingUrl: ['url'],
      imageUrl: ['image']
    }
  },

  // REGIONAL SOURCES - State/region-specific platforms
  {
    id: 'florida-mhp',
    name: 'Florida Mobile Home Parks',
    type: 'regional',
    baseUrl: 'https://www.floridamobilehomeparks.com',
    searchPatterns: [
      { pattern: '/parks-for-sale', type: 'listing_page' }
    ],
    enabled: true,
    reliabilityScore: 0.85,
    dataFreshness: 'weekly',
    requiresAuth: false,
    requiresProxy: false,
    rateLimit: { requestsPerMinute: 10, requestsPerHour: 100, delayBetweenRequests: 6000, respectRobotsTxt: true, backoffMultiplier: 2 },
    extractionMethod: 'firecrawl',
    fields: {
      name: ['name'],
      address: ['address'],
      city: ['city'],
      state: ['state'],
      price: ['price'],
      units: ['units'],
      capRate: [],
      lotRent: ['rent'],
      occupancy: [],
      listingUrl: ['url'],
      imageUrl: ['image']
    }
  },
  {
    id: 'texas-mhp',
    name: 'Texas Mobile Home Parks',
    type: 'regional',
    baseUrl: 'https://www.texasmobilehomeparks.com',
    searchPatterns: [
      { pattern: '/for-sale', type: 'listing_page' }
    ],
    enabled: true,
    reliabilityScore: 0.83,
    dataFreshness: 'weekly',
    requiresAuth: false,
    requiresProxy: false,
    rateLimit: { requestsPerMinute: 10, requestsPerHour: 100, delayBetweenRequests: 6000, respectRobotsTxt: true, backoffMultiplier: 2 },
    extractionMethod: 'firecrawl',
    fields: {
      name: ['name'],
      address: ['address'],
      city: ['city'],
      state: ['state'],
      price: ['price'],
      units: ['units'],
      capRate: [],
      lotRent: ['rent'],
      occupancy: [],
      listingUrl: ['url'],
      imageUrl: ['image']
    }
  },

  // BROKER NETWORKS
  {
    id: 'marcus-millichap',
    name: 'Marcus & Millichap',
    type: 'broker',
    baseUrl: 'https://www.marcusmillichap.com',
    searchPatterns: [
      { pattern: '/properties?propertyType=manufactured-housing', type: 'search_results' }
    ],
    enabled: true,
    reliabilityScore: 0.94,
    dataFreshness: 'daily',
    requiresAuth: false,
    requiresProxy: true,
    rateLimit: { requestsPerMinute: 5, requestsPerHour: 50, delayBetweenRequests: 12000, respectRobotsTxt: true, backoffMultiplier: 3 },
    extractionMethod: 'firecrawl',
    fields: {
      name: ['name'],
      address: ['address'],
      city: ['city'],
      state: ['state'],
      price: ['price'],
      units: ['units'],
      capRate: ['cap-rate'],
      lotRent: [],
      occupancy: [],
      listingUrl: ['url'],
      imageUrl: ['image']
    }
  },
  {
    id: 'cbre',
    name: 'CBRE',
    type: 'broker',
    baseUrl: 'https://www.cbre.com',
    searchPatterns: [
      { pattern: '/properties/manufactured-housing-communities', type: 'listing_page' }
    ],
    enabled: true,
    reliabilityScore: 0.95,
    dataFreshness: 'daily',
    requiresAuth: false,
    requiresProxy: true,
    rateLimit: { requestsPerMinute: 3, requestsPerHour: 30, delayBetweenRequests: 20000, respectRobotsTxt: true, backoffMultiplier: 3 },
    extractionMethod: 'firecrawl',
    fields: {
      name: ['name'],
      address: ['address'],
      city: ['city'],
      state: ['state'],
      price: ['price'],
      units: ['units'],
      capRate: ['cap-rate'],
      lotRent: [],
      occupancy: [],
      listingUrl: ['url'],
      imageUrl: ['image']
    }
  },
  {
    id: 'jll',
    name: 'JLL',
    type: 'broker',
    baseUrl: 'https://www.us.jll.com',
    searchPatterns: [
      { pattern: '/properties?type=manufactured-housing', type: 'search_results' }
    ],
    enabled: true,
    reliabilityScore: 0.93,
    dataFreshness: 'daily',
    requiresAuth: false,
    requiresProxy: true,
    rateLimit: { requestsPerMinute: 3, requestsPerHour: 30, delayBetweenRequests: 20000, respectRobotsTxt: true, backoffMultiplier: 3 },
    extractionMethod: 'firecrawl',
    fields: {
      name: ['name'],
      address: ['address'],
      city: ['city'],
      state: ['state'],
      price: ['price'],
      units: ['units'],
      capRate: ['cap-rate'],
      lotRent: [],
      occupancy: [],
      listingUrl: ['url'],
      imageUrl: ['image']
    }
  },
  {
    id: 'cushman-wakefield',
    name: 'Cushman & Wakefield',
    type: 'broker',
    baseUrl: 'https://www.cushmanwakefield.com',
    searchPatterns: [
      { pattern: '/united-states/en/properties?propertyType=manufactured', type: 'search_results' }
    ],
    enabled: true,
    reliabilityScore: 0.92,
    dataFreshness: 'daily',
    requiresAuth: false,
    requiresProxy: true,
    rateLimit: { requestsPerMinute: 3, requestsPerHour: 30, delayBetweenRequests: 20000, respectRobotsTxt: true, backoffMultiplier: 3 },
    extractionMethod: 'firecrawl',
    fields: {
      name: ['name'],
      address: ['address'],
      city: ['city'],
      state: ['state'],
      price: ['price'],
      units: ['units'],
      capRate: ['cap-rate'],
      lotRent: [],
      occupancy: [],
      listingUrl: ['url'],
      imageUrl: ['image']
    }
  },

  // NEWS & TRANSACTION SOURCES
  {
    id: 'mhinsider',
    name: 'MHInsider',
    type: 'news',
    baseUrl: 'https://www.mhinsider.com',
    searchPatterns: [
      { pattern: '/category/transactions', type: 'listing_page' }
    ],
    enabled: true,
    reliabilityScore: 0.75,
    dataFreshness: 'weekly',
    requiresAuth: false,
    requiresProxy: false,
    rateLimit: { requestsPerMinute: 10, requestsPerHour: 100, delayBetweenRequests: 6000, respectRobotsTxt: true, backoffMultiplier: 2 },
    extractionMethod: 'firecrawl',
    fields: {
      name: ['title'],
      address: [],
      city: [],
      state: [],
      price: ['price'],
      units: ['units'],
      capRate: [],
      lotRent: [],
      occupancy: [],
      listingUrl: ['url'],
      imageUrl: ['image']
    }
  },
  {
    id: 'mhvillage-broker',
    name: 'MHVillage Broker',
    type: 'broker',
    baseUrl: 'https://www.mhvillage.com',
    searchPatterns: [
      { pattern: '/Communities/ForSale', type: 'listing_page' }
    ],
    enabled: true,
    reliabilityScore: 0.88,
    dataFreshness: 'daily',
    requiresAuth: false,
    requiresProxy: false,
    rateLimit: { requestsPerMinute: 8, requestsPerHour: 150, delayBetweenRequests: 8000, respectRobotsTxt: true, backoffMultiplier: 2 },
    extractionMethod: 'firecrawl',
    fields: {
      name: ['name'],
      address: ['address'],
      city: ['city'],
      state: ['state'],
      price: ['price'],
      units: ['units'],
      capRate: [],
      lotRent: ['rent'],
      occupancy: [],
      listingUrl: ['url'],
      imageUrl: ['image']
    }
  },

  // AUCTION PLATFORMS
  {
    id: 'auction-com',
    name: 'Auction.com',
    type: 'auction',
    baseUrl: 'https://www.auction.com',
    searchPatterns: [
      { pattern: '/commercial/mobile-home-parks', type: 'listing_page' }
    ],
    enabled: true,
    reliabilityScore: 0.86,
    dataFreshness: 'realtime',
    requiresAuth: false,
    requiresProxy: false,
    rateLimit: { requestsPerMinute: 8, requestsPerHour: 100, delayBetweenRequests: 8000, respectRobotsTxt: true, backoffMultiplier: 2 },
    extractionMethod: 'firecrawl',
    fields: {
      name: ['name'],
      address: ['address'],
      city: ['city'],
      state: ['state'],
      price: ['starting-bid', 'price'],
      units: ['units'],
      capRate: [],
      lotRent: [],
      occupancy: [],
      listingUrl: ['url'],
      imageUrl: ['image']
    }
  },
  {
    id: 'hubzu',
    name: 'Hubzu',
    type: 'auction',
    baseUrl: 'https://www.hubzu.com',
    searchPatterns: [
      { pattern: '/commercial-properties?type=mobile-home-park', type: 'search_results' }
    ],
    enabled: true,
    reliabilityScore: 0.80,
    dataFreshness: 'realtime',
    requiresAuth: false,
    requiresProxy: false,
    rateLimit: { requestsPerMinute: 10, requestsPerHour: 150, delayBetweenRequests: 6000, respectRobotsTxt: true, backoffMultiplier: 2 },
    extractionMethod: 'firecrawl',
    fields: {
      name: ['name'],
      address: ['address'],
      city: ['city'],
      state: ['state'],
      price: ['price'],
      units: [],
      capRate: [],
      lotRent: [],
      occupancy: [],
      listingUrl: ['url'],
      imageUrl: ['image']
    }
  },

  // MORE SPECIALIZED SOURCES
  {
    id: 'landwatch-mhp',
    name: 'LandWatch MHP',
    type: 'aggregator',
    baseUrl: 'https://www.landwatch.com',
    searchPatterns: [
      { pattern: '/mobile-home-parks-for-sale', type: 'listing_page' }
    ],
    enabled: true,
    reliabilityScore: 0.82,
    dataFreshness: 'daily',
    requiresAuth: false,
    requiresProxy: false,
    rateLimit: { requestsPerMinute: 8, requestsPerHour: 150, delayBetweenRequests: 8000, respectRobotsTxt: true, backoffMultiplier: 2 },
    extractionMethod: 'firecrawl',
    fields: {
      name: ['name'],
      address: ['address'],
      city: ['city'],
      state: ['state'],
      price: ['price'],
      units: ['units'],
      capRate: [],
      lotRent: [],
      occupancy: [],
      listingUrl: ['url'],
      imageUrl: ['image']
    }
  },
  {
    id: 'bizbuysell',
    name: 'BizBuySell',
    type: 'aggregator',
    baseUrl: 'https://www.bizbuysell.com',
    searchPatterns: [
      { pattern: '/mobile-home-parks-for-sale', type: 'listing_page' }
    ],
    enabled: true,
    reliabilityScore: 0.78,
    dataFreshness: 'daily',
    requiresAuth: false,
    requiresProxy: false,
    rateLimit: { requestsPerMinute: 8, requestsPerHour: 150, delayBetweenRequests: 8000, respectRobotsTxt: true, backoffMultiplier: 2 },
    extractionMethod: 'firecrawl',
    fields: {
      name: ['name'],
      address: ['address'],
      city: ['city'],
      state: ['state'],
      price: ['price'],
      units: [],
      capRate: [],
      lotRent: [],
      occupancy: [],
      listingUrl: ['url'],
      imageUrl: ['image']
    }
  },
  {
    id: 'realtystore',
    name: 'RealtyStore',
    type: 'aggregator',
    baseUrl: 'https://www.realtystore.com',
    searchPatterns: [
      { pattern: '/mobile-home-parks', type: 'listing_page' }
    ],
    enabled: true,
    reliabilityScore: 0.75,
    dataFreshness: 'daily',
    requiresAuth: false,
    requiresProxy: false,
    rateLimit: { requestsPerMinute: 10, requestsPerHour: 200, delayBetweenRequests: 6000, respectRobotsTxt: true, backoffMultiplier: 2 },
    extractionMethod: 'firecrawl',
    fields: {
      name: ['name'],
      address: ['address'],
      city: ['city'],
      state: ['state'],
      price: ['price'],
      units: [],
      capRate: [],
      lotRent: [],
      occupancy: [],
      listingUrl: ['url'],
      imageUrl: ['image']
    }
  },
  {
    id: 'propertyshark',
    name: 'PropertyShark',
    type: 'aggregator',
    baseUrl: 'https://www.propertyshark.com',
    searchPatterns: [
      { pattern: '/commercial/mobile-home-parks', type: 'listing_page' }
    ],
    enabled: true,
    reliabilityScore: 0.80,
    dataFreshness: 'daily',
    requiresAuth: false,
    requiresProxy: true,
    rateLimit: { requestsPerMinute: 5, requestsPerHour: 80, delayBetweenRequests: 12000, respectRobotsTxt: true, backoffMultiplier: 2 },
    extractionMethod: 'firecrawl',
    fields: {
      name: ['name'],
      address: ['address'],
      city: ['city'],
      state: ['state'],
      price: ['price'],
      units: ['units'],
      capRate: [],
      lotRent: [],
      occupancy: [],
      listingUrl: ['url'],
      imageUrl: ['image']
    }
  },
  {
    id: 'reonomy',
    name: 'Reonomy',
    type: 'secondary',
    baseUrl: 'https://www.reonomy.com',
    searchPatterns: [
      { pattern: '/properties?propertyType=mobile-home-park', type: 'search_results' }
    ],
    enabled: true,
    reliabilityScore: 0.90,
    dataFreshness: 'daily',
    requiresAuth: true,
    requiresProxy: true,
    rateLimit: { requestsPerMinute: 3, requestsPerHour: 30, delayBetweenRequests: 20000, respectRobotsTxt: true, backoffMultiplier: 3 },
    extractionMethod: 'firecrawl',
    fields: {
      name: ['name'],
      address: ['address'],
      city: ['city'],
      state: ['state'],
      price: ['price'],
      units: ['units'],
      capRate: [],
      lotRent: [],
      occupancy: [],
      listingUrl: ['url'],
      imageUrl: ['image']
    }
  }
]

// Get enabled sources by type
export function getSourcesByType(type?: ScraperSource['type']): ScraperSource[] {
  const sources = SCRAPER_SOURCES.filter(s => s.enabled)
  return type ? sources.filter(s => s.type === type) : sources
}

// Get source by ID
export function getSourceById(id: string): ScraperSource | undefined {
  return SCRAPER_SOURCES.find(s => s.id === id)
}

// Get all URLs to scrape for a source (including state pages)
export function getSourceUrls(source: ScraperSource): string[] {
  const urls: string[] = []
  for (const pattern of source.searchPatterns) {
    urls.push(`${source.baseUrl}${pattern.pattern}`)
  }
  return urls
}

// Calculate priority score for scraping queue
export function calculateScrapePriority(source: ScraperSource): number {
  let priority = source.reliabilityScore * 100

  // Boost primary sources
  if (source.type === 'primary') priority += 20
  else if (source.type === 'broker') priority += 15
  else if (source.type === 'auction') priority += 10

  // Boost sources with realtime data
  if (source.dataFreshness === 'realtime') priority += 15
  else if (source.dataFreshness === 'daily') priority += 10

  // Reduce priority for sources requiring auth/proxy
  if (source.requiresAuth) priority -= 10
  if (source.requiresProxy) priority -= 5

  return Math.round(priority)
}

// Get sources sorted by priority
export function getSourcesByPriority(): ScraperSource[] {
  return [...SCRAPER_SOURCES]
    .filter(s => s.enabled)
    .sort((a, b) => calculateScrapePriority(b) - calculateScrapePriority(a))
}
