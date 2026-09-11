import { Globe } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { LANGUAGES, isLanguage, useLanguage } from '../i18n'
import { inputClass } from './buttonStyles'

/**
 * Language picker. `compact` sits in the sign-in pages' header; `field` is the full-width select
 * in Settings. Either way the choice applies instantly, is remembered on this device, and — when
 * someone is signed in — saved to their account (AuthContext.changeLanguage).
 */
function LanguageSwitcher({ variant = 'compact' }: { variant?: 'compact' | 'field' }) {
  const { language, t } = useLanguage()
  const { changeLanguage } = useAuth()

  function handleChange(value: string) {
    if (isLanguage(value)) changeLanguage(value)
  }

  if (variant === 'field') {
    return (
      <select
        value={language}
        onChange={(e) => handleChange(e.target.value)}
        aria-label={t.language.label}
        className={inputClass}
      >
        {LANGUAGES.map((l) => (
          <option key={l.code} value={l.code}>
            {l.name}
          </option>
        ))}
      </select>
    )
  }

  return (
    <label className="flex items-center gap-1.5">
      <Globe className="h-4 w-4 shrink-0" />
      <select
        value={language}
        onChange={(e) => handleChange(e.target.value)}
        aria-label={t.language.label}
        className="cursor-pointer bg-transparent text-sm text-ink-200 outline-none hover:text-ink-100"
      >
        {LANGUAGES.map((l) => (
          <option key={l.code} value={l.code} className="bg-ink-900 text-ink-100">
            {l.short}
          </option>
        ))}
      </select>
    </label>
  )
}

export default LanguageSwitcher
