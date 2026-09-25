import { useEffect, useRef, useState } from 'react'

import { fetchJson } from '../api'
import { queryForActivity, trimToAnalysisWindow, trimToRecentPeriods } from './overviewLogic'

export function metricRequests(catalog, filter) {
  return catalog.flatMap((activity) => activity.metrics.map((metric) => ({ activity, metric })))
    .map(({ activity, metric }) => {
      const query = queryForActivity(activity, filter)
      const params = new URLSearchParams({
        metric_id: String(metric.id),
        dim: query.dimension,
        gran: query.granularity,
      })
      if (query.versionId && query.versionId !== 'all') params.set('version_id', String(query.versionId))
      return { activity, metric, url: `/api/compute?${params.toString()}`, fallback: query.fallback }
    })
}

export function normalizeFactPresence(data) {
  return {
    ...data,
    series: (data?.series ?? []).map((series) => ({
      ...series,
      values: (series.values ?? []).map((point) => point.fact_count === 0
        ? { ...point, value: null, numerator: null, denominator: null, estimated: null, actual: null }
        : point),
    })),
  }
}

export function useComputedMetrics(catalog, filter, onSessionExpired) {
  const [state, setState] = useState({ loading: true, data: {}, errors: {} })
  const sessionExpiredRef = useRef(onSessionExpired)
  sessionExpiredRef.current = onSessionExpired

  useEffect(() => {
    if (!catalog) return undefined

    const controller = new AbortController()
    let active = true
    const requests = metricRequests(catalog, filter)
    setState({ loading: true, data: {}, errors: {} })

    Promise.allSettled(
      requests.map(async (request) => {
        const response = normalizeFactPresence(await fetchJson(request.url, { signal: controller.signal }))
        return {
          metricId: request.metric.id,
          data: filter.windowLimit
            ? trimToAnalysisWindow(response, { month: filter.analysisMonth, limit: filter.windowLimit })
            : request.fallback ? trimToRecentPeriods(response, 6) : response,
        }
      }),
    ).then((results) => {
      if (!active) return

      const data = {}
      const errors = {}
      let sessionExpired = false
      results.forEach((result, index) => {
        const request = requests[index]
        if (result.status === 'fulfilled') {
          data[result.value.metricId] = result.value.data
        } else if (result.reason?.name !== 'AbortError') {
          errors[request.metric.id] = result.reason
          if (result.reason?.status === 401 && !sessionExpired) {
            sessionExpired = true
            sessionExpiredRef.current()
          }
        }
      })
      setState({ loading: false, data, errors })
    })

    return () => {
      active = false
      controller.abort()
    }
  }, [catalog, filter.analysisMonth, filter.dimension, filter.granularity, filter.versionId, filter.windowLimit])

  return state
}

export function hasNumericValues(data) {
  return (data?.series ?? []).some((series) => (
    (series.values ?? []).some((point) => typeof point.value === 'number')
  )) || (data?.company_average ?? []).some((point) => typeof point.value === 'number')
}
