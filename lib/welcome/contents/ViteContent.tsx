import React from 'react'
import ContentStep from '../ContentStep'
import AsterikIcon from '../icons/AsterikIcon'

const ViteContent = () => {
  return (
    <div>
      <h2>Vite</h2>
      <p>
        A next-generation frontend build tool that significantly improves the development experience. With Vite, you get
        instant server start, lightning-fast HMR, and optimized builds out of the box.
      </p>
      <p>
        Vite serves your code via native ES modules, allowing for lightning-fast hot module replacement (HMR) and an
        instant development server startup.
      </p>

      <div className="welcome-content-steps">
        <ContentStep
          title="Lightning Fast HMR"
          description="Hot Module Replacement that stays fast regardless of app size"
          icon={AsterikIcon}
        />

        <ContentStep
          title="Optimized Build"
          description="Rollup-powered bundling with multi-page and library mode support"
          icon={AsterikIcon}
        />

        <ContentStep
          title="Universal Plugins"
          description="Extensive plugin system shared between dev and build"
          icon={AsterikIcon}
        />

        <ContentStep
          title="Zero Config"
          description="Sensible defaults work out of the box for most projects"
          icon={AsterikIcon}
        />
      </div>
    </div>
  )
}

export default ViteContent
