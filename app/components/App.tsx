import React, { useState, type FormEvent } from 'react'
import '../styles/app.css'
import { useAssets, type Asset, type UpdateAssetPayload, AssetWithThumbnail, BulkImportResult, FetchFilters, FetchSort, BulkUpdatePayload, BatchUpdateResult } from '../hooks/useAssets'
import LibraryView from './LibraryView'
import { DndProvider } from 'react-dnd'
import { HTML5Backend } from 'react-dnd-html5-backend'

// Re-add a simple placeholder DashboardView component
const DashboardView = () => (
  <div className="p-4 text-center">
    <h2 className="text-xl">Dashboard</h2>
    <p className="text-gray-400">This view is currently under construction.</p>
  </div>
);

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

function App(): JSX.Element {
  const [activeView, setActiveView] = useState('library');

  // Re-instate the useAssets hook here to provide props
  const assetsHook = useAssets();

  return (
    <DndProvider backend={HTML5Backend}>
      <div className="flex flex-col h-full w-full bg-gray-900 text-white min-h-0">
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

        <main className="flex flex-col flex-grow min-h-0 overflow-hidden">
          {activeView === 'dashboard' && <DashboardView />}
          {activeView === 'library' && 
            <LibraryView 
              {...assetsHook}
            />
          }
        </main>
      </div>
    </DndProvider>
  )
}

export default App
