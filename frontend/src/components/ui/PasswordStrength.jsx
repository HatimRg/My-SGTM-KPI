import { useMemo } from 'react'
import { CheckCircle, XCircle } from 'lucide-react'
import { useLanguage } from '../../i18n'

export function getPasswordPolicy(role) {
  const privileged = [
    'admin',
    'consultation',
    'hse_manager',
    'regional_hse_manager',
    'dev',
    'pole_director',
    'works_director',
    'hse_director',
    'hr_director',
  ]
  const isPrivileged = privileged.includes(role)

  return {
    minLength: isPrivileged ? 12 : 8,
    requireLower: true,
    requireUpper: true,
    requireDigit: true,
    requireSpecial: isPrivileged,
    hintKey: isPrivileged ? 'auth.passwordPolicy.privileged' : 'auth.passwordPolicy.standard',
  }
}

export function checkPasswordAgainstPolicy(password, policy) {
  const pwd = String(password ?? '')

  const checks = {
    minLength: pwd.length >= (policy?.minLength ?? 0),
    lower: /[a-z]/.test(pwd),
    upper: /[A-Z]/.test(pwd),
    digit: /\d/.test(pwd),
    special: policy?.requireSpecial ? /[^A-Za-z0-9]/.test(pwd) : true,
  }

  const ok = checks.minLength && checks.lower && checks.upper && checks.digit && checks.special
  return { ok, checks }
}

export function getPasswordStrengthScore(password, policy) {
  const pwd = String(password ?? '')
  if (!pwd) return { score: 0, max: 5 }

  const { checks } = checkPasswordAgainstPolicy(pwd, {
    ...(policy ?? { minLength: 8, requireLower: true, requireUpper: true, requireDigit: true, requireSpecial: false }),
  })

  const max = policy?.requireSpecial ? 5 : 4
  const base = [checks.minLength, checks.lower, checks.upper, checks.digit].filter(Boolean).length
  const extra = policy?.requireSpecial ? (checks.special ? 1 : 0) : 0
  const score = Math.min(max, base + extra)

  return { score, max }
}

export default function PasswordStrength({ password, role, policy: policyOverride }) {
  const { t } = useLanguage()

  const policy = useMemo(() => {
    if (policyOverride) return policyOverride
    return getPasswordPolicy(role)
  }, [policyOverride, role])

  const result = useMemo(() => checkPasswordAgainstPolicy(password, policy), [password, policy])
  const strength = useMemo(() => getPasswordStrengthScore(password, policy), [password, policy])

  const percent = strength.max > 0 ? Math.round((strength.score / strength.max) * 100) : 0

  const strengthLabelKey =
    strength.score <= 1
      ? 'auth.passwordStrength.weak'
      : strength.score === 2
        ? 'auth.passwordStrength.fair'
        : strength.score === 3
          ? 'auth.passwordStrength.good'
          : 'auth.passwordStrength.strong'

  const barColor =
    strength.score <= 1
      ? 'bg-red-500'
      : strength.score === 2
        ? 'bg-amber-500'
        : strength.score === 3
          ? 'bg-blue-500'
          : 'bg-green-500'

  const reqItems = [
    { key: 'minLength', ok: result.checks.minLength, label: t('auth.passwordRequirements.minLength', { min: policy.minLength }) },
    { key: 'lower', ok: result.checks.lower, label: t('auth.passwordRequirements.lowercase') },
    { key: 'upper', ok: result.checks.upper, label: t('auth.passwordRequirements.uppercase') },
    { key: 'digit', ok: result.checks.digit, label: t('auth.passwordRequirements.digit') },
  ]

  if (policy.requireSpecial) {
    reqItems.push({ key: 'special', ok: result.checks.special, label: t('auth.passwordRequirements.special') })
  }

  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/40 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-sm font-medium text-gray-900 dark:text-gray-100">{t('auth.passwordStrength.title')}</div>
          <div className="text-xs text-gray-600 dark:text-gray-400 mt-0.5">{t(policy.hintKey)}</div>
        </div>
        <div className="text-xs font-semibold text-gray-700 dark:text-gray-200 whitespace-nowrap">
          {t(strengthLabelKey)}
        </div>
      </div>

      <div className="mt-3 h-2 w-full rounded-full bg-gray-200 dark:bg-gray-800 overflow-hidden">
        <div className={`h-full ${barColor}`} style={{ width: `${percent}%` }} />
      </div>

      <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
        {reqItems.map((item) => (
          <div key={item.key} className="flex items-center gap-2 text-xs">
            {item.ok ? (
              <CheckCircle className="w-4 h-4 text-green-600" />
            ) : (
              <XCircle className="w-4 h-4 text-gray-400" />
            )}
            <span className={item.ok ? 'text-gray-800 dark:text-gray-200' : 'text-gray-600 dark:text-gray-400'}>
              {item.label}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
