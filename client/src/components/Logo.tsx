import logoIcon from '../assets/logo-icon.png'

interface LogoProps {
  size?: 'sm' | 'lg'
  stacked?: boolean
  className?: string
}

const SIZES = {
  sm: { icon: 'h-8 w-8', tech: 'text-lg', eng: 'text-[9px]' },
  lg: { icon: 'h-16 w-16', tech: 'text-2xl', eng: 'text-xs' },
}

function Logo({ size = 'sm', stacked = false, className = '' }: LogoProps) {
  const s = SIZES[size]

  return (
    <div
      className={`flex items-center gap-3 ${stacked ? 'flex-col text-center' : ''} ${className}`}
    >
      <img src={logoIcon} alt="" className={`${s.icon} object-contain`} />
      <div className={stacked ? 'flex flex-col items-center' : 'flex flex-col leading-none'}>
        <span className={`font-bold tracking-wide text-ink-100 ${s.tech}`}>TECHNET</span>
        <span className={`font-semibold tracking-[0.3em] text-cyan-accent ${s.eng}`}>
          ENGINEERING
        </span>
      </div>
    </div>
  )
}

export default Logo
