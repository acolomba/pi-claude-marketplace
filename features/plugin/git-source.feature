Feature: Plugin git source

  A plugin whose source is a git repository installs from a clone of that repository,
  and the git host's request log shows when Pi reaches the network.
  A loopback https git host serves the plugin repositories.

  Scenario: A plugin installed from a github source is offered by a new session
    Given the git repository "ghp" holds these plugins:
      | name | version | path |
      | ghp  | 1.0.0   |      |
    Given the marketplace "gits" is published as a dir source
    Given the marketplace "gits" offers these plugins from git repositories:
      | name | source kind | repository | pinned |
      | ghp  | github      | ghp        | false  |
    Given the marketplace "gits" is added to the project scope
    Given the user has run "/claude:plugin install ghp@gits --scope project"
    When the user starts a new pi session
    Then the session offers these skills:
      | command          | description           |
      | /skill:ghp-skill | A skill of ghp 1.0.0. |
