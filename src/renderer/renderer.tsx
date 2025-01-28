import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './app';
import { WindowContextProvider } from '@guasam/electron-react-app';
import '@guasam/electron-react-app/styles.css';
import './styles/app.css';
import appIcon from '@/renderer/assets/appIcon2.png';

ReactDOM.createRoot(document.getElementById('app') as HTMLElement).render(
  <React.StrictMode>
    <WindowContextProvider titlebar={{ title: 'Electron React App', iconUrl: appIcon }}>
      <App />
    </WindowContextProvider>
  </React.StrictMode>
);
