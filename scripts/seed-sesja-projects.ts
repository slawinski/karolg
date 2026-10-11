import { getPayload } from 'payload'
import config from '@payload-config'

const HERO_FILENAME = '000729840007-Edit.JPEG'

const seed = async () => {
  const payload = await getPayload({ config })

  const media = await payload.find({
    collection: 'media',
    limit: 100,
    sort: 'filename',
  })

  if (!media.totalDocs) {
    throw new Error('No media documents found — run seed:sesja first')
  }

  const hero = media.docs.find((doc) => doc.filename === HERO_FILENAME)

  if (!hero) {
    throw new Error(`Hero file ${HERO_FILENAME} not found in media`)
  }

  const galleryIds = media.docs
    .filter((doc) => doc.id !== hero.id)
    .map((doc) => doc.id)

  const projectData = {
    title: 'Sesja Karolg',
    slug: 'sesja-karolg',
    category: 'portrait' as const,
    excerpt: 'Studio portraits — natural light, movement and quiet character.',
    cover: hero.id,
    gallery: galleryIds,
    featured: true,
    year: '2026',
    order: 1,
  }

  const existing = await payload.find({
    collection: 'projects',
    limit: 1,
    where: { slug: { equals: 'sesja-karolg' } },
  })

  if (existing.totalDocs > 0) {
    await payload.update({
      collection: 'projects',
      id: existing.docs[0].id,
      overrideAccess: true,
      data: projectData,
    })
    payload.logger.info('Updated project sesja-karolg')
  } else {
    await payload.create({
      collection: 'projects',
      overrideAccess: true,
      data: projectData,
    })
    payload.logger.info('Created project sesja-karolg')
  }

  await payload.updateGlobal({
    slug: 'site-settings',
    overrideAccess: true,
    data: { heroMedia: hero.id },
  })
  payload.logger.info(`Hero set to ${HERO_FILENAME} + gallery=${galleryIds.length}`)

  if (typeof payload.destroy === 'function') {
    await payload.destroy()
  }
}

await seed()
