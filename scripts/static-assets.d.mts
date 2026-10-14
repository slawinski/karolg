export function createAssetManifest(media: Array<Record<string, unknown>>): string[]
export function copyStaticAssets(options: {
  manifest: string[]
  sourceDir: string
  outDir: string
}): Promise<void>
