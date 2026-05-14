# Import command e2e fixture

This fixture exercises `/claude:plugin import` with both Claude user and project settings.
It covers Claude's built-in `claude-plugins-official` marketplace, an `extraKnownMarketplaces`
`directory` source, an `extraKnownMarketplaces` `github.repo` source, local settings disabling a
base-enabled plugin with `false`, an unavailable plugin warning, an already-installed skip, both Pi
scopes, final summary output, and source-mismatch protection.
