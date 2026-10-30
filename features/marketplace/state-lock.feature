Feature: Marketplace state lock

  A marketplace command that changes a scope fails and changes nothing while another
  process holds the scope's state lock. A helper process holds the lock as a second Pi
  would, and local marketplaces and a loopback https git host stand in for published ones.

  Scenario: Removing a marketplace from the project scope while another process holds its state lock fails as lock held
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the marketplace "fixtures" is added to the project scope
    Given the user has run "/claude:plugin install demo@fixtures --scope project"
    Given another process holds the state lock of the project scope
    When the user runs "/claude:plugin marketplace remove fixtures --scope project"
    Then the result has these fields:
      | kind         | cascade                      |
      | severity     | error                        |
      | needs reload | false                        |
      | summary      | Some operations have failed. |
    Then the result lists these plugins:
      | marketplace name | marketplace scope | marketplace status | id       | name     | status | reasons   | scope   | cause chain                                                                                                                                                                                | cause truncated | leaks | rollback partial |
      | fixtures         | project           | failed             | fixtures | fixtures | failed | lock held | project | Another pi-claude-marketplace operation is in progress for project scope ({project dir}/.pi/pi-claude-marketplace/.state-lock). Retry after it completes., Lock file is already being held | false           |       |                  |
    Then the "claude-plugins.json" file of the project scope declares these marketplaces:
      | name     | source                       |
      | fixtures | {home}/marketplaces/fixtures |
    Then the "claude-plugins.json" file of the project scope declares these plugins:
      | id            |
      | demo@fixtures |
    Then the installation record of the project scope holds these plugins:
      | id            | version | enabled |
      | demo@fixtures | 1.0.0   | true    |
    Then the project scope stages these skills and prompts:
      | kind  | name       |
      | skill | demo-skill |

  Scenario: Removing a marketplace from the user scope while another process holds its state lock fails as lock held
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the marketplace "fixtures" is added to the user scope
    Given the user has run "/claude:plugin install demo@fixtures --scope user"
    Given another process holds the state lock of the user scope
    When the user runs "/claude:plugin marketplace remove fixtures --scope user"
    Then the result has these fields:
      | kind         | cascade                      |
      | severity     | error                        |
      | needs reload | false                        |
      | summary      | Some operations have failed. |
    Then the result lists these plugins:
      | marketplace name | marketplace scope | marketplace status | id       | name     | status | reasons   | scope | cause chain                                                                                                                                                                       | cause truncated | leaks | rollback partial |
      | fixtures         | user              | failed             | fixtures | fixtures | failed | lock held | user  | Another pi-claude-marketplace operation is in progress for user scope ({agent dir}/pi-claude-marketplace/.state-lock). Retry after it completes., Lock file is already being held | false           |       |                  |
    Then the "claude-plugins.json" file of the user scope declares these marketplaces:
      | name     | source                       |
      | fixtures | {home}/marketplaces/fixtures |
    Then the "claude-plugins.json" file of the user scope declares these plugins:
      | id            |
      | demo@fixtures |
    Then the installation record of the user scope holds these plugins:
      | id            | version | enabled |
      | demo@fixtures | 1.0.0   | true    |
    Then the user scope stages these skills and prompts:
      | kind  | name       |
      | skill | demo-skill |

  Scenario: Updating a marketplace in the project scope while another process holds its state lock fails as lock held
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the marketplace "fixtures" is added to the project scope
    Given the user has run "/claude:plugin install demo@fixtures --scope project"
    Given another process holds the state lock of the project scope
    When the user runs "/claude:plugin marketplace update fixtures --scope project"
    Then the result has these fields:
      | kind         | cascade                      |
      | severity     | error                        |
      | needs reload | false                        |
      | summary      | Some operations have failed. |
    Then the result lists these plugins:
      | marketplace name | marketplace scope | marketplace status | id       | name     | status | reasons   | scope   | cause chain                                                                                                                                                                                | cause truncated | leaks | rollback partial |
      | fixtures         | project           | failed             | fixtures | fixtures | failed | lock held | project | Another pi-claude-marketplace operation is in progress for project scope ({project dir}/.pi/pi-claude-marketplace/.state-lock). Retry after it completes., Lock file is already being held | false           |       |                  |
    Then the "claude-plugins.json" file of the project scope declares these marketplaces:
      | name     | source                       |
      | fixtures | {home}/marketplaces/fixtures |
    Then the "claude-plugins.json" file of the project scope declares these plugins:
      | id            |
      | demo@fixtures |
    Then the installation record of the project scope holds these plugins:
      | id            | version | enabled |
      | demo@fixtures | 1.0.0   | true    |
    Then the project scope stages these skills and prompts:
      | kind  | name       |
      | skill | demo-skill |

  Scenario: Updating a marketplace in the user scope while another process holds its state lock fails as lock held
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the marketplace "fixtures" is added to the user scope
    Given the user has run "/claude:plugin install demo@fixtures --scope user"
    Given another process holds the state lock of the user scope
    When the user runs "/claude:plugin marketplace update fixtures --scope user"
    Then the result has these fields:
      | kind         | cascade                      |
      | severity     | error                        |
      | needs reload | false                        |
      | summary      | Some operations have failed. |
    Then the result lists these plugins:
      | marketplace name | marketplace scope | marketplace status | id       | name     | status | reasons   | scope | cause chain                                                                                                                                                                       | cause truncated | leaks | rollback partial |
      | fixtures         | user              | failed             | fixtures | fixtures | failed | lock held | user  | Another pi-claude-marketplace operation is in progress for user scope ({agent dir}/pi-claude-marketplace/.state-lock). Retry after it completes., Lock file is already being held | false           |       |                  |
    Then the "claude-plugins.json" file of the user scope declares these marketplaces:
      | name     | source                       |
      | fixtures | {home}/marketplaces/fixtures |
    Then the "claude-plugins.json" file of the user scope declares these plugins:
      | id            |
      | demo@fixtures |
    Then the installation record of the user scope holds these plugins:
      | id            | version | enabled |
      | demo@fixtures | 1.0.0   | true    |
    Then the user scope stages these skills and prompts:
      | kind  | name       |
      | skill | demo-skill |

  Scenario Outline: Adding a marketplace while another process holds the state lock of the scope fails as lock held and leaves no marketplace
    Given the marketplace "tools" is published as a <source kind> source
    Given another process holds the state lock of the <scope> scope
    When the user runs "/claude:plugin marketplace add <source> --scope <scope>"
    Then the result has these fields:
      | kind         | cascade                      |
      | severity     | error                        |
      | needs reload | false                        |
      | summary      | Some operations have failed. |
    Then the result lists these plugins:
      | marketplace name | marketplace scope | marketplace status | id       | name     | status | reasons   | scope   | cause chain                                                                                                                                                                           | cause truncated | leaks | rollback partial |
      | <source>         | <scope>           | failed             | <source> | <source> | failed | lock held | <scope> | Another pi-claude-marketplace operation is in progress for <scope> scope (<scope root>/pi-claude-marketplace/.state-lock). Retry after it completes., Lock file is already being held | false           |       |                  |
    Then the "claude-plugins.json" file of the <scope> scope does not exist
    Then the <scope> scope holds no marketplace checkout
    Then the <scope> scope holds no git clones

    Examples:
      | scope   | scope root        | source kind | source                                                    |
      | project | {project dir}/.pi | dir         | {home}/marketplaces/tools                                 |
      | project | {project dir}/.pi | file        | {home}/marketplaces/tools/.claude-plugin/marketplace.json |
      | user    | {agent dir}       | dir         | {home}/marketplaces/tools                                 |
      | user    | {agent dir}       | file        | {home}/marketplaces/tools/.claude-plugin/marketplace.json |

    @url
    Examples:
      | scope   | scope root        | source kind | source                            |
      | project | {project dir}/.pi | url         | https://{git host}/acme/tools.git |
      | user    | {agent dir}       | url         | https://{git host}/acme/tools.git |

    @github
    Examples:
      | scope   | scope root        | source kind | source     |
      | project | {project dir}/.pi | github      | acme/tools |
      | user    | {agent dir}       | github      | acme/tools |
