Feature: Marketplace credentials

  The extension authenticates git only with what the machine holds, an ssh key or agent and the
  user's git credential helpers, and keeps no token of its own (SG-AUTH-01, SG-AUTH-02, SG-AUTH-03).
  The scenarios run against the run's https git host, the ssh stand-in, and a profile Pi whose
  github.com requests are routed to the git host.

  Scenario: With only GITHUB_TOKEN and GH_TOKEN set, adding a private url marketplace fails as authentication required and no request carries either token
    Given the marketplace "tools" is published as a url source
    Given the git host requires the user "alice" with the password "s3cret" for the marketplace "tools"
    Given pi runs with github's requests routed to the git host and these environment variables:
      | name         | value                  |
      | GITHUB_TOKEN | env-github-token-value |
      | GH_TOKEN     | env-gh-token-value     |
    When the user runs "/claude:plugin marketplace add https://{git host}/acme/tools.git --scope user"
    Then the result has these fields:
      | kind         | cascade                             |
      | severity     | error                               |
      | needs reload | false                               |
      | summary      | A marketplace operation has failed. |
    Then the result lists these marketplaces:
      | name                              | scope | status | reasons                 |
      | https://{git host}/acme/tools.git | user  | failed | authentication required |
    Then no result of the command contains "env-github-token-value"
    Then no result of the command contains "env-gh-token-value"
    Then no request the git host received carries "env-github-token-value"
    Then no request the git host received carries "env-gh-token-value"
    Then the git host receives these requests:
      | method | path                                              | status |
      | GET    | /acme/tools.git/info/refs?service=git-upload-pack | 401    |
    Then the user's ssh receives no launch
    Then the user scope holds no marketplace record
