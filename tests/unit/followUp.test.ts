import { describe, it, expect } from 'vitest'
import { followUpPatch } from '~/utils/followUp'

const ladder = [
  { value: 2, unit: 'day' as const },
  { value: 14, unit: 'day' as const },
  { value: 45, unit: 'day' as const },
]
const NOW = new Date('2026-10-03T12:00:00Z')

describe('followUpPatch', () => {
  it('advances rung 1 → 2 and schedules the next rung from now', () => {
    const { patch, result } = followUpPatch({ cadence_ladder: ladder, touchpoints_done: 0 }, NOW)
    expect(patch).toEqual({ touchpoints_done: 1, follow_up_by: '2026-10-17T12:00:00.000Z' })
    expect(result).toEqual({ outcome: 'advanced', touchpointsDone: 1, followUpBy: '2026-10-17T12:00:00.000Z' })
  })

  it('advances rung 2 → 3', () => {
    const { patch } = followUpPatch({ cadence_ladder: ladder, touchpoints_done: 1 }, NOW)
    expect(patch).toEqual({ touchpoints_done: 2, follow_up_by: '2026-11-17T12:00:00.000Z' })
  })

  it('graduates on the third touchpoint', () => {
    const { patch, result } = followUpPatch({ cadence_ladder: ladder, touchpoints_done: 2 }, NOW)
    expect(patch).toEqual({ touchpoints_done: 3, status: 'graduated' })
    expect(result).toEqual({ outcome: 'graduated' })
  })
})
