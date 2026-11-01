Feature: Slash command manifest forms

  A plugin can name its command files and directories in its manifest or its
  marketplace entry, and can declare commands as an object map. Pi loads them
  as Claude Code does. A local marketplace stands in for a published one.

  Scenario: A command file the plugin manifest declares by its path is listed under its file name
    Given pi runs with the scripted model
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the published plugin "demo" of the marketplace "fixtures" has the file ".claude-plugin/plugin.json" with this text:
      """
      { "name": "demo", "version": "1.0.0", "commands": "./cmds/a.md" }
      """
    Given the published plugin "demo" of the marketplace "fixtures" has the file "cmds/a.md" with this text:
      """
      ---
      description: Runs a.
      ---

      Run a.
      """
    Given the marketplace "fixtures" is added to the project scope
    Given the user has run "/claude:plugin install demo@fixtures --scope project"
    Given the user has started a new pi session
    When the user lists the slash commands pi offers
    Then pi offers these slash commands from prompt templates:
      | command | description |
      | /demo:a | Runs a.     |

  Scenario: A commands path a marketplace entry declares adds to the commands folder
    Given pi runs with the scripted model
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the marketplace "fixtures" publishes this manifest:
      """
      {
        "name": "fixtures",
        "owner": { "name": "features" },
        "plugins": [
          { "name": "demo", "source": "./plugins/demo", "version": "1.0.0", "commands": "./more" }
        ]
      }
      """
    Given the published plugin "demo" of the marketplace "fixtures" has the slash command "other" with this command file:
      """
      ---
      description: Runs other.
      ---

      Run other.
      """
    Given the published plugin "demo" of the marketplace "fixtures" has the file "more/b.md" with this text:
      """
      ---
      description: Runs b.
      ---

      Run b.
      """
    Given the marketplace "fixtures" is added to the project scope
    Given the user has run "/claude:plugin install demo@fixtures --scope project"
    Given the user has started a new pi session
    When the user lists the slash commands pi offers
    Then pi offers these slash commands from prompt templates:
      | command     | description |
      | /demo:b     | Runs b.     |
      | /demo:other | Runs other. |

  Scenario: Installing a plugin whose marketplace entry declares a commands path reports no folder note
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the marketplace "fixtures" publishes this manifest:
      """
      {
        "name": "fixtures",
        "owner": { "name": "features" },
        "plugins": [
          { "name": "demo", "source": "./plugins/demo", "version": "1.0.0", "commands": "./more" }
        ]
      }
      """
    Given the published plugin "demo" of the marketplace "fixtures" has the slash command "other" with this command file:
      """
      Run other.
      """
    Given the published plugin "demo" of the marketplace "fixtures" has the file "more/b.md" with this text:
      """
      Run b.
      """
    Given the marketplace "fixtures" is added to the project scope
    When the user runs "/claude:plugin install demo@fixtures --scope project"
    Then the command reports these results:
      | kind    | severity | needs reload |
      | cascade | info     | true         |
    Then the results list these marketplaces and plugins:
      | marketplace name | marketplace scope | id            | name | status    | reasons | scope   | version |
      | fixtures         | project           | demo@fixtures | demo | installed |         | project | 1.0.0   |

  Scenario: A commands path the plugin manifest declares replaces the commands folder
    Given pi runs with the scripted model
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the published plugin "demo" of the marketplace "fixtures" has the file ".claude-plugin/plugin.json" with this text:
      """
      { "name": "demo", "version": "1.0.0", "commands": "./custom" }
      """
    Given the published plugin "demo" of the marketplace "fixtures" has the file "custom/hello.md" with this text:
      """
      ---
      description: Says hello.
      ---

      Say hello.
      """
    Given the published plugin "demo" of the marketplace "fixtures" has the slash command "old" with this command file:
      """
      ---
      description: Runs old.
      ---

      Run old.
      """
    Given the marketplace "fixtures" is added to the project scope
    When the user runs "/claude:plugin install demo@fixtures --scope project"
    Then the command reports these results:
      | kind       | severity | needs reload | header                                                              | lines                                                                    |
      | cascade    | info     | true         |                                                                     |                                                                          |
      | diagnostic | warning  | false        | Plugin "demo" [project] installed; 1 declared component has a note. | Default commands/ folder is ignored because the manifest sets "commands" |
    Then the results list these marketplaces and plugins:
      | marketplace name | marketplace scope | id            | name | status    | reasons | scope   | version |
      | fixtures         | project           | demo@fixtures | demo | installed |         | project | 1.0.0   |
    When the user starts a new pi session
    When the user lists the slash commands pi offers
    Then pi offers these slash commands from prompt templates:
      | command     | description |
      | /demo:hello | Says hello. |

  Scenario: The plugin info of an unavailable plugin lists the commands folder beside the commands path its entry declares
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the marketplace "fixtures" publishes this manifest:
      """
      {
        "name": "fixtures",
        "owner": { "name": "features" },
        "plugins": [
          {
            "name": "demo",
            "source": "./plugins/demo",
            "version": "1.0.0",
            "skills": 42,
            "commands": "./more"
          }
        ]
      }
      """
    Given the published plugin "demo" of the marketplace "fixtures" has the slash command "a" with this command file:
      """
      Run a.
      """
    Given the published plugin "demo" of the marketplace "fixtures" has the file "more/b.md" with this text:
      """
      Run b.
      """
    Given the marketplace "fixtures" is added to the project scope
    When the user runs "/claude:plugin info demo@fixtures"
    Then the result has these fields:
      | kind                           | plugin-info        |
      | marketplace details autoupdate | false              |
      | marketplace name               | fixtures           |
      | marketplace scope              | project            |
      | needs reload                   | false              |
      | plugin components commands     | a, b               |
      | plugin components resolved     | true               |
      | plugin components skills       | demo-skill         |
      | plugin id                      | demo@fixtures      |
      | plugin name                    | demo               |
      | plugin reasons                 | unsupported source |
      | plugin status                  | unavailable        |
      | plugin version                 | 1.0.0              |
      | severity                       | info               |

  Scenario: Command files and directories a manifest declares in one array are all listed
    Given pi runs with the scripted model
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the published plugin "demo" of the marketplace "fixtures" has the file ".claude-plugin/plugin.json" with this text:
      """
      { "name": "demo", "version": "1.0.0", "commands": ["./cmds/a.md", "./more"] }
      """
    Given the published plugin "demo" of the marketplace "fixtures" has the file "cmds/a.md" with this text:
      """
      ---
      description: Runs a.
      ---

      Run a.
      """
    Given the published plugin "demo" of the marketplace "fixtures" has the file "more/b.md" with this text:
      """
      ---
      description: Runs b.
      ---

      Run b.
      """
    Given the published plugin "demo" of the marketplace "fixtures" has the file "more/sub/x.md" with this text:
      """
      ---
      description: Runs x.
      ---

      Run x.
      """
    Given the marketplace "fixtures" is added to the project scope
    Given the user has run "/claude:plugin install demo@fixtures --scope project"
    Given the user has started a new pi session
    When the user lists the slash commands pi offers
    Then pi offers these slash commands from prompt templates:
      | command     | description |
      | /demo:a     | Runs a.     |
      | /demo:b     | Runs b.     |
      | /demo:sub:x | Runs x.     |

  Scenario: A declared commands path that names a file other than a markdown file is skipped with a warning
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the published plugin "demo" of the marketplace "fixtures" has the file ".claude-plugin/plugin.json" with this text:
      """
      { "name": "demo", "version": "1.0.0", "commands": ["./cmds/readme.txt", "./cmds/a.md"] }
      """
    Given the published plugin "demo" of the marketplace "fixtures" has the file "cmds/readme.txt" with this text:
      """
      Read me.
      """
    Given the published plugin "demo" of the marketplace "fixtures" has the file "cmds/a.md" with this text:
      """
      Run a.
      """
    Given the marketplace "fixtures" is added to the project scope
    When the user runs "/claude:plugin install demo@fixtures --scope project"
    Then the command reports these results:
      | kind       | severity | needs reload | header                                                              | lines                                                                                    |
      | cascade    | info     | true         |                                                                     |                                                                                          |
      | diagnostic | warning  | false        | Plugin "demo" [project] installed; 1 declared component has a note. | declared command path "cmds/readme.txt" in "demo" is not a markdown file; skipping path. |
    Then the results list these marketplaces and plugins:
      | marketplace name | marketplace scope | id            | name | status    | reasons | scope   | version |
      | fixtures         | project           | demo@fixtures | demo | installed |         | project | 1.0.0   |

  Scenario: A plugin manifest's object map of commands lists each command under its key
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
        "commands": {
          "alpha": { "source": "./cmds/alpha.md" },
          "beta": { "source": "./cmds/beta.md" }
        }
      }
      """
    Given the published plugin "demo" of the marketplace "fixtures" has the file "cmds/alpha.md" with this text:
      """
      ---
      description: Runs alpha.
      ---

      Run alpha.
      """
    Given the published plugin "demo" of the marketplace "fixtures" has the file "cmds/beta.md" with this text:
      """
      ---
      description: Runs beta.
      ---

      Run beta.
      """
    Given the marketplace "fixtures" is added to the project scope
    Given the user has run "/claude:plugin install demo@fixtures --scope project"
    Given the user has started a new pi session
    When the user lists the slash commands pi offers
    Then pi offers these slash commands from prompt templates:
      | command     | description |
      | /demo:alpha | Runs alpha. |
      | /demo:beta  | Runs beta.  |

  Scenario: Installing a plugin whose manifest declares its commands as an object map reports the commands folder it leaves unread
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the published plugin "demo" of the marketplace "fixtures" has the file ".claude-plugin/plugin.json" with this text:
      """
      {
        "name": "demo",
        "version": "1.0.0",
        "commands": {
          "alpha": { "source": "./cmds/alpha.md" },
          "beta": { "source": "./cmds/beta.md" }
        }
      }
      """
    Given the published plugin "demo" of the marketplace "fixtures" has the file "cmds/alpha.md" with this text:
      """
      Run alpha.
      """
    Given the published plugin "demo" of the marketplace "fixtures" has the file "cmds/beta.md" with this text:
      """
      Run beta.
      """
    Given the published plugin "demo" of the marketplace "fixtures" has the slash command "old" with this command file:
      """
      Run old.
      """
    Given the marketplace "fixtures" is added to the project scope
    When the user runs "/claude:plugin install demo@fixtures --scope project"
    Then the command reports these results:
      | kind       | severity | needs reload | header                                                              | lines                                                                    |
      | cascade    | info     | true         |                                                                     |                                                                          |
      | diagnostic | warning  | false        | Plugin "demo" [project] installed; 1 declared component has a note. | Default commands/ folder is ignored because the manifest sets "commands" |
    Then the results list these marketplaces and plugins:
      | marketplace name | marketplace scope | id            | name | status    | reasons | scope   | version |
      | fixtures         | project           | demo@fixtures | demo | installed |         | project | 1.0.0   |

  Scenario: A marketplace entry's object map of commands adds to the commands folder
    Given pi runs with the scripted model
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the marketplace "fixtures" publishes this manifest:
      """
      {
        "name": "fixtures",
        "owner": { "name": "features" },
        "plugins": [
          {
            "name": "demo",
            "source": "./plugins/demo",
            "version": "1.0.0",
            "commands": { "gamma": { "source": "./extra/gamma.md" } }
          }
        ]
      }
      """
    Given the published plugin "demo" of the marketplace "fixtures" has the slash command "other" with this command file:
      """
      ---
      description: Runs other.
      ---

      Run other.
      """
    Given the published plugin "demo" of the marketplace "fixtures" has the file "extra/gamma.md" with this text:
      """
      ---
      description: Runs gamma.
      ---

      Run gamma.
      """
    Given the marketplace "fixtures" is added to the project scope
    Given the user has run "/claude:plugin install demo@fixtures --scope project"
    Given the user has started a new pi session
    When the user lists the slash commands pi offers
    Then pi offers these slash commands from prompt templates:
      | command     | description |
      | /demo:gamma | Runs gamma. |
      | /demo:other | Runs other. |

  Scenario: A marketplace entry's command map key names a folder file whose own command name another file took
    Given pi runs with the scripted model
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the marketplace "fixtures" publishes this manifest:
      """
      {
        "name": "fixtures",
        "owner": { "name": "features" },
        "plugins": [
          {
            "name": "demo",
            "source": "./plugins/demo",
            "version": "1.0.0",
            "commands": { "check": { "source": "./commands/lint.md" } }
          }
        ]
      }
      """
    Given the published plugin "demo" of the marketplace "fixtures" has the slash command "demo-lint" with this command file:
      """
      ---
      description: Lints.
      ---

      Lint.
      """
    Given the published plugin "demo" of the marketplace "fixtures" has the slash command "lint" with this command file:
      """
      ---
      description: Checks.
      ---

      Check.
      """
    Given the marketplace "fixtures" is added to the project scope
    When the user runs "/claude:plugin install demo@fixtures --scope project"
    Then the command reports these results:
      | kind       | severity | needs reload | header                                                              | lines                                       |
      | cascade    | info     | true         |                                                                     |                                             |
      | diagnostic | warning  | false        | Plugin "demo" [project] installed; 1 declared component has a note. | command source "lint" in "[redacted path] |
    Then the results list these marketplaces and plugins:
      | marketplace name | marketplace scope | id            | name | status    | reasons | scope   | version |
      | fixtures         | project           | demo@fixtures | demo | installed |         | project | 1.0.0   |
    When the user starts a new pi session
    When the user lists the slash commands pi offers
    Then pi offers these slash commands from prompt templates:
      | command     | description |
      | /demo:check | Checks.     |
      | /demo:lint  | Lints.      |

  Scenario Outline: A command map entry that names both or neither of source and content makes the plugin unavailable
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the published plugin "demo" of the marketplace "fixtures" has the file ".claude-plugin/plugin.json" with this text:
      """
      { "name": "demo", "version": "1.0.0", "commands": <commands> }
      """
    Given the published plugin "demo" of the marketplace "fixtures" has the file "cmds/alpha.md" with this text:
      """
      Run alpha.
      """
    Given the marketplace "fixtures" is added to the project scope
    When the user runs "/claude:plugin install demo@fixtures --scope project"
    Then the result has these fields:
      | kind         | cascade                        |
      | severity     | error                          |
      | needs reload | false                          |
      | summary      | A plugin operation has failed. |
    Then the result lists these plugins:
      | marketplace name | marketplace scope | id            | name | status      | reasons            |
      | fixtures         | project           | demo@fixtures | demo | unavailable | unsupported source |
    Then the project scope has no installed plugins

    Examples:
      | entry form                     | commands                                                                              |
      | both source and content        | { "alpha": { "source": "./cmds/alpha.md", "content": "Run alpha." } }                 |
      | neither source nor content     | { "alpha": { "source": "./cmds/alpha.md" }, "beta": { "description": "Runs beta." } } |
      | a description that is a number | { "alpha": { "source": "./cmds/alpha.md", "description": 5 } }                        |

  Scenario Outline: A command map key pi cannot name is skipped with a warning
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the published plugin "demo" of the marketplace "fixtures" has the file ".claude-plugin/plugin.json" with this text:
      """
      {
        "name": "demo",
        "version": "1.0.0",
        "commands": {
          "alpha": { "source": "./cmds/alpha.md" },
          "<key>": { "source": "./cmds/other.md" }
        }
      }
      """
    Given the published plugin "demo" of the marketplace "fixtures" has the file "cmds/alpha.md" with this text:
      """
      Run alpha.
      """
    Given the published plugin "demo" of the marketplace "fixtures" has the file "cmds/other.md" with this text:
      """
      Run other.
      """
    Given the marketplace "fixtures" is added to the project scope
    When the user runs "/claude:plugin install demo@fixtures --scope project"
    Then the command reports these results:
      | kind       | severity | needs reload | header                                                              | lines                                               |
      | cascade    | info     | true         |                                                                     |                                                     |
      | diagnostic | warning  | false        | Plugin "demo" [project] installed; 1 declared component has a note. | command map entry "<key>" <reason>; skipping entry. |
    Then the results list these marketplaces and plugins:
      | marketplace name | marketplace scope | id            | name | status    | reasons | scope   | version |
      | fixtures         | project           | demo@fixtures | demo | installed |         | project | 1.0.0   |

    Examples:
      | key       | reason           |
      | trail:    | ends with ":"    |
      | has space | holds whitespace |
      | <angle    | holds "<" or ">" |

  Scenario Outline: A command map entry whose source pi cannot stage is skipped with a warning
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the published plugin "demo" of the marketplace "fixtures" has the file ".claude-plugin/plugin.json" with this text:
      """
      {
        "name": "demo",
        "version": "1.0.0",
        "commands": {
          "alpha": { "source": "./cmds/alpha.md" },
          "beta": { "source": "./<source>" }
        }
      }
      """
    Given the published plugin "demo" of the marketplace "fixtures" has the file "cmds/alpha.md" with this text:
      """
      Run alpha.
      """
    Given the published plugin "demo" of the marketplace "fixtures" has the file "cmds/notes.txt" with this text:
      """
      Read the notes.
      """
    Given the published plugin "demo" of the marketplace "fixtures" has the file "cmds/.hidden.md" with this text:
      """
      Run hidden.
      """
    Given the marketplace "fixtures" is added to the project scope
    When the user runs "/claude:plugin install demo@fixtures --scope project"
    Then the command reports these results:
      | kind       | severity | needs reload | header                                                              | lines                                                                      |
      | cascade    | info     | true         |                                                                     |                                                                            |
      | diagnostic | warning  | false        | Plugin "demo" [project] installed; 1 declared component has a note. | command map entry "beta" names "<source>", which <reason>; skipping entry. |
    Then the results list these marketplaces and plugins:
      | marketplace name | marketplace scope | id            | name | status    | reasons | scope   | version |
      | fixtures         | project           | demo@fixtures | demo | installed |         | project | 1.0.0   |

    Examples:
      | source form    | source          | reason                 |
      | a missing file | cmds/missing.md | does not exist         |
      | a text file    | cmds/notes.txt  | is not a markdown file |
      | a dotfile      | cmds/.hidden.md | is dotfile-prefixed    |

  Scenario: A command map entry whose source is a directory is read as a directory
    Given pi runs with the scripted model
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the published plugin "demo" of the marketplace "fixtures" has the file ".claude-plugin/plugin.json" with this text:
      """
      { "name": "demo", "version": "1.0.0", "commands": { "tools": { "source": "./more" } } }
      """
    Given the published plugin "demo" of the marketplace "fixtures" has the file "more/b.md" with this text:
      """
      ---
      description: Runs b.
      ---

      Run b.
      """
    Given the published plugin "demo" of the marketplace "fixtures" has the file "more/sub/x.md" with this text:
      """
      ---
      description: Runs x.
      ---

      Run x.
      """
    Given the marketplace "fixtures" is added to the project scope
    Given the user has run "/claude:plugin install demo@fixtures --scope project"
    Given the user has started a new pi session
    When the user lists the slash commands pi offers
    Then pi offers these slash commands from prompt templates:
      | command     | description |
      | /demo:b     | Runs b.     |
      | /demo:sub:x | Runs x.     |

  Scenario: Two command map keys that name one file keep the first
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the published plugin "demo" of the marketplace "fixtures" has the file ".claude-plugin/plugin.json" with this text:
      """
      {
        "name": "demo",
        "version": "1.0.0",
        "commands": {
          "one": { "source": "./cmds/a.md" },
          "two": { "source": "./cmds/a.md" }
        }
      }
      """
    Given the published plugin "demo" of the marketplace "fixtures" has the file "cmds/a.md" with this text:
      """
      Run a.
      """
    Given the marketplace "fixtures" is added to the project scope
    When the user runs "/claude:plugin install demo@fixtures --scope project"
    Then the command reports these results:
      | kind       | severity | needs reload | header                                                              | lines                                                                                              |
      | cascade    | info     | true         |                                                                     |                                                                                                    |
      | diagnostic | warning  | false        | Plugin "demo" [project] installed; 1 declared component has a note. | command map entry "two" names "cmds/a.md", already loaded as command source "one"; skipping entry. |
    Then the results list these marketplaces and plugins:
      | marketplace name | marketplace scope | id            | name | status    | reasons | scope   | version |
      | fixtures         | project           | demo@fixtures | demo | installed |         | project | 1.0.0   |

  Scenario: A command map entry's inline content is listed with the manifest's description
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
        "commands": {
          "beta": { "content": "Beta inline body $ARGUMENTS", "description": "Beta from the manifest." }
        }
      }
      """
    Given the marketplace "fixtures" is added to the project scope
    Given the user has run "/claude:plugin install demo@fixtures --scope project"
    Given the user has started a new pi session
    When the user lists the slash commands pi offers
    Then pi offers these slash commands from prompt templates:
      | command    | description             |
      | /demo:beta | Beta from the manifest. |

  Scenario: Inline command content keeps its own frontmatter
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
        "commands": {
          "fm": { "content": "---\ndescription: FM in content\n---\nFM body $ARGUMENTS" }
        }
      }
      """
    Given the marketplace "fixtures" is added to the project scope
    Given the user has run "/claude:plugin install demo@fixtures --scope project"
    Given the user has started a new pi session
    When the user lists the slash commands pi offers
    Then pi offers these slash commands from prompt templates:
      | command  | description   |
      | /demo:fm | FM in content |

  Scenario: Invoking an inline command sends the model its content with the arguments
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
        "commands": {
          "beta": { "content": "Beta inline body $ARGUMENTS", "description": "Beta from the manifest." }
        }
      }
      """
    Given the marketplace "fixtures" is added to the project scope
    Given the user has run "/claude:plugin install demo@fixtures --scope project"
    Given the user has started a new pi session
    Given the scripted model plays these steps:
      | reply     |
      | Beta ran. |
    When the user prompts "/demo:beta x"
    Then the model receives these calls:
      | call | role | text               |
      | 1    | user | Beta inline body x |

  Scenario: A command map entry's model is reported as a dropped field
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the published plugin "demo" of the marketplace "fixtures" has the file ".claude-plugin/plugin.json" with this text:
      """
      {
        "name": "demo",
        "version": "1.0.0",
        "commands": { "alpha": { "source": "./cmds/alpha.md", "model": "opus" } }
      }
      """
    Given the published plugin "demo" of the marketplace "fixtures" has the file "cmds/alpha.md" with this text:
      """
      ---
      description: Runs alpha.
      ---

      Run alpha.
      """
    Given the marketplace "fixtures" is added to the project scope
    When the user runs "/claude:plugin install demo@fixtures --scope project"
    Then the command reports these results:
      | kind       | severity | needs reload | header                                                              | lines                         |
      | cascade    | info     | true         |                                                                     |                               |
      | diagnostic | warning  | false        | Plugin "demo" [project] installed; 1 declared component has a note. | [alpha] dropped fields: model |
    Then the results list these marketplaces and plugins:
      | marketplace name | marketplace scope | id            | name | status    | reasons | scope   | version |
      | fixtures         | project           | demo@fixtures | demo | installed |         | project | 1.0.0   |

  Scenario: A command map entry's argument hint is shown in pi's terminal menu
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the published plugin "demo" of the marketplace "fixtures" has the file ".claude-plugin/plugin.json" with this text:
      """
      {
        "name": "demo",
        "version": "1.0.0",
        "commands": { "alpha": { "source": "./cmds/alpha.md", "argumentHint": "<target>" } }
      }
      """
    Given the published plugin "demo" of the marketplace "fixtures" has the file "cmds/alpha.md" with this text:
      """
      ---
      description: Runs alpha.
      argument-hint: <file hint>
      ---

      Run alpha.
      """
    Given the marketplace "fixtures" is added to the project scope
    Given the user has run "/claude:plugin install demo@fixtures --scope project"
    When the user types the slash command prefix "/demo:al" in pi's terminal
    Then pi's terminal menu offers these slash commands:
      | command    | text                        |
      | demo:alpha | <target> -- [t] Runs alpha. |

  Scenario: A marketplace entry's inline command content is dropped with a warning
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the marketplace "fixtures" publishes this manifest:
      """
      {
        "name": "fixtures",
        "owner": { "name": "features" },
        "plugins": [
          {
            "name": "demo",
            "source": "./plugins/demo",
            "version": "1.0.0",
            "commands": {
              "gamma": { "source": "./extra/gamma.md" },
              "delta": { "content": "Delta inline body." }
            }
          }
        ]
      }
      """
    Given the published plugin "demo" of the marketplace "fixtures" has the file "extra/gamma.md" with this text:
      """
      Run gamma.
      """
    Given the marketplace "fixtures" is added to the project scope
    When the user runs "/claude:plugin install demo@fixtures --scope project"
    Then the command reports these results:
      | kind       | severity | needs reload | header                                                              | lines                                                                                               |
      | cascade    | info     | true         |                                                                     |                                                                                                     |
      | diagnostic | warning  | false        | Plugin "demo" [project] installed; 1 declared component has a note. | command map entry "delta" sets "content", which a marketplace entry cannot declare; skipping entry. |
    Then the results list these marketplaces and plugins:
      | marketplace name | marketplace scope | id            | name | status    | reasons | scope   | version |
      | fixtures         | project           | demo@fixtures | demo | installed |         | project | 1.0.0   |
