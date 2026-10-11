import type { Access, CollectionConfig } from 'payload'

const isAuthenticated: Access = ({ req }) => Boolean(req.user)

const slugify = (value: string) =>
  value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')

export const Photoshoots: CollectionConfig = {
  // Keep the historical collection slug to preserve existing SQLite data.
  slug: 'projects',
  labels: {
    singular: 'Photoshoot',
    plural: 'Photoshoots',
  },
  access: {
    read: () => true,
    create: isAuthenticated,
    update: isAuthenticated,
    delete: isAuthenticated,
  },
  admin: {
    group: 'Portfolio',
    useAsTitle: 'title',
    defaultColumns: ['title', 'year', 'order'],
  },
  defaultSort: 'order',
  fields: [
    { name: 'title', type: 'text', required: true },
    {
      name: 'slug',
      type: 'text',
      unique: true,
      index: true,
      admin: { position: 'sidebar' },
      hooks: {
        beforeValidate: [
          ({ value, siblingData }) =>
            value || (siblingData?.title ? slugify(String(siblingData.title)) : undefined),
        ],
      },
    },
    { name: 'excerpt', type: 'textarea', maxLength: 220 },
    { name: 'year', type: 'text', admin: { position: 'sidebar' } },
    { name: 'order', type: 'number', defaultValue: 10, min: 0, admin: { position: 'sidebar' } },
  ],
}
