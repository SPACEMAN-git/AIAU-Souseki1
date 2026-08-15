import { z } from 'zod'

export const CSV_COLUMNS = [
  'external_id',
  'title',
  'address',
  'monthly_rent',
  'management_fee',
  'layout',
  'floor_area',
  'building_age',
  'nearest_station_name',
  'walk_minutes_to_station',
  'latitude',
  'longitude',
  'source_url',
] as const

const numeric = (min: number, max: number) =>
  z
    .string()
    .refine(
      (v) => v === '' || (Number.isFinite(Number(v)) && Number(v) >= min && Number(v) <= max),
      { message: `must be a number between ${min} and ${max}` },
    )

export const csvRowSchema = z.object({
  external_id: z.string().min(1, 'external_id is required'),
  title: z.string().min(1, 'title is required'),
  address: z.string().min(1, 'address is required'),
  monthly_rent: numeric(1, 10_000_000).refine((v) => v !== '', {
    message: 'monthly_rent is required',
  }),
  management_fee: numeric(0, 1_000_000),
  layout: z.string(),
  floor_area: numeric(1, 1000),
  building_age: numeric(0, 150),
  nearest_station_name: z.string(),
  walk_minutes_to_station: numeric(0, 120),
  latitude: numeric(-90, 90),
  longitude: numeric(-180, 180),
  source_url: z.string(),
})

export type CsvRow = z.infer<typeof csvRowSchema>

export interface CsvParseResult {
  valid: CsvRow[]
  errors: Array<{ line: number; message: string }>
}

/** Parses simple comma-separated CSV (no embedded commas in fields). */
export function parseListingsCsv(text: string): CsvParseResult {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0)
  const result: CsvParseResult = { valid: [], errors: [] }
  if (lines.length === 0) {
    result.errors.push({ line: 0, message: 'empty file' })
    return result
  }
  const header = lines[0].split(',').map((h) => h.trim())
  const missing = CSV_COLUMNS.filter((c) => !header.includes(c))
  if (missing.length > 0) {
    result.errors.push({
      line: 1,
      message: `missing columns: ${missing.join(', ')}`,
    })
    return result
  }
  for (let i = 1; i < lines.length; i++) {
    const cells = lines[i].split(',').map((c) => c.trim())
    const row: Record<string, string> = {}
    header.forEach((h, idx) => {
      row[h] = cells[idx] ?? ''
    })
    const parsed = csvRowSchema.safeParse(row)
    if (parsed.success) {
      result.valid.push(parsed.data)
    } else {
      const issue = parsed.error.issues[0]
      result.errors.push({
        line: i + 1,
        message: `${issue.path.join('.')}: ${issue.message}`,
      })
    }
  }
  return result
}
