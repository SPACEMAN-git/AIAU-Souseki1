import type { Station, StationEdge } from './types'
import { DEMO_TRANSFER_MINUTES } from './config'

export interface PathResult {
  minutes: number
  stations: string[]
  lines: string[]
  transferCount: number
}

interface AdjEdge {
  to: string
  minutes: number
  line: string
}

/**
 * Dijkstra shortest path over the demo station graph.
 * A line change adds DEMO_TRANSFER_MINUTES and counts as a transfer.
 * Edges are treated as bidirectional.
 */
export function shortestPath(
  stations: Station[],
  edges: StationEdge[],
  fromId: string,
  toId: string,
): PathResult | null {
  const adj = new Map<string, AdjEdge[]>()
  for (const s of stations) adj.set(s.id, [])
  for (const e of edges) {
    adj.get(e.from)?.push({ to: e.to, minutes: e.minutes, line: e.line })
    adj.get(e.to)?.push({ to: e.from, minutes: e.minutes, line: e.line })
  }
  if (!adj.has(fromId) || !adj.has(toId)) return null

  // State: station + line arrived on (to charge transfer penalties).
  interface State {
    station: string
    line: string
    cost: number
  }
  const best = new Map<string, number>()
  const prev = new Map<string, { key: string; line: string }>()
  const queue: State[] = [{ station: fromId, line: '', cost: 0 }]
  const keyOf = (s: string, l: string) => `${s}#${l}`
  best.set(keyOf(fromId, ''), 0)

  while (queue.length > 0) {
    queue.sort((a, b) => a.cost - b.cost)
    const cur = queue.shift()!
    const curKey = keyOf(cur.station, cur.line)
    if ((best.get(curKey) ?? Infinity) < cur.cost) continue
    for (const e of adj.get(cur.station) ?? []) {
      const transferPenalty =
        cur.line !== '' && cur.line !== e.line ? DEMO_TRANSFER_MINUTES : 0
      const nextCost = cur.cost + e.minutes + transferPenalty
      const nextKey = keyOf(e.to, e.line)
      if (nextCost < (best.get(nextKey) ?? Infinity)) {
        best.set(nextKey, nextCost)
        prev.set(nextKey, { key: curKey, line: e.line })
        queue.push({ station: e.to, line: e.line, cost: nextCost })
      }
    }
  }

  let bestKey: string | null = null
  let bestCost = Infinity
  for (const [k, c] of best) {
    if (k.startsWith(`${toId}#`) && c < bestCost) {
      bestCost = c
      bestKey = k
    }
  }
  if (bestKey == null) return null

  const pathStations: string[] = []
  const pathLines: string[] = []
  let k: string | null = bestKey
  while (k) {
    const [station, line] = k.split('#')
    pathStations.unshift(station)
    if (line) pathLines.unshift(line)
    k = prev.get(k)?.key ?? null
  }
  const uniqueLines = pathLines.filter((l, i) => i === 0 || l !== pathLines[i - 1])
  return {
    minutes: Math.round(bestCost),
    stations: pathStations,
    lines: uniqueLines,
    transferCount: Math.max(uniqueLines.length - 1, 0),
  }
}
