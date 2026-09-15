import { useEffect, useRef, useState } from 'react'

import { fetchJson } from '../api'
import { previousMonthId } from './overviewLogic'

export function maturityOverviewUrl(month, category) {
  const params = new URLSearchParams({ month: String(month), kind: String(category) })
  return `/api/maturity/overview?${params.toString()}`
}

export function maturityRecordsUrl(teamId, month) {
  const params = new URLSearchParams({ team_id: String(teamId), month: String(month) })
  return `/api/maturity/records?${params.toString()}`
}

export function useMaturityOverview(month, category, onSessionExpired, refreshKey = 0) {
  const [state, setState] = useState({ loading: true, data: null, error: null })
  const sessionExpiredRef = useRef(onSessionExpired)
  sessionExpiredRef.current = onSessionExpired

  useEffect(() => {
    const controller = new AbortController()
    let active = true
    setState({ loading: true, data: null, error: null })
    fetchJson(maturityOverviewUrl(month, category), { signal: controller.signal })
      .then((data) => {
        if (active) setState({ loading: false, data, error: null })
      })
      .catch((error) => {
        if (!active || error.name === 'AbortError') return
        setState({ loading: false, data: null, error })
        if (error.status === 401) sessionExpiredRef.current?.()
      })
    return () => {
      active = false
      controller.abort()
    }
  }, [category, month, refreshKey])

  return state
}

export function useMaturityRecords(teamId, month, onSessionExpired, enabled = true) {
  const [state, setState] = useState({ loading: false, records: [], previousRecords: [], error: null })
  const sessionExpiredRef = useRef(onSessionExpired)
  sessionExpiredRef.current = onSessionExpired

  useEffect(() => {
    if (!enabled || !teamId || !month) {
      setState({ loading: false, records: [], previousRecords: [], error: null })
      return undefined
    }

    const controller = new AbortController()
    let active = true
    const previousMonth = previousMonthId(month)
    setState({ loading: true, records: [], previousRecords: [], error: null })
    Promise.all([
      fetchJson(maturityRecordsUrl(teamId, month), { signal: controller.signal }),
      previousMonth
        ? fetchJson(maturityRecordsUrl(teamId, previousMonth), { signal: controller.signal })
        : Promise.resolve([]),
    ])
      .then(([records, previousRecords]) => {
        if (active) setState({ loading: false, records, previousRecords, error: null })
      })
      .catch((error) => {
        if (!active || error.name === 'AbortError') return
        setState({ loading: false, records: [], previousRecords: [], error })
        if (error.status === 401) sessionExpiredRef.current?.()
      })
    return () => {
      active = false
      controller.abort()
    }
  }, [enabled, month, teamId])

  return state
}

export function maturitySavePayload(entries) {
  return {
    entries: entries.map((entry) => ({
      activity_id: Number(entry.activity_id),
      score: entry.score === null || entry.score === undefined || entry.score === ''
        ? null
        : String(entry.score),
      note: entry.note || null,
    })),
  }
}
