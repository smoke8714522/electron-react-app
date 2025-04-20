import { useState, type FormEvent } from 'react'
import '../styles/app.css'
import { useItems, type Item } from '../hooks/useItems'

export default function App() {
  const { items, loading, error, createItem, updateItem, deleteItem } = useItems()
  const [currentItem, setCurrentItem] = useState<Item | null>(null)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!name) return // Basic validation

    if (currentItem) {
      // Update existing item
      await updateItem({ ...currentItem, name, description })
    } else {
      // Create new item
      await createItem({ name, description })
    }
    // Reset form
    setCurrentItem(null)
    setName('')
    setDescription('')
  }

  const handleEdit = (item: Item) => {
    setCurrentItem(item)
    setName(item.name)
    setDescription(item.description)
  }

  const handleCancelEdit = () => {
    setCurrentItem(null)
    setName('')
    setDescription('')
  }

  const handleDelete = async (id: number) => {
    if (window.confirm('Are you sure you want to delete this item?')) {
      await deleteItem(id)
      // If deleting the item currently being edited, reset form
      if (currentItem && currentItem.id === id) {
        handleCancelEdit()
      }
    }
  }

  return (
    <div className="container mx-auto p-4 bg-gray-900 text-white min-h-screen">
      <h1 className="text-2xl font-bold mb-4">Minimal CRUD App</h1>

      <form onSubmit={handleSubmit} className="mb-6 p-4 bg-gray-800 rounded shadow">
        <h2 className="text-xl mb-3">{currentItem ? 'Edit Item' : 'Add Item'}</h2>
        <div className="mb-3">
          <label htmlFor="name" className="block mb-1 text-sm font-medium">
            Name:
          </label>
          <input
            id="name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded focus:outline-none focus:border-blue-500"
          />
        </div>
        <div className="mb-4">
          <label htmlFor="description" className="block mb-1 text-sm font-medium">
            Description:
          </label>
          <textarea
            id="description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded focus:outline-none focus:border-blue-500"
          />
        </div>
        <div className="flex gap-2">
          <button
            type="submit"
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded text-white font-medium transition-colors duration-150"
          >
            {currentItem ? 'Update Item' : 'Add Item'}
          </button>
          {currentItem && (
            <button
              type="button"
              onClick={handleCancelEdit}
              className="px-4 py-2 bg-gray-600 hover:bg-gray-700 rounded text-white font-medium transition-colors duration-150"
            >
              Cancel Edit
            </button>
          )}
        </div>
      </form>

      <h2 className="text-xl mb-3">Items List</h2>
      {loading && <p>Loading items...</p>}
      {error && <p className="text-red-500">Error: {error}</p>}
      {!loading && !error && (
        <ul className="space-y-3">
          {items.length === 0 ? (
            <li className="text-gray-400">No items found.</li>
          ) : (
            items.map((item) => (
              <li
                key={item.id}
                className="flex items-center justify-between p-3 bg-gray-800 rounded shadow"
              >
                <div>
                  <p className="font-semibold">{item.name}</p>
                  <p className="text-sm text-gray-400">{item.description}</p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleEdit(item)}
                    className="px-3 py-1 bg-yellow-600 hover:bg-yellow-700 rounded text-white text-sm font-medium transition-colors duration-150"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleDelete(item.id)}
                    className="px-3 py-1 bg-red-600 hover:bg-red-700 rounded text-white text-sm font-medium transition-colors duration-150"
                  >
                    Delete
                  </button>
                </div>
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  )
}
