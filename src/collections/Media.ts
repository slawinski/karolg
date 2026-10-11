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
    defaultColumns: ['filename', 'alt', 'photoshoot', 'featured'],
    description:
      'Assign photoshoots and homepage featured state directly from this list. Changes save immediately.',
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
      name: 'featured',
      label: 'Featured on homepage',
      type: 'checkbox',
      defaultValue: false,
      admin: {
        position: 'sidebar',
        components: {
          Cell: '/components/admin/MediaListCells#FeaturedCell',
        },
      },
    },
  ],
}
