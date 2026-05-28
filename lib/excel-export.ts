import * as XLSX from 'xlsx'
import { Property } from './types'

// Format values for Excel export
function formatPrice(price: number | null): string {
  if (price === null || price === undefined) return ''
  return `$${price.toLocaleString()}`
}

function formatPercent(value: number | null): string {
  if (value === null || value === undefined) return ''
  return `${value.toFixed(1)}%`
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return ''
  return new Date(dateStr).toLocaleDateString()
}

export interface ExcelExportOptions {
  filename?: string
  includeMetrics?: boolean
}

export function exportToExcel(
  properties: Property[], 
  options: ExcelExportOptions = {}
): void {
  const { 
    filename = `mhc-listings-${new Date().toISOString().split('T')[0]}`,
    includeMetrics = true 
  } = options

  // Define the columns we want to export
  const data = properties.map(p => {
    const baseData: Record<string, string | number | null> = {
      'Property Name': p.name,
      'Address': p.address || '',
      'City': p.city,
      'State': p.state,
      'Region': p.region || '',
      'Units': p.units,
      'Asking Price': p.asking_price ? formatPrice(p.asking_price) : '',
      'Cap Rate': p.cap_rate ? formatPercent(p.cap_rate) : '',
      'Lot Rent': p.lot_rent ? `$${p.lot_rent}/mo` : '',
      'Occupancy': p.occupancy ? formatPercent(p.occupancy) : '',
      'NOI': p.noi ? formatPrice(p.noi) : '',
      'Price Per Pad': p.price_per_pad ? formatPrice(p.price_per_pad) : '',
      'Source': p.source || '',
      'Status': p.status || 'active',
      'Listing URL': p.listing_url || '',
      'Date Added': formatDate(p.created_at),
    }

    if (includeMetrics) {
      baseData['AI Score'] = p.ai_score ?? ''
      baseData['Mom & Pop'] = p.mom_pop ? 'Yes' : 'No'
    }

    // Add unit breakdown
    baseData['TOH (Tenant Owned)'] = p.toh ?? ''
    baseData['POH (Park Owned)'] = p.poh ?? ''
    baseData['Vacant'] = p.vacant ?? ''

    // Add sold data if applicable
    if (p.status === 'sold') {
      baseData['Sold Price'] = p.sold_price ? formatPrice(p.sold_price) : ''
      baseData['Sold Date'] = formatDate(p.sold_date)
      baseData['Buyer'] = p.buyer || ''
    }

    baseData['Notes'] = p.notes || ''

    return baseData
  })

  // Create workbook and worksheet
  const workbook = XLSX.utils.book_new()
  const worksheet = XLSX.utils.json_to_sheet(data)

  // Set column widths for better readability
  const colWidths = [
    { wch: 30 }, // Property Name
    { wch: 35 }, // Address
    { wch: 15 }, // City
    { wch: 8 },  // State
    { wch: 12 }, // Region
    { wch: 8 },  // Units
    { wch: 15 }, // Asking Price
    { wch: 10 }, // Cap Rate
    { wch: 12 }, // Lot Rent
    { wch: 10 }, // Occupancy
    { wch: 15 }, // NOI
    { wch: 15 }, // Price Per Pad
    { wch: 20 }, // Source
    { wch: 10 }, // Status
    { wch: 50 }, // Listing URL
    { wch: 12 }, // Date Added
    { wch: 10 }, // AI Score
    { wch: 10 }, // Mom & Pop
    { wch: 8 },  // TOH
    { wch: 8 },  // POH
    { wch: 8 },  // Vacant
    { wch: 15 }, // Sold Price
    { wch: 12 }, // Sold Date
    { wch: 20 }, // Buyer
    { wch: 40 }, // Notes
  ]
  worksheet['!cols'] = colWidths

  // Add worksheet to workbook
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Properties')

  // Create a summary sheet with statistics
  const summaryData = [
    { 'Metric': 'Total Properties', 'Value': properties.length },
    { 'Metric': 'Active Listings', 'Value': properties.filter(p => p.status !== 'sold').length },
    { 'Metric': 'Sold Properties', 'Value': properties.filter(p => p.status === 'sold').length },
    { 'Metric': 'Total Units', 'Value': properties.reduce((sum, p) => sum + (p.units || 0), 0) },
    { 'Metric': 'Avg. Asking Price', 'Value': formatPrice(
      Math.round(
        properties
          .filter(p => p.asking_price)
          .reduce((sum, p) => sum + (p.asking_price || 0), 0) / 
        (properties.filter(p => p.asking_price).length || 1)
      )
    )},
    { 'Metric': 'Avg. AI Score', 'Value': (
      properties
        .filter(p => p.ai_score !== null)
        .reduce((sum, p) => sum + (p.ai_score || 0), 0) / 
      (properties.filter(p => p.ai_score !== null).length || 1)
    ).toFixed(1) },
    { 'Metric': 'Export Date', 'Value': new Date().toLocaleString() },
  ]
  
  const summarySheet = XLSX.utils.json_to_sheet(summaryData)
  summarySheet['!cols'] = [{ wch: 20 }, { wch: 20 }]
  XLSX.utils.book_append_sheet(workbook, summarySheet, 'Summary')

  // Generate and download the file
  XLSX.writeFile(workbook, `${filename}.xlsx`)
}

// Export as CSV as a fallback option
export function exportToCSV(properties: Property[], filename?: string): void {
  const data = properties.map(p => ({
    name: p.name,
    address: p.address || '',
    city: p.city,
    state: p.state,
    region: p.region || '',
    units: p.units,
    asking_price: p.asking_price || '',
    cap_rate: p.cap_rate || '',
    lot_rent: p.lot_rent || '',
    occupancy: p.occupancy || '',
    ai_score: p.ai_score || '',
    source: p.source || '',
    status: p.status || 'active',
    listing_url: p.listing_url || '',
    notes: p.notes || '',
  }))

  const workbook = XLSX.utils.book_new()
  const worksheet = XLSX.utils.json_to_sheet(data)
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Properties')
  
  XLSX.writeFile(workbook, `${filename || 'mhc-listings'}.csv`, { bookType: 'csv' })
}
