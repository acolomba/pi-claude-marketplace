<!-- markdownlint-disable MD033 MD041 -->

<p align="center">
  <img src="https://media.githubusercontent.com/media/acolomba/pi-claude-marketplace/refs/heads/main/images/redpi.png" alt="Pi Claude Marketplace logo" width="360">
</p>
<!-- markdownlint-enable MD033 MD041 -->

# Pi Claude Marketplace

[![CI](https://github.com/acolomba/pi-claude-marketplace/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/acolomba/pi-claude-marketplace/actions/workflows/ci.yml) [![Quality Gate Status](https://sonarcloud.io/api/project_badges/measure?project=acolomba_pi-claude-marketplace&metric=alert_status)](https://sonarcloud.io/summary/overall?id=acolomba_pi-claude-marketplace) [![Coverage](https://sonarcloud.io/api/project_badges/measure?project=acolomba_pi-claude-marketplace&metric=coverage)](https://sonarcloud.io/summary/overall?id=acolomba_pi-claude-marketplace) [![Bugs](https://sonarcloud.io/api/project_badges/measure?project=acolomba_pi-claude-marketplace&metric=bugs)](https://sonarcloud.io/summary/overall?id=acolomba_pi-claude-marketplace) [![Code Smells](https://sonarcloud.io/api/project_badges/measure?project=acolomba_pi-claude-marketplace&metric=code_smells)](https://sonarcloud.io/summary/overall?id=acolomba_pi-claude-marketplace) [![Maintainability Rating](https://sonarcloud.io/api/project_badges/measure?project=acolomba_pi-claude-marketplace&metric=sqale_rating)](https://sonarcloud.io/summary/overall?id=acolomba_pi-claude-marketplace) [![Reliability Rating](https://sonarcloud.io/api/project_badges/measure?project=acolomba_pi-claude-marketplace&metric=reliability_rating)](https://sonarcloud.io/summary/overall?id=acolomba_pi-claude-marketplace) [![Security Rating](https://sonarcloud.io/api/project_badges/measure?project=acolomba_pi-claude-marketplace&metric=security_rating)](https://sonarcloud.io/summary/overall?id=acolomba_pi-claude-marketplace) [![GitHub](https://img.shields.io/badge/GitHub-acolomba%2Fpi--claude--marketplace-181717?logo=github&logoColor=white)](https://github.com/acolomba/pi-claude-marketplace) [![npm](https://img.shields.io/badge/npm-pi--claude--marketplace-cb3837?logo=npm&logoColor=white)](https://www.npmjs.com/package/pi-claude-marketplace) [![pi.dev](https://img.shields.io/badge/pi.dev-pi--claude--marketplace-09090b?logo=data:image/svg%2Bxml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCA4MDAgODAwIj48cmVjdCB3aWR0aD0iODAwIiBoZWlnaHQ9IjgwMCIgcng9IjEyMCIgZmlsbD0iIzA5MDkwYiIvPjxwYXRoIGZpbGw9IiNmZmYiIGZpbGwtcnVsZT0iZXZlbm9kZCIgZD0iTTE2NS4yOSAxNjUuMjlINTE3LjM2VjQwMEg0MDBWNTE3LjM2SDI4Mi42NVY2MzQuNzJIMTY1LjI5Wk0yODIuNjUgMjgyLjY1VjQwMEg0MDBWMjgyLjY1WiIvPjxwYXRoIGZpbGw9IiNmZmYiIGQ9Ik01MTcuMzYgNDAwSDYzNC43MlY2MzQuNzJINTE3LjM2WiIvPjwvc3ZnPg==)](https://pi.dev/packages/pi-claude-marketplace)

Accede a los mercados de complementos de Claude desde [Pi Coding Agent](https://pi.dev). Admite los comandos, habilidades, agentes, hooks, servidores MCP y workflows de Claude.

<!-- markdownlint-disable MD033 -->

<p align="center">
  <img src="https://media.githubusercontent.com/media/acolomba/pi-claude-marketplace/refs/heads/main/demos/bootstrap.gif" alt="Bootstrap demo" width="720">
</p>
<!-- markdownlint-enable MD033 -->

## Características

Esta extensión instala complementos desde los mercados de complementos de Claude que contienen los siguientes componentes:

- Comandos.
- Habilidades.
- Agentes. Requiere [pi-subagents](https://pi.dev/packages/pi-subagents).
- Hooks (ganchos). Soporte parcial. Para más información, consulta [Compatibilidad de hooks](docs/hooks-compatibility.md).
- Servidores MCP. Requiere [pi-mcp-adapter](https://pi.dev/packages/pi-mcp-adapter). Para más información, consulta [Compatibilidad de MCP](docs/mcp-compatibility.md).
- Workflows (flujos de trabajo). Requiere [@quintinshaw/pi-dynamic-workflows](https://pi.dev/packages/@quintinshaw/pi-dynamic-workflows). Para más información, consulta [Compatibilidad de workflows](docs/workflows-compatibility.md).

Los complementos que contienen componentes no compatibles pueden instalarse parcialmente. Un complemento instalado parcialmente puede no funcionar según lo previsto.

El comando `/claude:plugin` gestiona los mercados y complementos de Claude, como `/plugin` de Claude Code. Las configuraciones de estado deseado en `[~/].pi/agent/claude-plugins[.local].json` hacen que las instalaciones de complementos sean automáticas y repetibles. Puedes compartir estas configuraciones entre máquinas o miembros del equipo.

## Requisitos previos

- [Pi Coding Agent](https://pi.dev) 1.0.0 o posterior
- [pi-subagents](https://pi.dev/packages/pi-subagents) 0.74.0 o posterior (opcional pero recomendado, `pi install npm:pi-subagents`)
- [pi-mcp-adapter](https://pi.dev/packages/pi-mcp-adapter) 5.2.0 o una versión 5.x posterior (opcional pero recomendado, `pi install npm:pi-mcp-adapter`). La compatibilidad con MCP integrada en Pi no cumple este requisito.
- [@quintinshaw/pi-dynamic-workflows](https://pi.dev/packages/@quintinshaw/pi-dynamic-workflows) (opcional pero recomendado, `pi install npm:@quintinshaw/pi-dynamic-workflows`)

## Uso

Instala la extensión de Pi:

```bash
pi install npm:pi-claude-marketplace
```

Inicializa (bootstrap) el mercado oficial de complementos de Claude (`anthropics/claude-plugins-official`):

```text
/claude:plugin bootstrap
```

Lista los complementos disponibles para instalar:

```text
/claude:plugin list --available
```

Instala un complemento:

```text
/claude:plugin install pr-review-toolkit@claude-plugins-official
```

Agrega otro mercado:

```text
/claude:plugin marketplace add upstash/context7
```

Lista sus complementos:

```text
/claude:plugin list context7-marketplace --available
```

Agrega otro complemento:

```text
/claude:plugin install context7-plugin@context7-marketplace
```

Luego recarga:

```text
/reload
```

Ejecuta un complemento:

```text
/pr-review-toolkit:review-pr
```

### Mapeo de nombres

Esta extensión prefija los nombres de comandos y habilidades con el nombre del complemento. Si el nombre ya empieza con el nombre del complemento y `-`, esta extensión elimina esa parte común.

Los comandos usan dos puntos (`:`) en POSIX y un punto (`.`) en Windows:

| Nombre del complemento | Nombre del comando | Nombre en Pi (POSIX) | Nombre en Pi (Windows) |
| ---------------------- | ------------------ | -------------------- | ---------------------- |
| `foo`                  | `bar`              | `/foo:bar`           | `/foo.bar`             |
| `foo`                  | `foo-bar`          | `/foo:bar`           | `/foo.bar`             |
| `foo`                  | `foo`              | `/foo:foo`           | `/foo.foo`             |

Las habilidades usan la forma `/skill:` de Pi y también tienen un alias en las sesiones interactivas:

| Nombre del complemento | Nombre de la habilidad | Forma de Pi      | Alias interactivo |
| ---------------------- | ---------------------- | ---------------- | ----------------- |
| `foo`                  | `bar`                  | `/skill:foo-bar` | `/foo:bar`        |
| `foo`                  | `foo-bar`              | `/skill:foo-bar` | `/foo:bar`        |
| `foo`                  | `foo`                  | `/skill:foo`     | `/foo:foo`        |

Los alias de habilidades usan dos puntos en todas las plataformas. Si un alias entra en conflicto con un comando, el comando tiene prioridad. Usa `/skill:foo-bar` para ejecutar la habilidad.

Los servidores MCP de los complementos reciben los nombres que les da Claude Code. El modelo ve cada herramienta como `mcp__plugin_<plugin>_<server>__<tool>`. pi-mcp-adapter guarda cada servidor bajo una clave que termina en `_`. `/claude:plugin info` muestra cada servidor como `plugin:<plugin>:<server>`.

| Nombre del complemento | Clave de `mcpServers` | Clave del servidor en el adaptador | Nombres de las herramientas     | Nombre que muestra `info` |
| ---------------------- | --------------------- | ---------------------------------- | ------------------------------- | ------------------------- |
| `foo`                  | `api`                 | `plugin_foo_api_`                  | `mcp__plugin_foo_api__<tool>`   | `plugin:foo:api`          |
| `foo`                  | `my.db`               | `plugin_foo_my_db_`                | `mcp__plugin_foo_my_db__<tool>` | `plugin:foo:my.db`        |
| `bar`                  | `api`                 | `plugin_bar_api_`                  | `mcp__plugin_bar_api__<tool>`   | `plugin:bar:api`          |

### Ámbito (Scoping)

Puedes instalar mercados y complementos en el ámbito de usuario o en el ámbito del proyecto. El valor predeterminado es el ámbito de usuario.

El ámbito del proyecto hereda el ámbito de usuario. Así, puedes instalar un complemento desde un mercado de ámbito de usuario en el ámbito del proyecto. La instalación agrega ese mercado al ámbito del proyecto, como lo haría `marketplace add --scope project`, y lo declara en la configuración base del proyecto (`claude-plugins.json`), o en su configuración local (`claude-plugins.local.json`) con `--local`. Para un mercado git, el proyecto obtiene su propio clon. El proyecto conserva entonces el mercado cuando lo eliminas del ámbito de usuario.

También puedes instalar el mismo complemento en ambos ámbitos, el de usuario y el de proyecto. En ese caso, el complemento del ámbito de usuario tiene prioridad.

### Complementos parcialmente disponibles

Algunos complementos contienen componentes no compatibles: un hook que no se puede mapear, un servidor LSP, un tema o un servidor MCP que usa una función que pi-mcp-adapter no puede ejecutar. Para instalar o actualizar estos complementos parcialmente, pasa la opción `--partial`. Esta extensión instala los componentes compatibles e ignora los incompatibles.

Lista los complementos parcialmente disponibles.

```text
/claude:plugin list --partial
```

Instala un complemento parcialmente disponible. Coloca `--partial` primero para habilitar el autocompletado de argumentos para complementos parcialmente disponibles. Sin esa opción, el autocompletado los excluye.

```text
/claude:plugin install --partial hookify@claude-plugins-official
```

## Archivos de configuración

Cada ámbito declara sus mercados y complementos en dos capas: la capa base y la capa local. El archivo de una capa es su configuración. La configuración base, `claude-plugins.json`, está bajo la raíz del ámbito.

| Ámbito    | Ruta del archivo                  |
| --------- | --------------------------------- |
| `user`    | `~/.pi/agent/claude-plugins.json` |
| `project` | `<cwd>/.pi/claude-plugins.json`   |

Las configuraciones de un ámbito son el registro definitivo de sus mercados y complementos instalados. Pi aplica su contenido al cargar la extensión (`/reload`).

Que Pi aplique los componentes de un complemento declarado depende de la clave opcional `enabled` de la entrada y del valor predeterminado de instalación que declara el autor del complemento. Para más información, consulta [Activación de complementos](docs/plugin-enablement.md).

### La configuración local

La configuración local, `claude-plugins.local.json`, está junto a la configuración base.

| Ámbito    | Ruta del archivo                        |
| --------- | --------------------------------------- |
| `user`    | `~/.pi/agent/claude-plugins.local.json` |
| `project` | `<cwd>/.pi/claude-plugins.local.json`   |

La configuración local anula entradas de la configuración base. Puedes declarar un mercado o un complemento en ambas capas. Su entrada local anula solo los campos que define, y toma los demás campos de la configuración base. Por ejemplo, una entrada local de mercado sin `autoupdate` usa el valor de `autoupdate` de la configuración base, y una entrada local de complemento sin `enabled` usa el valor de `enabled` de la configuración base.

Un comando que escribe una declaración modifica solo la configuración base, o solo la configuración local con `--local`. Hay dos excepciones:

- Una eliminación que quita el mercado del ámbito también borra sus claves de complementos de ambas configuraciones.
- `marketplace autoupdate` y `marketplace noautoupdate` sin un nombre fijan el valor en la configuración base. Escriben una entrada local solo cuando el valor que se le aplica todavía es distinto, así que una entrada local sin `autoupdate` toma el nuevo valor de la base cuando la configuración base declara el mercado. Con `--local`, modifican solo la configuración local.

`marketplace remove`, `marketplace autoupdate` y `marketplace noautoupdate` con un nombre fallan cuando la capa de destino no declara el mercado. Con `--local`, `marketplace autoupdate` y `marketplace noautoupdate`, con o sin un nombre, escriben el valor local solo cuando cambia el valor que se aplica. Fallan con `{invalid manifest}` cuando necesitan el valor de la configuración base y la configuración base no es válida. Una eliminación desde una capa desinstala solo los complementos que declara esa capa, y el mercado se mantiene mientras la otra capa lo declare. La eliminación falla y no cambia nada cuando la configuración de la otra capa no es válida, o cuando un complemento que se queda todavía necesita un complemento que desinstalaría. Las lecturas siempre combinan ambas capas. `update` de un mercado sigue actualizando las fuentes en caché y el estado de los complementos instalados.

Los comandos de complementos siguen la misma regla. `uninstall`, `enable`, `disable`, `update` y `reinstall` con un nombre de complemento modifican solo la capa de destino. Fallan y no cambian nada cuando solo la otra capa declara el complemento. Un complemento que declaran ambas capas se instala una sola vez. Así, un `install` en una capa solo añade la declaración cuando la otra capa declara el complemento instalado, y un `uninstall` desde una capa solo quita la declaración de esa capa. `update` y `reinstall` no escriben ninguna declaración. Un `enable` o `disable` sin `--local` también falla cuando la configuración local fija el valor contrario de `enabled`, porque gana el valor local.

Una capa que declara un complemento también declara el mercado del complemento. `install --local` añade el mercado a la configuración local por ti. Cuando una capa declara un complemento y solo la otra capa declara su mercado, una recarga se detiene para ese ámbito con `{invalid manifest}`. Para reparar la capa, ejecuta `marketplace add <source> --scope <scope>` para ese ámbito, con `--local` para la capa local. El error muestra este comando. También puedes quitar el complemento de la capa.

```text
/claude:plugin marketplace add upstash/context7 --local
/claude:plugin install context7-plugin@context7-marketplace --local
/claude:plugin marketplace autoupdate context7-marketplace --local
```

### Convención de Gitignore

En el ámbito del proyecto, confirma (`commit`) la configuración base, `claude-plugins.json`. Así, tus colaboradores instalan los mismos mercados y complementos. Mantén la configuración local, `claude-plugins.local.json`, fuera del control de versiones. Agrega esta línea al `.gitignore` de tu proyecto:

```text
.pi/claude-plugins.local.json
```

Las configuraciones de ámbito de usuario se encuentran en tu directorio de inicio. Son personales y nunca se comparten.

## Espejo de GitHub

La mayoría de los usuarios nunca necesita esta sección. `PI_CLAUDE_MARKETPLACE_GITHUB_BASE_URL` es una configuración avanzada. Envía los orígenes de GitHub a otro host git `https`, como un espejo, un servidor aislado de la red o un servidor local de pruebas. Un origen de GitHub es una abreviatura `owner/repo` o una URL `https://github.com/...`.

Define la variable en el shell que inicia Pi:

```text
export PI_CLAUDE_MARKETPLACE_GITHUB_BASE_URL=https://git.example.com/mirror
```

Después, agrega un mercado de GitHub en Pi como de costumbre:

```text
/claude:plugin marketplace add upstash/context7
```

Este comando clona `https://git.example.com/mirror/upstash/context7.git`. La ruta después del host se conserva en la URL, y una barra final en el valor no cambia nada.

El valor debe ser una URL `https:` sin nombre de usuario, contraseña, consulta ni fragmento. Si el valor incumple una de estas reglas, el comando falla con un error que nombra la variable. Un valor vacío cuenta como no definido.

La configuración tiene estos límites:

- Mientras la variable está definida, los orígenes de GitHub nunca usan la autenticación Device Flow.

- Las credenciales vienen solo de `git credential`. Guarda una credencial bajo el host del valor, con su puerto si lo tiene. Por ejemplo, para `https://git.example.com/mirror`:

  ```text
  printf 'protocol=https\nhost=git.example.com\nusername=<user>\npassword=<token>\n\n' | git credential approve
  ```

- `list`, `info`, las configuraciones (`claude-plugins.json` y `claude-plugins.local.json`) y los resultados de los comandos siguen mostrando URLs `https://github.com/...`. Cuando falla la descarga de un comando, el error nombra la URL que el comando descargó realmente, así que un valor incorrecto es fácil de ver. `/claude:plugin bootstrap` no muestra esta URL, y los errores de `/reload` no siempre la muestran.

- Un valor modificado se aplica en la siguiente descarga. No hace falta volver a agregar el mercado.

Claude Code no tiene esta configuración, así que este comportamiento es una diferencia con respecto a Claude Code.

## Referencia de comandos

Esta extensión replica el comando `/plugin` de Claude Code. Usa `/claude:plugin` en Pi para operaciones de mercado y complementos. Después de instalar, desinstalar, actualizar o reinstalar complementos, ejecuta `/reload`. Así, Pi detecta los recursos modificados.

### Mercado

Agrega un mercado desde la abreviatura de repositorio de GitHub `owner/repo`.

```text
/claude:plugin marketplace add upstash/context7
```

> [!NOTE]
> Si Git no está autenticado, un repositorio privado desencadenará una autenticación Device Flow.

Agrega el mismo mercado desde una URL de GitHub.

```text
/claude:plugin marketplace add https://github.com/upstash/context7-marketplace
```

Fija un mercado de GitHub a una rama, etiqueta o confirmación con un sufijo `#ref`.

```text
/claude:plugin marketplace add https://github.com/upstash/context7-marketplace#v1.0.30
```

Agrega un mercado desde el sistema de archivos local. La ruta puede ser un directorio con `.claude-plugin/marketplace.json`, o una ruta directa a un archivo `marketplace.json`.

```text
/claude:plugin marketplace add ~/my-marketplace
/claude:plugin marketplace add ~/my-marketplace/.claude-plugin/marketplace.json
```

Agrega un mercado local al proyecto actual con `--scope project`. El ámbito predeterminado es `user`.

```text
/claude:plugin marketplace add upstash/context7-marketplace --scope project
```

Lista los mercados configurados.

```text
/claude:plugin marketplace list
/claude:plugin marketplace ls
```

Muestra detalles de un mercado.

```text
/claude:plugin marketplace info context7-marketplace
/claude:plugin marketplace info context7-marketplace --scope user
```

Actualiza un mercado. Si omites el nombre, el comando actualiza todos los mercados.

```text
/claude:plugin marketplace update context7-marketplace
/claude:plugin marketplace update
```

Elimina un mercado de la configuración base (`claude-plugins.json`), o de la configuración local (`claude-plugins.local.json`) con `--local`, y desinstala los complementos de ese mercado que la capa declara. Una dependencia que otro complemento todavía necesita sigue instalada.

```text
/claude:plugin marketplace remove context7-marketplace
/claude:plugin marketplace rm context7-marketplace
```

Activa o desactiva las actualizaciones automáticas de complementos del mercado. Cuando actualizas el mercado manualmente, esta extensión también actualiza los complementos instalados.

```text
/claude:plugin marketplace autoupdate context7-marketplace
/claude:plugin marketplace noautoupdate context7-marketplace
```

### Complemento

Explora complementos de forma interactiva en los mercados configurados. En modo interactivo, ejecutar `/claude:plugin` sin argumentos también abre el explorador.

```text
/claude:plugin browse
/claude:plugin
```

Lista los complementos disponibles para instalar. Omite el nombre del mercado para listar en todos los mercados configurados.

```text
/claude:plugin list context7-marketplace --available
/claude:plugin list --available
```

Filtra la lista por estado del complemento: instalado, disponible para instalación, parcialmente disponible (no todas las características son compatibles), remoto (un complemento en un repositorio remoto que aún no se ha obtenido) o no disponible para instalar.

```text
/claude:plugin list --installed
/claude:plugin list --available
/claude:plugin list --partial
/claude:plugin list --remote
/claude:plugin list --unavailable
```

Muestra detalles de un complemento.

```text
/claude:plugin info context7-plugin@context7-marketplace
```

Instala un complemento con el formato `<plugin>@<marketplace>`.

```text
/claude:plugin install context7-plugin@context7-marketplace
```

Instala en el ámbito del proyecto en lugar del ámbito de usuario.

```text
/claude:plugin install context7-plugin@context7-marketplace --scope project
```

Un complemento puede declarar los otros complementos que necesita. La instalación también los agrega, en el mismo ámbito. Para más información, consulta [Resolución de dependencias](docs/dependency-resolution.md).

Actualiza un complemento instalado, todos los complementos instalados de un mercado, o todos los complementos instalados.

```text
/claude:plugin update context7-plugin@context7-marketplace
/claude:plugin update @context7-marketplace
/claude:plugin update
```

> [!NOTE]
> Las definiciones de agente en los complementos pueden nombrar un modelo preferido para el agente, por ejemplo, "sonnet" u "opus". Esta extensión descarta estos modelos de forma predeterminada. Para mapearlos a modelos de Pi en la medida de lo posible, usa la opción `--map-model` con `install` y `update`.

Reinstala un complemento instalado, todos los complementos instalados de un mercado, o todos los complementos instalados.

```text
/claude:plugin reinstall context7-plugin@context7-marketplace
/claude:plugin reinstall @context7-marketplace
/claude:plugin reinstall
```

Limita la reinstalación a un ámbito con `--scope user` o `--scope project`. La opción puede aparecer antes o después del objetivo:

```text
/claude:plugin reinstall --scope project
/claude:plugin reinstall @context7-marketplace --scope user
```

Desinstala un complemento.

```text
/claude:plugin uninstall context7-plugin@context7-marketplace
```

Recarga Pi después de los cambios.

```text
/reload
```

#### Complementos remotos

Los mercados pueden declarar complementos remotos alojados en un repositorio Git diferente. Puedes listarlos con la opción `--remote`.

```text
/claude:plugin list --remote
```

Esta extensión obtiene los repositorios de complementos remotos solo cuando es necesario. Por eso, `/claude:plugin info` no resuelve sus componentes. Para obtener el repositorio de un complemento, pasa la opción `--fetch`.

```text
/claude:plugin info 2crunch-api-security-testing@claude-plugins-official --fetch
```

También puedes obtener los repositorios de forma anticipada. Obtén un complemento remoto, todos los complementos de un mercado, o todos los complementos remotos de todos los mercados:

```text
/claude:plugin fetch 2crunch-api-security-testing@claude-plugins-official
/claude:plugin fetch @claude-plugins-official
/claude:plugin fetch
```

Después de la obtención, cada complemento está disponible, parcialmente disponible o no disponible para instalar.

El comando `/claude:plugin install` obtiene automáticamente un complemento remoto.

```text
/claude:plugin install 2crunch-api-security-testing@claude-plugins-official
```

### Bootstrap

`Bootstrap` es una configuración en un solo paso. Agrega el mercado oficial de Anthropic en el ámbito de usuario y habilita `autoupdate`.

```text
/claude:plugin bootstrap
```

Equivale a ejecutar estos comandos:

```text
/claude:plugin marketplace add anthropics/claude-plugins-official
/claude:plugin marketplace autoupdate claude-plugins-official
```

### Import

El comando `import` agrega mercados y complementos ya definidos en la configuración de Claude Code.

```text
/claude:plugin import
```

Por defecto, la importación agrega cada mercado y complemento al mismo ámbito que tiene en Claude Code. También puedes limitar la importación a un ámbito específico.

```text
/claude:plugin import --scope user
/claude:plugin import --scope project
```

La importación omite los complementos que Pi no puede instalar debido a componentes no compatibles. Muestra una advertencia por cada uno.

## Contribuir

Consulta [CONTRIBUTING](CONTRIBUTING.md) y [CODE_OF_CONDUCT](CODE_OF_CONDUCT.md).

## Descargo de responsabilidad sobre IA

El autor desarrolló este proyecto con prácticas de ingeniería de agentes de IA. Utiliza el sistema de desarrollo basado en especificaciones [Open GSD](https://www.opengsd.net/).

El autor `vibe-coded` (programó intuitivamente) un prototipo hasta que estuvo funcionalmente completo para un primer lanzamiento, luego extrajo y revisó un PRD a partir de la implementación.

El PRD luego guió a GSD a través de las fases de discusión, planificación e implementación de una nueva implementación.

## Licencia

La Licencia MIT cubre este proyecto. Para más detalles, lee el archivo [COPYING](COPYING).

Derechos de autor 2026 [Alessandro Colomba](https://github.com/acolomba)
