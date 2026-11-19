import gruppo from '../assets/welcome/gruppo.webp'
import picnic from '../assets/welcome/picnic.webp'
import selfie from '../assets/welcome/selfie.webp'
import './Welcome.css'

type Props = { onContinue: () => void }

export default function Welcome({ onContinue }: Props) {
  return (
    <div className="screen welcome">
      <div className="welcome__stack" aria-hidden="true">
        <img className="welcome__card welcome__card--left" src={selfie} alt="" />
        <img className="welcome__card welcome__card--right" src={picnic} alt="" />
        <img className="welcome__card welcome__card--front" src={gruppo} alt="" />
      </div>

      <div className="welcome__text">
        <h1 className="welcome__title">
          Benvenuto
          <br />
          alla mia <strong>laurea!</strong>
        </h1>
        <p className="welcome__subtitle">Ogni scatto conta: carica i tuoi e rivivi la giornata con me.</p>
      </div>

      <button className="cta welcome__cta" type="button" onClick={onContinue}>
        Continua
        <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
          <path d="M6 3.5 10.5 8 6 12.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
    </div>
  )
}
