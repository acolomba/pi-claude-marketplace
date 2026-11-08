Feature: Hook stop failure

  A turn that ends in an error runs the StopFailure hooks of a bridged plugin in place of its Stop hooks, with the
  payload and the error type Claude Code gives them, and a matcher selects the hooks by error type. A scripted model
  stands in for the provider and ends the turn with a chosen error, and a local marketplace stands in for a published one.

  Scenario: A turn the model ends in an authentication error runs the StopFailure hook
    Given pi runs with the scripted model
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the published plugin "demo" of the marketplace "fixtures" has these hooks, each recording its runs:
      | name    | event       | matcher |
      | failure | StopFailure | *       |
    Given the marketplace "fixtures" is added to the project scope
    Given the user has run "/claude:plugin install demo@fixtures --scope project"
    Given the user has started a new pi session
    Given the scripted model plays these steps:
      | reply | error                       |
      |       | Authentication failed (401) |
    When the user prompts "hello"
    Then the hooks record these runs:
      | event       | session | error                 | last assistant message      | cwd           | transcript path | arguments | CLAUDE_PROJECT_DIR | CLAUDE_PLUGIN_ROOT                        | CLAUDE_PLUGIN_DATA                                         | CLAUDE_CODE_SESSION_ID | CLAUDE_SESSION_ID | CLAUDECODE |
      | StopFailure | first   | authentication_failed | Authentication failed (401) | {project dir} |                 | failure   | {project dir}      | {home}/marketplaces/fixtures/plugins/demo | {project dir}/.pi/pi-claude-marketplace/data/fixtures/demo | first                  | first             | 1          |

  Scenario Outline: An error turn of type <error type> runs only the StopFailure hook whose matcher names it
    Given pi runs with the scripted model
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the published plugin "demo" of the marketplace "fixtures" has these hooks, each recording its runs:
      | name  | event       | matcher      |
      | named | StopFailure | <error type> |
      | other | StopFailure | <other type> |
    Given the marketplace "fixtures" is added to the project scope
    Given the user has run "/claude:plugin install demo@fixtures --scope project"
    Given the user has started a new pi session
    Given the scripted model plays these steps:
      | reply | error     |
      |       | <message> |
    When the user prompts "hello"
    Then the hooks record these runs:
      | event       | session | error        | last assistant message | cwd           | transcript path | arguments | CLAUDE_PROJECT_DIR | CLAUDE_PLUGIN_ROOT                        | CLAUDE_PLUGIN_DATA                                         | CLAUDE_CODE_SESSION_ID | CLAUDE_SESSION_ID | CLAUDECODE |
      | StopFailure | first   | <error type> | <message>              | {project dir} |                 | named     | {project dir}      | {home}/marketplaces/fixtures/plugins/demo | {project dir}/.pi/pi-claude-marketplace/data/fixtures/demo | first                  | first             | 1          |

    Examples:
      | message                                                                                                                  | error type            | other type            |
      | Authentication failed (401)                                                                                              | authentication_failed | oauth_org_not_allowed |
      | Rate limit reached (429)                                                                                                 | rate_limit            | overloaded            |
      | Overloaded (529)                                                                                                         | overloaded            | rate_limit            |
      | Internal server error (500)                                                                                              | server_error          | unknown               |
      | Invalid request (400)                                                                                                    | invalid_request       | model_not_found       |
      | Model not found (404)                                                                                                    | model_not_found       | invalid_request       |
      | Your credit balance is too low to access the Anthropic API. Please go to Plans & Billing to upgrade or purchase credits. | billing_error         | rate_limit            |
      | The provider closed the connection                                                                                       | unknown               | server_error          |

  Scenario: An error turn runs the StopFailure hook and not the Stop hook
    Given pi runs with the scripted model
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the published plugin "demo" of the marketplace "fixtures" has these hooks, each recording its runs:
      | name    | event       | matcher |
      | failure | StopFailure | *       |
      | stop    | Stop        |         |
    Given the marketplace "fixtures" is added to the project scope
    Given the user has run "/claude:plugin install demo@fixtures --scope project"
    Given the user has started a new pi session
    Given the scripted model plays these steps:
      | reply | error            |
      |       | Overloaded (529) |
    When the user prompts "hello"
    Then the hooks record these runs:
      | event       | session | error      | last assistant message | cwd           | transcript path | arguments | CLAUDE_PROJECT_DIR | CLAUDE_PLUGIN_ROOT                        | CLAUDE_PLUGIN_DATA                                         | CLAUDE_CODE_SESSION_ID | CLAUDE_SESSION_ID | CLAUDECODE |
      | StopFailure | first   | overloaded | Overloaded (529)       | {project dir} |                 | failure   | {project dir}      | {home}/marketplaces/fixtures/plugins/demo | {project dir}/.pi/pi-claude-marketplace/data/fixtures/demo | first                  | first             | 1          |

  Scenario: A turn that ends normally runs the Stop hook and not the StopFailure hook
    Given pi runs with the scripted model
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the published plugin "demo" of the marketplace "fixtures" has these hooks, each recording its runs:
      | name    | event       | matcher |
      | failure | StopFailure | *       |
      | stop    | Stop        |         |
    Given the marketplace "fixtures" is added to the project scope
    Given the user has run "/claude:plugin install demo@fixtures --scope project"
    Given the user has started a new pi session
    Given the scripted model plays these steps:
      | reply |
      | Hi.   |
    When the user prompts "hello"
    Then the hooks record these runs:
      | event | session | last assistant message | stop hook active | cwd           | transcript path | arguments | CLAUDE_PROJECT_DIR | CLAUDE_PLUGIN_ROOT                        | CLAUDE_PLUGIN_DATA                                         | CLAUDE_CODE_SESSION_ID | CLAUDE_SESSION_ID | CLAUDECODE |
      | Stop  | first   | Hi.                    | false            | {project dir} |                 | stop      | {project dir}      | {home}/marketplaces/fixtures/plugins/demo | {project dir}/.pi/pi-claude-marketplace/data/fixtures/demo | first                  | first             | 1          |

  Scenario: The output and exit code of a StopFailure hook change nothing
    Given pi runs with the scripted model
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the published plugin "demo" of the marketplace "fixtures" has these hooks, each recording its runs:
      | name    | event       | matcher | form   | stderr          | output                                                                                                                                         | exit code | on failure |
      | exits   | StopFailure | *       | script | blocked by hook |                                                                                                                                                | 2         |            |
      | decides | StopFailure | *       | script |                 | {"decision":"block","reason":"retry","systemMessage":"Shown?","hookSpecificOutput":{"hookEventName":"StopFailure","additionalContext":"more"}} |           |            |
      | fails   | StopFailure | *       | script |                 |                                                                                                                                                | 1         | block      |
    Given the marketplace "fixtures" is added to the project scope
    Given the user has run "/claude:plugin install demo@fixtures --scope project"
    Given the user has started a new pi session
    Given the scripted model plays these steps:
      | reply | error                       |
      |       | Authentication failed (401) |
    When the user prompts "hello"
    Then the hooks show the user no messages
    Then the model receives these calls:
      | call | role | text  |
      | 1    | user | hello |
    Then the hooks record these runs in any order:
      | event       | session | error                 | last assistant message      | cwd           | transcript path | arguments | CLAUDE_PROJECT_DIR | CLAUDE_PLUGIN_ROOT                        | CLAUDE_PLUGIN_DATA                                         | CLAUDE_CODE_SESSION_ID | CLAUDE_SESSION_ID | CLAUDECODE |
      | StopFailure | first   | authentication_failed | Authentication failed (401) | {project dir} |                 | decides   | {project dir}      | {home}/marketplaces/fixtures/plugins/demo | {project dir}/.pi/pi-claude-marketplace/data/fixtures/demo | first                  | first             | 1          |
      | StopFailure | first   | authentication_failed | Authentication failed (401) | {project dir} |                 | exits     | {project dir}      | {home}/marketplaces/fixtures/plugins/demo | {project dir}/.pi/pi-claude-marketplace/data/fixtures/demo | first                  | first             | 1          |
      | StopFailure | first   | authentication_failed | Authentication failed (401) | {project dir} |                 | fails     | {project dir}      | {home}/marketplaces/fixtures/plugins/demo | {project dir}/.pi/pi-claude-marketplace/data/fixtures/demo | first                  | first             | 1          |

  Scenario: The prompt after an error turn gets a normal turn
    Given pi runs with the scripted model
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the published plugin "demo" of the marketplace "fixtures" has these hooks, each recording its runs:
      | name    | event       | matcher | form   | stderr          | output                                                                                                                                         | exit code | on failure |
      | exits   | StopFailure | *       | script | blocked by hook |                                                                                                                                                | 2         |            |
      | decides | StopFailure | *       | script |                 | {"decision":"block","reason":"retry","systemMessage":"Shown?","hookSpecificOutput":{"hookEventName":"StopFailure","additionalContext":"more"}} |           |            |
      | fails   | StopFailure | *       | script |                 |                                                                                                                                                | 1         | block      |
      | stop    | Stop        |         | script |                 |                                                                                                                                                |           |            |
    Given the marketplace "fixtures" is added to the project scope
    Given the user has run "/claude:plugin install demo@fixtures --scope project"
    Given the user has started a new pi session
    Given the scripted model plays these steps:
      | reply | error                       |
      |       | Authentication failed (401) |
      | Hi.   |                             |
    Given the user has prompted "hello"
    When the user prompts "again"
    Then the model receives these calls:
      | call | role      | text  |
      | 2    | user      | hello |
      | 2    | assistant |       |
      | 2    | user      | again |
    Then the hooks show the user no messages
    Then the hooks record these runs:
      | event | session | last assistant message | stop hook active | cwd           | transcript path | arguments | CLAUDE_PROJECT_DIR | CLAUDE_PLUGIN_ROOT                        | CLAUDE_PLUGIN_DATA                                         | CLAUDE_CODE_SESSION_ID | CLAUDE_SESSION_ID | CLAUDECODE |
      | Stop  | first   | Hi.                    | false            | {project dir} |                 | stop      | {project dir}      | {home}/marketplaces/fixtures/plugins/demo | {project dir}/.pi/pi-claude-marketplace/data/fixtures/demo | first                  | first             | 1          |

  Scenario: A StopFailure matcher that lists error types runs its hook on a listed type
    Given pi runs with the scripted model
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the published plugin "demo" of the marketplace "fixtures" has these hooks, each recording its runs:
      | name   | event       | matcher                               |
      | listed | StopFailure | network_error\|rate_limit\|overloaded |
      | other  | StopFailure | server_error\|unknown                 |
    Given the marketplace "fixtures" is added to the project scope
    Given the user has run "/claude:plugin install demo@fixtures --scope project"
    Given the user has started a new pi session
    Given the scripted model plays these steps:
      | reply | error                    |
      |       | Rate limit reached (429) |
    When the user prompts "hello"
    Then the hooks record these runs:
      | event       | session | error      | last assistant message   | cwd           | transcript path | arguments | CLAUDE_PROJECT_DIR | CLAUDE_PLUGIN_ROOT                        | CLAUDE_PLUGIN_DATA                                         | CLAUDE_CODE_SESSION_ID | CLAUDE_SESSION_ID | CLAUDECODE |
      | StopFailure | first   | rate_limit | Rate limit reached (429) | {project dir} |                 | listed    | {project dir}      | {home}/marketplaces/fixtures/plugins/demo | {project dir}/.pi/pi-claude-marketplace/data/fixtures/demo | first                  | first             | 1          |

  Scenario Outline: Info on a plugin whose StopFailure hook names <error type> shows it available
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the published plugin "demo" of the marketplace "fixtures" has these hooks, each recording its runs:
      | name    | event       | matcher      |
      | failure | StopFailure | <error type> |
    Given the marketplace "fixtures" is added to the project scope
    When the user runs "/claude:plugin info demo@fixtures"
    Then the result has these fields:
      | kind                           | plugin-info               |
      | marketplace details autoupdate | false                     |
      | marketplace name               | fixtures                  |
      | marketplace scope              | project                   |
      | needs reload                   | false                     |
      | plugin components hooks        | [{"event":"StopFailure"}] |
      | plugin components resolved     | true                      |
      | plugin components skills       | demo-skill                |
      | plugin id                      | demo@fixtures             |
      | plugin name                    | demo                      |
      | plugin reasons                 |                           |
      | plugin status                  | available                 |
      | plugin version                 | 1.0.0                     |
      | severity                       | info                      |

    Examples:
      | error type             |
      | authentication_failed  |
      | oauth_org_not_allowed  |
      | account_on_hold        |
      | verification_required  |
      | billing_error          |
      | rate_limit             |
      | overloaded             |
      | invalid_request        |
      | model_not_found        |
      | server_error           |
      | unknown                |
      | max_output_tokens      |
      | cloud_credential_error |

  Scenario Outline: Info on a plugin whose StopFailure matcher <matcher> matches no type Claude Code sends shows it partially available
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the published plugin "demo" of the marketplace "fixtures" has these hooks, each recording its runs:
      | name    | event       | matcher   |
      | failure | StopFailure | <matcher> |
    Given the marketplace "fixtures" is added to the project scope
    When the user runs "/claude:plugin info demo@fixtures"
    Then the result has these fields:
      | kind                           | plugin-info                                                 |
      | marketplace details autoupdate | false                                                       |
      | marketplace name               | fixtures                                                    |
      | marketplace scope              | project                                                     |
      | needs reload                   | false                                                       |
      | plugin components hooks        | [{"kind":"lenient","event":"StopFailure","supported":true}] |
      | plugin components resolved     | true                                                        |
      | plugin components skills       | demo-skill                                                  |
      | plugin id                      | demo@fixtures                                               |
      | plugin name                    | demo                                                        |
      | plugin reasons                 | unsupported hooks                                           |
      | plugin status                  | partially-available                                         |
      | plugin version                 | 1.0.0                                                       |
      | severity                       | info                                                        |

    Examples:
      | matcher                |
      | network_error          |
      | Rate_Limit             |
      | network_error\|timeout |

  Scenario: A reply cut off at the output limit runs the StopFailure hook with no assistant message
    Given pi runs with the scripted model
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the published plugin "demo" of the marketplace "fixtures" has these hooks, each recording its runs:
      | name    | event       | matcher |
      | failure | StopFailure | *       |
      | stop    | Stop        |         |
    Given the marketplace "fixtures" is added to the project scope
    Given the user has run "/claude:plugin install demo@fixtures --scope project"
    Given the user has started a new pi session
    Given the scripted model plays these steps:
      | reply            | stop reason |
      | The answer is cu | length      |
    When the user prompts "hello"
    Then the hooks record these runs:
      | event       | session | error             | cwd           | transcript path | arguments | CLAUDE_PROJECT_DIR | CLAUDE_PLUGIN_ROOT                        | CLAUDE_PLUGIN_DATA                                         | CLAUDE_CODE_SESSION_ID | CLAUDE_SESSION_ID | CLAUDECODE |
      | StopFailure | first   | max_output_tokens | {project dir} |                 | failure   | {project dir}      | {home}/marketplaces/fixtures/plugins/demo | {project dir}/.pi/pi-claude-marketplace/data/fixtures/demo | first                  | first             | 1          |
