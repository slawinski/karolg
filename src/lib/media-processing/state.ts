import type { MediaKind, MediaProcessingStatus } from '../media'

export const MEDIA_PROCESSING_CONTEXT = 'mediaProcessing'

type ProcessingDocument = {
  kind?: MediaKind | null
  processingRevision?: number | null
  processingStatus?: MediaProcessingStatus | null
}

export const isCurrentVideoRevision = (
  document: ProcessingDocument | null | undefined,
  revision: number,
) =>
  document?.kind === 'video' &&
  document.processingRevision === revision

export function failurePatchForRevision(
  document: ProcessingDocument | null | undefined,
  revision: number,
  error: unknown,
) {
  if (!isCurrentVideoRevision(document, revision)) return null

  const message = error instanceof Error ? error.message : String(error)
  return {
    processingStatus: 'failed' as const,
    processingError: message.slice(0, 2000),
  }
}

export const hasMediaProcessingContext = (context: Record<string, unknown>) =>
  context[MEDIA_PROCESSING_CONTEXT] === true
