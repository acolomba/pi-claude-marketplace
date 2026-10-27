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
      | kind       | severity | needs reload | header                                                    | lines                                             |
      | cascade    | info     | true         |                                                           |                                                   |
      | diagnostic | warning  | false        | Plugin "pkp" installed; 1 declared component has a note. | Plugin dependency install failed (npm): no output |
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
