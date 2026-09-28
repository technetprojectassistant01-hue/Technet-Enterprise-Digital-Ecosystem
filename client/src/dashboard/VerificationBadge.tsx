import { Link } from 'react-router-dom'
import type { SiteAttendance } from '../lib/api'
import { verificationState } from '../lib/siteAttendance'
import { Badge } from './ui'
import { useT } from '../i18n'

const TONE = { VERIFIED: 'success', UNVERIFIED: 'neutral', FLAGGED: 'danger' } as const

/**
 * Verified / Unverified / Flagged for one visit on a register (see verificationState). When the
 * visit has any anomalies the badge links to them on the Anomalies page, filtered to this visit.
 */
function VerificationBadge({ visit }: { visit: Pick<SiteAttendance, 'id' | 'workOrder' | 'anomalies' | 'knownPlace'> }) {
  const t = useT()
  const state = verificationState(visit)
  const label = { VERIFIED: t.ops.anomalies.badgeVerified, UNVERIFIED: t.ops.anomalies.badgeUnverified, FLAGGED: t.ops.anomalies.badgeFlagged }[state]
  const hint = {
    VERIFIED: t.ops.anomalies.badgeVerifiedHint,
    UNVERIFIED: t.ops.anomalies.badgeUnverifiedHint,
    FLAGGED: t.ops.anomalies.badgeFlaggedHint,
  }[state]
  // Spec section 2: a check-in that matched a known place shows the place's name as verified.
  const badge = (
    <Badge tone={TONE[state]}>
      {state === 'VERIFIED' && visit.knownPlace ? `${label} · ${visit.knownPlace.name}` : label}
    </Badge>
  )

  if (!visit.anomalies?.length) return <span title={hint}>{badge}</span>
  return (
    <Link to={`/dashboard/operations/anomalies?siteAttendanceId=${visit.id}`} title={hint} className="hover:opacity-80">
      {badge}
    </Link>
  )
}

export default VerificationBadge
