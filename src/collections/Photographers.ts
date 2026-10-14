import type { Access, CollectionConfig } from 'payload'

const isAuthenticated: Access = ({ req }) => Boolean(req.user)

export const Photographers: CollectionConfig = {
  slug: 'photographers',
  access: {
    read: () => true,
    create: isAuthenticated,
    update: isAuthenticated,
    delete: isAuthenticated,
  },
  admin: {
    group: 'Portfolio',
    useAsTitle: 'displayName',
    defaultColumns: ['displayName'],
  },
  fields: [
    {
      name: 'displayName',
      type: 'text',
      required: true,
      hooks: {
        beforeValidate: [
          ({ value }) => typeof value === 'string' ? value.trim() : value,
        ],
      },
    },
  ],
}
