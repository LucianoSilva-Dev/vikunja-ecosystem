# Plano de Implementação do Bot Vikunja (Discord)

Este documento descreve a arquitetura e o passo a passo técnico para implementar um bot de Discord capaz de interagir profundamente com uma instância Vikunja. O plano foca em replicar a lógica do frontend oficial para garantir compatibilidade total.

## 1. Arquitetura do Cliente API

Para interagir "livremente" com a API (como um usuário normal faria), o bot não pode apenas fazer chamadas REST cruas. Ele precisa de uma camada de abstração que imite o comportamento do `AbstractService` do frontend Vue.js.

### 1.1. Padronização de Dados (Snake vs Camel Case)
O frontend trabalha com `camelCase` (JS/TS), mas a API espera e retorna `snake_case` (Go).
**Requisito:** Implementar middleware/interceptors no cliente HTTP (ex: Axios no Node.js) que:
- **Request:** Converta recursivamente chaves do body de `camelCase` para `snake_case` antes de enviar.
- **Response:** Converta recursivamente chaves do body de `snake_case` para `camelCase` ao receber.
- *Referência:* `frontend/src/helpers/case.ts` e `frontend/src/services/abstractService.ts` (linhas 75-103).

### 1.2. Tratamento de IDs e Tipos
A API Vikunja pode ser estrita com tipos numéricos.
**Regra:** Certifique-se de converter IDs para `number` (integer) antes de enviar, pois strings podem causar falha na validação do Go bindings.
- *Referência:* `TaskService.processModel` (linha 53: `model.projectId = Number(model.projectId)`).

### 1.3. Tratamento de Datas
O frontend normaliza todas as datas para strings ISO 8601 UTC antes do envio.
- **Campos:** `due_date`, `start_date`, `end_date`, `created`, `updated`, `reminder_dates`.
- *Referência:* `TaskService` (linhas 56-61).

## 2. Estratégia "Global" de Webhooks

A API do Vikunja não possui um conceito nativo de "Webhook Global do Sistema" exposto na v1. Os webhooks são escopados por Projeto (`/projects/:id/webhooks`). Para atingir o objetivo de "sem configuração individual por usuário", o bot deve agir proativamente.

### 2.1. O "Bot Admin"
O bot deve rodar com um token de usuário que tenha permissões de **Admin** na instância Vikunja. Isso permite listar todos os projetos e usuários da instância.

### 2.2. O Loop de Registro (Sync Script)
Ao iniciar (e periodicamente, via cron), o bot deve executar:
1. **Listar Todos Projetos:** `GET /api/v1/projects` (como admin, vê tudo).
2. **Para cada Projeto:**
   - Listar webhooks existentes: `GET /api/v1/projects/{id}/webhooks`.
   - Verificar se a URL do Bot já está registrada.
   - **Se não estiver:** Registrar o webhook automaticamente.

**Payload de Registro:**
```json
PUT /api/v1/projects/{projectID}/webhooks
{
  "target_url": "https://seu-bot-url.com/webhook",
  "events": [
    "task.created", "task.updated", "task.deleted",
    "task.assignee.created", "task.comment.created",
    "project.created" // Nota: este evento pode ser capturado em projetos pais ou no loop de verificação
  ]
}
```

### 2.3. Detecção de Novos Projetos
Como não existe um webhook global de "Projeto Criado no Sistema" (apenas dentro de outro projeto ou namespace), o bot tem duas opções:
1. **Polling:** Rodar o script de sincronização a cada X minutos.
2. **Hook de Namespace:** Se o bot tiver acesso ao Namespace raiz ou Default, registrar webhooks lá pode capturar criações de sub-projetos (verificar comportamento exato na prática). Recomenda-se o Polling de segurança.

## 3. Implementação das Funcionalidades (Feature by Feature)

Abaixo, a lógica necessária para replicar funcionalidades chave do frontend.

### 3.1. Listar Usuários e Permissões
- **Endpoint:** `GET /api/v1/users` (com query `?s=` para busca ou vazio para todos se admin).
- **Mapeamento:** O objeto retornado contém `id`, `username`, `email`.
- **Cargos:** Não há "cargos" globais complexos além de Admin/User. Permissões são por projeto/team.
- **Verificar Shared Users:** `GET /api/v1/projects/{id}/projectusers`.

### 3.2. Criar Tarefas (Lógica Complexa)
Baseado em `frontend/src/services/task.ts`:

1. **Pre-processing:**
   - Converta cores Hex para Int se necessário (Vikunja usava Int para cores antigamente, mas frontend atual parece lidar com Hex e converter helpers. O `task.ts` linha 94 chama `colorFromHex`). *Nota: A API v1 atual aceita HEX strings.*
   - Se houver `reminders` nulos, remova-os do array.
   - Converta `repeat_after` de objeto `{amount, type}` para segundos (inteiro) antes de enviar.
     - `hours` * 3600
     - `days` * 86400
     - `weeks` * 604800

2. **Requisição:**
   ```http
   PUT /api/v1/projects/{projectID}/tasks
   Content-Type: application/json
   
   {
     "title": "Nova Tarefa",
     "description": "Descrição com markdown",
     "priority": 1
     // ... outros campos snake_case
   }
   ```

### 3.3. Upload de Imagens/Anexos
O Vikunja não cria a tarefa COM o anexo numa única chamada. É um processo de dois passos.

1. **Passo 1:** Criar a Tarefa (retorna o `task_id`).
2. **Passo 2:** Enviar o arquivo.
   - **Endpoint:** `PUT /api/v1/tasks/{taskID}/attachments`
   - **Formato:** `multipart/form-data`
   - **Campo:** `files` (array de arquivos) ou arquivo único.
   - *Referência:* `frontend/src/services/attachment.ts` (linha 66).

### 3.4. Relacionamentos entre Tarefas
Se o bot precisar linkar tarefas (ex: dependência):
- **Endpoint:** `PUT /api/v1/tasks/{taskID}/relations`
- **Body:**
  ```json
  {
    "other_task_id": 123,
    "relation_kind": "dependency" // ou "subtask", "parent", etc.
  }
  ```

### 3.5. Comentários
- **Endpoint:** `PUT /api/v1/tasks/{taskID}/comments`
- **Body:** `{"comment": "Texto do comentário"}`

## 4. Stack Tecnológica Recomendada

Para facilitar essa imitação do frontend, recomenda-se:

1. **Linguagem:** TypeScript (Node.js).
   - Motivo: Pode reutilizar interfaces de tipos se copiar do frontend (`frontend/src/modelTypes/*.ts`), e bibliotecas como `axios` têm comportamento similar ao do navegador.
2. **Bibliotecas:**
   - `axios` (Cliente HTTP).
   - `camelcase-keys` e `snakecase-keys` (para transformação de dados automática).
   - `discord.js` (para o bot).
   - `node-cron` (para o loop de registro de webhooks).

## 5. Resumo do Fluxo de Trabalho do Bot

1. **Startup:**
   - Logar na API (`POST /api/v1/login`) -> Guardar JWT.
   - Rodar `SyncWebhooks()` -> Garante que todos projetos existentes enviarão eventos para o bot.
   - Iniciar `Discord Client`.

2. **Evento Recebido (Webhook):**
   - Validar assinatura `X-Vikunja-Signature` (HMAC SHA256 com segredo do webhook).
   - Parsear JSON (`task.created`, etc).
   - Enviar mensagem formatada no canal Discord configurado no banco de dados do bot (mapeamento ProjectID <-> ChannelID necessário).

3. **Comando Discord (ex: `!criar "Minha Tarefa"`):**
   - Bot identifica usuário Discord -> Mapeia para usuário Vikunja (opcional, ou usa usuário do bot).
   - Bot chama API: Converte input -> Snake Case -> `PUT /tasks`.
   - Se sucesso: Responde no Discord com Link para a tarefa.

Este plano cobre as necessidades de automação global e interação rica com a API.
