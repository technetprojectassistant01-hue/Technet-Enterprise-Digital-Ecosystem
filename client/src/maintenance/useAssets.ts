import { useEffect, useMemo, useState } from 'react'
import * as api from '../lib/api'
import type { Asset } from '../lib/api'

/** Every asset, decommissioned ones included - right for filters and history views. */
export function useAssets() {
  const [assets, setAssets] = useState<Asset[]>([])

  useEffect(() => {
    api.listAssets().then(({ assets }) => setAssets(assets))
  }, [])

  return assets
}

/**
 * Only assets still in service. Use this for pickers that start new work against an asset -
 * raising a maintenance request, or opening a maintenance contract - so a decommissioned unit
 * can't be scheduled for servicing. Same split as useEmployees/useAssignableEmployees.
 */
export function useServiceableAssets() {
  const assets = useAssets()
  return useMemo(() => assets.filter((a) => a.status !== 'DECOMMISSIONED'), [assets])
}
