import { useEffect, useState } from 'react'
import * as api from '../lib/api'
import type { InventoryItem } from '../lib/api'

export function useInventoryItems() {
  const [items, setItems] = useState<InventoryItem[]>([])

  useEffect(() => {
    api.listInventory().then(({ items }) => setItems(items))
  }, [])

  return items
}
