import * as migration_20261012_140000_schema_baseline from './20261012_140000_schema_baseline'
import * as migration_20261012_151430_portfolio_media_system from './20261012_151430_portfolio_media_system'

export const migrations = [
  {
    up: migration_20261012_140000_schema_baseline.up,
    down: migration_20261012_140000_schema_baseline.down,
    name: '20261012_140000_schema_baseline',
  },
  {
    up: migration_20261012_151430_portfolio_media_system.up,
    down: migration_20261012_151430_portfolio_media_system.down,
    name: '20261012_151430_portfolio_media_system',
  },
]
