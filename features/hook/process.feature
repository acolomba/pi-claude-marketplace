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
      | name      | event            | matcher | form | arguments                                                                                              |
      | exec-hook | UserPromptSubmit |         | exec | ["${CLAUDE_PLUGIN_ROOT}/bin/tool", "--data=${CLAUDE_PLUGIN_DATA}", "${CLAUDE_PROJECT_DIR}", "${HOME}"] |
    Given the marketplace "fixtures" is added to the project scope
    Given the user has run "/claude:plugin install demo@fixtures --scope project"
    Given the user has started a new pi session
    Given the scripted model plays these steps:
      | reply |
      | Done. |
    When the user prompts "say done"
    Then the hooks record these runs:
      | event            | session | prompt   | cwd           | transcript path | arguments                                                                                                                                            | CLAUDE_PROJECT_DIR | CLAUDE_PLUGIN_ROOT                        | CLAUDE_PLUGIN_DATA                                         | CLAUDE_CODE_SESSION_ID | CLAUDE_SESSION_ID | CLAUDECODE |
      | UserPromptSubmit | first   | say done | {project dir} |                 | exec-hook {home}/marketplaces/fixtures/plugins/demo/bin/tool --data={project dir}/.pi/pi-claude-marketplace/data/fixtures/demo {project dir} ${HOME} | {project dir}      | {home}/marketplaces/fixtures/plugins/demo | {project dir}/.pi/pi-claude-marketplace/data/fixtures/demo | first                  | first             | 1          |
    Then the model receives these calls:
      | call | role | text     |
      | 1    | user | say done |

  Scenario: An exec-form hook receives plugin options in its arguments (PG-CORE-03)
    Given pi runs with the scripted model
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the published plugin "demo" of the marketplace "fixtures" has the file ".claude-plugin/plugin.json" with this text:
      """
      {
        "name": "demo",
        "version": "1.0.0",
        "userConfig": {
          "mode": { "type": "string", "title": "Mode", "description": "The mode.", "default": "fast" },
          "level": { "type": "number", "title": "Level", "description": "The level.", "default": 3 }
        }
      }
      """
    Given the published plugin "demo" of the marketplace "fixtures" has these hooks, each recording its runs:
      | name        | event            | matcher | form | arguments                                                                                          |
      | option-hook | UserPromptSubmit |         | exec | ["${user_config.mode}", "--level=${user_config.level}", "${user_config.mode}${user_config.level}"] |
    Given the marketplace "fixtures" is added to the project scope
    Given the user has run "/claude:plugin install demo@fixtures --scope project"
    Given the user has started a new pi session
    Given the scripted model plays these steps:
      | reply |
      | Done. |
    When the user prompts "say done"
    Then the hooks record these runs:
      | event            | session | prompt   | cwd           | transcript path | arguments                        | CLAUDE_PROJECT_DIR | CLAUDE_PLUGIN_ROOT                        | CLAUDE_PLUGIN_DATA                                         | CLAUDE_PLUGIN_OPTION_MODE | CLAUDE_PLUGIN_OPTION_LEVEL | CLAUDE_CODE_SESSION_ID | CLAUDE_SESSION_ID | CLAUDECODE |
      | UserPromptSubmit | first   | say done | {project dir} |                 | option-hook fast --level=3 fast3 | {project dir}      | {home}/marketplaces/fixtures/plugins/demo | {project dir}/.pi/pi-claude-marketplace/data/fixtures/demo | fast                      | 3                          | first                  | first             | 1          |
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
      | event            | session | prompt   | cwd           | transcript path | arguments   | CLAUDE_PROJECT_DIR | CLAUDE_PLUGIN_ROOT                        | CLAUDE_PLUGIN_DATA                                         | CLAUDE_CODE_SESSION_ID | CLAUDE_SESSION_ID | CLAUDECODE |
      | UserPromptSubmit | first   | say done | {project dir} |                 | script-hook | {project dir}      | {home}/marketplaces/fixtures/plugins/demo | {project dir}/.pi/pi-claude-marketplace/data/fixtures/demo | first                  | first             | 1          |
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
      | event            | session | prompt   | cwd           | transcript path | arguments                          | CLAUDE_PROJECT_DIR | CLAUDE_PLUGIN_ROOT                        | CLAUDE_PLUGIN_DATA                                         | CLAUDE_CODE_SESSION_ID | CLAUDE_SESSION_ID | CLAUDECODE |
      | UserPromptSubmit | first   | say done | {project dir} |                 | shell-hook ${CLAUDE_PLUGIN_ROOT}/x | {project dir}      | {home}/marketplaces/fixtures/plugins/demo | {project dir}/.pi/pi-claude-marketplace/data/fixtures/demo | first                  | first             | 1          |
    Then the model receives these calls:
      | call | role | text     |
      | 1    | user | say done |

  Scenario: A hook receives each plugin option that has a default as CLAUDE_PLUGIN_OPTION_KEY (PG-CORE-03)
    Given pi runs with the scripted model
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the published plugin "demo" of the marketplace "fixtures" has the file ".claude-plugin/plugin.json" with this text:
      """
      {
        "name": "demo",
        "version": "1.0.0",
        "userConfig": {
          "mode": { "type": "string", "title": "Mode", "description": "The mode.", "default": "fast" },
          "retries": { "type": "number", "title": "Retries", "description": "The retries.", "default": 3 },
          "note": { "type": "string", "title": "Note", "description": "A note.", "required": false }
        }
      }
      """
    Given the published plugin "demo" of the marketplace "fixtures" has these hooks, each recording its runs:
      | name        | event            | matcher | form | arguments |
      | option-hook | UserPromptSubmit |         | exec | []        |
    Given the marketplace "fixtures" is added to the project scope
    Given the user has run "/claude:plugin install demo@fixtures --scope project"
    Given the user has started a new pi session
    Given the scripted model plays these steps:
      | reply |
      | Done. |
    When the user prompts "say done"
    Then the hooks record these runs:
      | event            | session | prompt   | cwd           | transcript path | arguments   | CLAUDE_PROJECT_DIR | CLAUDE_PLUGIN_ROOT                        | CLAUDE_PLUGIN_DATA                                         | CLAUDE_PLUGIN_OPTION_MODE | CLAUDE_PLUGIN_OPTION_RETRIES | CLAUDE_CODE_SESSION_ID | CLAUDE_SESSION_ID | CLAUDECODE |
      | UserPromptSubmit | first   | say done | {project dir} |                 | option-hook | {project dir}      | {home}/marketplaces/fixtures/plugins/demo | {project dir}/.pi/pi-claude-marketplace/data/fixtures/demo | fast                      | 3                            | first                  | first             | 1          |
    Then the model receives these calls:
      | call | role | text     |
      | 1    | user | say done |

  Scenario: A hook of a plugin installed in this session receives the plugin's option defaults (PG-CORE-03)
    Given pi runs with the scripted model
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the published plugin "demo" of the marketplace "fixtures" has the file ".claude-plugin/plugin.json" with this text:
      """
      {
        "name": "demo",
        "version": "1.0.0",
        "userConfig": {
          "mode": { "type": "string", "title": "Mode", "description": "The mode.", "default": "fast" },
          "retries": { "type": "number", "title": "Retries", "description": "The retries.", "default": 3 },
          "note": { "type": "string", "title": "Note", "description": "A note.", "required": false }
        }
      }
      """
    Given the published plugin "demo" of the marketplace "fixtures" has these hooks, each recording its runs:
      | name        | event            | matcher | form | arguments |
      | option-hook | UserPromptSubmit |         | exec | []        |
    Given the marketplace "fixtures" is added to the project scope
    Given the user has run "/claude:plugin install demo@fixtures --scope project"
    Given the scripted model plays these steps:
      | reply |
      | Done. |
    When the user prompts "say done"
    Then the hooks record these runs:
      | event            | session | prompt   | cwd           | transcript path | arguments   | CLAUDE_PROJECT_DIR | CLAUDE_PLUGIN_ROOT                        | CLAUDE_PLUGIN_DATA                                         | CLAUDE_PLUGIN_OPTION_MODE | CLAUDE_PLUGIN_OPTION_RETRIES | CLAUDE_CODE_SESSION_ID | CLAUDE_SESSION_ID | CLAUDECODE |
      | UserPromptSubmit | first   | say done | {project dir} |                 | option-hook | {project dir}      | {home}/marketplaces/fixtures/plugins/demo | {project dir}/.pi/pi-claude-marketplace/data/fixtures/demo | fast                      | 3                            | first                  | first             | 1          |
    Then the model receives these calls:
      | call | role | text     |
      | 1    | user | say done |

  Scenario: A reinstall delivers a changed option default to the plugin's hooks (D-PG10-15)
    Given pi runs with the scripted model
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the published plugin "demo" of the marketplace "fixtures" has the file ".claude-plugin/plugin.json" with this text:
      """
      {
        "name": "demo",
        "version": "1.0.0",
        "userConfig": {
          "mode": { "type": "string", "title": "Mode", "description": "The mode.", "default": "fast" }
        }
      }
      """
    Given the published plugin "demo" of the marketplace "fixtures" has these hooks, each recording its runs:
      | name        | event            | matcher | form | arguments |
      | option-hook | UserPromptSubmit |         | exec | []        |
    Given the marketplace "fixtures" is added to the project scope
    Given the user has run "/claude:plugin install demo@fixtures --scope project"
    Given the published plugin "demo" of the marketplace "fixtures" has the file ".claude-plugin/plugin.json" with this text:
      """
      {
        "name": "demo",
        "version": "1.0.0",
        "userConfig": {
          "mode": { "type": "string", "title": "Mode", "description": "The mode.", "default": "slow" }
        }
      }
      """
    Given the user has run "/claude:plugin reinstall demo@fixtures --scope project"
    Given the user has started a new pi session
    Given the scripted model plays these steps:
      | reply |
      | Done. |
    When the user prompts "say done"
    Then the hooks record these runs:
      | event            | session | prompt   | cwd           | transcript path | arguments   | CLAUDE_PROJECT_DIR | CLAUDE_PLUGIN_ROOT                        | CLAUDE_PLUGIN_DATA                                         | CLAUDE_PLUGIN_OPTION_MODE | CLAUDE_CODE_SESSION_ID | CLAUDE_SESSION_ID | CLAUDECODE |
      | UserPromptSubmit | first   | say done | {project dir} |                 | option-hook | {project dir}      | {home}/marketplaces/fixtures/plugins/demo | {project dir}/.pi/pi-claude-marketplace/data/fixtures/demo | slow                      | first                  | first             | 1          |
    Then the model receives these calls:
      | call | role | text     |
      | 1    | user | say done |

  Scenario: A reinstall in this session delivers a changed option default to the plugin's hooks (D-PG10-15)
    Given pi runs with the scripted model
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the published plugin "demo" of the marketplace "fixtures" has the file ".claude-plugin/plugin.json" with this text:
      """
      {
        "name": "demo",
        "version": "1.0.0",
        "userConfig": {
          "mode": { "type": "string", "title": "Mode", "description": "The mode.", "default": "fast" },
          "retries": { "type": "number", "title": "Retries", "description": "The retries.", "default": 3 },
          "note": { "type": "string", "title": "Note", "description": "A note.", "required": false }
        }
      }
      """
    Given the published plugin "demo" of the marketplace "fixtures" has these hooks, each recording its runs:
      | name        | event            | matcher | form | arguments |
      | option-hook | UserPromptSubmit |         | exec | []        |
    Given the marketplace "fixtures" is added to the project scope
    Given the user has run "/claude:plugin install demo@fixtures --scope project"
    Given the published plugin "demo" of the marketplace "fixtures" has the file ".claude-plugin/plugin.json" with this text:
      """
      {
        "name": "demo",
        "version": "1.0.0",
        "userConfig": {
          "mode": { "type": "string", "title": "Mode", "description": "The mode.", "default": "slow" },
          "retries": { "type": "number", "title": "Retries", "description": "The retries.", "default": 3 },
          "note": { "type": "string", "title": "Note", "description": "A note.", "required": false }
        }
      }
      """
    Given the user has run "/claude:plugin reinstall demo@fixtures --scope project"
    Given the scripted model plays these steps:
      | reply |
      | Done. |
    When the user prompts "say done"
    Then the hooks record these runs:
      | event            | session | prompt   | cwd           | transcript path | arguments   | CLAUDE_PROJECT_DIR | CLAUDE_PLUGIN_ROOT                        | CLAUDE_PLUGIN_DATA                                         | CLAUDE_PLUGIN_OPTION_MODE | CLAUDE_PLUGIN_OPTION_RETRIES | CLAUDE_CODE_SESSION_ID | CLAUDE_SESSION_ID | CLAUDECODE |
      | UserPromptSubmit | first   | say done | {project dir} |                 | option-hook | {project dir}      | {home}/marketplaces/fixtures/plugins/demo | {project dir}/.pi/pi-claude-marketplace/data/fixtures/demo | slow                      | 3                            | first                  | first             | 1          |
    Then the model receives these calls:
      | call | role | text     |
      | 1    | user | say done |

  Scenario: Enabling a disabled plugin in this session gives its hooks the plugin's option defaults (D-PG10-15)
    Given pi runs with the scripted model
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the published plugin "demo" of the marketplace "fixtures" has the file ".claude-plugin/plugin.json" with this text:
      """
      {
        "name": "demo",
        "version": "1.0.0",
        "userConfig": {
          "mode": { "type": "string", "title": "Mode", "description": "The mode.", "default": "fast" },
          "retries": { "type": "number", "title": "Retries", "description": "The retries.", "default": 3 },
          "note": { "type": "string", "title": "Note", "description": "A note.", "required": false }
        }
      }
      """
    Given the published plugin "demo" of the marketplace "fixtures" has these hooks, each recording its runs:
      | name        | event            | matcher | form | arguments |
      | option-hook | UserPromptSubmit |         | exec | []        |
    Given the marketplace "fixtures" is added to the project scope
    Given the user has run "/claude:plugin install demo@fixtures --scope project"
    Given the user has run "/claude:plugin disable demo@fixtures --scope project"
    Given the user has run "/claude:plugin enable demo@fixtures --scope project"
    Given the scripted model plays these steps:
      | reply |
      | Done. |
    When the user prompts "say done"
    Then the hooks record these runs:
      | event            | session | prompt   | cwd           | transcript path | arguments   | CLAUDE_PROJECT_DIR | CLAUDE_PLUGIN_ROOT                        | CLAUDE_PLUGIN_DATA                                         | CLAUDE_PLUGIN_OPTION_MODE | CLAUDE_PLUGIN_OPTION_RETRIES | CLAUDE_CODE_SESSION_ID | CLAUDE_SESSION_ID | CLAUDECODE |
      | UserPromptSubmit | first   | say done | {project dir} |                 | option-hook | {project dir}      | {home}/marketplaces/fixtures/plugins/demo | {project dir}/.pi/pi-claude-marketplace/data/fixtures/demo | fast                      | 3                            | first                  | first             | 1          |
    Then the model receives these calls:
      | call | role | text     |
      | 1    | user | say done |
