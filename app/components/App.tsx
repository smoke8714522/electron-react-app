import { useState, type FormEvent } from 'react'
import '../styles/app.css'
import { useItems, type Item } from '../hooks/useItems'

// Helper function to format file size
function formatBytes(bytes: number, decimals = 2): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

export default function App() {
  const { items, loading, error, importFile, updateItem, deleteItem } = useItems()
  const [currentItem, setCurrentItem] = useState<Item | null>(null)
  const [editName, setEditName] = useState('')
  const [editDescription, setEditDescription] = useState('')

  const handleEditSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!currentItem || !editName) return // Basic validation

    await updateItem({ id: currentItem.id, name: editName, description: editDescription })
    
    // Reset form
    setCurrentItem(null)
    setEditName('')
    setEditDescription('')
  }

  const handleEditClick = (item: Item) => {
    setCurrentItem(item)
    setEditName(item.name)
    setEditDescription(item.description)
  }

  const handleCancelEdit = () => {
    setCurrentItem(null)
    setEditName('')
    setEditDescription('')
  }

  const handleDelete = async (id: number) => {
    if (window.confirm('Are you sure you want to delete this file and its metadata?')) {
      await deleteItem(id)
      // If deleting the item currently being edited, reset form
      if (currentItem && currentItem.id === id) {
        handleCancelEdit()
      }
    }
  }

  return (
    <div className="container mx-auto p-4 bg-gray-900 text-white min-h-screen">
      <h1 className="text-2xl font-bold mb-4">File Vault</h1>

      <div className="mb-6">
        <button
          onClick={importFile}
          disabled={loading}
          className="px-4 py-2 bg-green-600 hover:bg-green-700 rounded text-white font-medium transition-colors duration-150 disabled:opacity-50"
        >
          {loading ? 'Importing...' : 'Import File'}
        </button>
      </div>

      {currentItem && (
        <form onSubmit={handleEditSubmit} className="mb-6 p-4 bg-gray-800 rounded shadow">
          <h2 className="text-xl mb-3">Edit Metadata for: {currentItem.filePath}</h2>
          <div className="mb-3">
            <label htmlFor="edit-name" className="block mb-1 text-sm font-medium">
              Name:
            </label>
            <input
              id="edit-name"
              type="text"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              required
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded focus:outline-none focus:border-blue-500"
            />
          </div>
          <div className="mb-4">
            <label htmlFor="edit-description" className="block mb-1 text-sm font-medium">
              Description:
            </label>
            <textarea
              id="edit-description"
              value={editDescription}
              onChange={(e) => setEditDescription(e.target.value)}
              rows={3}
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded focus:outline-none focus:border-blue-500"
            />
          </div>
          <div className="flex gap-2">
            <button
              type="submit"
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded text-white font-medium transition-colors duration-150"
            >
              Update Metadata
            </button>
            <button
              type="button"
              onClick={handleCancelEdit}
              className="px-4 py-2 bg-gray-600 hover:bg-gray-700 rounded text-white font-medium transition-colors duration-150"
            >
              Cancel Edit
            </button>
          </div>
        </form>
      )}

      <h2 className="text-xl mb-3">Vaulted Files</h2>
      {loading && items.length === 0 && <p>Loading files...</p>}
      {error && <p className="text-red-500">Error: {error}</p>}
      {!loading && items.length === 0 && (
          <p className="text-gray-400">No files found. Click 'Import File' to add one.</p>
      )}
      {items.length > 0 && (
        <ul className="space-y-3">
          {items.map((item) => (
            <li
              key={item.id}
              className="flex items-center justify-between p-3 bg-gray-800 rounded shadow"
            >
              <div className="flex-grow mr-4 overflow-hidden">
                <p className="font-semibold truncate" title={item.name}>{item.name}</p>
                <p className="text-sm text-gray-400 truncate" title={item.description || 'No description'}>{item.description || 'No description'}</p>
                <p className="text-xs text-gray-500 mt-1">Path: {item.filePath}</p>
                <p className="text-xs text-gray-500">Type: {item.mimeType} | Size: {formatBytes(item.size)}</p>
              </div>
              <div className="flex-shrink-0 flex gap-2">
                <button
                  onClick={() => handleEditClick(item)}
                  disabled={currentItem?.id === item.id}
                  className="px-3 py-1 bg-yellow-600 hover:bg-yellow-700 rounded text-white text-sm font-medium transition-colors duration-150 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Edit Meta
                </button>
                <button
                  onClick={() => handleDelete(item.id)}
                  className="px-3 py-1 bg-red-600 hover:bg-red-700 rounded text-white text-sm font-medium transition-colors duration-150"
                >
                  Delete
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
