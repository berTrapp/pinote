# Pinote

Aplicativo desktop de notas inteligentes construído com Tauri (Rust) + React/TypeScript, com foco em produtividade offline-first: notas Markdown, cada uma podendo existir como janela flutuante própria do sistema operacional, com personalização visual e recursos inteligentes opcionais.

O app funciona 100% offline. Todos os dados ficam em um banco SQLite local — nenhuma informação é enviada para servidores externos.

## Status atual

Em desenvolvimento incremental por fases (ver plano de arquitetura). Concluído até agora:

- **CRUD completo de notas**: criar, editar, duplicar, favoritar, arquivar, excluir/restaurar, exclusão permanente, exclusão em massa (checkbox na lista), tags, busca, filtros por status/tag/favorito, ordenação (criação/atualização/prioridade), autosave com flush garantido ao fechar a janela.
- **Janelas flutuantes por nota**: cada nota pode abrir como janela própria do SO, sempre no topo, com posição/tamanho lembrados entre sessões e reabertura automática das notas que estavam abertas ao fechar o app.
- **Criação rápida**: "Nova nota" já cria e abre direto como janela flutuante — pelo botão no gerenciador, pela bandeja do sistema ou pelo atalho global `Ctrl+Alt+N`, sem precisar abrir o gerenciador.
- **Bandeja do sistema**: o app continua rodando em segundo plano; fechar a janela do gerenciador só a esconde (não encerra o app), com "Nova nota", "Abrir gerenciador" e "Sair" no menu da bandeja.
- **Personalização**: cor de fundo da nota (5 cores fixas + opção de remover).

Ainda não implementado: mais opções de personalização visual (fonte, opacidade, presets), autostart, e as funcionalidades inteligentes (opcionais).

## Stack

- **Backend**: Rust + Tauri v2, `rusqlite` (SQLite embarcado) com pool de conexões `r2d2` e migrations versionadas via `rusqlite_migration`.
- **Frontend**: React 19 + TypeScript (strict), Vite, Zustand para estado, Tailwind CSS v4.
- Nenhum dado sai da máquina do usuário; nenhuma permissão além do necessário é concedida ao frontend (capabilities restritas do Tauri).

## Desenvolvimento

Pré-requisitos: Node.js 20+, Rust estável (`rustup`), e as [dependências de sistema do Tauri](https://tauri.app/start/prerequisites/) para a sua plataforma.

```sh
npm install
npm run tauri dev
```

Isso sobe o Vite em modo dev e compila/roda o app Tauri com hot-reload do frontend.

### Scripts úteis

| Comando                           | Descrição                                                  |
| --------------------------------- | ---------------------------------------------------------- |
| `npm run dev`                     | Só o servidor Vite (sem a janela nativa)                   |
| `npm run tauri dev`               | App completo em modo desenvolvimento                       |
| `npm run typecheck`               | Checagem de tipos TypeScript (strict, sem emitir arquivos) |
| `npm run lint`                    | ESLint sobre `src/`                                        |
| `npm run format` / `format:check` | Prettier                                                   |
| `npm run build`                   | Build de produção do frontend (`tsc` + `vite build`)       |
| `npm run tauri build`             | Build de produção do instalador nativo                     |

No lado Rust (dentro de `src-tauri/`):

```sh
cargo check      # type-check
cargo clippy      # lints
cargo test        # testes da camada de repositório/regras de negócio
```

## Build de produção

```sh
npm run tauri build
```

Gera os instaladores nativos para a plataforma atual em `src-tauri/target/release/bundle/`.

## Distribuição

O identificador do bundle é `com.pinote.app`. Os dados do usuário (banco SQLite, logs) ficam no diretório de dados do app do sistema operacional (ex.: `~/.local/share/com.pinote.app` no Linux), fora do diretório de instalação — desinstalar o app não apaga as notas automaticamente.

## Estrutura do projeto

```
src/            React (frontend)
  views/        Telas por tipo de janela (manager, futuramente note/settings)
  components/   Componentes de UI
  stores/       Estado global (Zustand)
  services/     Wrappers tipados sobre os comandos Tauri (invoke)
src-tauri/      Backend Rust
  src/db/            Modelos, migrations e camada de acesso a dados (SQLite)
  src/commands/      Comandos Tauri expostos ao frontend, com validação de entrada
  src/window_manager.rs  Abertura/fechamento de janelas de nota, geometria, reabertura
  src/tray.rs        Ícone e menu da bandeja do sistema
  src/shortcuts.rs   Atalho global (Ctrl+Alt+N)
  src/events.rs      Eventos para manter janelas sincronizadas entre si
  src/state.rs       Estado compartilhado da aplicação (pool de conexões)
```

## Recursos inteligentes (IA)

Fora do escopo da Fase 1. A arquitetura prevê uma camada desacoplada e opcional (`SmartProvider`) para features como sugestão de tags, detecção de tarefas/datas e resumo — nenhuma delas é necessária para o funcionamento do app.
