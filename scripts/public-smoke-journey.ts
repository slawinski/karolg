import assert from 'node:assert/strict'
import { writeFile } from 'node:fs/promises'
import path from 'node:path'
import AxeBuilder from '@axe-core/playwright'
import { chromium, type BrowserContext, type Locator, type Page } from 'playwright'
import type { PublicSmokeFixture } from './public-smoke-fixture'

const checkNames = ['home', 'axe-home', 'pointer-story', 'story-media', 'video', 'axe-story',
  'pointer-return', 'pointer-contact', 'keyboard-story', 'keyboard-return', 'keyboard-contact']
export const browserScenarios = [
  { name: 'mobile', viewport: { width: 390, height: 844 }, motion: 'no-preference' as const },
  { name: 'desktop', viewport: { width: 1440, height: 900 }, motion: 'no-preference' as const },
  { name: 'mobile-reduced', viewport: { width: 390, height: 844 }, motion: 'reduce' as const },
].map((scenario) => ({
  ...scenario, step: 'context', url: '', status: 'not-run' as 'not-run' | 'running' | 'passed' | 'failed',
  checks: Object.fromEntries(checkNames.map((name) => [name, 'not-run'])) as Record<string, 'not-run' | 'passed' | 'failed'>,
  accessibility: [] as Array<{ surface: string; violations: number; incomplete: number; results: string }>,
  logs: [] as string[], evidence: [] as string[], evidenceErrors: [] as string[], error: null as string | null,
}))
type Scenario = typeof browserScenarios[number]
const errorMessage = (error: unknown) => error instanceof Error ? error.stack || error.message : String(error)

async function ready(page: Page) {
  await page.locator('[data-public-media-ready="true"]').waitFor()
}

async function imageLoaded(image: Locator) {
  await image.scrollIntoViewIfNeeded()
  const handle = await image.elementHandle()
  assert(handle, 'Expected rendered fixture image')
  try {
    await image.page().waitForFunction((element) => {
      const image = element as HTMLImageElement
      return image.complete && image.naturalWidth > 0 && image.naturalHeight > 0
    }, handle)
    await image.evaluate((element) => (element as HTMLImageElement).decode())
  } finally { await handle.dispose() }
}

async function visibleTarget(page: Page, selector: string) {
  await page.waitForFunction((selector) => {
    const box = document.querySelector(selector)?.getBoundingClientRect()
    return box && box.top >= 0 && box.top < innerHeight && box.bottom > 0
  }, selector)
}

// Traverse the browser's real focus order, without focus() or scrolling the target for it.
async function tabTo(page: Page, link: Locator) {
  await link.waitFor({ state: 'attached' })
  const unfocused = await link.evaluate((element) => {
    const style = getComputedStyle(element)
    return { shadow: style.boxShadow, decoration: style.textDecorationLine }
  })
  let reached = false
  for (let tabs = 0; tabs < 80; tabs++) {
    await page.keyboard.press('Tab')
    if (await link.evaluate((element) => element === document.activeElement)) { reached = true; break }
  }
  assert(reached, `Keyboard could not reach ${await link.getAttribute('href')} within 80 Tabs`)
  const handle = await link.elementHandle()
  assert(handle)
  try {
    await page.waitForFunction((element) => {
      const box = element.getBoundingClientRect()
      const style = getComputedStyle(element)
      const hit = document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2)
      return element === document.activeElement && element.matches(':focus-visible') &&
        box.width > 0 && box.height > 0 && box.top >= 0 && box.bottom <= innerHeight &&
        box.left >= 0 && box.right <= innerWidth && Number(style.opacity) > 0 &&
        style.visibility === 'visible' && hit && (hit === element || element.contains(hit))
    }, handle)
  } finally { await handle.dispose() }
  assert(await link.evaluate((element, before) => {
    const style = getComputedStyle(element)
    return (style.outlineStyle !== 'none' && parseFloat(style.outlineWidth) > 0 &&
      style.outlineColor !== 'transparent' && style.outlineColor !== 'rgba(0, 0, 0, 0)') ||
      (style.boxShadow !== 'none' && style.boxShadow !== before.shadow) ||
      (style.textDecorationLine !== 'none' && style.textDecorationLine !== before.decoration)
  }, unfocused), 'Keyboard focus must have a visible indicator')
}

export async function runPublicSmokeJourney(base: string, fixture: PublicSmokeFixture, artifacts: string,
  progress: (scenario: Scenario) => Promise<void>) {
  const browser = await chromium.launch()
  let primaryError: unknown
  try {
    for (const scenario of browserScenarios) {
      scenario.status = 'running'
      await progress(scenario)
      let context: BrowserContext | undefined
      let page: Page | undefined
      let failed = false
      const playbackRequests: string[] = []
      const capture = async (action: () => Promise<unknown>) => {
        try { await action() } catch (error) { scenario.evidenceErrors.push(errorMessage(error)) }
      }
      try {
        context = await browser.newContext({ viewport: scenario.viewport, reducedMotion: scenario.motion })
        await context.tracing.start({ screenshots: true, snapshots: true, sources: true })
        page = await context.newPage()
        page.setDefaultTimeout(15_000)
        page.setDefaultNavigationTimeout(30_000)
        page.on('console', (message) => {
          if (message.type() === 'error') scenario.logs.push(`console: ${message.text()}`)
        })
        page.on('pageerror', (error) => scenario.logs.push(`pageerror: ${errorMessage(error)}`))
        page.on('requestfailed', (request) => {
          if (new URL(request.url()).origin === base)
            scenario.logs.push(`requestfailed: ${request.url()} ${request.failure()?.errorText}`)
        })
        page.on('response', (response) => {
          if (new URL(response.url()).origin === base && response.status() >= 400)
            scenario.logs.push(`HTTP ${response.status()}: ${response.url()}`)
        })
        page.on('request', (request) => {
          if (new URL(request.url()).pathname === new URL(fixture.video.playbackUrl, base).pathname)
            playbackRequests.push(request.url())
        })
        const currentPage = page
        const step = async (name: string, action: () => Promise<void>) => {
          scenario.step = name
          scenario.url = currentPage.url()
          await progress(scenario)
          await action()
          scenario.checks[name] = 'passed'
          scenario.url = currentPage.url()
          await progress(scenario)
        }
        const axe = async (surface: string) => {
          const result = await new AxeBuilder({ page: currentPage })
            .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze()
          const filename = `${scenario.name}-axe-${surface}.json`
          await writeFile(path.join(artifacts, filename), `${JSON.stringify(result, null, 2)}\n`)
          scenario.evidence.push(filename)
          scenario.accessibility.push({ surface, violations: result.violations.length,
            incomplete: result.incomplete.length, results: filename })
          assert.equal(result.violations.length, 0,
            `axe ${surface}: ${result.violations.map((violation) => violation.id).join(', ')}; see ${filename} (incomplete checks are separate)`)
        }
        const storyPath = `/work/${fixture.story.slug}`
        const storyLink = () => currentPage.getByRole('link', { name: `View ${fixture.story.title}`, exact: true }).first()
        const selectedWork = () => currentPage.getByRole('link', { name: 'Selected work', exact: true })
        const email = () => currentPage.getByRole('link', { name: 'Email', exact: true })
        const storyTop = async () => {
          await currentPage.waitForURL(new URL(storyPath, base).href)
          await currentPage.getByRole('heading', { name: fixture.story.title, level: 1, exact: true }).waitFor()
          assert.equal(await currentPage.evaluate(() => window.scrollY), 0, 'Story entry must start at top')
          await ready(currentPage)
          assert.equal(await currentPage.evaluate(() => window.scrollY), 0, 'Readiness must not move story entry')
          await visibleTarget(currentPage, '.photoshoot-head h1')
        }
        const returned = async () => {
          await currentPage.waitForURL((url) => url.pathname === '/' && url.hash === '#work')
          await ready(currentPage)
          await visibleTarget(currentPage, '#work')
        }
        const reduced = async () => {
          if (scenario.motion !== 'reduce') return
          assert.equal(await currentPage.locator('video[src], video source[src], video[autoplay]').count(), 0,
            'Reduced motion must suppress source acquisition and autoplay')
          assert(await currentPage.locator('video').evaluateAll((videos) => videos.every((video) => (video as HTMLVideoElement).paused)),
            'Reduced-motion videos must stay paused')
          assert.equal(playbackRequests.length, 0, 'Reduced motion must not request fixture playback')
        }
        await step('home', async () => {
          await currentPage.goto(base, { waitUntil: 'domcontentloaded' })
          await ready(currentPage)
          const images = currentPage.locator('img[data-public-critical]')
          assert(await images.count() > 0, 'Home must render critical media')
          for (const image of await images.all()) await imageLoaded(image)
          assert.equal(await storyLink().getAttribute('href'), storyPath)
          await reduced()
        })
        await step('axe-home', () => axe('home'))
        await step('pointer-story', async () => { await storyLink().click(); await storyTop() })
        await step('story-media', async () => {
          const images = currentPage.locator('.photoshoot-gallery img')
          const identities = await images.evaluateAll((images) => images.map((image) => {
            const url = new URL((image as HTMLImageElement).currentSrc || (image as HTMLImageElement).src)
            return new URL(url.searchParams.get('url') || url.href, location.origin).pathname
          }))
          for (const url of [...fixture.images.map((image) => image.url), fixture.video.posterUrl]) {
            const index = identities.indexOf(new URL(url, base).pathname)
            assert(index >= 0, `Gallery must render fixture media ${url}`)
            await imageLoaded(images.nth(index))
          }
        })
        await step('video', async () => {
          const video = currentPage.locator('.photoshoot-gallery video')
          assert.equal(await video.count(), 1, 'Fixture video must render')
          await video.scrollIntoViewIfNeeded()
          if (scenario.motion === 'reduce') await reduced()
          else {
            await currentPage.waitForFunction((playback) => {
              const video = document.querySelector<HTMLVideoElement>('.photoshoot-gallery video')
              return video && new URL(video.currentSrc || video.src, location.origin).pathname === playback &&
                video.readyState >= 2 && !video.paused && video.currentTime > 0
            }, new URL(fixture.video.playbackUrl, base).pathname)
          }
        })
        await step('axe-story', () => axe('story'))
        await step('pointer-return', async () => { await selectedWork().click(); await returned() })
        await step('pointer-contact', async () => {
          await email().scrollIntoViewIfNeeded()
          await email().click({ trial: true })
          assert.equal(await email().getAttribute('href'), `mailto:${fixture.email}`)
          await reduced()
        })
        await step('keyboard-story', async () => { await tabTo(currentPage, storyLink()); await currentPage.keyboard.press('Enter'); await storyTop() })
        await step('keyboard-return', async () => { await tabTo(currentPage, selectedWork()); await currentPage.keyboard.press('Enter'); await returned() })
        await step('keyboard-contact', async () => {
          await tabTo(currentPage, email())
          assert.equal(await email().getAttribute('href'), `mailto:${fixture.email}`)
          await reduced()
        })
        scenario.status = 'passed'
      } catch (error) {
        failed = true
        primaryError = error
        scenario.status = 'failed'
        scenario.checks[scenario.step] = 'failed'
        scenario.error = errorMessage(error)
        if (page) {
          scenario.url = page.url()
          await capture(async () => {
            const filename = `${scenario.name}-failure.png`
            await page!.screenshot({ path: path.join(artifacts, filename), timeout: 5000 })
            scenario.evidence.push(filename)
          })
        }
      } finally {
        await capture(async () => {
          if (!context) return
          const filename = `${scenario.name}-trace.zip`
          await context.tracing.stop(failed ? { path: path.join(artifacts, filename) } : undefined)
          if (failed) scenario.evidence.push(filename)
        })
        await capture(async () => { await context?.close() })
        await capture(() => progress(scenario))
      }
      if (primaryError) throw primaryError
      assert.equal(scenario.evidenceErrors.length, 0, `Browser evidence/cleanup failed: ${scenario.evidenceErrors.join('\n')}`)
    }
  } catch (error) {
    primaryError = error
    throw error
  } finally {
    try { await browser.close() } catch (error) { if (!primaryError) throw error }
  }
}
