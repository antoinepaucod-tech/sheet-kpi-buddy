import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { supabase } from '../lib/supabase'
import { Button } from '../components/ui'

export default function Login() {
  const { t } = useTranslation()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState(false)
  const [loading, setLoading] = useState(false)

  async function submit(e) {
    e.preventDefault()
    setLoading(true)
    setError(false)
    const { error: err } = await supabase.auth.signInWithPassword({ email, password })
    if (err) setError(true)
    setLoading(false)
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-6">
      <span className="font-display text-6xl text-accent">PROFIT OS</span>
      <span className="mb-10 text-sm text-muted">{t('app.tagline')}</span>
      <form onSubmit={submit} className="flex w-full max-w-sm flex-col gap-3">
        <input
          type="email"
          required
          autoComplete="email"
          placeholder={t('auth.email')}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="rounded-xl border border-line bg-card px-4 py-3 text-white outline-none focus:border-accent"
        />
        <input
          type="password"
          required
          autoComplete="current-password"
          placeholder={t('auth.password')}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="rounded-xl border border-line bg-card px-4 py-3 text-white outline-none focus:border-accent"
        />
        {error ? <span className="text-sm text-neg">{t('auth.error')}</span> : null}
        <Button type="submit" disabled={loading} className="mt-2 py-3">
          {t('auth.submit')}
        </Button>
      </form>
    </div>
  )
}
