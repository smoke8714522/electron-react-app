import ContentStep from '../ContentStep'
import CodeWindowIcon from '../icons/CodeWindowIcon'
import FanIcon from '../icons/FanIcon'
import ColorSchemeIcon from '../icons/ColorSchemeIcon'
import AsterikIcon from '../icons/AsterikIcon'

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

export default EraContent
