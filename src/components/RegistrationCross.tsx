export function RegistrationCross({ position = 'tr' }: { position?: 'tl' | 'tr' }) {
  return <span className={`reg reg-${position}`} aria-hidden="true" />
}
