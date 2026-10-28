/**
 * Compatibility aliases for the former IR-only KPI data module.
 *
 * The dashboard now aggregates requirement activities independently. New code
 * should import from `./requirementKpiData.js`; these aliases keep the old
 * exports working while callers migrate.
 */
import { useRequirementOverviewMetrics } from './requirementKpiData.js'

export {
  REQUIREMENT_KPIS as IR_OVERVIEW_KPIS,
  buildRequirementKpiData as buildIROverviewMetricData,
  requirementCoverageBreakdown as irCoverageBreakdown,
  requirementKpiSummary as irOverviewMetricSummary,
} from './requirementKpiData.js'

export function useIROverviewMetrics(fromMonth, toMonth, versionId, onSessionExpired) {
  return useRequirementOverviewMetrics(fromMonth, toMonth, versionId, 'design', 'all', onSessionExpired)
}
