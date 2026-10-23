Feature: Plugin fetch

  Fetch refreshes the cached source of an installed git-source plugin without
  installing a new version. A loopback https git host serves the plugin
  repositories and logs the requests Pi makes.

  Scenario: Fetching a plugin succeeds again once the git host serves its repository again
    Given the git repository "ghp" holds these plugins:
      | name | version | path |
      | ghp  | 1.0.0   |      |
    Given the marketplace "gits" is published as a dir source
    Given the marketplace "gits" offers these plugins from git repositories:
      | name | source kind | repository | pinned |
      | ghp  | github      | ghp        | false  |
    Given the marketplace "gits" is added to the project scope
    Given the user has run "/claude:plugin install ghp@gits --scope project"
    Given the git host answers 404 for the plugin "ghp"
    Given the user has run "/claude:plugin fetch ghp@gits --scope project", which failed
    Given the git host serves the plugin "ghp" again
    When the user runs "/claude:plugin fetch ghp@gits --scope project"
    Then the result has these fields:
      | kind         | cascade |
      | severity     | info    |
      | needs reload | false   |
    Then the result lists these plugins:
      | marketplace name | marketplace scope | id       | name | status    | reasons |
      | gits             | project           | ghp@gits | ghp  | available |         |
    Then the git host receives these requests:
      | method | path                                            | status |
      | GET    | /acme/ghp.git/info/refs?service=git-upload-pack | 200    |
      | POST   | /acme/ghp.git/git-upload-pack                   | 200    |
