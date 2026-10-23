Feature: Plugin git source update

  Updating a plugin whose source is a git repository fetches the repository's
  new revision and installs it. A loopback https git host serves the
  marketplace and plugin repositories and logs the requests Pi makes.

  Scenario: Updating a git-source plugin fetches its new revision
    Given the git repository "ghp" holds these plugins:
      | name | version | path |
      | ghp  | 1.0.0   |      |
    Given the marketplace "gits" is published as a url source
    Given the marketplace "gits" offers these plugins from git repositories:
      | name | source kind | repository | pinned |
      | ghp  | github      | ghp        | false  |
    Given the marketplace "gits" is added to the project scope
    Given the user has run "/claude:plugin install ghp@gits --scope project"
    Given the git repository "ghp" holds these plugins:
      | name | version | path |
      | ghp  | 2.0.0   |      |
    When the user runs "/claude:plugin update ghp@gits --scope project"
    Then the result has these fields:
      | kind         | cascade |
      | severity     | info    |
      | needs reload | true    |
    Then the result lists these plugins:
      | marketplace name | marketplace scope | id       | name | status  | reasons | scope   | from             | to               |
      | gits             | project           | ghp@gits | ghp  | updated |         | project | {ghp revision 1} | {ghp revision 2} |
    Then the git host receives these requests:
      | method | path                                             | status |
      | GET    | /acme/gits.git/info/refs?service=git-upload-pack | 200    |
      | POST   | /acme/gits.git/git-upload-pack                   | 200    |
      | GET    | /acme/ghp.git/info/refs?service=git-upload-pack  | 200    |
      | POST   | /acme/ghp.git/git-upload-pack                    | 200    |
    Then the project scope holds these git clones:
      | clone       | origin                           | revision         |
      | marketplace | https://{git host}/acme/gits.git |                  |
      | plugin      | https://github.com/acme/ghp.git  |                  |
      | plugin      | https://github.com/acme/ghp.git  | {ghp revision 2} |
    Then the git-source plugin "ghp" installed in the project scope runs revision 2 of its repository

  Scenario: Updating a plugin to a revision the clone cache already holds makes no request
    Given the git repository "mono" holds these plugins:
      | name | version | path         |
      | subp | 1.0.0   | plugins/subp |
      | subq | 1.0.0   | plugins/subq |
    Given the marketplace "gits" is published as a dir source
    Given the marketplace "gits" offers these plugins from git repositories:
      | name | source kind | repository | pinned |
      | subp | git-subdir  | mono       | true   |
      | subq | git-subdir  | mono       | true   |
    Given the marketplace "gits" is added to the project scope
    Given the user has run "/claude:plugin install subp@gits --scope project"
    Given the user has run "/claude:plugin install subq@gits --scope project"
    Given the git repository "mono" holds these plugins:
      | name | version | path         |
      | subp | 2.0.0   | plugins/subp |
      | subq | 2.0.0   | plugins/subq |
    Given the marketplace "gits" offers these plugins from git repositories:
      | name | source kind | repository | pinned |
      | subp | git-subdir  | mono       | true   |
      | subq | git-subdir  | mono       | true   |
    Given the user has run "/claude:plugin update subp@gits --scope project"
    When the user runs "/claude:plugin update subq@gits --scope project"
    Then the result has these fields:
      | kind         | cascade |
      | severity     | info    |
      | needs reload | true    |
    Then the result lists these plugins:
      | marketplace name | marketplace scope | id        | name | status  | reasons | scope   | from              | to                |
      | gits             | project           | subq@gits | subq | updated |         | project | {mono revision 1} | {mono revision 2} |
    Then the git host receives no request
    When the user starts a new pi session
    Then the session offers these skills:
      | command           | description            |
      | /skill:subp-skill | A skill of subp 2.0.0. |
      | /skill:subq-skill | A skill of subq 2.0.0. |
