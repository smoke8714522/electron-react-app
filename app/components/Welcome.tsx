import { useState } from 'react'
import EraShape from './shape'
import { motion, AnimatePresence } from 'framer-motion'
import CodeWindowIcon from './CodeWindowIcon'
import FanIcon from './FanIcon'
import ColorSchemeIcon from './ColorSchemeIcon'
import AsterikIcon from './AsterikIcon'

export default function Welcome() {
  const [activePath, setActivePath] = useState<number>(5)

  const handlePathHover = (index: number) => {
    setActivePath(index)
  }

  const handlePathReset = () => {
    setActivePath(5)
  }

  const content = () => {
    switch (activePath) {
      case 0:
        return <ElectronContent />
      case 1:
        return <ReactContent />
      case 2:
        return <ViteContent />
      case 3:
        return <TypescriptContent />
      case 4:
        return <TailwindContent />
      case 5:
        return <EraContent />
      default:
        return <EraContent />
    }
  }

  return (
    <div className="welcome-content">
      <AnimatePresence mode="wait">
        <motion.div
          key={'content-' + activePath}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{
            duration: 0.2,
            ease: 'easeInOut',
          }}
        >
          {content()}
        </motion.div>
      </AnimatePresence>
      <EraShape onPathHover={handlePathHover} onPathReset={handlePathReset} />
    </div>
  )
}

const ContentStep = ({
  title,
  description,
  icon: Icon,
}: {
  title: string
  description: string
  icon: React.ComponentType
}) => {
  return (
    <div className="welcome-content-step">
      <Icon />
      <div>
        <h3>{title}</h3>
        <p>{description}</p>
      </div>
    </div>
  )
}

const EraContent = () => {
  return (
    <div>
      <h2>Electron React App</h2>
      <p>
        Nobis minus voluptatibus pariatur dignissimos libero quaerat iure expedita at? Asperiores nemo possimus nesciunt
        dicta veniam aspernatur quam mollitia.
      </p>
      <p>
        Vitae error, quaerat officia delectus voluptatibus explicabo quo pariatur impedit, at reprehenderit aliquam a
        ipsum quas voluptatem. Quo pariatur asperiores eum amet.
      </p>

      <div className="welcome-content-steps">
        <ContentStep
          title="Custom Window Titlebar & Menus"
          description="Customize the look and feel of the application window"
          icon={CodeWindowIcon}
        />

        <ContentStep
          title="Fast & Hot Reload"
          description="Make changes to your code and see the changes instantly"
          icon={FanIcon}
        />

        <ContentStep
          title="Dark & Light Mode"
          description="Switch between dark and light mode with a click of a button"
          icon={ColorSchemeIcon}
        />

        <ContentStep
          title="Improved Project Structure"
          description="Organized project with a better folder structure to get you started"
          icon={AsterikIcon}
        />
      </div>
    </div>
  )
}

const ElectronContent = () => {
  return (
    <div>
      <h2>Electron v20.0</h2>
      <p>
        Nobis minus voluptatibus pariatur dignissimos libero quaerat iure expedita at? Asperiores nemo possimus nesciunt
        dicta veniam aspernatur quam mollitia.
      </p>
      <p>
        Vitae error, quaerat officia delectus voluptatibus explicabo quo pariatur impedit, at reprehenderit aliquam a
        ipsum quas voluptatem. Quo pariatur asperiores eum amet.
      </p>
    </div>
  )
}

const ReactContent = () => {
  return (
    <div>
      <h2>React Application</h2>
      <p>
        Nobis minus voluptatibus pariatur dignissimos libero quaerat iure expedita at? Asperiores nemo possimus nesciunt
        dicta veniam aspernatur quam mollitia.
      </p>
      <p>
        Vitae error, quaerat officia delectus voluptatibus explicabo quo pariatur impedit, at reprehenderit aliquam a
        ipsum quas voluptatem. Quo pariatur asperiores eum amet.
      </p>
    </div>
  )
}

const ViteContent = () => {
  return (
    <div>
      <h2>ViteJS Application</h2>
      <p>
        Nobis minus voluptatibus pariatur dignissimos libero quaerat iure expedita at? Asperiores nemo possimus nesciunt
        dicta veniam aspernatur quam mollitia.
      </p>
      <p>
        Vitae error, quaerat officia delectus voluptatibus explicabo quo pariatur impedit, at reprehenderit aliquam a
        ipsum quas voluptatem. Quo pariatur asperiores eum amet.
      </p>
    </div>
  )
}

const TypescriptContent = () => {
  return (
    <div>
      <h2>Typescript</h2>
      <p>
        Nobis minus voluptatibus pariatur dignissimos libero quaerat iure expedita at? Asperiores nemo possimus nesciunt
        dicta veniam aspernatur quam mollitia.
      </p>
      <p>
        Vitae error, quaerat officia delectus voluptatibus explicabo quo pariatur impedit, at reprehenderit aliquam a
        ipsum quas voluptatem. Quo pariatur asperiores eum amet.
      </p>
    </div>
  )
}

const TailwindContent = () => {
  return (
    <div>
      <h2>Tailwind</h2>
      <p>
        Nobis minus voluptatibus pariatur dignissimos libero quaerat iure expedita at? Asperiores nemo possimus nesciunt
        dicta veniam aspernatur quam mollitia.
      </p>
      <p>
        Vitae error, quaerat officia delectus voluptatibus explicabo quo pariatur impedit, at reprehenderit aliquam a
        ipsum quas voluptatem. Quo pariatur asperiores eum amet.
      </p>
    </div>
  )
}
