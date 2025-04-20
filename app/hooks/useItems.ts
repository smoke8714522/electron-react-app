import { useState, useEffect, useCallback } from 'react'

// Define the Item type in the renderer as well
// Ideally, this would be shared, but for simplicity, we define it here.
export interface Item {
  id: number
  name: string
  description: string
}

// Augment the Window interface to include the exposed API
declare global {
  interface Window {
    // Define the 'api' object exposed by the preload script
    api: {
      invoke: (channel: string, ...args: any[]) => Promise<any>;
      // Add other methods if you expose them (send, receive, removeAllListeners)
      // send: (channel: string, ...args: any[]) => void;
      // receive: (channel: string, func: (...args: any[]) => void) => void;
      // removeAllListeners: (channel: string) => void;
    }
  }
}

export function useItems() {
  const [items, setItems] = useState<Item[]>([])
  const [loading, setLoading] = useState<boolean>(true)
  const [error, setError] = useState<string | null>(null)

  const fetchItems = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      // Use window.api.invoke
      const fetchedItems = await window.api.invoke('get-items')
      setItems(fetchedItems || []) // Ensure items is always an array
    } catch (err) {
      console.error('Failed to fetch items:', err)
      setError('Failed to fetch items.')
      setItems([]) // Clear items on error
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    fetchItems()
  }, [fetchItems])

  const createItem = useCallback(
    async (newItemData: { name: string; description: string }) => {
      try {
        // Use window.api.invoke
        const newItem = await window.api.invoke('create-item', newItemData)
        if (newItem) {
          setItems((prevItems) => [...prevItems, newItem])
          return newItem // Return the created item on success
        } else {
          throw new Error('Failed to create item on backend.')
        }
      } catch (err) {
        console.error('Failed to create item:', err)
        setError('Failed to create item.')
        return null // Indicate failure
      }
    },
    []
  )

  const updateItem = useCallback(async (updatedItem: Item) => {
    try {
      // Use window.api.invoke
      const success = await window.api.invoke('update-item', updatedItem)
      if (success) {
        setItems((prevItems) =>
          prevItems.map((item) => (item.id === updatedItem.id ? updatedItem : item))
        )
        return true // Indicate success
      } else {
        throw new Error('Failed to update item on backend.')
      }
    } catch (err) {
      console.error('Failed to update item:', err)
      setError('Failed to update item.')
      return false // Indicate failure
    }
  }, [])

  const deleteItem = useCallback(async (id: number) => {
    try {
      // Use window.api.invoke
      const success = await window.api.invoke('delete-item', id)
      if (success) {
        setItems((prevItems) => prevItems.filter((item) => item.id !== id))
        return true // Indicate success
      } else {
        throw new Error('Failed to delete item on backend.')
      }
    } catch (err) {
      console.error('Failed to delete item:', err)
      setError('Failed to delete item.')
      return false // Indicate failure
    }
  }, [])

  return { items, loading, error, fetchItems, createItem, updateItem, deleteItem }
} 