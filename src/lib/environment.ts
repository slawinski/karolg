export function requirePayloadSecret(value: string | undefined) {
  if (
    !value ||
    value.length < 32 ||
    /^(replace|change|development|example|secret)/i.test(value)
  ) {
    throw new Error('PAYLOAD_SECRET must be a non-placeholder value of at least 32 characters')
  }
  return value
}

export function boundedEnvironmentInteger(
  name: string,
  raw: string | undefined,
  fallback: number,
  minimum: number,
  maximum: number,
) {
  if (raw == null || raw === '') return fallback
  const value = Number(raw)
  if (!Number.isSafeInteger(value) || value < minimum || value > maximum) {
    throw new Error(`${name} must be an integer between ${minimum} and ${maximum}`)
  }
  return value
}
