import { useEffect, useRef, useState } from 'react'

import { fetchJson } from '../api'
import { monthWindow, previousMonthId } from './overviewLogic'

export function maturityOverviewUrl(month, category) {
  const params = new URLSearchParams({ month: String(month), kind: String(category) })
  return `/api/maturity/overview?${params.toString()}`
}

export function maturityRecordsUrl(teamId, month) {
  const params = new URLSearchParams({ team_id: String(teamId), month: String(month) })
  return `/api/maturity/records?${params.toString()}`
}

export function useMaturityOverview(month, category, onSessionExpired, enabled = true) {
  const [state, setState] = useState({ loading: true, data: null, history: [], error: null })
  const sessionExpiredRef = useRef(onSessionExpired)
  sessionExpiredRef.current = onSessionExpired

  useEffect(() => {
    if (!enabled) {
      setState({ loading: false, data: null, history: [], error: null })
      return undefined
    }

    const controller = new AbortController()
    let active = true
    const months = monthWindow(month, 6)
    setState({ loading: true, data: null, history: [], error: null })
    Promise.all(months.map((assessmentMonth) => fetchJson(maturityOverviewUrl(assessmentMonth, category), { signal: controller.signal })))
      .then((responses) => {
        if (active) setState({
          loading: false,
          data: responses.at(-1) ?? null,
          history: responses.map((data, index) => ({ month: months[index], data })),
          error: null,
        })
      })
      .catch((error) => {
        if (!active || error.name === 'AbortError') return
        setState({ loading: false, data: null, history: [], error })
        if (error.status === 401) sessionExpiredRef.current?.()
      })
    return () => {
      active = false
      controller.abort()
    }
  }, [category, enabled, month])

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
