import { handleOptions, jsonResponse } from '../_shared/cors.ts'
import { getAdminClient } from '../_shared/supabaseAdmin.ts'

const REQUIRED = [
  'external_id',
  'title',
  'address',
  'latitude',
  'longitude',
  'monthly_rent',
  'floor_area',
]

/**
 * Imports listings from a CSV file previously uploaded to the
 * `imports` storage bucket. Body: { filePath: string }.
 * Validates required columns, upserts by external_id, records a job.
 */
Deno.serve(async (req) => {
  const opt = handleOptions(req)
  if (opt) return opt
  try {
    const { filePath } = (await req.json()) as { filePath?: string }
    if (!filePath) return jsonResponse({ error: 'filePath required' }, 400)
    const sb = getAdminClient()

    const { data: file, error: dlErr } = await sb.storage
      .from('imports')
      .download(filePath)
    if (dlErr || !file) {
      return jsonResponse({ error: `download failed: ${dlErr?.message}` }, 400)
    }
    const text = await file.text()
    const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0)
    if (lines.length < 2) {
      return jsonResponse({ error: 'empty csv' }, 400)
    }
    const header = lines[0].split(',').map((h) => h.trim())
    const missing = REQUIRED.filter((c) => !header.includes(c))
    if (missing.length > 0) {
      return jsonResponse(
        { error: `missing columns: ${missing.join(', ')}` },
        400,
      )
    }

    const errors: Array<{ row: number; message: string }> = []
    const rows: Record<string, unknown>[] = []
    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i].split(',').map((c) => c.trim())
      const row: Record<string, string> = {}
      header.forEach((h, j) => (row[h] = cols[j] ?? ''))
      const lat = Number(row.latitude)
      const lng = Number(row.longitude)
      const rent = Number(row.monthly_rent)
      const area = Number(row.floor_area)
      if (!row.external_id || !row.title || !row.address) {
        errors.push({ row: i + 1, message: 'missing required text field' })
        continue
      }
      if (!Number.isFinite(lat) || lat < 20 || lat > 46) {
        errors.push({ row: i + 1, message: 'invalid latitude' })
        continue
      }
      if (!Number.isFinite(lng) || lng < 122 || lng > 154) {
        errors.push({ row: i + 1, message: 'invalid longitude' })
        continue
      }
      if (!Number.isFinite(rent) || rent <= 0) {
        errors.push({ row: i + 1, message: 'invalid monthly_rent' })
        continue
      }
      if (!Number.isFinite(area) || area <= 0) {
        errors.push({ row: i + 1, message: 'invalid floor_area' })
        continue
      }
      rows.push({
        external_id: row.external_id,
        title: row.title,
        address: row.address,
        latitude: lat,
        longitude: lng,
        monthly_rent: rent,
        management_fee: Number(row.management_fee) || 0,
        deposit: Number(row.deposit) || 0,
        key_money: Number(row.key_money) || 0,
        layout: row.layout || null,
        floor_area: area,
        building_age: Number(row.building_age) || 0,
        nearest_station_name: row.nearest_station_name || null,
        walk_minutes_to_station:
          Number(row.walk_minutes_to_station) || null,
        railway_line: row.railway_line || null,
        source_name: row.source_name || 'CSV Import',
        source_url: row.source_url || null,
        is_demo: row.is_demo !== 'false',
      })
    }

    let imported = 0
    if (rows.length > 0) {
      const { error } = await sb
        .from('listings')
        .upsert(rows, { onConflict: 'external_id' })
      if (error) return jsonResponse({ error: error.message }, 500)
      imported = rows.length
    }

    await sb.from('listing_import_jobs').insert({
      file_path: filePath,
      status: 'done',
      total_rows: lines.length - 1,
      imported_rows: imported,
      error_rows: errors.length > 0 ? errors : null,
      finished_at: new Date().toISOString(),
    })

    return jsonResponse({
      totalRows: lines.length - 1,
      importedRows: imported,
      errors,
    })
  } catch (err) {
    return jsonResponse({ error: String(err) }, 500)
  }
})
