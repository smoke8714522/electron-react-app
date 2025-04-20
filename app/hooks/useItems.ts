import { useState, useEffect, useCallback } from 'react'

// Define the Item type in the renderer as well
// Ideally, this would be shared, but for simplicity, we define it here.
export interface Item {
  id: number
  name: string
  description: string
  filePath: string
  mimeType: string
  size: number
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

  const importFile = useCallback(async () => {
    setError(null); // Clear previous errors
    try {
      // 1. Ask main process to open file dialog
      const sourcePath = await window.api.invoke('open-file-dialog');
      if (!sourcePath) {
        console.log('File selection canceled.');
        return null; // User canceled selection
      }

      // 2. Ask main process to import the selected file
      setLoading(true); // Show loading state during import
      const result = await window.api.invoke('import-file', sourcePath);
      setLoading(false);

      if (result.success && result.item) {
        // Add the new item to the state
        setItems((prevItems) => [...prevItems, result.item]);
        return result.item; // Return the newly added item
      } else {
        console.error('Import failed:', result.error);
        setError(`Import failed: ${result.error}`);
        return null; // Indicate failure
      }
    } catch (err) {
      console.error('Failed to import file:', err);
      setError('Failed to import file.');
      setLoading(false); // Ensure loading state is reset on error
      return null; // Indicate failure
    }
  }, []);

  const updateItem = useCallback(async (itemData: Pick<Item, 'id' | 'name' | 'description'>) => {
    try {
      const success = await window.api.invoke('update-item', itemData);
      if (success) {
        setItems((prevItems) =>
          prevItems.map((item) =>
            item.id === itemData.id ? { ...item, name: itemData.name, description: itemData.description } : item
          )
        );
        return true;
      } else {
        throw new Error('Failed to update item on backend.');
      }
    } catch (err) {
      console.error('Failed to update item:', err);
      setError('Failed to update item.');
      return false;
    }
  }, []);

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

  return { items, loading, error, fetchItems, importFile, updateItem, deleteItem }
} 