import * as migration_20261012_140000_schema_baseline from './20261012_140000_schema_baseline'
import * as migration_20261012_151430_portfolio_media_system from './20261012_151430_portfolio_media_system'
import * as migration_20261015_093016_photoshoot_photographers_schema from './20261015_093016_photoshoot_photographers_schema'
import * as migration_20261016_085713_optional_media_alt from './20261016_085713_optional_media_alt'

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
  {
    up: migration_20261015_093016_photoshoot_photographers_schema.up,
    down: migration_20261015_093016_photoshoot_photographers_schema.down,
    name: '20261015_093016_photoshoot_photographers_schema',
  },
  {
    up: migration_20261016_085713_optional_media_alt.up,
    down: migration_20261016_085713_optional_media_alt.down,
    name: '20261016_085713_optional_media_alt',
  },
]
