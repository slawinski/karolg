import type { Access, GlobalConfig } from 'payload'

const isAuthenticated: Access = ({ req }) => Boolean(req.user)

export const SiteSettings: GlobalConfig = {
  slug: 'site-settings',
  access: {
    read: () => true,
    update: isAuthenticated,
  },
  admin: {
    group: 'Portfolio',
  },
  fields: [
    { name: 'name', type: 'text', required: true, defaultValue: 'CARLA GORECKA' },
    { name: 'roles', type: 'text', required: true, defaultValue: 'MODEL / PILATES / CREATIVE' },
    { name: 'heroEyebrow', type: 'textarea', defaultValue: 'HONEST\nNATURAL\nAUTHENTIC\nIN MOTION' },
    { name: 'heroHeadline', type: 'textarea', required: true, defaultValue: 'A CREATIVE APPROACH TO MODELING' },
    { name: 'handwrittenLine', type: 'text', defaultValue: 'Movement · People · Stories' },
    { name: 'intro', type: 'textarea', defaultValue: 'A portfolio built around fashion, movement and natural portraiture.' },
    { name: 'heroMedia', type: 'upload', relationTo: 'media' },
    {
      name: 'locations',
      type: 'array',
      fields: [{ name: 'label', type: 'text', required: true }],
      defaultValue: [{ label: 'WARSAW' }, { label: 'WORLDWIDE' }],
    },
    {
      name: 'profileFacts',
      type: 'array',
      labels: { singular: 'Fact', plural: 'Profile facts' },
      fields: [
        { name: 'label', type: 'text', required: true },
        { name: 'value', type: 'text', required: true },
      ],
      defaultValue: [
        { label: 'Model', value: '@vanillamodels.pl' },
        { label: 'Pilates', value: 'Classical teacher' },
      ],
    },
    { name: 'instagram', type: 'text', defaultValue: 'https://www.instagram.com/carlagorecka/' },
    { name: 'email', type: 'email' },
    { name: 'seoDescription', type: 'textarea', maxLength: 180, defaultValue: 'Portfolio of Carla Gorecka — model, classical Pilates teacher and creative.' },
  ],
}
