Feature: Plugin update dependencies

  Updating a plugin installs, enables or moves the dependencies its new version
  needs, dependencies first, or keeps the installed version when they cannot be
  met. The scenarios run the real extension in a headless Pi and use a local
  marketplace in place of a published one.

  Scenario: Updating a plugin whose new version needs a dependency that is not installed installs the dependency too
    Given the marketplace "tools" is published as a dir source
    Given the marketplace "tools" offers these plugins with dependencies:
      | name   | version | dependencies |
      | widget | 1.0.0   |              |
      | zcore  | 1.0.0   |              |
    Given the marketplace "tools" is added to the project scope
    Given the user has run "/claude:plugin install widget@tools --scope project"
    Given the marketplace "tools" offers these plugins with dependencies:
      | name   | version | dependencies |
      | widget | 1.1.0   | zcore        |
      | zcore  | 1.0.0   |              |
    When the user runs "/claude:plugin update widget@tools --scope project"
    Then the result has these fields:
      | kind         | cascade |
      | severity     | info    |
      | needs reload | true    |
    Then the result lists these plugins:
      | marketplace name | marketplace scope | id           | name        | status    | reasons | scope   | version | from  | to    |
      | tools            | project           | widget@tools | widget      | updated   |         | project |         | 1.0.0 | 1.1.0 |
      | tools            | project           | zcore@tools  | zcore@tools | installed |         | project | 1.0.0   |       |       |
    Then the installation record of the project scope holds these plugins:
      | id           | version | enabled |
      | widget@tools | 1.1.0   | true    |
      | zcore@tools  | 1.0.0   | true    |
    When the user starts a new pi session
    Then the session offers these skills:
      | command             | description              |
      | /skill:widget-skill | A skill of widget 1.1.0. |
      | /skill:zcore-skill  | A skill of zcore 1.0.0.  |

  Scenario: Updating a plugin whose new version needs a disabled dependency enables the dependency
    Given the marketplace "tools" is published as a dir source
    Given the marketplace "tools" offers these plugins with dependencies:
      | name   | version | dependencies |
      | widget | 1.0.0   |              |
      | zcore  | 1.0.0   |              |
    Given the marketplace "tools" is added to the project scope
    Given the user has run "/claude:plugin install widget@tools --scope project"
    Given the user has run "/claude:plugin install zcore@tools --scope project"
    Given the user has run "/claude:plugin disable zcore@tools --scope project"
    Given the marketplace "tools" offers these plugins with dependencies:
      | name   | version | dependencies |
      | widget | 1.1.0   | zcore        |
      | zcore  | 1.0.0   |              |
    When the user runs "/claude:plugin update widget@tools --scope project"
    Then the result has these fields:
      | kind         | cascade |
      | severity     | info    |
      | needs reload | true    |
    Then the result lists these plugins:
      | marketplace name | marketplace scope | id           | name        | status    | reasons                               | scope   | version | from  | to    |
      | tools            | project           | widget@tools | widget      | updated   |                                       | project |         | 1.0.0 | 1.1.0 |
      | tools            | project           | zcore@tools  | zcore@tools | installed | already installed, dependency enabled | project | 1.0.0   |       |       |
    Then the installation record of the project scope holds these plugins:
      | id           | version | enabled |
      | widget@tools | 1.1.0   | true    |
      | zcore@tools  | 1.0.0   | true    |
    When the user starts a new pi session
    Then the session offers these skills:
      | command             | description              |
      | /skill:widget-skill | A skill of widget 1.1.0. |
      | /skill:zcore-skill  | A skill of zcore 1.0.0.  |

  Scenario: Updating a plugin whose new version needs a newer version of an installed dependency moves the dependency first
    Given the marketplace "tools" is published as a dir source
    Given the marketplace "tools" offers these plugins with dependencies:
      | name   | version | dependencies |
      | widget | 1.0.0   | zcore        |
      | zcore  | 1.0.0   |              |
    Given the marketplace "tools" is added to the project scope
    Given the user has run "/claude:plugin install widget@tools --scope project"
    Given the marketplace "tools" offers these plugins with dependencies:
      | name   | version | dependencies |
      | widget | 1.1.0   | zcore@^2.0.0 |
      | zcore  | 2.0.0   |              |
    When the user runs "/claude:plugin update widget@tools --scope project"
    Then the result has these fields:
      | kind         | cascade |
      | severity     | info    |
      | needs reload | true    |
    Then the result lists these plugins:
      | marketplace name | marketplace scope | id           | name        | status  | reasons                 | scope   | from  | to    | cause chain                                                              | cause truncated | leaks | rollback partial |
      | tools            | project           | widget@tools | widget      | updated |                         | project | 1.0.0 | 1.1.0 |                                                                          |                 |       |                  |
      | tools            | project           | zcore@tools  | zcore@tools | updated | dependency current copy | project | 1.0.0 | 2.0.0 | constrained to the combined range (^2.0.0) -- required by "widget@tools" | false           |       |                  |
    Then the installation record of the project scope holds these plugins:
      | id           | version | enabled |
      | widget@tools | 1.1.0   | true    |
      | zcore@tools  | 2.0.0   | true    |
    When the user starts a new pi session
    Then the session offers these skills:
      | command             | description              |
      | /skill:widget-skill | A skill of widget 1.1.0. |
      | /skill:zcore-skill  | A skill of zcore 2.0.0.  |

  Scenario: Updating a plugin whose new version needs a dependency version no release offers fails and keeps the installed versions
    Given the marketplace "tools" is published as a dir source
    Given the marketplace "tools" offers these plugins with dependencies:
      | name   | version | dependencies |
      | widget | 1.0.0   | zcore        |
      | zcore  | 1.0.0   |              |
    Given the marketplace "tools" is added to the project scope
    Given the user has run "/claude:plugin install widget@tools --scope project"
    Given the marketplace "tools" offers these plugins with dependencies:
      | name   | version | dependencies |
      | widget | 1.1.0   | zcore@^2.0.0 |
      | zcore  | 1.5.0   |              |
    When the user runs "/claude:plugin update widget@tools --scope project"
    Then the result has these fields:
      | kind         | cascade                             |
      | severity     | error                               |
      | needs reload | false                               |
      | summary      | Some plugin operations have failed. |
    Then the result lists these plugins:
      | marketplace name | marketplace scope | id           | name        | status | reasons                             | scope   | version | cause chain                                                                                                                                                                                               | cause truncated | leaks | rollback partial |
      | tools            | project           | widget@tools | widget      | failed | dependency failed                   | project | 1.0.0   |                                                                                                                                                                                                           |                 |       |                  |
      | tools            | project           | zcore@tools  | zcore@tools | failed | already installed, version conflict | project | 1.0.0   | Dependency "zcore@tools" is installed at version 1.0.0, which does not satisfy ^2.0.0, and cannot move: version 1.5.0 falls outside what the combined range admits (^2.0.0) -- required by "widget@tools" | false           |       |                  |
    Then the installation record of the project scope holds these plugins:
      | id           | version | enabled |
      | widget@tools | 1.0.0   | true    |
      | zcore@tools  | 1.0.0   | true    |
    Then the project scope stages these skills and prompts:
      | kind  | name         |
      | skill | widget-skill |
      | skill | zcore-skill  |
    Then the "claude-plugins.json" file of the project scope declares these plugins:
      | id           |
      | widget@tools |

  Scenario: Autoupdating a marketplace installs the dependency a plugin's new version needs
    Given the marketplace "tools" is published as a dir source
    Given the marketplace "tools" offers these plugins with dependencies:
      | name   | version | dependencies |
      | widget | 1.0.0   |              |
      | zcore  | 1.0.0   |              |
    Given the marketplace "tools" is added to the project scope
    Given the user has run "/claude:plugin install widget@tools --scope project"
    Given the user has run "/claude:plugin marketplace autoupdate tools --scope project"
    Given the marketplace "tools" offers these plugins with dependencies:
      | name   | version | dependencies |
      | widget | 1.1.0   | zcore        |
      | zcore  | 1.0.0   |              |
    When the user runs "/claude:plugin marketplace update tools --scope project"
    Then the result has these fields:
      | kind         | cascade |
      | severity     | info    |
      | needs reload | true    |
    Then the results list these marketplaces and plugins:
      | marketplace name | marketplace scope | marketplace status | id           | name        | status    | reasons | scope   | version | from  | to    |
      | tools            | project           | updated            | widget@tools | widget      | updated   |         | project |         | 1.0.0 | 1.1.0 |
      | tools            | project           | updated            | zcore@tools  | zcore@tools | installed |         | project | 1.0.0   |       |       |
    Then the installation record of the project scope holds these plugins:
      | id           | version | enabled |
      | widget@tools | 1.1.0   | true    |
      | zcore@tools  | 1.0.0   | true    |

  Scenario: Updating a plugin whose new version needs a newer version of a git-source dependency moves the dependency first
    Given the git repository "lib" holds these plugins:
      | name | version | path |
      | lib  | 1.0.0   |      |
    Given the marketplace "tools" is published as a dir source
    Given the marketplace "tools" offers these plugins with dependencies:
      | name | version | dependencies |
      | app  | 1.0.0   | lib          |
    Given the marketplace "tools" offers these plugins from git repositories:
      | name | source kind | repository | pinned |
      | lib  | url         | lib        | false  |
    Given the marketplace "tools" is added to the project scope
    Given the user has run "/claude:plugin install app@tools --scope project"
    Given the git repository "lib" holds these plugins:
      | name | version | path |
      | lib  | 2.0.0   |      |
    Given the marketplace "tools" offers these plugins with dependencies:
      | name | version | dependencies |
      | app  | 1.1.0   | lib@^2.0.0   |
    Given the marketplace "tools" offers these plugins from git repositories:
      | name | source kind | repository | pinned |
      | lib  | url         | lib        | false  |
    When the user runs "/claude:plugin update app@tools --scope project"
    Then the result has these fields:
      | kind         | cascade |
      | severity     | info    |
      | needs reload | true    |
    Then the result lists these plugins:
      | marketplace name | marketplace scope | id        | name      | status  | reasons | scope   | from  | to    | cause chain                                                           | cause truncated | leaks | rollback partial |
      | tools            | project           | app@tools | app       | updated |         | project | 1.0.0 | 1.1.0 |                                                                       |                 |       |                  |
      | tools            | project           | lib@tools | lib@tools | updated |         | project | 1.0.0 | 2.0.0 | constrained to the combined range (^2.0.0) -- required by "app@tools" | false           |       |                  |
    Then the installation record of the project scope holds these plugins:
      | id        | version | enabled |
      | app@tools | 1.1.0   | true    |
      | lib@tools | 2.0.0   | true    |

  Scenario: Updating a dependency is held by the range a git-source plugin's installed copy declares
    Given the git repository "app" holds these plugins:
      | name | version | path | dependencies |
      | app  | 1.0.0   |      | lib@^1.0.0   |
    Given the marketplace "tools" is published as a dir source
    Given the marketplace "tools" offers these plugins with dependencies:
      | name | version | dependencies |
      | lib  | 1.0.0   |              |
    Given the marketplace "tools" offers these plugins from git repositories:
      | name | source kind | repository | pinned |
      | app  | url         | app        | true   |
    Given the marketplace "tools" is added to the project scope
    Given the user has run "/claude:plugin install lib@tools --scope project"
    Given the user has run "/claude:plugin install app@tools --scope project"
    Given the git repository "app" holds these plugins:
      | name | version | path |
      | app  | 1.0.0   |      |
    Given the marketplace "tools" offers these plugins with dependencies:
      | name | version | dependencies |
      | lib  | 2.0.0   |              |
    Given the marketplace "tools" offers these plugins from git repositories:
      | name | source kind | repository | pinned |
      | app  | url         | app        | true   |
    When the user runs "/claude:plugin update lib@tools --scope project"
    Then the result has these fields:
      | kind         | cascade                             |
      | severity     | warning                             |
      | needs reload | false                               |
      | summary      | A plugin operation needs attention. |
    Then the result lists these plugins:
      | marketplace name | marketplace scope | id        | name | status  | reasons              | scope   | version | cause chain                                                                                    | cause truncated | leaks | rollback partial |
      | tools            | project           | lib@tools | lib  | skipped | dependents constrain | project | 1.0.0   | version 2.0.0 falls outside what the combined range admits (^1.0.0) -- required by "app@tools" | false           |       |                  |
    Then the installation record of the project scope holds these plugins:
      | id        | version | enabled |
      | app@tools | 1.0.0   | true    |
      | lib@tools | 1.0.0   | true    |

  Scenario: Updating a dependency recorded at the highest release tag its range admits leaves it up to date
    Given the git repository "lib" holds these plugins:
      | name | version | path |
      | lib  | 1.0.0   |      |
    Given the git repository "lib" has a revision only the tag "lib--v2.0.0" reaches, holding these plugins:
      | name | version | path |
      | lib  | 2.0.0   |      |
    Given the marketplace "tools" is published as a dir source
    Given the marketplace "tools" offers these plugins with dependencies:
      | name | version | dependencies |
      | app  | 1.0.0   | lib@^2.0.0   |
    Given the marketplace "tools" offers these plugins from git repositories:
      | name | source kind | repository | pinned |
      | lib  | url         | lib        | false  |
    Given the marketplace "tools" is added to the project scope
    Given the user has run "/claude:plugin install app@tools --scope project"
    When the user runs "/claude:plugin update lib@tools --scope project"
    Then the result has these fields:
      | kind         | cascade |
      | severity     | info    |
      | needs reload | false   |
    Then the result lists these plugins:
      | marketplace name | marketplace scope | id        | name | status  | reasons    | scope   | cause chain                                                                               | cause truncated | leaks | rollback partial |
      | tools            | project           | lib@tools | lib  | skipped | up-to-date | project | already the highest version the combined range admits (^2.0.0) -- required by "app@tools" | false           |       |                  |
    Then the installation record of the project scope holds these plugins:
      | id        | version                | enabled |
      | app@tools | 1.0.0                  | true    |
      | lib@tools | 2.0.0-{lib revision 2} | true    |

  Scenario: Updating a dependency to a newer release tag its range admits records the new tag's commit
    Given the git repository "lib" holds these plugins:
      | name | version | path |
      | lib  | 1.0.0   |      |
    Given the git repository "lib" has a revision only the tag "lib--v2.0.0" reaches, holding these plugins:
      | name | version | path |
      | lib  | 2.0.0   |      |
    Given the marketplace "tools" is published as a dir source
    Given the marketplace "tools" offers these plugins with dependencies:
      | name | version | dependencies |
      | app  | 1.0.0   | lib@^2.0.0   |
    Given the marketplace "tools" offers these plugins from git repositories:
      | name | source kind | repository | pinned |
      | lib  | url         | lib        | false  |
    Given the marketplace "tools" is added to the project scope
    Given the user has run "/claude:plugin install app@tools --scope project"
    Given the git repository "lib" has a revision only the tag "lib--v2.1.0" reaches, holding these plugins:
      | name | version | path |
      | lib  | 2.1.0   |      |
    When the user runs "/claude:plugin update lib@tools --scope project"
    Then the result has these fields:
      | kind         | cascade |
      | severity     | info    |
      | needs reload | true    |
    Then the result lists these plugins:
      | marketplace name | marketplace scope | id        | name | status  | reasons | scope   | from                   | to                     | cause chain                                                                               | cause truncated | leaks | rollback partial |
      | tools            | project           | lib@tools | lib  | updated |         | project | 2.0.0-{lib revision 2} | 2.1.0-{lib revision 3} | already the highest version the combined range admits (^2.0.0) -- required by "app@tools" | false           |       |                  |
    Then the installation record of the project scope holds these plugins:
      | id        | version                | enabled |
      | app@tools | 1.0.0                  | true    |
      | lib@tools | 2.1.0-{lib revision 3} | true    |

  Scenario: Updating a dependency no range holds any longer at its release tag's commit records the version without the tag's commit
    Given the git repository "lib" holds these plugins:
      | name | version | path |
      | lib  | 1.0.0   |      |
    Given the git repository "lib" has a revision only the tag "lib--v2.0.0" reaches, holding these plugins:
      | name | version | path |
      | lib  | 2.0.0   |      |
    Given the marketplace "tools" is published as a dir source
    Given the marketplace "tools" offers these plugins with dependencies:
      | name | version | dependencies |
      | app  | 1.0.0   | lib@^2.0.0   |
    Given the marketplace "tools" offers these plugins from git repositories:
      | name | source kind | repository | pinned |
      | lib  | url         | lib        | true   |
    Given the marketplace "tools" is added to the project scope
    Given the user has run "/claude:plugin install app@tools --scope project"
    Given the user has run "/claude:plugin uninstall app@tools --scope project"
    When the user runs "/claude:plugin update lib@tools --scope project"
    Then the result has these fields:
      | kind         | cascade |
      | severity     | info    |
      | needs reload | true    |
    Then the result lists these plugins:
      | marketplace name | marketplace scope | id        | name | status  | reasons | scope   | from                   | to    |
      | tools            | project           | lib@tools | lib  | updated |         | project | 2.0.0-{lib revision 2} | 2.0.0 |
    Then the installation record of the project scope holds these plugins:
      | id        | version | enabled |
      | lib@tools | 2.0.0   | true    |

  Scenario: Updating again a dependency recorded without its release tag's commit leaves it up to date
    Given the git repository "lib" holds these plugins:
      | name | version | path |
      | lib  | 1.0.0   |      |
    Given the git repository "lib" has a revision only the tag "lib--v2.0.0" reaches, holding these plugins:
      | name | version | path |
      | lib  | 2.0.0   |      |
    Given the marketplace "tools" is published as a dir source
    Given the marketplace "tools" offers these plugins with dependencies:
      | name | version | dependencies |
      | app  | 1.0.0   | lib@^2.0.0   |
    Given the marketplace "tools" offers these plugins from git repositories:
      | name | source kind | repository | pinned |
      | lib  | url         | lib        | true   |
    Given the marketplace "tools" is added to the project scope
    Given the user has run "/claude:plugin install app@tools --scope project"
    Given the user has run "/claude:plugin uninstall app@tools --scope project"
    Given the user has run "/claude:plugin update lib@tools --scope project"
    When the user runs "/claude:plugin update lib@tools --scope project"
    Then the result has these fields:
      | kind         | cascade |
      | severity     | info    |
      | needs reload | false   |
    Then the result lists these plugins:
      | marketplace name | marketplace scope | id        | name | status  | reasons    | scope   |
      | tools            | project           | lib@tools | lib  | skipped | up-to-date | project |
    Then the installation record of the project scope holds these plugins:
      | id        | version | enabled |
      | lib@tools | 2.0.0   | true    |

  Scenario: Updating an anthropic-plugin-directory dependency its range holds leaves it at its listed copy, not a newer release tag
    Given the git repository "dirp" holds these plugins:
      | name | version | path |
      | dirp | 1.0.0   |      |
    Given the marketplace "anthropic-plugin-directory" is published as a dir source
    Given the marketplace "anthropic-plugin-directory" offers these plugins with dependencies:
      | name | version | dependencies |
      | app  | 1.0.0   | dirp@^1.0.0  |
    Given the marketplace "anthropic-plugin-directory" offers these plugins from git repositories:
      | name | source kind | repository | pinned |
      | dirp | url         | dirp       | false  |
    Given the marketplace "anthropic-plugin-directory" is added to the project scope
    Given the user has run "/claude:plugin install dirp@anthropic-plugin-directory --scope project"
    Given the user has run "/claude:plugin install app@anthropic-plugin-directory --scope project"
    Given the git repository "dirp" has a revision only the tag "dirp--v1.5.0" reaches, holding these plugins:
      | name | version | path |
      | dirp | 1.5.0   |      |
    When the user runs "/claude:plugin update dirp@anthropic-plugin-directory --scope project"
    Then the result has these fields:
      | kind         | cascade |
      | severity     | info    |
      | needs reload | false   |
    Then the result lists these plugins:
      | marketplace name           | marketplace scope | id                              | name | status  | reasons    | scope   | cause chain                                                                                | cause truncated | leaks | rollback partial |
      | anthropic-plugin-directory | project           | dirp@anthropic-plugin-directory | dirp | skipped | up-to-date | project | constrained to the combined range (^1.0.0) -- required by "app@anthropic-plugin-directory" | false           |       |                  |
    Then the installation record of the project scope holds these plugins:
      | id                              | version | enabled |
      | app@anthropic-plugin-directory  | 1.0.0   | true    |
      | dirp@anthropic-plugin-directory | 1.0.0   | true    |

  Scenario: Updating a pinned anthropic-plugin-directory dependency still listed at its recorded commit leaves it up to date, even outside a dependent's range
    Given the git repository "dirp" holds these plugins:
      | name | version | path |
      | dirp | 1.0.0   |      |
    Given the marketplace "anthropic-plugin-directory" is published as a dir source
    Given the marketplace "anthropic-plugin-directory" offers these plugins with dependencies:
      | name | version | dependencies |
      | app  | 1.0.0   | dirp@^1.0.0  |
    Given the marketplace "anthropic-plugin-directory" offers these plugins from git repositories:
      | name | source kind | repository | pinned |
      | dirp | url         | dirp       | true   |
    Given the marketplace "anthropic-plugin-directory" is added to the project scope
    Given the user has run "/claude:plugin install app@anthropic-plugin-directory --scope project"
    Given the marketplace "anthropic-plugin-directory" offers these plugins with dependencies:
      | name | version | dependencies |
      | app  | 1.0.0   | dirp@^2.0.0  |
    Given the marketplace "anthropic-plugin-directory" offers these plugins from git repositories:
      | name | source kind | repository | pinned |
      | dirp | url         | dirp       | true   |
    When the user runs "/claude:plugin update dirp@anthropic-plugin-directory --scope project"
    Then the result has these fields:
      | kind         | cascade |
      | severity     | info    |
      | needs reload | false   |
    Then the result lists these plugins:
      | marketplace name           | marketplace scope | id                              | name | status  | reasons    | scope   |
      | anthropic-plugin-directory | project           | dirp@anthropic-plugin-directory | dirp | skipped | up-to-date | project |
    Then the installation record of the project scope holds these plugins:
      | id                              | version                 | enabled |
      | app@anthropic-plugin-directory  | 1.0.0                   | true    |
      | dirp@anthropic-plugin-directory | 1.0.0-{dirp revision 1} | true    |

  Scenario: Updating every plugin installs the dependency a plugin's new version needs
    Given the marketplace "tools" is published as a dir source
    Given the marketplace "tools" offers these plugins with dependencies:
      | name   | version | dependencies |
      | widget | 1.0.0   |              |
      | zcore  | 1.0.0   |              |
    Given the marketplace "tools" is added to the project scope
    Given the user has run "/claude:plugin install widget@tools --scope project"
    Given the marketplace "tools" offers these plugins with dependencies:
      | name   | version | dependencies |
      | widget | 1.1.0   | zcore        |
      | zcore  | 1.0.0   |              |
    When the user runs "/claude:plugin update --scope project"
    Then the result has these fields:
      | kind                | cascade       |
      | severity            | info          |
      | needs reload        | true          |
      | tally label         | Plugin update |
      | tally failures      | 0             |
      | tally warnings      | 0             |
      | tally success count | 1             |
      | tally success verb  | updated       |
    Then the result lists these plugins:
      | marketplace name | marketplace scope | id           | name        | status    | reasons | scope   | version | from  | to    |
      | tools            | project           | widget@tools | widget      | updated   |         | project |         | 1.0.0 | 1.1.0 |
      | tools            | project           | zcore@tools  | zcore@tools | installed |         | project | 1.0.0   |       |       |
    Then the installation record of the project scope holds these plugins:
      | id           | version | enabled |
      | widget@tools | 1.1.0   | true    |
      | zcore@tools  | 1.0.0   | true    |

  Scenario: Autoupdating a marketplace does not install a partially supported dependency a plugin's new version needs
    Given the marketplace "tools" is published as a dir source
    Given the marketplace "tools" offers these plugins with dependencies:
      | name   | version | dependencies |
      | widget | 1.0.0   |              |
    Given the marketplace "tools" is added to the project scope
    Given the user has run "/claude:plugin install widget@tools --scope project"
    Given the user has run "/claude:plugin marketplace autoupdate tools --scope project"
    Given the marketplace "tools" offers these plugins with dependencies:
      | name   | version | dependencies |
      | widget | 1.1.0   | zcore        |
      | zcore  | 1.0.0   |              |
    Given the published plugin "zcore" of the marketplace "tools" has an output style
    When the user runs "/claude:plugin marketplace update tools --scope project"
    Then the result has these fields:
      | kind         | cascade                             |
      | severity     | error                               |
      | needs reload | false                               |
      | summary      | Some plugin operations have failed. |
    Then the results list these marketplaces and plugins:
      | marketplace name | marketplace scope | marketplace status | id           | name        | status | reasons           | scope   | version | cause chain                                              | cause truncated | leaks | rollback partial |
      | tools            | project           | updated            | widget@tools | widget      | failed | dependency failed | project | 1.0.0   |                                                          |                 |       |                  |
      | tools            | project           | updated            | zcore@tools  | zcore@tools | failed |                   | project |         | Plugin "zcore" is not installable: contains outputStyles | false           |       |                  |
    Then the installation record of the project scope holds these plugins:
      | id           | version | enabled |
      | widget@tools | 1.0.0   | true    |

  Scenario: Autoupdating a marketplace moves the installed dependency a plugin's new version needs at a newer version
    Given the marketplace "tools" is published as a dir source
    Given the marketplace "tools" offers these plugins with dependencies:
      | name   | version | dependencies |
      | widget | 1.0.0   | zcore        |
      | zcore  | 1.0.0   |              |
    Given the marketplace "tools" is added to the project scope
    Given the user has run "/claude:plugin install widget@tools --scope project"
    Given the user has run "/claude:plugin marketplace autoupdate tools --scope project"
    Given the marketplace "tools" offers these plugins with dependencies:
      | name   | version | dependencies |
      | widget | 1.1.0   | zcore@^2.0.0 |
      | zcore  | 2.0.0   |              |
    When the user runs "/claude:plugin marketplace update tools --scope project"
    Then the result has these fields:
      | kind         | cascade |
      | severity     | info    |
      | needs reload | true    |
    Then the results list these marketplaces and plugins:
      | marketplace name | marketplace scope | marketplace status | id           | name   | status  | reasons                 | scope   | from  | to    | cause chain                                                              | cause truncated | leaks | rollback partial |
      | tools            | project           | updated            | zcore@tools  | zcore  | updated | dependency current copy | project | 1.0.0 | 2.0.0 | constrained to the combined range (^2.0.0) -- required by "widget@tools" | false           |       |                  |
      | tools            | project           | updated            | widget@tools | widget | updated |                         | project | 1.0.0 | 1.1.0 |                                                                          |                 |       |                  |
    Then the installation record of the project scope holds these plugins:
      | id           | version | enabled |
      | widget@tools | 1.1.0   | true    |
      | zcore@tools  | 2.0.0   | true    |

  Scenario: Updating every plugin moves the installed dependency a plugin's new version needs at a newer version
    Given the marketplace "tools" is published as a dir source
    Given the marketplace "tools" offers these plugins with dependencies:
      | name   | version | dependencies |
      | widget | 1.0.0   | zcore        |
      | zcore  | 1.0.0   |              |
    Given the marketplace "tools" is added to the project scope
    Given the user has run "/claude:plugin install widget@tools --scope project"
    Given the marketplace "tools" offers these plugins with dependencies:
      | name   | version | dependencies |
      | widget | 1.1.0   | zcore@^2.0.0 |
      | zcore  | 2.0.0   |              |
    When the user runs "/claude:plugin update --scope project"
    Then the result has these fields:
      | kind                | cascade       |
      | severity            | info          |
      | needs reload        | true          |
      | tally label         | Plugin update |
      | tally failures      | 0             |
      | tally warnings      | 0             |
      | tally success count | 2             |
      | tally success verb  | updated       |
    Then the result lists these plugins:
      | marketplace name | marketplace scope | id           | name   | status  | reasons                 | scope   | from  | to    | cause chain                                                              | cause truncated | leaks | rollback partial |
      | tools            | project           | zcore@tools  | zcore  | updated | dependency current copy | project | 1.0.0 | 2.0.0 | constrained to the combined range (^2.0.0) -- required by "widget@tools" | false           |       |                  |
      | tools            | project           | widget@tools | widget | updated |                         | project | 1.0.0 | 1.1.0 |                                                                          |                 |       |                  |
    Then the installation record of the project scope holds these plugins:
      | id           | version | enabled |
      | widget@tools | 1.1.0   | true    |
      | zcore@tools  | 2.0.0   | true    |
