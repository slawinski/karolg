import type { Access, CollectionConfig } from 'payload'

const isAuthenticated: Access = ({ req }) => Boolean(req.user)

const slugify = (value: string) =>
  value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')

export const Projects: CollectionConfig = {
  slug: 'projects',
  access: {
    read: () => true,
    create: isAuthenticated,
    update: isAuthenticated,
    delete: isAuthenticated,
  },
  admin: {
    group: 'Portfolio',
    useAsTitle: 'title',
    defaultColumns: ['title', 'category', 'featured', 'order'],
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
    {
      name: 'category',
      type: 'select',
      required: true,
      defaultValue: 'editorial',
      options: [
        { label: 'Editorial', value: 'editorial' },
        { label: 'Campaign', value: 'campaign' },
        { label: 'Personal', value: 'personal' },
        { label: 'Movement', value: 'movement' },
        { label: 'Portrait', value: 'portrait' },
      ],
    },
    { name: 'excerpt', type: 'textarea', maxLength: 220 },
    { name: 'cover', type: 'upload', relationTo: 'media' },
    { name: 'gallery', type: 'upload', relationTo: 'media', hasMany: true },
    { name: 'featured', type: 'checkbox', defaultValue: false, admin: { position: 'sidebar' } },
    { name: 'year', type: 'text', admin: { position: 'sidebar' } },
    { name: 'order', type: 'number', defaultValue: 10, min: 0, admin: { position: 'sidebar' } },
  ],
}
