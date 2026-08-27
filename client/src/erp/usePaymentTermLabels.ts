import { useEffect, useState } from 'react'
import * as api from '../lib/api'

export function usePaymentTermLabels() {
  const [labels, setLabels] = useState<string[]>([])

  useEffect(() => {
    api
      .getPaymentTermLabels()
      .then(({ labels }) => setLabels(labels))
      .catch(() => setLabels([]))
  }, [])

  return labels
}
