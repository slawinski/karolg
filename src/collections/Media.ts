import type { Access, CollectionConfig } from 'payload'

const isAuthenticated: Access = ({ req }) => Boolean(req.user)

export const Media: CollectionConfig = {
  slug: 'media',
  access: {
    read: () => true,
    create: isAuthenticated,
    update: isAuthenticated,
    delete: isAuthenticated,
  },
  admin: {
    group: 'Portfolio',
    useAsTitle: 'alt',
  },
  upload: {
    mimeTypes: ['image/*'],
    imageSizes: [
      { name: 'card', width: 720, height: 960, position: 'centre' },
      { name: 'hero', width: 1600, height: 1200, position: 'centre' },
    ],
    adminThumbnail: 'card',
  },
  fields: [
    {
      name: 'alt',
      type: 'text',
      required: true,
    },
    {
      name: 'caption',
      type: 'text',
    },
  ],
}
