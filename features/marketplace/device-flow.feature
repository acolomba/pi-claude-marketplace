Feature: Marketplace device flow

  A user with no stored GitHub credential signs in through GitHub's Device
  Flow. A loopback stand-in answers GitHub's sign-in endpoints, the run's git
  host serves GitHub's repositories, and an in-process redirect sends Pi's
  github.com requests to them and refuses every other host.

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
      | method | path                      | form                                                                                                         |
      | POST   | /login/device/code        | client_id=Ov23liNcyK08uGdU0mMl, scope=repo                                                                   |
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
