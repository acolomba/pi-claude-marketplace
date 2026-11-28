Feature: Marketplace failure messages

  A failed marketplace command says what went wrong and how to fix it, and it
  shows no credential. The scenarios run against the run's loopback https git
  host and the ssh stand-in.

  Scenario: Adding a marketplace from a URL whose password and query token the git host refuses shows neither in the result
    Given the marketplace "tools" is published as a url source
    Given the git host answers 404 for the marketplace "tools"
    When the user runs "/claude:plugin marketplace add https://alice:pw-word@{git host}/acme/tools.git?private_token=token-word --scope project"
    Then the result has these fields:
      | kind         | cascade                             |
      | severity     | error                               |
      | needs reload | false                               |
      | summary      | A marketplace operation has failed. |
    Then the result lists these marketplaces:
      | name                                                    | scope   | status | reasons        |
      | https://***@{git host}/acme/tools.git?private_token=*** | project | failed | source missing |
    Then no result of the command contains "pw-word"
    Then no result of the command contains "token-word"
    Then the git host receives these requests:
      | method | path                                                                       | status |
      | GET    | /acme/tools.git?private_token=token-word/info/refs&service=git-upload-pack | 404    |
