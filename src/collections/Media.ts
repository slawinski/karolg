import type { Access, CollectionConfig, Field, PayloadRequest, Where } from 'payload'
import {
  mediaAdminThumbnail,
  privateVideoOriginalHandler,
  redactPrivateVideoOriginal,
} from '@/lib/media-publication'
import { serveMediaDerivative } from '@/lib/media-processing/derivative-response'
import {
  deriveAndPersistImageColor,
  markCurrentRevisionFailed,
  queueVideoProcessing,
  removeVideoDerivatives,
  requestMediaReprocess,
} from '@/lib/media-processing/service'
import { MEDIA_STATIC_DIR } from '@/lib/media-processing/paths'
import { hasMediaProcessingContext } from '@/lib/media-processing/state'

const isAuthenticated: Access = ({ req }) => Boolean(req.user)
const publicMediaFilter: Where = {
  or: [
    { kind: { not_equals: 'video' } },
    {
      and: [
        { kind: { equals: 'video' } },
        { playbackFilename: { exists: true } },
        { posterFilename: { exists: true } },
      ],
    },
  ],
}
const canReadMedia: Access = ({ req }) => req.user ? true : publicMediaFilter

const systemFieldAdmin = {
  readOnly: true,
  position: 'sidebar' as const,
}

const systemFieldAccess = {
  create: () => false,
  update: () => false,
}

const isVideoMime = (mimeType: unknown) =>
  typeof mimeType === 'string' && mimeType.toLowerCase().startsWith('video/')

const systemMetadataField = (name: string, type: 'number' | 'text'): Field => ({
  name,
  type,
  access: systemFieldAccess,
  admin: {
    ...systemFieldAdmin,
    condition: (_data: unknown, siblingData: { kind?: string }) => siblingData.kind === 'video',
  },
} as Field)

export const Media: CollectionConfig = {
  slug: 'media',
  access: {
    read: canReadMedia,
    create: isAuthenticated,
    update: isAuthenticated,
    delete: isAuthenticated,
  },
  admin: {
    group: 'Portfolio',
    useAsTitle: 'filename',
    defaultColumns: ['filename', 'alt', 'kind', 'processingStatus', 'photoshoot'],
    description:
      'Assign images or ready processed videos to photoshoots. Video derivatives are generated asynchronously.',
  },
  upload: {
    staticDir: MEDIA_STATIC_DIR,
    modifyResponseHeaders: ({ headers }) => {
      headers.set('Cache-Control', 'private, no-cache, max-age=0, must-revalidate')
    },
    mimeTypes: [
      'image/jpeg',
      'image/png',
      'image/webp',
      'image/avif',
      'image/gif',
      'image/tiff',
      'video/quicktime',
      'video/mp4',
      'video/x-m4v',
      'video/webm',
    ],
    imageSizes: [
      { name: 'card', width: 720, height: 960, position: 'centre' },
      { name: 'hero', width: 1600, height: 1200, position: 'centre' },
    ],
    adminThumbnail: mediaAdminThumbnail,
    handlers: [privateVideoOriginalHandler],
  },
  endpoints: [
    ...(['playback', 'poster'] as const).flatMap((kind) =>
      (['get', 'head'] as const).map((method) => ({
        path: `/:id/${kind}`,
        method,
        handler: (req: PayloadRequest) => serveMediaDerivative({
          payload: req.payload,
          request: req as Request,
          rawId: req.routeParams?.id,
          kind,
        }),
      })),
    ),
    {
      path: '/:id/reprocess',
      method: 'post',
      handler: async (req) => {
        if (!req.user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

        const rawId = typeof req.routeParams?.id === 'string'
          ? req.routeParams.id
          : ''
        if (!/^[1-9]\d*$/.test(rawId)) {
          return Response.json({ error: 'Invalid media ID' }, { status: 400 })
        }
        const id = Number(rawId)
        if (!Number.isSafeInteger(id)) {
          return Response.json({ error: 'Invalid media ID' }, { status: 400 })
        }

        try {
          const result = await requestMediaReprocess(req.payload, id, req)
          const status = result.status === 'pending'
            ? 202
            : result.status === 'already-processing'
              ? 409
              : result.status === 'queue-failed'
                ? 503
                : 200
          return Response.json(result, { status })
        } catch (error) {
          const status = error instanceof Error && error.name === 'NotFound' ? 404 : 500
          return Response.json(
            { error: status === 404 ? 'Media not found' : 'Could not reprocess media' },
            { status },
          )
        }
      },
    },
  ],
  hooks: {
    afterRead: [
      ({ doc, req }) => redactPrivateVideoOriginal(doc, Boolean(req.user)),
    ],
    beforeChange: [
      ({ context, data, operation, originalDoc, req }) => {
        if (hasMediaProcessingContext(context)) return data

        const replaced = operation === 'create' || Boolean(req.file)
        if (!replaced) return data

        const mimeType = req.file?.mimetype || data.mimeType || originalDoc?.mimeType
        const kind = isVideoMime(mimeType) ? 'video' : 'image'
        const revision = Number(originalDoc?.processingRevision || 0) + 1

        if (kind === 'video') {
          return {
            ...data,
            kind,
            processingStatus: 'pending',
            processingRevision: revision,
            processingError: null,
          }
        }

        return {
          ...data,
          kind,
          processingStatus: 'ready',
          processingRevision: revision,
          processingError: null,
          duration: null,
          videoWidth: null,
          videoHeight: null,
          playbackFilename: null,
          playbackUrl: null,
          playbackMimeType: null,
          playbackFilesize: null,
          posterFilename: null,
          posterUrl: null,
          posterMimeType: null,
          posterWidth: null,
          posterHeight: null,
        }
      },
    ],
    afterChange: [
      async ({ context, doc, operation, previousDoc, req }) => {
        if (hasMediaProcessingContext(context)) return doc

        const replaced = operation === 'create' || Boolean(req.file) ||
          doc.filename !== previousDoc?.filename
        if (!replaced) return doc

        if (doc.kind !== 'video') {
          await deriveAndPersistImageColor(req.payload, doc)
          if (previousDoc?.kind === 'video') {
            await removeVideoDerivatives(req.payload, previousDoc)
          }
          return doc
        }

        try {
          await queueVideoProcessing(
            req.payload,
            doc.id,
            doc.processingRevision || 1,
            req,
          )
        } catch (error) {
          req.payload.logger.error(`Could not queue video ${doc.id}`)
          await markCurrentRevisionFailed(
            req.payload,
            doc.id,
            doc.processingRevision || 1,
            new Error('Could not queue media processing'),
            req,
          )
        }

        return doc
      },
    ],
    afterDelete: [
      async ({ doc, req }) => {
        await removeVideoDerivatives(req.payload, doc)
      },
    ],
  },
  fields: [
    {
      name: 'alt',
      type: 'text',
      admin: {
        description: 'Optional. Leave blank to use the photoshoot title as a fallback.',
      },
    },
    {
      name: 'caption',
      type: 'text',
    },
    {
      name: 'photoshoot',
      label: 'Photoshoot',
      type: 'relationship',
      relationTo: 'projects',
      admin: {
        position: 'sidebar',
        components: {
          Cell: '/components/admin/MediaListCells#PhotoshootCell',
        },
      },
    },
    {
      name: 'transitionColor',
      type: 'text',
      access: systemFieldAccess,
      admin: systemFieldAdmin,
      validate: (value: null | string | undefined) =>
        value == null || /^#[0-9a-f]{6}$/.test(String(value))
          ? true
          : 'Must be a lowercase six-digit hex color.',
    },
    {
      name: 'kind',
      type: 'select',
      options: ['image', 'video'],
      defaultValue: 'image',
      required: true,
      access: systemFieldAccess,
      admin: systemFieldAdmin,
    },
    {
      name: 'processingStatus',
      type: 'select',
      options: ['pending', 'processing', 'ready', 'failed'],
      defaultValue: 'ready',
      required: true,
      access: systemFieldAccess,
      admin: systemFieldAdmin,
    },
    {
      name: 'processingRevision',
      type: 'number',
      defaultValue: 0,
      required: true,
      min: 0,
      access: systemFieldAccess,
      admin: systemFieldAdmin,
    },
    {
      name: 'processingError',
      type: 'textarea',
      access: {
        ...systemFieldAccess,
        read: ({ req }) => Boolean(req.user),
      },
      admin: systemFieldAdmin,
    },
    systemMetadataField('duration', 'number'),
    systemMetadataField('videoWidth', 'number'),
    systemMetadataField('videoHeight', 'number'),
    systemMetadataField('playbackFilename', 'text'),
    systemMetadataField('playbackUrl', 'text'),
    systemMetadataField('playbackMimeType', 'text'),
    systemMetadataField('playbackFilesize', 'number'),
    systemMetadataField('posterFilename', 'text'),
    systemMetadataField('posterUrl', 'text'),
    systemMetadataField('posterMimeType', 'text'),
    systemMetadataField('posterWidth', 'number'),
    systemMetadataField('posterHeight', 'number'),
  ],
}
