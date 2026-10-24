Feature: Plugin state lock

  A command that changes a scope fails and changes nothing while another
  process holds the scope's state lock. A helper process holds the lock as a
  second Pi would, and a local marketplace stands in for a published one.

  Scenario: Uninstalling a plugin from the project scope while another process holds its state lock fails as lock held
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the marketplace "fixtures" is added to the project scope
    Given the user has run "/claude:plugin install demo@fixtures --scope project"
    Given another process holds the state lock of the project scope
    When the user runs "/claude:plugin uninstall demo@fixtures --scope project"
    Then the result has these fields:
      | kind         | cascade                        |
      | severity     | error                          |
      | needs reload | false                          |
      | summary      | A plugin operation has failed. |
    Then the result lists these plugins:
      | marketplace name | marketplace scope | id            | name | status | reasons   | scope   | cause chain                                                                                                                                                                                | cause truncated | leaks | rollback partial |
      | fixtures         | project           | demo@fixtures | demo | failed | lock held | project | Another pi-claude-marketplace operation is in progress for project scope ({project dir}/.pi/pi-claude-marketplace/.state-lock). Retry after it completes., Lock file is already being held | false           |       |                  |
    Then the installation record of the project scope holds these plugins:
      | id            | version | enabled |
      | demo@fixtures | 1.0.0   | true    |
    Then the "claude-plugins.json" file of the project scope declares these plugins:
      | id            |
      | demo@fixtures |
    Then the project scope stages these skills and prompts:
      | kind  | name       |
      | skill | demo-skill |

  Scenario: Uninstalling a plugin from the user scope while another process holds its state lock fails as lock held
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the marketplace "fixtures" is added to the user scope
    Given the user has run "/claude:plugin install demo@fixtures --scope user"
    Given another process holds the state lock of the user scope
    When the user runs "/claude:plugin uninstall demo@fixtures --scope user"
    Then the result has these fields:
      | kind         | cascade                        |
      | severity     | error                          |
      | needs reload | false                          |
      | summary      | A plugin operation has failed. |
    Then the result lists these plugins:
      | marketplace name | marketplace scope | id            | name | status | reasons   | scope | cause chain                                                                                                                                                                       | cause truncated | leaks | rollback partial |
      | fixtures         | user              | demo@fixtures | demo | failed | lock held | user  | Another pi-claude-marketplace operation is in progress for user scope ({agent dir}/pi-claude-marketplace/.state-lock). Retry after it completes., Lock file is already being held | false           |       |                  |
    Then the installation record of the user scope holds these plugins:
      | id            | version | enabled |
      | demo@fixtures | 1.0.0   | true    |
    Then the "claude-plugins.json" file of the user scope declares these plugins:
      | id            |
      | demo@fixtures |
    Then the user scope stages these skills and prompts:
      | kind  | name       |
      | skill | demo-skill |

  Scenario: Installing a plugin into the project scope while another process holds its state lock fails as lock held
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the marketplace "fixtures" is added to the project scope
    Given another process holds the state lock of the project scope
    When the user runs "/claude:plugin install demo@fixtures --scope project"
    Then the result has these fields:
      | kind         | cascade                        |
      | severity     | error                          |
      | needs reload | false                          |
      | summary      | A plugin operation has failed. |
    Then the result lists these plugins:
      | marketplace name | marketplace scope | id            | name | status | reasons   | scope   | cause chain                                                                                                                                                                                | cause truncated | leaks | rollback partial |
      | fixtures         | project           | demo@fixtures | demo | failed | lock held | project | Another pi-claude-marketplace operation is in progress for project scope ({project dir}/.pi/pi-claude-marketplace/.state-lock). Retry after it completes., Lock file is already being held | false           |       |                  |
    Then the project scope has no installed plugins
    Then the "claude-plugins.json" file of the project scope declares no plugins

  Scenario: Installing a plugin into the user scope while another process holds its state lock fails as lock held
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the marketplace "fixtures" is added to the user scope
    Given another process holds the state lock of the user scope
    When the user runs "/claude:plugin install demo@fixtures --scope user"
    Then the result has these fields:
      | kind         | cascade                        |
      | severity     | error                          |
      | needs reload | false                          |
      | summary      | A plugin operation has failed. |
    Then the result lists these plugins:
      | marketplace name | marketplace scope | id            | name | status | reasons   | scope | cause chain                                                                                                                                                                       | cause truncated | leaks | rollback partial |
      | fixtures         | user              | demo@fixtures | demo | failed | lock held | user  | Another pi-claude-marketplace operation is in progress for user scope ({agent dir}/pi-claude-marketplace/.state-lock). Retry after it completes., Lock file is already being held | false           |       |                  |
    Then the user scope has no installed plugins
    Then the "claude-plugins.json" file of the user scope declares no plugins

  Scenario: Enabling a plugin in the project scope while another process holds its state lock fails as lock held
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
      | keep | 1.0.0   |
    Given the marketplace "fixtures" is added to the project scope
    Given the user has run "/claude:plugin install demo@fixtures --scope project"
    Given the user has run "/claude:plugin install keep@fixtures --scope project"
    Given the user has run "/claude:plugin disable demo@fixtures --scope project"
    Given another process holds the state lock of the project scope
    When the user runs "/claude:plugin enable demo@fixtures --scope project"
    Then the result has these fields:
      | kind         | cascade                        |
      | severity     | error                          |
      | needs reload | false                          |
      | summary      | A plugin operation has failed. |
    Then the result lists these plugins:
      | marketplace name | marketplace scope | id            | name | status | reasons   | scope   | cause chain                                                                                                                                                                                | cause truncated | leaks | rollback partial |
      | fixtures         | project           | demo@fixtures | demo | failed | lock held | project | Another pi-claude-marketplace operation is in progress for project scope ({project dir}/.pi/pi-claude-marketplace/.state-lock). Retry after it completes., Lock file is already being held | false           |       |                  |
    Then the installation record of the project scope holds these plugins:
      | id            | version | enabled |
      | demo@fixtures | 1.0.0   | false   |
      | keep@fixtures | 1.0.0   | true    |
    Then the "claude-plugins.json" file of the project scope declares these plugins:
      | id            | enabled |
      | demo@fixtures | false   |
      | keep@fixtures |         |
    Then the project scope stages these skills and prompts:
      | kind  | name       |
      | skill | keep-skill |

  Scenario: Enabling a plugin in the user scope while another process holds its state lock fails as lock held
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
      | keep | 1.0.0   |
    Given the marketplace "fixtures" is added to the user scope
    Given the user has run "/claude:plugin install demo@fixtures --scope user"
    Given the user has run "/claude:plugin install keep@fixtures --scope user"
    Given the user has run "/claude:plugin disable demo@fixtures --scope user"
    Given another process holds the state lock of the user scope
    When the user runs "/claude:plugin enable demo@fixtures --scope user"
    Then the result has these fields:
      | kind         | cascade                        |
      | severity     | error                          |
      | needs reload | false                          |
      | summary      | A plugin operation has failed. |
    Then the result lists these plugins:
      | marketplace name | marketplace scope | id            | name | status | reasons   | scope | cause chain                                                                                                                                                                       | cause truncated | leaks | rollback partial |
      | fixtures         | user              | demo@fixtures | demo | failed | lock held | user  | Another pi-claude-marketplace operation is in progress for user scope ({agent dir}/pi-claude-marketplace/.state-lock). Retry after it completes., Lock file is already being held | false           |       |                  |
    Then the installation record of the user scope holds these plugins:
      | id            | version | enabled |
      | demo@fixtures | 1.0.0   | false   |
      | keep@fixtures | 1.0.0   | true    |
    Then the "claude-plugins.json" file of the user scope declares these plugins:
      | id            | enabled |
      | demo@fixtures | false   |
      | keep@fixtures |         |
    Then the user scope stages these skills and prompts:
      | kind  | name       |
      | skill | keep-skill |

  Scenario: Disabling a plugin in the project scope while another process holds its state lock fails as lock held
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the marketplace "fixtures" is added to the project scope
    Given the user has run "/claude:plugin install demo@fixtures --scope project"
    Given another process holds the state lock of the project scope
    When the user runs "/claude:plugin disable demo@fixtures --scope project"
    Then the result has these fields:
      | kind         | cascade                        |
      | severity     | error                          |
      | needs reload | false                          |
      | summary      | A plugin operation has failed. |
    Then the result lists these plugins:
      | marketplace name | marketplace scope | id            | name | status | reasons   | scope   | cause chain                                                                                                                                                                                | cause truncated | leaks | rollback partial |
      | fixtures         | project           | demo@fixtures | demo | failed | lock held | project | Another pi-claude-marketplace operation is in progress for project scope ({project dir}/.pi/pi-claude-marketplace/.state-lock). Retry after it completes., Lock file is already being held | false           |       |                  |
    Then the installation record of the project scope holds these plugins:
      | id            | version | enabled |
      | demo@fixtures | 1.0.0   | true    |
    Then the "claude-plugins.json" file of the project scope declares these plugins:
      | id            |
      | demo@fixtures |
    Then the project scope stages these skills and prompts:
      | kind  | name       |
      | skill | demo-skill |

  Scenario: Disabling a plugin in the user scope while another process holds its state lock fails as lock held
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the marketplace "fixtures" is added to the user scope
    Given the user has run "/claude:plugin install demo@fixtures --scope user"
    Given another process holds the state lock of the user scope
    When the user runs "/claude:plugin disable demo@fixtures --scope user"
    Then the result has these fields:
      | kind         | cascade                        |
      | severity     | error                          |
      | needs reload | false                          |
      | summary      | A plugin operation has failed. |
    Then the result lists these plugins:
      | marketplace name | marketplace scope | id            | name | status | reasons   | scope | cause chain                                                                                                                                                                       | cause truncated | leaks | rollback partial |
      | fixtures         | user              | demo@fixtures | demo | failed | lock held | user  | Another pi-claude-marketplace operation is in progress for user scope ({agent dir}/pi-claude-marketplace/.state-lock). Retry after it completes., Lock file is already being held | false           |       |                  |
    Then the installation record of the user scope holds these plugins:
      | id            | version | enabled |
      | demo@fixtures | 1.0.0   | true    |
    Then the "claude-plugins.json" file of the user scope declares these plugins:
      | id            |
      | demo@fixtures |
    Then the user scope stages these skills and prompts:
      | kind  | name       |
      | skill | demo-skill |

  Scenario: Updating a plugin in the project scope while another process holds its state lock fails as lock held
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the marketplace "fixtures" is added to the project scope
    Given the user has run "/claude:plugin install demo@fixtures --scope project"
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.1.0   |
    Given another process holds the state lock of the project scope
    When the user runs "/claude:plugin update demo@fixtures --scope project"
    Then the result has these fields:
      | kind         | cascade                        |
      | severity     | error                          |
      | needs reload | false                          |
      | summary      | A plugin operation has failed. |
    Then the result lists these plugins:
      | marketplace name | marketplace scope | id            | name | status | reasons   | scope   | from  | version | cause chain                                                                                                                                                                                | cause truncated | leaks | rollback partial |
      | fixtures         | project           | demo@fixtures | demo | failed | lock held | project | 1.0.0 | 1.1.0   | Another pi-claude-marketplace operation is in progress for project scope ({project dir}/.pi/pi-claude-marketplace/.state-lock). Retry after it completes., Lock file is already being held | false           |       |                  |
    Then the installation record of the project scope holds these plugins:
      | id            | version | enabled |
      | demo@fixtures | 1.0.0   | true    |
    Then the "claude-plugins.json" file of the project scope declares these plugins:
      | id            |
      | demo@fixtures |
    Then the project scope stages these skills and prompts:
      | kind  | name       |
      | skill | demo-skill |

  Scenario: Updating a plugin in the user scope while another process holds its state lock fails as lock held
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the marketplace "fixtures" is added to the user scope
    Given the user has run "/claude:plugin install demo@fixtures --scope user"
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.1.0   |
    Given another process holds the state lock of the user scope
    When the user runs "/claude:plugin update demo@fixtures --scope user"
    Then the result has these fields:
      | kind         | cascade                        |
      | severity     | error                          |
      | needs reload | false                          |
      | summary      | A plugin operation has failed. |
    Then the result lists these plugins:
      | marketplace name | marketplace scope | id            | name | status | reasons   | scope | from  | version | cause chain                                                                                                                                                                       | cause truncated | leaks | rollback partial |
      | fixtures         | user              | demo@fixtures | demo | failed | lock held | user  | 1.0.0 | 1.1.0   | Another pi-claude-marketplace operation is in progress for user scope ({agent dir}/pi-claude-marketplace/.state-lock). Retry after it completes., Lock file is already being held | false           |       |                  |
    Then the installation record of the user scope holds these plugins:
      | id            | version | enabled |
      | demo@fixtures | 1.0.0   | true    |
    Then the "claude-plugins.json" file of the user scope declares these plugins:
      | id            |
      | demo@fixtures |
    Then the user scope stages these skills and prompts:
      | kind  | name       |
      | skill | demo-skill |

  Scenario: Reinstalling a plugin in the project scope while another process holds its state lock fails as lock held
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the marketplace "fixtures" is added to the project scope
    Given the user has run "/claude:plugin install demo@fixtures --scope project"
    Given another process holds the state lock of the project scope
    When the user runs "/claude:plugin reinstall demo@fixtures --scope project"
    Then the result has these fields:
      | kind         | cascade                        |
      | severity     | error                          |
      | needs reload | false                          |
      | summary      | A plugin operation has failed. |
    Then the result lists these plugins:
      | marketplace name | marketplace scope | id            | name | status | reasons   | scope   | version | cause chain                                                                                                                                                                                | cause truncated | leaks | rollback partial |
      | fixtures         | project           | demo@fixtures | demo | failed | lock held | project | 1.0.0   | Another pi-claude-marketplace operation is in progress for project scope ({project dir}/.pi/pi-claude-marketplace/.state-lock). Retry after it completes., Lock file is already being held | false           |       |                  |
    Then the installation record of the project scope holds these plugins:
      | id            | version | enabled |
      | demo@fixtures | 1.0.0   | true    |
    Then the "claude-plugins.json" file of the project scope declares these plugins:
      | id            |
      | demo@fixtures |
    Then the project scope stages these skills and prompts:
      | kind  | name       |
      | skill | demo-skill |

  Scenario: Reinstalling a plugin in the user scope while another process holds its state lock fails as lock held
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the marketplace "fixtures" is added to the user scope
    Given the user has run "/claude:plugin install demo@fixtures --scope user"
    Given another process holds the state lock of the user scope
    When the user runs "/claude:plugin reinstall demo@fixtures --scope user"
    Then the result has these fields:
      | kind         | cascade                        |
      | severity     | error                          |
      | needs reload | false                          |
      | summary      | A plugin operation has failed. |
    Then the result lists these plugins:
      | marketplace name | marketplace scope | id            | name | status | reasons   | scope | version | cause chain                                                                                                                                                                       | cause truncated | leaks | rollback partial |
      | fixtures         | user              | demo@fixtures | demo | failed | lock held | user  | 1.0.0   | Another pi-claude-marketplace operation is in progress for user scope ({agent dir}/pi-claude-marketplace/.state-lock). Retry after it completes., Lock file is already being held | false           |       |                  |
    Then the installation record of the user scope holds these plugins:
      | id            | version | enabled |
      | demo@fixtures | 1.0.0   | true    |
    Then the "claude-plugins.json" file of the user scope declares these plugins:
      | id            |
      | demo@fixtures |
    Then the user scope stages these skills and prompts:
      | kind  | name       |
      | skill | demo-skill |

  Scenario: Pruning the project scope while another process holds its state lock fails as lock held
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins with dependencies:
      | name | version | dependencies |
      | app  | 1.0.0   | lib          |
      | lib  | 1.0.0   |              |
    Given the marketplace "fixtures" is added to the project scope
    Given the user has run "/claude:plugin install app@fixtures --scope project"
    Given the user has run "/claude:plugin uninstall app@fixtures --scope project"
    Given another process holds the state lock of the project scope
    When the user runs "/claude:plugin prune --scope project"
    Then the result has these fields:
      | kind         | cascade                        |
      | severity     | error                          |
      | needs reload | false                          |
      | summary      | A plugin operation has failed. |
    Then the result lists these plugins:
      | marketplace name | marketplace scope | id              | name    | status | reasons   | scope   | cause chain                                                                                                                                                                                | cause truncated | leaks | rollback partial |
      | (prune)          | project           | (prune)@(prune) | (prune) | failed | lock held | project | Another pi-claude-marketplace operation is in progress for project scope ({project dir}/.pi/pi-claude-marketplace/.state-lock). Retry after it completes., Lock file is already being held | false           |       |                  |
    Then the installation record of the project scope holds these plugins:
      | id           | version | enabled |
      | lib@fixtures | 1.0.0   | true    |
    Then the "claude-plugins.json" file of the project scope declares no plugins
    Then the project scope stages these skills and prompts:
      | kind  | name      |
      | skill | lib-skill |

  Scenario: Pruning the user scope while another process holds its state lock fails as lock held
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins with dependencies:
      | name | version | dependencies |
      | app  | 1.0.0   | lib          |
      | lib  | 1.0.0   |              |
    Given the marketplace "fixtures" is added to the user scope
    Given the user has run "/claude:plugin install app@fixtures --scope user"
    Given the user has run "/claude:plugin uninstall app@fixtures --scope user"
    Given another process holds the state lock of the user scope
    When the user runs "/claude:plugin prune --scope user"
    Then the result has these fields:
      | kind         | cascade                        |
      | severity     | error                          |
      | needs reload | false                          |
      | summary      | A plugin operation has failed. |
    Then the result lists these plugins:
      | marketplace name | marketplace scope | id              | name    | status | reasons   | scope | cause chain                                                                                                                                                                       | cause truncated | leaks | rollback partial |
      | (prune)          | user              | (prune)@(prune) | (prune) | failed | lock held | user  | Another pi-claude-marketplace operation is in progress for user scope ({agent dir}/pi-claude-marketplace/.state-lock). Retry after it completes., Lock file is already being held | false           |       |                  |
    Then the installation record of the user scope holds these plugins:
      | id           | version | enabled |
      | lib@fixtures | 1.0.0   | true    |
    Then the "claude-plugins.json" file of the user scope declares no plugins
    Then the user scope stages these skills and prompts:
      | kind  | name      |
      | skill | lib-skill |
