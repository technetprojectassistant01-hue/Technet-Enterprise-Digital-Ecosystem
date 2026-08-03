import { useEffect, useState } from 'react'
import * as api from '../lib/api'
import type { Asset } from '../lib/api'

export function useAssets() {
  const [assets, setAssets] = useState<Asset[]>([])

  useEffect(() => {
    api.listAssets().then(({ assets }) => setAssets(assets))
  }, [])

  return assets
}
