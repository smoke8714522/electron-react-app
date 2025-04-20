import { useState, type FormEvent } from 'react'
import '../styles/app.css'
import { useAssets, type Asset, type UpdateAssetPayload } from '../hooks/useAssets'

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
  const { assets, loading, error, createAsset, updateAsset, deleteAsset } = useAssets()
  const [currentAsset, setCurrentAsset] = useState<Asset | null>(null)
  const [editFileName, setEditFileName] = useState('')
  const [editYear, setEditYear] = useState<string>('')
  const [editAdvertiser, setEditAdvertiser] = useState('')
  const [editNiche, setEditNiche] = useState('')
  const [editAdspower, setEditAdspower] = useState('')

  const handleEditSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!currentAsset) return

    const payload: UpdateAssetPayload = {
      id: currentAsset.id,
      updates: {
        fileName: editFileName || currentAsset.fileName,
        year: editYear ? parseInt(editYear, 10) : null,
        advertiser: editAdvertiser || null,
        niche: editNiche || null,
        adspower: editAdspower || null,
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
    setEditAdspower(asset.adspower || '')
  }

  const handleCancelEdit = () => {
    setCurrentAsset(null)
    setEditFileName('')
    setEditYear('')
    setEditAdvertiser('')
    setEditNiche('')
    setEditAdspower('')
  }

  const handleDelete = async (id: number) => {
    if (window.confirm('Are you sure you want to delete this asset and its file?')) {
      await deleteAsset(id)
      if (currentAsset && currentAsset.id === id) {
        handleCancelEdit()
      }
    }
  }

  return (
    <div className="container mx-auto p-4 bg-gray-900 text-white min-h-screen">
      <h1 className="text-2xl font-bold mb-4">Ad Vault</h1>

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
            <label htmlFor="edit-adspower" className="block mb-1 text-sm font-medium">Adspower Profile:</label>
            <input
              id="edit-adspower"
              type="text"
              value={editAdspower}
              onChange={(e) => setEditAdspower(e.target.value)}
              placeholder="e.g., Profile ID or Name"
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

      <h2 className="text-xl mb-3">Vaulted Assets</h2>
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
                  {asset.adspower && <p>Adspower: <span className="text-gray-300">{asset.adspower}</span></p>}
                </div>
              </div>
              <div className="flex-shrink-0 flex gap-2 self-end sm:self-center">
                <button
                  onClick={() => handleEditClick(asset)}
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
}
