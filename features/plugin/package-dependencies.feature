Feature: Plugin package dependencies

  A plugin whose folder ships a package.json and a supported lockfile gets its npm packages
  with it, as Claude Code installs them, and a failed package install never blocks the plugin.
  A loopback npm registry stands in for the public one, and the sandbox npm config points npm at it.

  Scenario: Installing a plugin whose lockfile lists an npm package installs the package into the plugin
    Given the npm registry serves these packages:
      | name    | version |
      | pkd-dep | 1.0.0   |
    Given the marketplace "tools" is published as a url source
    Given the marketplace "tools" offers these plugins:
      | name | version |
      | pkp  | 1.0.0   |
    Given the published plugin "pkp" of the marketplace "tools" depends on these npm packages:
      | name    | version |
      | pkd-dep | 1.0.0   |
    Given the marketplace "tools" is added to the project scope
    When the user runs "/claude:plugin install pkp@tools --scope project"
    Then the result has these fields:
      | kind         | cascade |
      | severity     | info    |
      | needs reload | true    |
    Then the result lists these plugins:
      | marketplace name | marketplace scope | id        | name | status    | reasons | scope   | version |
      | tools            | project           | pkp@tools | pkp  | installed |         | project | 1.0.0   |
    Then the npm registry receives these requests:
      | method | path                         | status |
      | GET    | /pkd-dep/-/pkd-dep-1.0.0.tgz | 200    |
    Then the plugin "pkp" installed in the project scope has these npm packages:
      | name    | version |
      | pkd-dep | 1.0.0   |

  Scenario: A package install that fails leaves the plugin installed with a warning
    Given the npm registry serves these packages:
      | name    | version |
      | pkd-dep | 1.0.0   |
    Given the marketplace "tools" is published as a url source
    Given the marketplace "tools" offers these plugins:
      | name | version |
      | pkp  | 1.0.0   |
    Given the published plugin "pkp" of the marketplace "tools" depends on these npm packages:
      | name    | version |
      | pkd-dep | 1.0.0   |
    Given the npm registry answers 404 for the package "pkd-dep"
    Given the marketplace "tools" is added to the project scope
    When the user runs "/claude:plugin install pkp@tools --scope project"
    Then the command reports these results:
      | kind       | severity | needs reload | header                                                             | lines                                             |
      | cascade    | info     | true         |                                                                    |                                                   |
      | diagnostic | warning  | false        | Plugin "pkp" [project] installed; 1 declared component has a note. | Plugin dependency install failed (npm): no output |
    Then the results list these marketplaces and plugins:
      | marketplace name | marketplace scope | id        | name | status    | reasons | scope   | version |
      | tools            | project           | pkp@tools | pkp  | installed |         | project | 1.0.0   |
    Then the npm registry receives these requests:
      | method | path                         | status |
      | GET    | /pkd-dep/-/pkd-dep-1.0.0.tgz | 404    |
    Then the installation record of the project scope holds these plugins:
      | id        | version | enabled |
      | pkp@tools | 1.0.0   | true    |
    Then the plugin "pkp" installed in the project scope has no npm packages

  Scenario: A plugin whose lockfile lists a package from a local folder is installed with a note and npm fetches nothing
    Given the npm registry serves these packages:
      | name    | version |
      | pkd-dep | 1.0.0   |
    Given the marketplace "tools" is published as a url source
    Given the marketplace "tools" offers these plugins:
      | name | version |
      | pkp  | 1.0.0   |
    Given the published plugin "pkp" of the marketplace "tools" depends on these npm packages and on the package "pkd-local" from the folder "../pkd-local":
      | name    | version |
      | pkd-dep | 1.0.0   |
    Given the marketplace "tools" is added to the project scope
    When the user runs "/claude:plugin install pkp@tools --scope project"
    Then the command reports these results:
      | kind       | severity | needs reload | header                                                             | lines                                                                                                                                              |
      | cascade    | info     | true         |                                                                    |                                                                                                                                                    |
      | diagnostic | warning  | false        | Plugin "pkp" [project] installed; 1 declared component has a note. | Skipped installing this plugin's dependencies: its package-lock.json has a dependency that is not a registry package and version range: pkd-local. |
    Then the results list these marketplaces and plugins:
      | marketplace name | marketplace scope | id        | name | status    | reasons | scope   | version |
      | tools            | project           | pkp@tools | pkp  | installed |         | project | 1.0.0   |
    Then the npm registry receives no request
    Then the plugin "pkp" installed in the project scope has no npm packages

  Scenario: A session start hook of an installed plugin loads the npm package its lockfile lists
    Given the npm registry serves these packages:
      | name    | version |
      | pkd-dep | 1.0.0   |
    Given the marketplace "tools" is published as a url source
    Given the marketplace "tools" offers these plugins:
      | name | version |
      | pkp  | 1.0.0   |
    Given the published plugin "pkp" of the marketplace "tools" depends on these npm packages:
      | name    | version |
      | pkd-dep | 1.0.0   |
    Given the published plugin "pkp" of the marketplace "tools" has a session start hook that writes what the npm package "pkd-dep" exports to the project file "pkd-proof.txt"
    Given the marketplace "tools" is added to the project scope
    Given the user has run "/claude:plugin install pkp@tools --scope project"
    When the user starts a new pi session
    Then the project directory holds the file "pkd-proof.txt" with the text "pkd-dep 1.0.0"
    Then the npm registry receives no request

  Scenario: A plugin from a local marketplace is installed with a note naming the command to run in its folder
    Given the npm registry serves these packages:
      | name    | version |
      | pkd-dep | 1.0.0   |
    Given the marketplace "tools" is published as a dir source
    Given the marketplace "tools" offers these plugins:
      | name | version |
      | pkp  | 1.0.0   |
    Given the published plugin "pkp" of the marketplace "tools" depends on these npm packages:
      | name    | version |
      | pkd-dep | 1.0.0   |
    Given the marketplace "tools" is added to the project scope
    When the user runs "/claude:plugin install pkp@tools --scope project"
    Then the command reports these results:
      | kind       | severity | needs reload | header                                                             | lines                                                                                                                                                                                                                                                             |
      | cascade    | info     | true         |                                                                    |                                                                                                                                                                                                                                                                   |
      | diagnostic | warning  | false        | Plugin "pkp" [project] installed; 1 declared component has a note. | Skipped installing this plugin's dependencies: its folder in the marketplace "tools" is outside the folders this extension manages, so it was not changed. To install them, run "npm ci --ignore-scripts --workspaces=false --no-audit --no-fund" in that folder. |
    Then the results list these marketplaces and plugins:
      | marketplace name | marketplace scope | id        | name | status    | reasons | scope   | version |
      | tools            | project           | pkp@tools | pkp  | installed |         | project | 1.0.0   |
    Then the npm registry receives no request
    Then the plugin "pkp" installed in the project scope has no npm packages

  Scenario Outline: A plugin whose only lockfile is <lockfile> is installed with a note saying why its packages were not installed
    Given the marketplace "tools" is published as a dir source
    Given the marketplace "tools" offers these plugins:
      | name | version |
      | pkp  | 1.0.0   |
    Given the published plugin "pkp" of the marketplace "tools" ships a package.json and the lockfile "<lockfile>"
    Given the marketplace "tools" is added to the project scope
    When the user runs "/claude:plugin install pkp@tools --scope project"
    Then the command reports these results:
      | kind       | severity | needs reload | header                                                             | lines  |
      | cascade    | info     | true         |                                                                    |        |
      | diagnostic | warning  | false        | Plugin "pkp" [project] installed; 1 declared component has a note. | <note> |
    Then the results list these marketplaces and plugins:
      | marketplace name | marketplace scope | id        | name | status    | reasons | scope   | version |
      | tools            | project           | pkp@tools | pkp  | installed |         | project | 1.0.0   |

    Examples:
      | lockfile       | note                                                                                                                                    |
      | yarn.lock      | The packages it lists were not installed, because it uses a yarn or pnpm lockfile, which plugin installs do not support.               |
      | pnpm-lock.yaml | The packages it lists were not installed, because it uses a yarn or pnpm lockfile, which plugin installs do not support.               |
      | bun.lockb      | Skipped installing this plugin's dependencies: its bun.lockb is a binary lockfile that cannot be checked; ship a text bun.lock instead. |

  Scenario: Updating a plugin installs the packages its new lockfile lists
    Given the npm registry serves these packages:
      | name    | version |
      | pkd-dep | 1.0.0   |
      | pkd-dep | 2.0.0   |
    Given the marketplace "tools" is published as a url source
    Given the marketplace "tools" offers these plugins:
      | name | version |
      | pkp  | 1.0.0   |
    Given the published plugin "pkp" of the marketplace "tools" depends on these npm packages:
      | name    | version |
      | pkd-dep | 1.0.0   |
    Given the marketplace "tools" is added to the project scope
    Given the user has run "/claude:plugin install pkp@tools --scope project"
    Given the marketplace "tools" offers these plugins:
      | name | version |
      | pkp  | 2.0.0   |
    Given the published plugin "pkp" of the marketplace "tools" depends on these npm packages:
      | name    | version |
      | pkd-dep | 2.0.0   |
    When the user runs "/claude:plugin update pkp@tools --scope project"
    Then the result has these fields:
      | kind         | cascade |
      | severity     | info    |
      | needs reload | true    |
    Then the result lists these plugins:
      | marketplace name | marketplace scope | id        | name | status  | reasons | scope   | from  | to    |
      | tools            | project           | pkp@tools | pkp  | updated |         | project | 1.0.0 | 2.0.0 |
    Then the npm registry receives these requests:
      | method | path                         | status |
      | GET    | /pkd-dep/-/pkd-dep-2.0.0.tgz | 200    |
    Then the plugin "pkp" installed in the project scope has these npm packages:
      | name    | version |
      | pkd-dep | 2.0.0   |

  Scenario: Reinstalling a plugin whose packages are installed makes no npm request
    Given the npm registry serves these packages:
      | name    | version |
      | pkd-dep | 1.0.0   |
    Given the marketplace "tools" is published as a url source
    Given the marketplace "tools" offers these plugins:
      | name | version |
      | pkp  | 1.0.0   |
    Given the published plugin "pkp" of the marketplace "tools" depends on these npm packages:
      | name    | version |
      | pkd-dep | 1.0.0   |
    Given the marketplace "tools" is added to the project scope
    Given the user has run "/claude:plugin install pkp@tools --scope project"
    Given the npm cache is empty
    When the user runs "/claude:plugin reinstall pkp@tools --scope project"
    Then the result has these fields:
      | kind         | cascade |
      | severity     | info    |
      | needs reload | true    |
    Then the result lists these plugins:
      | marketplace name | marketplace scope | id        | name | status      | reasons | scope   | version |
      | tools            | project           | pkp@tools | pkp  | reinstalled |         | project | 1.0.0   |
    Then the npm registry receives no request
    Then the plugin "pkp" installed in the project scope has these npm packages:
      | name    | version |
      | pkd-dep | 1.0.0   |

  Scenario: Reinstalling a plugin after its marketplace moved it to a new lockfile installs the new packages
    Given the npm registry serves these packages:
      | name    | version |
      | pkd-dep | 1.0.0   |
      | pkd-dep | 2.0.0   |
    Given the marketplace "tools" is published as a url source
    Given the marketplace "tools" offers these plugins:
      | name | version |
      | pkp  | 1.0.0   |
    Given the published plugin "pkp" of the marketplace "tools" depends on these npm packages:
      | name    | version |
      | pkd-dep | 1.0.0   |
    Given the marketplace "tools" is added to the project scope
    Given the user has run "/claude:plugin install pkp@tools --scope project"
    Given the marketplace "tools" offers these plugins:
      | name | version |
      | pkp  | 2.0.0   |
    Given the published plugin "pkp" of the marketplace "tools" depends on these npm packages:
      | name    | version |
      | pkd-dep | 2.0.0   |
    Given the user has run "/claude:plugin marketplace update tools --scope project"
    When the user runs "/claude:plugin reinstall pkp@tools --scope project"
    Then the result has these fields:
      | kind         | cascade |
      | severity     | info    |
      | needs reload | true    |
    Then the result lists these plugins:
      | marketplace name | marketplace scope | id        | name | status      | reasons | scope   | from  | version |
      | tools            | project           | pkp@tools | pkp  | reinstalled |         | project | 1.0.0 | 2.0.0   |
    Then the npm registry receives these requests:
      | method | path                         | status |
      | GET    | /pkd-dep/-/pkd-dep-2.0.0.tgz | 200    |
    Then the plugin "pkp" installed in the project scope has these npm packages:
      | name    | version |
      | pkd-dep | 2.0.0   |

  Scenario: Apply that moves a plugin whose package install fails reports the warning
    Given the npm registry serves these packages:
      | name    | version |
      | pkd-dep | 1.0.0   |
      | pkd-dep | 2.0.0   |
    Given the marketplace "tools" is published as a url source
    Given the marketplace "tools" offers these plugins:
      | name | version |
      | pkp  | 1.0.0   |
    Given the published plugin "pkp" of the marketplace "tools" depends on these npm packages:
      | name    | version |
      | pkd-dep | 1.0.0   |
    Given the marketplace "tools" is added to the project scope
    Given the user has run "/claude:plugin install pkp@tools --scope project"
    Given the marketplace "tools" offers these plugins:
      | name | version |
      | pkp  | 2.0.0   |
    Given the published plugin "pkp" of the marketplace "tools" depends on these npm packages:
      | name    | version |
      | pkd-dep | 2.0.0   |
    Given the user has run "/claude:plugin marketplace update tools --scope project"
    Given the npm registry answers 404 for the package "pkd-dep"
    When the user runs "/claude:plugin apply --scope project"
    Then the command reports these results:
      | kind                      | severity | needs reload | header                                                           | lines                                             | tally label | tally failures | tally warnings | tally success count |
      | reconcile-applied-cascade | info     | true         |                                                                  |                                                   | Reconcile   | 0              | 0              | 1                   |
      | diagnostic                | warning  | false        | Plugin "pkp" [project] updated; 1 declared component has a note. | Plugin dependency install failed (npm): no output |             |                |                |                     |
    Then the results list these marketplaces and plugins:
      | marketplace name | marketplace scope | id        | name | status  | reasons | scope   | from  | to    |
      | tools            | project           | pkp@tools | pkp  | updated |         | project | 1.0.0 | 2.0.0 |
    Then the npm registry receives these requests:
      | method | path                         | status |
      | GET    | /pkd-dep/-/pkd-dep-2.0.0.tgz | 404    |
    Then the installation record of the project scope holds these plugins:
      | id        | version | enabled |
      | pkp@tools | 2.0.0   | true    |
    Then the plugin "pkp" installed in the project scope has these npm packages:
      | name    | version |
      | pkd-dep | 1.0.0   |

  Scenario: A marketplace update with autoupdate on that moves a plugin whose package install fails reports the warning
    Given the npm registry serves these packages:
      | name    | version |
      | pkd-dep | 1.0.0   |
      | pkd-dep | 2.0.0   |
    Given the marketplace "tools" is published as a url source
    Given the marketplace "tools" offers these plugins:
      | name | version |
      | pkp  | 1.0.0   |
    Given the published plugin "pkp" of the marketplace "tools" depends on these npm packages:
      | name    | version |
      | pkd-dep | 1.0.0   |
    Given the marketplace "tools" is added to the project scope
    Given the user has run "/claude:plugin install pkp@tools --scope project"
    Given the user has run "/claude:plugin marketplace autoupdate tools --scope project"
    Given the marketplace "tools" offers these plugins:
      | name | version |
      | pkp  | 2.0.0   |
    Given the published plugin "pkp" of the marketplace "tools" depends on these npm packages:
      | name    | version |
      | pkd-dep | 2.0.0   |
    Given the npm registry answers 404 for the package "pkd-dep"
    When the user runs "/claude:plugin marketplace update tools --scope project"
    Then the command reports these results:
      | kind       | severity | needs reload | header                                                           | lines                                             |
      | cascade    | info     | true         |                                                                  |                                                   |
      | diagnostic | warning  | false        | Plugin "pkp" [project] updated; 1 declared component has a note. | Plugin dependency install failed (npm): no output |
    Then the results list these marketplaces and plugins:
      | marketplace name | marketplace scope | marketplace status | id        | name | status  | reasons | scope   | from  | to    |
      | tools            | project           | updated            | pkp@tools | pkp  | updated |         | project | 1.0.0 | 2.0.0 |
    Then the npm registry receives these requests:
      | method | path                         | status |
      | GET    | /pkd-dep/-/pkd-dep-2.0.0.tgz | 404    |
    Then the installation record of the project scope holds these plugins:
      | id        | version | enabled |
      | pkp@tools | 2.0.0   | true    |
    Then the plugin "pkp" installed in the project scope has these npm packages:
      | name    | version |
      | pkd-dep | 1.0.0   |

  Scenario: Installing a plugin again after uninstalling it installs the packages its current lockfile lists
    Given the npm registry serves these packages:
      | name    | version |
      | pkd-dep | 1.0.0   |
      | pkd-dep | 2.0.0   |
    Given the marketplace "tools" is published as a url source
    Given the marketplace "tools" offers these plugins:
      | name | version |
      | pkp  | 1.0.0   |
    Given the published plugin "pkp" of the marketplace "tools" depends on these npm packages:
      | name    | version |
      | pkd-dep | 1.0.0   |
    Given the marketplace "tools" is added to the project scope
    Given the user has run "/claude:plugin install pkp@tools --scope project"
    Given the user has run "/claude:plugin uninstall pkp@tools --scope project"
    Given the marketplace "tools" offers these plugins:
      | name | version |
      | pkp  | 2.0.0   |
    Given the published plugin "pkp" of the marketplace "tools" depends on these npm packages:
      | name    | version |
      | pkd-dep | 2.0.0   |
    Given the user has run "/claude:plugin marketplace update tools --scope project"
    When the user runs "/claude:plugin install pkp@tools --scope project"
    Then the result has these fields:
      | kind         | cascade |
      | severity     | info    |
      | needs reload | true    |
    Then the result lists these plugins:
      | marketplace name | marketplace scope | id        | name | status    | reasons | scope   | version |
      | tools            | project           | pkp@tools | pkp  | installed |         | project | 2.0.0   |
    Then the npm registry receives these requests:
      | method | path                         | status |
      | GET    | /pkd-dep/-/pkd-dep-2.0.0.tgz | 200    |
    Then the plugin "pkp" installed in the project scope has these npm packages:
      | name    | version |
      | pkd-dep | 2.0.0   |
