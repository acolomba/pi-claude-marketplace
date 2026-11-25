Feature: Plugin without git

  A plugin whose source is a git repository needs system git, so installing one with no git fails before
  any request, while a plugin inside a local marketplace still installs (SG-PRC-06, D-SG-01).
  The scenarios run a headless Pi whose PATH holds no git, against a loopback https git host that records every request.

  Scenario Outline: Installing a plugin from a <plugin source kind> source with no git fails as git missing and sends no request
    Given the git repository "<repository>" holds these plugins:
      | name     | version | path   |
      | <plugin> | 1.0.0   | <path> |
    Given the marketplace "gits" is published as a dir source
    Given the marketplace "gits" offers these plugins from git repositories:
      | name     | source kind          | repository   | pinned |
      | <plugin> | <plugin source kind> | <repository> | false  |
    Given the marketplace "gits" is added to the project scope
    Given pi runs without git on its path
    When the user runs "/claude:plugin install <plugin>@gits --scope project"
    Then the result has these fields:
      | kind         | cascade                        |
      | severity     | error                          |
      | needs reload | false                          |
      | summary      | A plugin operation has failed. |
    Then the result lists these plugins:
      | marketplace name | marketplace scope | id            | name     | status | reasons     | scope   | leaks | rollback partial | cause chain                              | cause truncated |
      | gits             | project           | <plugin>@gits | <plugin> | failed | git missing | project |       |                  | Git is required to install marketplaces. | false           |
    Then the installation record of the project scope holds no plugins
    Then the project scope holds no git clones
    Then the git host receives no request

    Examples:
      | plugin source kind | plugin | repository | path         |
      | url                | urlp   | urlp       |              |
      | git-subdir         | subp   | mono       | plugins/subp |

  Scenario: Installing a plugin from a github source with no git fails as git missing, sends no request, and names the clone it tried
    Given the git repository "ghp" holds these plugins:
      | name | version | path |
      | ghp  | 1.0.0   |      |
    Given the marketplace "gits" is published as a dir source
    Given the marketplace "gits" offers these plugins from git repositories:
      | name | source kind | repository | pinned |
      | ghp  | github      | ghp        | false  |
    Given the marketplace "gits" is added to the project scope
    Given pi runs without git on its path
    When the user runs "/claude:plugin install ghp@gits --scope project"
    Then the result has these fields:
      | kind         | cascade                        |
      | severity     | error                          |
      | needs reload | false                          |
      | summary      | A plugin operation has failed. |
    Then the result lists these plugins:
      | marketplace name | marketplace scope | id       | name | status | reasons     | scope   | leaks | rollback partial | cause chain                              | cause truncated | clone note | clone url                       |
      | gits             | project           | ghp@gits | ghp  | failed | git missing | project |       |                  | Git is required to install marketplaces. | false           | via-https  | https://github.com/acme/ghp.git |
    Then the installation record of the project scope holds no plugins
    Then the project scope holds no git clones
    Then the git host receives no request

  Scenario: Installing a plugin of a local marketplace with no git installs it
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the marketplace "fixtures" is added to the project scope
    Given pi runs without git on its path
    When the user runs "/claude:plugin install demo@fixtures --scope project"
    Then the result has these fields:
      | kind         | cascade |
      | severity     | info    |
      | needs reload | true    |
    Then the result lists these plugins:
      | marketplace name | marketplace scope | id            | name | status    | reasons | scope   | version |
      | fixtures         | project           | demo@fixtures | demo | installed |         | project | 1.0.0   |
    Then the installation record of the project scope holds these plugins:
      | id            | version | enabled |
      | demo@fixtures | 1.0.0   | true    |
    Then the git host receives no request
