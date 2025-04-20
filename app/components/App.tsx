import { useState, type FormEvent } from 'react'
import '../styles/app.css'
import { useAssets, type Asset, type UpdateAssetPayload, AssetWithThumbnail } from '../hooks/useAssets'
import LibraryView from './LibraryView'

// Helper function to format file size
function formatBytes(bytes: number, decimals = 2): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

// Helper function to format date string
function formatDate(dateString: string): string {
  try {
    return new Date(dateString).toLocaleString();
  } catch (e) {
    return 'Invalid Date';
  }
}

export default function App() {
  const [activeView, setActiveView] = useState<'dashboard' | 'library'>('library')
  const { assets, loading, error, createAsset, updateAsset, deleteAsset, bulkImportAssets, fetchAssets, bulkUpdateAssets } = useAssets()
  const [currentAsset, setCurrentAsset] = useState<Asset | null>(null)
  const [editFileName, setEditFileName] = useState('')
  const [editYear, setEditYear] = useState<string>('')
  const [editAdvertiser, setEditAdvertiser] = useState('')
  const [editNiche, setEditNiche] = useState('')
  const [editShares, setEditShares] = useState<string>('')

  const handleEditSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!currentAsset) return

    const payload: UpdateAssetPayload = {
      id: currentAsset.id,
      updates: {
        fileName: editFileName || currentAsset.fileName,
        year: editYear === '' ? null : parseInt(editYear, 10),
        advertiser: editAdvertiser || null,
        niche: editNiche || null,
        shares: editShares === '' ? null : parseInt(editShares, 10),
      }
    };

    await updateAsset(payload)
    
    handleCancelEdit()
  }

  const handleEditClick = (asset: Asset) => {
    setCurrentAsset(asset)
    setEditFileName(asset.fileName)
    setEditYear(asset.year?.toString() || '')
    setEditAdvertiser(asset.advertiser || '')
    setEditNiche(asset.niche || '')
    setEditShares(asset.shares?.toString() || '')
  }

  const handleCancelEdit = () => {
    setCurrentAsset(null)
    setEditFileName('')
    setEditYear('')
    setEditAdvertiser('')
    setEditNiche('')
    setEditShares('')
  }

  const handleDelete = async (id: number) => {
    if (window.confirm('Are you sure you want to delete this asset and its file?')) {
      await deleteAsset(id)
      if (currentAsset && currentAsset.id === id) {
        handleCancelEdit()
      }
    }
  }

  // Component for the original Dashboard view content
  const DashboardView = () => (
    <div className="p-4">
      <div className="mb-6">
        <button
          onClick={createAsset}
          disabled={loading}
          className="px-4 py-2 bg-green-600 hover:bg-green-700 rounded text-white font-medium transition-colors duration-150 disabled:opacity-50"
        >
          {loading ? 'Processing...' : 'Import Asset'}
        </button>
      </div>

      {currentAsset && (
        <form onSubmit={handleEditSubmit} className="mb-6 p-4 bg-gray-800 rounded shadow">
          <h2 className="text-xl mb-3">Edit Metadata for: {currentAsset.filePath}</h2>
          <div className="mb-3">
            <label htmlFor="edit-fileName" className="block mb-1 text-sm font-medium">File Name:</label>
            <input
              id="edit-fileName"
              type="text"
              value={editFileName}
              onChange={(e) => setEditFileName(e.target.value)}
              required
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded focus:outline-none focus:border-blue-500"
            />
          </div>
          <div className="mb-3">
            <label htmlFor="edit-year" className="block mb-1 text-sm font-medium">Year:</label>
            <input
              id="edit-year"
              type="number"
              value={editYear}
              onChange={(e) => setEditYear(e.target.value)}
              placeholder="e.g., 2023"
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded focus:outline-none focus:border-blue-500"
            />
          </div>
          <div className="mb-3">
            <label htmlFor="edit-advertiser" className="block mb-1 text-sm font-medium">Advertiser:</label>
            <input
              id="edit-advertiser"
              type="text"
              value={editAdvertiser}
              onChange={(e) => setEditAdvertiser(e.target.value)}
              placeholder="e.g., Client Name"
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded focus:outline-none focus:border-blue-500"
            />
          </div>
          <div className="mb-3">
            <label htmlFor="edit-niche" className="block mb-1 text-sm font-medium">Niche:</label>
            <input
              id="edit-niche"
              type="text"
              value={editNiche}
              onChange={(e) => setEditNiche(e.target.value)}
              placeholder="e.g., E-commerce"
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded focus:outline-none focus:border-blue-500"
            />
          </div>
          <div className="mb-4">
            <label htmlFor="edit-shares" className="block mb-1 text-sm font-medium">Shares:</label>
            <input
              id="edit-shares"
              type="number"
              min="0"
              value={editShares}
              onChange={(e) => setEditShares(e.target.value)}
              placeholder="e.g., 100"
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded focus:outline-none focus:border-blue-500"
            />
          </div>
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded text-white font-medium transition-colors duration-150 disabled:opacity-50"
            >
              {loading ? 'Updating...' : 'Update Metadata'}
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

      <h2 className="text-xl mb-3">Vaulted Assets (Dashboard View)</h2>
      {loading && assets.length === 0 && <p>Loading assets...</p>}
      {error && <p className="text-red-500">Error: {error}</p>}
      {!loading && assets.length === 0 && (
          <p className="text-gray-400">No assets found. Click 'Import Asset' to add one.</p>
      )}
      {assets.length > 0 && (
        <ul className="space-y-3">
          {assets.map((asset) => (
            <li
              key={asset.id}
              className="p-3 bg-gray-800 rounded shadow flex flex-col sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="flex-grow mb-3 sm:mb-0 sm:mr-4 overflow-hidden">
                <p className="font-semibold truncate text-lg" title={asset.fileName}>{asset.fileName}</p>
                <div className="text-xs text-gray-400 mt-1 space-y-0.5">
                  <p>Path: <span className="text-gray-300">{asset.filePath}</span></p>
                  <p>Type: <span className="text-gray-300">{asset.mimeType}</span> | Size: <span className="text-gray-300">{formatBytes(asset.size)}</span></p>
                  <p>Created: <span className="text-gray-300">{formatDate(asset.createdAt)}</span></p>
                  {asset.year && <p>Year: <span className="text-gray-300">{asset.year}</span></p>}
                  {asset.advertiser && <p>Advertiser: <span className="text-gray-300">{asset.advertiser}</span></p>}
                  {asset.niche && <p>Niche: <span className="text-gray-300">{asset.niche}</span></p>}
                  {asset.shares !== null && asset.shares !== undefined && <p>Shares: <span className="text-gray-300">{asset.shares}</span></p>}
                </div>
              </div>
              <div className="flex-shrink-0 flex gap-2 self-end sm:self-center">
                <button
                  onClick={() => handleEditClick(asset as Asset)}
                  disabled={currentAsset?.id === asset.id || loading}
                  className="px-3 py-1 bg-yellow-600 hover:bg-yellow-700 rounded text-white text-sm font-medium transition-colors duration-150 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Edit Meta
                </button>
                <button
                  onClick={() => handleDelete(asset.id)}
                  disabled={loading}
                  className="px-3 py-1 bg-red-600 hover:bg-red-700 rounded text-white text-sm font-medium transition-colors duration-150 disabled:opacity-50"
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

  return (
    <div className="flex flex-col h-screen w-screen bg-gray-900 text-white overflow-hidden">
      <nav className="bg-gray-800 shadow-md flex-shrink-0">
        <div className="w-full px-4 py-2 flex items-center justify-between">
          <h1 className="text-lg font-bold">Ad Vault</h1>
          <div className="space-x-4">
            <button
              onClick={() => setActiveView('dashboard')}
              className={`px-3 py-1 rounded transition-colors duration-150 ${activeView === 'dashboard' ? 'bg-blue-600 text-white' : 'text-gray-300 hover:bg-gray-700 hover:text-white'}`}
            >
              Dashboard
            </button>
            <button
              onClick={() => setActiveView('library')}
              className={`px-3 py-1 rounded transition-colors duration-150 ${activeView === 'library' ? 'bg-blue-600 text-white' : 'text-gray-300 hover:bg-gray-700 hover:text-white'}`}
            >
              Library
            </button>
          </div>
        </div>
      </nav>

      <main className="flex-grow">
        {activeView === 'dashboard' && <DashboardView />}
        {activeView === 'library' && 
          <LibraryView 
            assets={assets as AssetWithThumbnail[]}
            loading={loading}
            error={error}
            bulkImportAssets={bulkImportAssets}
            fetchAssets={fetchAssets}
            deleteAsset={deleteAsset}
            updateAsset={updateAsset}
            bulkUpdateAssets={bulkUpdateAssets}
          />
        }
      </main>
    </div>
  )
}
