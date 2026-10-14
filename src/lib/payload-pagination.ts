export async function loadAllDocuments<T>(
  load: (options: { pagination: false }) => Promise<{ docs: T[] }>,
) {
  const result = await load({ pagination: false })
  return result.docs
}
