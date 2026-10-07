import { withPayload } from '@payloadcms/next/withPayload'
import type { NextConfig } from 'next'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(__filename)
const isStaticExport = process.env.STATIC_EXPORT === '1'

const nextConfig: NextConfig = {
  ...(isStaticExport ? { output: 'export' as const, trailingSlash: true } : {}),
  images: {
    formats: ['image/avif', 'image/webp'],
    localPatterns: [{ pathname: '/api/media/file/**' }, { pathname: '/placeholders/**' }],
    ...(isStaticExport ? { unoptimized: true } : {}),
  },
  poweredByHeader: false,
  webpack: (webpackConfig) => {
    webpackConfig.resolve.extensionAlias = {
      '.cjs': ['.cts', '.cjs'],
      '.js': ['.ts', '.tsx', '.js', '.jsx'],
      '.mjs': ['.mts', '.mjs'],
    }
    return webpackConfig
  },
  turbopack: {
    root: path.resolve(dirname),
  },
}

export default isStaticExport
  ? nextConfig
  : withPayload(nextConfig, { devBundleServerPackages: false })
