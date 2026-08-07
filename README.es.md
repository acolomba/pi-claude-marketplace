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

Esta extensión instala complementos desde los mercados de complementos de Claude que contienen los siguientes componentes:

- Comandos.
- Habilidades.
- Agentes. Requiere [pi-subagents](https://pi.dev/packages/pi-subagents).
- Hooks (ganchos). Soporte parcial. Para más información, consulta [Compatibilidad de hooks](docs/hooks-compatibility.md).
- Servidores MCP. Requiere [pi-mcp-adapter](https://pi.dev/packages/pi-mcp-adapter).

Los complementos que contienen componentes no compatibles pueden instalarse parcialmente. Un complemento instalado parcialmente puede no funcionar según lo previsto.

El comando `/claude:plugin` gestiona los mercados y complementos de Claude, como `/plugin` de Claude Code. Una configuración de estado deseado en los archivos `[~/].pi/agent/claude-plugins[.local].json` hace que las instalaciones de complementos sean automáticas y repetibles. Puedes compartir estos archivos entre máquinas o miembros del equipo.

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

Esta extensión prefija los nombres de comandos y habilidades con el nombre del complemento. Si el nombre ya empieza con el nombre del complemento y `-`, esta extensión elimina esa parte común.

Los nombres de comandos y habilidades usan el formato con dos puntos de Pi:

| Nombre del complemento | Nombre del comando o habilidad | Nombre en Pi |
| ---------------------- | ------------------------------ | ------------ |
| `foo`                  | `bar`                          | `/foo:bar`   |
| `foo`                  | `foo-bar`                      | `/foo:bar`   |
| `foo`                  | `foo`                          | `/foo:foo`   |

Esta extensión también registra las habilidades con nombres separados por guiones después del prefijo `/skill:`:

| Nombre del complemento | Nombre de la habilidad | Nombre en Pi     |
| ---------------------- | ---------------------- | ---------------- |
| `foo`                  | `bar`                  | `/skill:foo-bar` |
| `foo`                  | `foo-bar`              | `/skill:foo-bar` |
| `foo`                  | `foo`                  | `/skill:foo`     |

Los nombres de los servidores MCP no cambian. Si otra configuración de MCP ya utiliza ese nombre, la instalación o actualización del complemento fallará.

| Nombre del complemento | Clave de `mcpServers` | Nombre del servidor MCP en Pi  |
| ---------------------- | --------------------- | ------------------------------ |
| `foo`                  | `api`                 | `api`                          |
| `foo`                  | `foo-api`             | `foo-api`                      |
| `bar`                  | `api`                 | _conflicto si `api` ya existe_ |

### Ámbito (Scoping)

Puedes instalar mercados y complementos en el ámbito de usuario o en el ámbito del proyecto. El valor predeterminado es el ámbito de usuario.

El ámbito del proyecto hereda el ámbito de usuario. Así, puedes instalar un complemento desde un mercado de ámbito de usuario en el ámbito del proyecto.

También puedes instalar el mismo complemento en ambos ámbitos, el de usuario y el de proyecto. En ese caso, el complemento del ámbito de usuario tiene prioridad.

### Complementos parcialmente disponibles

Algunos complementos contienen componentes no compatibles: un hook que no se puede mapear, un servidor LSP o un tema. Para instalar o actualizar estos complementos parcialmente, pasa la opción `--partial`. Esta extensión instala los componentes compatibles e ignora los incompatibles.

Lista los complementos parcialmente disponibles.

```text
/claude:plugin list --partial
```

Instala un complemento parcialmente disponible. Coloca `--partial` primero para habilitar el autocompletado de argumentos para complementos parcialmente disponibles. Sin esa opción, el autocompletado los excluye.

```text
/claude:plugin install --partial hookify@claude-plugins-official
```

## Archivos de configuración

Cada ámbito almacena su configuración declarativa de mercados y complementos en `claude-plugins.json`, bajo la raíz del ámbito.

| Ámbito    | Ruta del archivo                  |
| --------- | --------------------------------- |
| `user`    | `~/.pi/agent/claude-plugins.json` |
| `project` | `<cwd>/.pi/claude-plugins.json`   |

Estos archivos son el registro definitivo de los mercados y complementos instalados. Pi aplica su contenido al cargar la extensión (`/reload`).

### Archivos de configuración local

Cada ámbito también puede tener un archivo `claude-plugins.local.json` junto al archivo base.

| Ámbito    | Ruta del archivo                        |
| --------- | --------------------------------------- |
| `user`    | `~/.pi/agent/claude-plugins.local.json` |
| `project` | `<cwd>/.pi/claude-plugins.local.json`   |

El archivo local anula las entradas individuales del archivo base. Una entrada en `claude-plugins.local.json` reemplaza por completo la entrada con la misma clave en `claude-plugins.json`.

Pasa `--local` a cualquier comando de modificación para dirigirse únicamente al archivo local.

```text
/claude:plugin install context7-plugin@context7-marketplace --local
/claude:plugin marketplace autoupdate context7-marketplace --local
```

### Convención de Gitignore

En el ámbito del proyecto, confirma (`commit`) `claude-plugins.json`. Así, tus colaboradores instalan los mismos mercados y complementos. Mantén `claude-plugins.local.json` fuera del control de versiones. Agrega esta línea al `.gitignore` de tu proyecto:

```text
.pi/claude-plugins.local.json
```

Los archivos de ámbito de usuario se encuentran en tu directorio de inicio. Son personales y nunca se comparten.

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

Elimina un mercado y todos los complementos instalados desde él.

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
