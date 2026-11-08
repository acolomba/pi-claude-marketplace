Feature: Marketplace device flow

  A user with no stored GitHub credential signs in through GitHub's Device Flow when a command
  clones a private GitHub repository. Claude Code runs no Device Flow, and this extension clones
  through isomorphic-git, which cannot prompt for a credential, so the sign-in is the project's own
  contract (AUTH-01, D-79-04, D-79-05, GHB-02, D-BG-1101). A loopback stand-in answers GitHub's
  sign-in endpoints, the run's git host serves GitHub's repositories, and an in-process redirect
  sends Pi's github.com requests to them and refuses every other host.

  Scenario: Adding a private GitHub marketplace signs in through Device Flow and clones it
    Given the marketplace "tools" is published as a github source
    Given the git host requires the user "x-access-token" with the password "stand-in-access-token" for the marketplace "tools"
    Given github's sign-in answers its polls with these outcomes:
      | outcome               |
      | authorization_pending |
      | authorized            |
    Given the user's git keeps credentials in its credential store
    Given pi runs with github's requests routed to the stand-ins
    When the user runs "/claude:plugin marketplace add acme/tools --scope user"
    Then the command reports these results:
      | kind               | severity | needs reload | verification uri                | user code |
      | device-flow-prompt | info     | false        | https://github.com/login/device | WDJB-MJHT |
      | cascade            | info     | false        |                                 |           |
    Then the results list these marketplaces and plugins:
      | marketplace name | marketplace scope | marketplace status |
      | tools            | user              | added              |
    Then the git host receives these requests:
      | method | path                                              | status |
      | GET    | /acme/tools.git/info/refs?service=git-upload-pack | 401    |
      | GET    | /acme/tools.git/info/refs?service=git-upload-pack | 200    |
      | POST   | /acme/tools.git/git-upload-pack                   | 200    |
    Then github's sign-in receives these requests:
      | method | path                      | form                                                                                                                      |
      | POST   | /login/device/code        | client_id=Ov23liNcyK08uGdU0mMl, scope=repo                                                                                |
      | POST   | /login/oauth/access_token | client_id=Ov23liNcyK08uGdU0mMl, device_code=stand-in-device-code, grant_type=urn:ietf:params:oauth:grant-type:device_code |
      | POST   | /login/oauth/access_token | client_id=Ov23liNcyK08uGdU0mMl, device_code=stand-in-device-code, grant_type=urn:ietf:params:oauth:grant-type:device_code |
    Then pi routes these github requests:
      | method | url                                                                 | routed to |
      | GET    | https://github.com/acme/tools.git/info/refs?service=git-upload-pack | git host  |
      | POST   | https://github.com/login/device/code                                | sign-in   |
      | POST   | https://github.com/login/oauth/access_token                         | sign-in   |
      | POST   | https://github.com/login/oauth/access_token                         | sign-in   |
      | GET    | https://github.com/acme/tools.git/info/refs?service=git-upload-pack | git host  |
      | POST   | https://github.com/acme/tools.git/git-upload-pack                   | git host  |
    Then the user's git credential store holds these credentials:
      | protocol | host       | user           | password              |
      | https    | github.com | x-access-token | stand-in-access-token |

  Scenario: Updating a marketplace after a Device Flow sign-in uses the stored token without signing in again
    Given the marketplace "tools" is published as a github source
    Given the git host requires the user "x-access-token" with the password "stand-in-access-token" for the marketplace "tools"
    Given github's sign-in answers its polls with these outcomes:
      | outcome               |
      | authorization_pending |
      | authorized            |
    Given the user's git keeps credentials in its credential store
    Given pi runs with github's requests routed to the stand-ins
    Given the user has run "/claude:plugin marketplace add acme/tools --scope user"
    When the user runs "/claude:plugin marketplace update tools --scope user"
    Then the result has these fields:
      | kind         | cascade |
      | severity     | info    |
      | needs reload | false   |
    Then the result lists these marketplaces:
      | name  | scope | status  | reasons    |
      | tools | user  | skipped | up-to-date |
    Then the git host receives these requests:
      | method | path                                              | status |
      | GET    | /acme/tools.git/info/refs?service=git-upload-pack | 401    |
      | GET    | /acme/tools.git/info/refs?service=git-upload-pack | 200    |
      | POST   | /acme/tools.git/git-upload-pack                   | 200    |
    Then github's sign-in receives no request
    Then pi routes these github requests:
      | method | url                                                                 | routed to |
      | GET    | https://github.com/acme/tools.git/info/refs?service=git-upload-pack | git host  |
      | GET    | https://github.com/acme/tools.git/info/refs?service=git-upload-pack | git host  |
      | POST   | https://github.com/acme/tools.git/git-upload-pack                   | git host  |

  Scenario: A terminal session of a sign-in scenario sends the background update's GitHub requests to the git host
    Given the marketplace "tools" is published as a github source
    Given github's sign-in answers its polls with these outcomes:
      | outcome               |
      | authorization_pending |
    Given pi runs with github's requests routed to the stand-ins
    Given the user has run "/claude:plugin marketplace add acme/tools --scope user"
    Given the user has run "/claude:plugin marketplace autoupdate tools --scope user"
    Given the tui session starts with the environment variable "PI_CLAUDE_MARKETPLACE_AUTOUPDATE_DELAY_MS" set to "0"
    When the user sends the message "hello" in the tui session
    Then the tui session reports no notice
    Then the git host receives these requests:
      | method | path                                              | status |
      | GET    | /acme/tools.git/info/refs?service=git-upload-pack | 200    |
      | POST   | /acme/tools.git/git-upload-pack                   | 200    |
    Then github's sign-in receives no request
    Then pi routes these github requests:
      | method | url                                                                 | routed to |
      | GET    | https://github.com/acme/tools.git/info/refs?service=git-upload-pack | git host  |
      | POST   | https://github.com/acme/tools.git/git-upload-pack                   | git host  |
