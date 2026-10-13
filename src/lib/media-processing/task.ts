import type { TaskConfig } from 'payload'
import { runVideoProcessing } from './service'

type ProcessVideoTask = {
  input: { mediaId: number; revision: number }
  output: { mediaId: number; status: 'ready' | 'stale' }
}

export const processVideoTask: TaskConfig<ProcessVideoTask> = {
  slug: 'processVideo',
  label: 'Process uploaded video',
  inputSchema: [
    { name: 'mediaId', type: 'number', required: true },
    { name: 'revision', type: 'number', required: true },
  ],
  outputSchema: [
    { name: 'mediaId', type: 'number', required: true },
    { name: 'status', type: 'select', options: ['ready', 'stale'], required: true },
  ],
  retries: 0,
  concurrency: {
    key: ({ input }) => `media:${input.mediaId}`,
    exclusive: true,
    supersedes: true,
  },
  handler: async ({ input, req }) => {
    const status = await runVideoProcessing(
      req.payload,
      input.mediaId,
      input.revision,
    )
    return { output: { mediaId: input.mediaId, status } }
  },
}
