import type { ComponentProps } from 'react'

type Props = ComponentProps<'img'> & {
  fill?: boolean
  priority?: boolean
}

export default function TestImage({ fill: _fill, priority: _priority, ...props }: Props) {
  return <img {...props} />
}
