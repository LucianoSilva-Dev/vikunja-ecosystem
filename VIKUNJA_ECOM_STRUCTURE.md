# Proposta de Estrutura do Projeto: Vikunja Bot & MCP

Para atender aos requisitos de **simplicidade** e **alta reutilização de código** (especialmente o `apiClient`), recomendo uma abordagem de **Monorepo** usando `pnpm workspaces`.

Como a raiz atual é um projeto Go, sugiro criar uma pasta `vikunja-ecosystem` (ou `tools`) na raiz para isolar o ambiente Node.js/TypeScript desses novos serviços.

## 1. Estrutura de Pastas Proposta

```
c:\codigo\vikunja\
├── ... (arquivos Go existentes)
├── vikunja-ecosystem/              # Nova pasta raiz para os serviços JS/TS
│   ├── package.json                # Define o workspace (private: true)
│   ├── pnpm-workspace.yaml         # Configura os pacotes do workspace
│   ├── tsconfig.base.json          # Configuração TS base compartilhada
│   ├── apps/
│   │   ├── discord-bot/            # O Bot do Discord
│   │   │   ├── src/
│   │   │   ├── package.json
│   │   │   └── tsconfig.json
│   │   └── mcp-server/             # O Servidor MCP
│   │       ├── src/
│   │       ├── package.json
│   │       └── tsconfig.json
│   └── packages/
│       └── api-client/             # Biblioteca Compartilhada
│           ├── src/
│           │   ├── services/       # Portado do Frontend (TaskService, etc)
│           │   ├── models/         # Modelos e Tipos
│           │   └── index.ts        # Exporta tudo
│           ├── package.json
│           └── tsconfig.json
```

## 2. Benefícios dessa Estrutura

1.  **Reutilização Direta:** O `discord-bot` e o `mcp-server` importarão o cliente simplesmente como `import { TaskService } from '@vikunja/api-client'`.
2.  **Isolamento:** Não mistura dependências do Node.js com o projeto Go raiz.
3.  **Consistência de Tipos:** Se você atualizar um modelo em `packages/api-client`, o TypeScript avisará imediatamente sobre erros no bot e no servidor MCP.
4.  **Simplicidade de Build:** Com `pnpm`, você instala todas as dependências de todos os projetos com um único comando `pnpm install` na raiz `vikunja-ecosystem`.

## 3. Detalhes dos Pacotes

### `packages/api-client`
*   **Responsabilidade:** Conter toda a lógica de comunicação com o Vikunja.
*   **Conteúdo:** Cópia adaptada da pasta `frontend/src/services` e `frontend/src/models`.
*   **Adaptação:** Remoção de dependências do Vue.js/Pinia, focando apenas em Axios e Tipos Puros. Implementação da conversão `snake_case` <-> `camelCase` aqui.

### `apps/discord-bot`
*   **Tech Stack:** `discord.js`, `node-cron` (para webhooks).
*   **Uso:** Importa `api-client` para ler/escrever no Vikunja.

### `apps/mcp-server`
*   **Tech Stack:** `@modelcontextprotocol/sdk`.
*   **Uso:** Expõe ferramentas (ex: `list_tasks`, `create_task`) que internamente chamam o `api-client`.

## 4. Próximos Passos (Plano de Execução)

1.  Criar a estrutura de diretórios e arquivos de configuração (`package.json`, `pnpm-workspace.yaml`).
2.  Inicializar o pacote `api-client` e portar o código base do `AbstractService`.
3.  Inicializar o `discord-bot` e fazer o "Hello World" (conectar no Discord).
4.  Conectar o Bot ao Vikunja usando o `api-client`.

## Pergunta
Você aprova essa estrutura dentro de `vikunja-ecosystem`? Se sim, posso começar a criar as pastas e arquivos de configuração.
