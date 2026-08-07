<!-- markdownlint-disable MD033 MD041 -->

<p align="center">
  <img src="https://media.githubusercontent.com/media/acolomba/pi-claude-marketplace/refs/heads/main/images/redpi.png" alt="Pi Claude Marketplace logo" width="360">
</p>
<!-- markdownlint-enable MD033 MD041 -->

# Pi Claude Marketplace

[![CI](https://github.com/acolomba/pi-claude-marketplace/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/acolomba/pi-claude-marketplace/actions/workflows/ci.yml) [![Quality Gate Status](https://sonarcloud.io/api/project_badges/measure?project=acolomba_pi-claude-marketplace&metric=alert_status)](https://sonarcloud.io/summary/overall?id=acolomba_pi-claude-marketplace) [![Coverage](https://sonarcloud.io/api/project_badges/measure?project=acolomba_pi-claude-marketplace&metric=coverage)](https://sonarcloud.io/summary/overall?id=acolomba_pi-claude-marketplace) [![Bugs](https://sonarcloud.io/api/project_badges/measure?project=acolomba_pi-claude-marketplace&metric=bugs)](https://sonarcloud.io/summary/overall?id=acolomba_pi-claude-marketplace) [![Code Smells](https://sonarcloud.io/api/project_badges/measure?project=acolomba_pi-claude-marketplace&metric=code_smells)](https://sonarcloud.io/summary/overall?id=acolomba_pi-claude-marketplace) [![Maintainability Rating](https://sonarcloud.io/api/project_badges/measure?project=acolomba_pi-claude-marketplace&metric=sqale_rating)](https://sonarcloud.io/summary/overall?id=acolomba_pi-claude-marketplace) [![Reliability Rating](https://sonarcloud.io/api/project_badges/measure?project=acolomba_pi-claude-marketplace&metric=reliability_rating)](https://sonarcloud.io/summary/overall?id=acolomba_pi-claude-marketplace) [![Security Rating](https://sonarcloud.io/api/project_badges/measure?project=acolomba_pi-claude-marketplace&metric=security_rating)](https://sonarcloud.io/summary/overall?id=acolomba_pi-claude-marketplace) [![GitHub](https://img.shields.io/badge/GitHub-acolomba%2Fpi--claude--marketplace-181717?logo=github&logoColor=white)](https://github.com/acolomba/pi-claude-marketplace) [![npm](https://img.shields.io/badge/npm-pi--claude--marketplace-cb3837?logo=npm&logoColor=white)](https://www.npmjs.com/package/pi-claude-marketplace) [![pi.dev](https://img.shields.io/badge/pi.dev-pi--claude--marketplace-09090b?logo=data:image/svg%2Bxml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCA4MDAgODAwIj48cmVjdCB3aWR0aD0iODAwIiBoZWlnaHQ9IjgwMCIgcng9IjEyMCIgZmlsbD0iIzA5MDkwYiIvPjxwYXRoIGZpbGw9IiNmZmYiIGZpbGwtcnVsZT0iZXZlbm9kZCIgZD0iTTE2NS4yOSAxNjUuMjlINTE3LjM2VjQwMEg0MDBWNTE3LjM2SDI4Mi42NVY2MzQuNzJIMTY1LjI5Wk0yODIuNjUgMjgyLjY1VjQwMEg0MDBWMjgyLjY1WiIvPjxwYXRoIGZpbGw9IiNmZmYiIGQ9Ik01MTcuMzYgNDAwSDYzNC43MlY2MzQuNzJINTE3LjM2WiIvPjwvc3ZnPg==)](https://pi.dev/packages/pi-claude-marketplace)

Accede a los mercados de complementos de Claude desde [Pi Coding Agent](https://pi.dev).

<!-- markdownlint-disable MD033 -->

<p align="center">
  <img src="https://media.githubusercontent.com/media/acolomba/pi-claude-marketplace/refs/heads/main/demos/bootstrap.gif" alt="Bootstrap demo" width="720">
</p>
<!-- markdownlint-enable MD033 -->

## Características

Instala complementos desde los mercados de complementos de Claude que contienen los siguientes componentes:

- Comandos.
- Habilidades.
- Agentes. Requiere [pi-subagents](https://pi.dev/packages/pi-subagents).
- Hooks (ganchos). Soporte parcial. Para más información, consulta [Compatibilidad de hooks](docs/hooks-compatibility.md).
- Servidores MCP. Requiere [pi-mcp-adapter](https://pi.dev/packages/pi-mcp-adapter).

Los complementos que contienen componentes no compatibles pueden instalarse parcialmente, pero es posible que no funcionen según lo previsto.

Los mercados y complementos de Claude se gestionan mediante un comando `/claude:plugin` similar a `/plugin` de Claude Code. Se mantiene una configuración de estado deseado en los archivos `[~/].pi/agent/claude-plugins[.local].json` para instalaciones de complementos automatizadas y repetibles que pueden compartirse entre máquinas o miembros del equipo.

## Requisitos previos

- [Pi Coding Agent](https://pi.dev)
- [pi-subagents](https://pi.dev/packages/pi-subagents) (opcional pero recomendado, `pi install npm:pi-subagents`)
- [pi-mcp-adapter](https://pi.dev/packages/pi-mcp-adapter) (opcional pero recomendado, `pi install npm:pi-mcp-adapter`)

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

Los nombres de comandos y habilidades se prefijan con el nombre del complemento. Si el comando o la habilidad ya tiene el prefijo del nombre del complemento más un `-`, esa parte común se omite.

Los nombres de comandos y habilidades usan el formato con dos puntos de Pi:

| Nombre del complemento | Nombre del comando o habilidad | Nombre en Pi |
| ---------------------- | ------------------------------ | ------------ |
| `foo`                  | `bar`                          | `/foo:bar`   |
| `foo`                  | `foo-bar`                      | `/foo:bar`   |
| `foo`                  | `foo`                          | `/foo:foo`   |

Las habilidades también se registran con nombres separados por guiones después del prefijo `/skill:`:

| Nombre del complemento | Nombre de la habilidad | Nombre en Pi     |
| ---------------------- | ---------------------- | ---------------- |
| `foo`                  | `bar`                  | `/skill:foo-bar` |
| `foo`                  | `foo-bar`              | `/skill:foo-bar` |
| `foo`                  | `foo`                  | `/skill:foo`     |

Los nombres de los servidores MCP se mantienen sin cambios. Si otra configuración de MCP ya utiliza ese nombre, la instalación o actualización del complemento fallará.

| Nombre del complemento | Clave de `mcpServers` | Nombre del servidor MCP en Pi  |
| ---------------------- | --------------------- | ------------------------------ |
| `foo`                  | `api`                 | `api`                          |
| `foo`                  | `foo-api`             | `foo-api`                      |
| `bar`                  | `api`                 | _conflicto si `api` ya existe_ |

### Ámbito (Scoping)

Los mercados y complementos pueden instalarse en el ámbito de usuario o en el ámbito del proyecto actual. El valor predeterminado es el ámbito de usuario.

El ámbito de usuario se hereda, por lo que es posible instalar un complemento desde un mercado de ámbito de usuario en el ámbito del proyecto.

También es posible instalar el mismo complemento en ambos ámbitos, de usuario y de proyecto; el complemento en el ámbito de usuario tiene prioridad.

### Complementos parcialmente disponibles

Los complementos que contienen componentes no compatibles, como un hook que no se puede mapear, un servidor LSP o un tema, pueden instalarse o actualizarse parcialmente pasando la opción `--partial`. Se instalan los componentes compatibles y se ignoran los incompatibles.

Lista los complementos parcialmente disponibles.

```text
/claude:plugin list --partial
```

Instala un complemento parcialmente disponible. Colocar `--partial` primero habilita el autocompletado de argumentos para complementos parcialmente disponibles, los cuales de otro modo estarían excluidos del autocompletado en ausencia de esa opción.

```text
/claude:plugin install --partial hookify@claude-plugins-official
```

## Archivos de configuración

Cada ámbito almacena su configuración declarativa de mercado y complemento en `claude-plugins.json` bajo la raíz del ámbito.

| Ámbito    | Ruta del archivo                  |
| --------- | --------------------------------- |
| `user`    | `~/.pi/agent/claude-plugins.json` |
| `project` | `<cwd>/.pi/claude-plugins.json`   |

Este archivo es el registro definitivo de qué mercados y complementos están instalados. Pi aplica su contenido al cargar la extensión (`/reload`).

### Archivos de configuración local

Cada ámbito también puede tener un archivo `claude-plugins.local.json` junto al archivo base.

| Ámbito    | Ruta del archivo                        |
| --------- | --------------------------------------- |
| `user`    | `~/.pi/agent/claude-plugins.local.json` |
| `project` | `<cwd>/.pi/claude-plugins.local.json`   |

El archivo local anula las entradas individuales del archivo base: una entrada de mercado o complemento en `claude-plugins.local.json` reemplaza por completo la entrada con la misma clave en `claude-plugins.json`.

Pasa `--local` a cualquier comando de modificación para dirigirse únicamente al archivo local.

```text
/claude:plugin install context7-plugin@context7-marketplace --local
/claude:plugin marketplace autoupdate context7-marketplace --local
```

### Convención de Gitignore

En el ámbito del proyecto, confirma (`commit`) `claude-plugins.json` para que los colaboradores instalen los mismos mercados y complementos, pero mantén `claude-plugins.local.json` fuera del control de versiones. Agrega lo siguiente al `.gitignore` de tu proyecto.

```text
.pi/claude-plugins.local.json
```

Los archivos de ámbito de usuario se encuentran en tu directorio de inicio; son personales y nunca se comparten.

## Referencia de comandos

Esta extensión replica el comando `/plugin` de Claude Code. Usa `/claude:plugin` en Pi para operaciones de mercado y complementos, luego ejecuta `/reload` después de instalar, desinstalar, actualizar o reinstalar complementos para que Pi detecte los recursos modificados.

### Mercado

Agrega un mercado desde la abreviatura de repositorio de GitHub `owner/repo`.

```text
/claude:plugin marketplace add upstash/context7
```

> [!NOTE]
> Los repositorios privados pueden desencadenar una autenticación Device Flow si Git no está autenticado.

Agrega el mismo mercado desde una URL de GitHub.

```text
/claude:plugin marketplace add https://github.com/upstash/context7-marketplace
```

Fija un mercado de GitHub a una rama, etiqueta o confirmación con un sufijo `#ref`.

```text
/claude:plugin marketplace add https://github.com/upstash/context7-marketplace#v1.0.30
```

Agrega un mercado desde el sistema de archivos local. La ruta puede ser un directorio que contenga `.claude-plugin/marketplace.json` o una ruta directa a un archivo `marketplace.json`.

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

Actualiza un mercado, o todos los mercados si se omite el nombre.

```text
/claude:plugin marketplace update context7-marketplace
/claude:plugin marketplace update
```

Elimina un mercado y todos los complementos instalados desde él.

```text
/claude:plugin marketplace remove context7-marketplace
/claude:plugin marketplace rm context7-marketplace
```

Activa o desactiva las actualizaciones automáticas de complementos del mercado. Cuando el mercado se actualiza manualmente, los complementos instalados se actualizan automáticamente.

```text
/claude:plugin marketplace autoupdate context7-marketplace
/claude:plugin marketplace noautoupdate context7-marketplace
```

### Complemento

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

Instala un complemento, usando el formato `<plugin>@<marketplace>`.

```text
/claude:plugin install context7-plugin@context7-marketplace
```

Instala en el ámbito del proyecto en lugar del ámbito de usuario.

```text
/claude:plugin install context7-plugin@context7-marketplace --scope project
```

Actualiza un complemento instalado, todos los complementos instalados de un mercado, o todos los complementos instalados.

```text
/claude:plugin update context7-plugin@context7-marketplace
/claude:plugin update @context7-marketplace
/claude:plugin update
```

> [!NOTE]
> Las definiciones de agente en los complementos pueden incluir un modelo preferido para ejecutar el agente, por ejemplo, "sonnet", "opus", etc. Estos se descartan por defecto, pero la opción `--map-model` para `install` y `update` se puede usar para intentar mapear estos modelos a modelos de Pi en la medida de lo posible.

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

Los mercados pueden declarar complementos remotos alojados en un repositorio Git diferente. Se pueden listar con la opción `--remote`.

```text
/claude:plugin list --remote
```

Los repositorios de complementos remotos se obtienen de forma diferida (lazy), por lo que `/claude:plugin info` no resolverá sus componentes. Se puede pasar la opción `--fetch` para obtener el repositorio de un complemento específico.

```text
/claude:plugin info 2crunch-api-security-testing@claude-plugins-official --fetch
```

El repositorio de un complemento remoto específico, de todos los complementos en un mercado, o de todos los complementos remotos en todos los mercados también se puede obtener de forma anticipada (eager):

```text
/claude:plugin fetch 2crunch-api-security-testing@claude-plugins-official
/claude:plugin fetch @claude-plugins-official
/claude:plugin fetch
```

Una vez obtenidos, los complementos se clasifican como disponibles, parcialmente disponibles o no disponibles para instalación.

El comando `/claude:plugin install` obtiene automáticamente un complemento remoto.

```text
/claude:plugin install 2crunch-api-security-testing@claude-plugins-official
```

### Bootstrap

`Bootstrap` es una configuración única y práctica del mercado oficial de Anthropic en el ámbito de usuario con `autoupdate` habilitado.

```text
/claude:plugin bootstrap
```

Esto es equivalente a ejecutar:

```text
/claude:plugin marketplace add anthropics/claude-plugins-official
/claude:plugin marketplace autoupdate claude-plugins-official
```

### Import

`Import` es un comando práctico para importar mercados y complementos ya definidos en la configuración de Claude Code.

```text
/claude:plugin import
```

Por defecto, los mercados y complementos se agregan de acuerdo con el ámbito en el que se definen en Claude Code. También es posible limitar la importación a un ámbito específico.

```text
/claude:plugin import --scope user
/claude:plugin import --scope project
```

Los complementos que no están disponibles para instalación en Pi debido a componentes no compatibles se omiten con una advertencia.

## Contribuir

Consulta [CONTRIBUTING](CONTRIBUTING.md) y [CODE_OF_CONDUCT](CODE_OF_CONDUCT.md).

## Descargo de responsabilidad sobre IA

Este proyecto se desarrolla con prácticas de ingeniería de agentes de IA utilizando el sistema de desarrollo basado en especificaciones [Open GSD](https://www.opengsd.net/).

El autor `vibe-coded` (programó intuitivamente) un prototipo hasta que estuvo funcionalmente completo para un primer lanzamiento, luego extrajo y revisó un PRD a partir de la implementación.

El PRD se utilizó luego para guiar a GSD a través de las fases de discusión, planificación e implementación de una nueva implementación.

## Licencia

Este proyecto está licenciado bajo la Licencia MIT. Consulta el archivo [COPYING](COPYING) para más detalles.

Derechos de autor 2026 [Alessandro Colomba](https://github.com/acolomba)
