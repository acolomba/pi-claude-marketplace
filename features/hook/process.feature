Feature: Hook process

  A bridged plugin's hook starts as a process of its own: its command form,
  its arguments, and its environment. A scripted model stands in for a real
  one, and a hook that records each run stands in for a plugin's hook.

  Scenario: An exec-form hook receives its arguments with Claude's path variables filled in
    Given pi runs with the scripted model
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the published plugin "demo" of the marketplace "fixtures" has these hooks, each recording its runs:
      | name      | event            | matcher | form | arguments                                                                                                                      |
      | exec-hook | UserPromptSubmit |         | exec | ["${CLAUDE_PLUGIN_ROOT}/bin/tool", "--data=${CLAUDE_PLUGIN_DATA}", "${CLAUDE_PROJECT_DIR}", "${user_config.token}", "${HOME}"] |
    Given the marketplace "fixtures" is added to the project scope
    Given the user has run "/claude:plugin install demo@fixtures --scope project"
    Given the user has started a new pi session
    Given the scripted model plays these steps:
      | reply |
      | Done. |
    When the user prompts "say done"
    Then the hooks record these runs:
      | event            | session | prompt   | cwd           | transcript path | arguments                                                                                                                                                        | CLAUDE_PROJECT_DIR | CLAUDE_PLUGIN_ROOT                        | CLAUDE_PLUGIN_DATA                                | CLAUDE_CODE_SESSION_ID | CLAUDE_SESSION_ID | CLAUDECODE |
      | UserPromptSubmit | first   | say done | {project dir} |                 | exec-hook {home}/marketplaces/fixtures/plugins/demo/bin/tool --data={project dir}/.pi/pi-claude-marketplace/data/demo {project dir} ${user_config.token} ${HOME} | {project dir}      | {home}/marketplaces/fixtures/plugins/demo | {project dir}/.pi/pi-claude-marketplace/data/demo | first                  | first             | 1          |
    Then the model receives these calls:
      | call | role | text     |
      | 1    | user | say done |

  Scenario: An exec-form hook whose command names a script under the plugin root runs it
    Given pi runs with the scripted model
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the published plugin "demo" of the marketplace "fixtures" has these hooks, each recording its runs:
      | name        | event            | matcher | form        | arguments |
      | script-hook | UserPromptSubmit |         | exec script | []        |
    Given the marketplace "fixtures" is added to the project scope
    Given the user has run "/claude:plugin install demo@fixtures --scope project"
    Given the user has started a new pi session
    Given the scripted model plays these steps:
      | reply |
      | Done. |
    When the user prompts "say done"
    Then the hooks record these runs:
      | event            | session | prompt   | cwd           | transcript path | arguments   | CLAUDE_PROJECT_DIR | CLAUDE_PLUGIN_ROOT                        | CLAUDE_PLUGIN_DATA                                | CLAUDE_CODE_SESSION_ID | CLAUDE_SESSION_ID | CLAUDECODE |
      | UserPromptSubmit | first   | say done | {project dir} |                 | script-hook | {project dir}      | {home}/marketplaces/fixtures/plugins/demo | {project dir}/.pi/pi-claude-marketplace/data/demo | first                  | first             | 1          |
    Then the model receives these calls:
      | call | role | text     |
      | 1    | user | say done |

  Scenario: A shell-form hook leaves placeholder text to the shell
    Given pi runs with the scripted model
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the published plugin "demo" of the marketplace "fixtures" has these hooks, each recording its runs:
      | name       | event            | matcher | form  | arguments                     |
      | shell-hook | UserPromptSubmit |         | shell | ["'${CLAUDE_PLUGIN_ROOT}/x'"] |
    Given the marketplace "fixtures" is added to the project scope
    Given the user has run "/claude:plugin install demo@fixtures --scope project"
    Given the user has started a new pi session
    Given the scripted model plays these steps:
      | reply |
      | Done. |
    When the user prompts "say done"
    Then the hooks record these runs:
      | event            | session | prompt   | cwd           | transcript path | arguments                          | CLAUDE_PROJECT_DIR | CLAUDE_PLUGIN_ROOT                        | CLAUDE_PLUGIN_DATA                                | CLAUDE_CODE_SESSION_ID | CLAUDE_SESSION_ID | CLAUDECODE |
      | UserPromptSubmit | first   | say done | {project dir} |                 | shell-hook ${CLAUDE_PLUGIN_ROOT}/x | {project dir}      | {home}/marketplaces/fixtures/plugins/demo | {project dir}/.pi/pi-claude-marketplace/data/demo | first                  | first             | 1          |
    Then the model receives these calls:
      | call | role | text     |
      | 1    | user | say done |
