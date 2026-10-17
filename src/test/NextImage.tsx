import type { ComponentProps } from 'react'

type Props = ComponentProps<'img'> & {
  fill?: boolean
  priority?: boolean
  unoptimized?: boolean
}

export default function TestImage({ fill: _fill, priority: _priority, unoptimized, ...props }: Props) {
  return <img data-unoptimized={unoptimized || undefined} {...props} />
}
