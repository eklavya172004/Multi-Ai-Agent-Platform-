# AvniLLM

AvniLLM is a multi-service AI chat application. It combines a React/Vite client with an Express gateway, Firebase authentication, conversation persistence, credit-based billing, and a LangGraph-powered set of specialist AI agents.

The application can:

- Authenticate users with Google/Firebase.
- Create, rename, list, and open conversations.
- Answer normal chat prompts with conversation memory.
- Search the web and return sourced results/images through Tavily.
- Generate and review code, including structured multi-file artifacts.
- Analyze uploaded images.
- Read uploaded PDFs with retrieval-augmented generation (RAG).
- Generate downloadable PDFs and PowerPoint presentations.
- Generate images through the configured image provider.
- Charge credits for agent usage.
- Sell credit plans through Razorpay.
- Display Markdown, tables, syntax-highlighted code, images, files, and interactive HTML/CSS/JavaScript artifacts.

> **Security notice:** This repository contains environment files and a Firebase service-account file in the workspace. Never publish those files. The Firebase private key and any API/payment credentials should be rotated if they have been committed, shared, or exposed. Use secret management or local untracked files for development.

## Contents

- [Architecture](#architecture)
- [Request and data flows](#request-and-data-flows)
- [Repository layout](#repository-layout)
- [Backend services](#backend-services)
- [Agent system](#agent-system)
- [Frontend](#frontend)
- [Persistence and integrations](#persistence-and-integrations)
- [API reference](#api-reference)
- [Configuration](#configuration)
- [Local development](#local-development)
- [Known limitations](#known-limitations)
- [File-by-file reference](#file-by-file-reference)

## Architecture

```text
Browser (React/Vite)
        |
        | /api/* with Firebase-authenticated session cookie
        v
Gateway (Express, CORS, cookies, logging, proxying)
   |             |              |              |
   v             v              v              v
 Auth          Chat           Agent          Billing
   |             |              |              |
Firebase     PostgreSQL      LangGraph      PostgreSQL/Razorpay
Redis        Prisma          model/tools    Auth credit update
                              |     |
                         Redis  S3  Qdrant  Tavily
```

The gateway is the intended public entry point. Auth routes are proxied without the gateway's `protect` middleware because login must work before a session exists. Chat, Agent, and Billing routes are protected and receive the authenticated user ID in the `x-user-id` header.

## Request and data flows

### Authentication

1. The frontend signs in with Google using Firebase.
2. Firebase returns an ID token.
3. The frontend posts the token to `/api/auth/login`.
4. Auth verifies the token with Firebase Admin.
5. Auth creates or retrieves the Prisma `User` record.
6. Auth stores a Redis session and sets an HTTP-only `session` cookie.
7. Later gateway requests read the cookie, load the Redis session, and forward `x-user-id` to protected services.

### Chat message

1. The user selects an agent and submits a prompt.
2. The frontend creates a conversation first when no conversation is selected.
3. The frontend sends multipart form data to `/api/agent/chat`.
4. Agent saves the user message, builds `AgentState`, and runs the compiled LangGraph.
5. The router selects the requested agent, chooses an upload-specific route, or classifies the prompt with an LLM.
6. The selected agent calls models and external tools, deducts credits where applicable, and returns an answer plus images, files, or artifacts.
7. Agent persists the assistant response and returns it to the frontend.
8. Redux updates the message list, artifact panel, and user credit display.

### Billing

1. The frontend requests an order for a selected plan.
2. Billing validates the plan and creates a Razorpay order and pending `Payment` row.
3. Razorpay checkout returns payment identifiers.
4. Billing verifies the Razorpay HMAC signature.
5. Billing marks the payment paid and calls Auth to update credits and plan data.

## Repository layout

```text
AvniLLM/
├── Backend/
│   ├── gateway/                 Public API gateway and authentication boundary
│   ├── services/
│   │   ├── agent/               LangGraph agents and AI integrations
│   │   ├── auth/                Firebase login, sessions, and credits
│   │   ├── billing/             Razorpay orders and payment verification
│   │   └── chat/                Conversations and messages
│   ├── shared/                  Shared Prisma schema, DB config, and Redis client
│   ├── docker-compose.yml       Local Redis container
│   └── package.json             Root backend metadata
├── Frontend/                    React/Vite application
├── Project-Workflow-Documentation-Part1.docx
├── ~$oject-Workflow-Documentation-Part1.docx   Temporary Office lock file
└── README.md
```

Each service has its own `package.json` and lockfile. `node_modules`, generated output, and temporary runtime files are intentionally omitted from the layout above.

## Backend services

### Gateway: `Backend/gateway`

`index.js` creates the Express server, configures CORS, request logging, cookie parsing, and route proxies, then listens on `PORT`.

- `GET /`: gateway greeting/health-style response.
- `GET /api/me`: protected current-user endpoint.
- `/api/auth/*`: forwards to Auth.
- `/api/chat/*`: protected proxy to Chat with `x-user-id`.
- `/api/agent/*`: protected proxy to Agent with `x-user-id`.
- `/api/billing/*`: protected proxy to Billing with `x-user-id`.

Functions:

- `protect` in `middleware/auth.middleware.js`: reads the `session` cookie, loads `session-{sessionId}` from Redis, parses the session, and assigns `req.user`.
- `getcurrentuser` in `controller/user.controller.js`: returns `req.user`.
- `proxyWithHeader` in `utils/proxyWithHeader.js`: forwards requests to a service and injects the authenticated user ID.

### Auth: `Backend/services/auth`

`index.js` starts the Auth Express service and registers authentication routes. `config/firebase.js` initializes Firebase Admin. `lib/db.js` exposes the Prisma connection.

Routes:

- `GET /test`: service test response.
- `POST /login`: verify Firebase ID token, upsert user, create Redis session, and set cookie.
- `POST /logout`: delete the session and clear the cookie.
- `POST /update-plan`: update plan, credits, total credits, expiry, and cached session data.
- `POST /deduct-credits`: validate the agent and available balance, decrement credits, and refresh session data.

Functions in `controllers/auth.controller.js`:

- `login`: Firebase token verification, user persistence, Redis session creation, and cookie setup.
- `logout`: Redis session deletion and cookie clearing.
- `updateUserPayment`: apply a purchased plan and synchronize the user's session.
- `deductCredits`: enforce credit availability and reduce the balance.
- `connectToDB`: establish the Prisma database connection.

### Chat: `Backend/services/chat`

`index.js` starts the Chat Express service. `lib/db.js` creates the Prisma client. The controller owns all conversation/message persistence.

Routes:

- `POST /create-conversation`: create a conversation for `x-user-id`.
- `GET /get-conversations`: list the user's conversations, ordered by `updatedAt`.
- `POST /update-conversation`: change a conversation title.
- `POST /save-message`: save a user/assistant message, nested artifacts, and artifact files.
- `GET /get-message/:conversationId`: return messages for a conversation.

Functions in `controllers/chat.controller.js`:

- `createConversation`: create a user-owned conversation.
- `getConversation`: query conversations for a user.
- `updateConversation`: update a conversation title.
- `saveMessage`: persist message content, images, and nested artifact/file data.
- `getMessage`: retrieve a conversation's messages.
- `connectToDB`: establish the Prisma connection.

### Billing: `Backend/services/billing`

`index.js` starts the Billing Express service. `lib/razorpay.js` initializes Razorpay and `lib/db.js` creates the Prisma client.

Routes:

- `POST /create-payment`: validate a plan, create a Razorpay order, and record a pending payment.
- `POST /verify-payment`: verify the Razorpay signature, mark the payment paid, and ask Auth to apply credits.

Functions:

- `createOrder` in `controllers/billing.controller.js`: create an order for a configured plan.
- `verifyPayment` in `controllers/billing.controller.js`: validate the payment signature and complete the payment flow.
- `PLANS` in `lib/plan.js`: defines the `free`, `starter`, and `pro` plans.
- `razorpay` in `lib/razorpay.js`: configured Razorpay SDK instance.

### Agent: `Backend/services/agent`

`index.js` starts the AI service and registers `POST /chat`. `controller/agent.controller.js` accepts prompt, conversation, agent, user ID, and an optional uploaded file; it invokes the graph and returns the generated response.

- Upload route: `POST /chat`.
- Upload field: `file`.
- Accepted file types: PDF and image MIME types.
- Maximum upload size: 20 MB.

Functions in `controller/agent.controller.js`:

- `agent`: persist the incoming message, invoke the graph, persist the response, and return answer/images/files/artifacts.

## Agent system

The graph in `graph/graph.js` starts at `router`, conditionally routes to one specialist, and ends after that specialist completes. Search flows continue from `search` into `chat` so the chat model can turn search results into a final response.

### State and routing

- `AgentState` in `graph/state.js`: LangGraph state containing prompt, selected agent, conversation ID, response, search results, images, artifacts, user ID, and uploaded file.
- `router` in `graph/router.js`: honors an explicit agent selection, routes image/PDF uploads to their analyzers, or asks an LLM to classify the prompt.
- `graph` in `graph/graph.js`: registers all nodes and compiles the workflow.

Supported graph nodes:

- `chat`: normal conversational response with memory.
- `search`: Tavily web search followed by chat synthesis.
- `coding`: code generation, explanation, or review.
- `pdf`: structured PDF generation and S3 upload.
- `ppt`: structured PowerPoint generation and S3 upload.
- `vision`: image prompt generation and image retrieval/upload.
- `pdfRag`: PDF parsing, embeddings, retrieval, and grounded response.
- `imageAnalyser`: Gemini multimodal analysis of an uploaded image.

### Specialist agents

- `agents/chat.agent.js` - `chatAgent`: checks agent rate limits, loads recent memory, includes search results when present, invokes the chat model, and deducts credits.
- `agents/coding.agent.js` - `codeAgent`: classifies coding intent; generates structured project files for code generation or returns Markdown analysis/review.
- `agents/search.agent.js` - `searchAgent`: calls Tavily, stores results/images in state, and deducts credits.
- `agents/pdf.agent.js` - `pdfAgent`: generates document JSON, renders a PDF, uploads it to S3, creates a signed URL, and returns a download link.
- `agents/ppt.agent.js` - `pptAgent`: generates slide JSON, renders a PPTX, uploads it to S3, and creates a signed URL.
- `agents/vision.agent.js` - `visionAgent`: creates an image-generation prompt, fetches a Pollinations image, uploads it to S3, and returns a signed URL.
- `agents/pdfRag.agent.js` - `pdfRag`: parses PDFs, chunks text, embeds chunks in a conversation-specific Qdrant collection, retrieves relevant context with MMR, and answers from that context.
- `agents/imageAnalyser.agent.js` - `imageAnalyser`: reads an uploaded image, sends it to Gemini for multimodal analysis, and removes the temporary file.

### Agent configuration and utilities

- `config/agentRateLimit.js` - `checkAgentLimit`: Redis-backed per-user/per-agent rate limiting.
- `config/embeddings.js`: embedding model configuration.
- `config/memory.js` - `getMemory` and `addMessage`: load cached conversation history and retain the latest 20 Redis messages.
- `config/multer.js`: multipart upload configuration and file restrictions.
- `config/s3.js`: AWS S3 client configuration.
- `config/tavily.js`: Tavily client configuration.
- `config/vectorDB.js` - `collectionExists`, `createVectorStore`, and `getVectorStore`: manage Qdrant collections and vector retrieval.
- `lib/model.js` - `getModel`: construct Groq, OpenRouter, or Gemini model instances.
- `lib/db.js`: Prisma connection for the Agent service.
- `utils/deductCredits.js` - `deductCredits`: call Auth to decrement a user's credits.
- `utils/getMessages.js` - `getMessages`: call Chat to retrieve conversation history.
- `utils/uploadToS3.js` - `uploadToS3`: upload generated content to S3.
- `utils/getFromS3.js` - `getFromS3`: create a signed S3 download URL.
- `utils/generatePdf.js` - `generatePDF`: render PDFKit document definitions.
- `utils/generatePpt.js` - `generatePPT`: render cover, content, and thank-you slides.
- `temp/`: runtime location for uploaded files and the checked-in sample PDF.

## Frontend

The frontend is a React 19/Vite application rooted at `src/main.jsx`. Redux Toolkit provides application state and Axios calls the gateway configured by `VITE_SERVER_URL`.

### Application and UI components

- `App.jsx` - `App`: loads `/api/me` and renders `Home`.
- `pages/Home.jsx` - `Home`: composes sidebar, chat area, artifact panel, and the Google login modal.
- `components/Sidebar.jsx` - `Sidebar`: fetch conversations, select a conversation, create a new chat, open billing, and log out.
- `components/Nav.jsx` - `Navbar`: show the selected conversation title and message count.
- `components/ChatArea.jsx` - `ChatArea`: compose navbar, message list, AI banner, and input.
- `components/ChatInput.jsx` - `ChatInput`: choose an agent, select PDF/image uploads, create conversations, rename the initial conversation, submit multipart prompts, refresh credits, and append responses.
- `components/MessageList.jsx` - `MessageList`: load messages, render loading/empty states, and scroll to the latest message.
- `components/MessageBubble.jsx` - `MessageBubble`: render Markdown, GFM tables, syntax-highlighted code, links, images, files, copy controls, and an image lightbox.
- `components/Artifact.jsx` - `Artifact`: show generated files in Monaco and preview HTML/CSS/JavaScript in a sandboxed iframe.
- `components/BillingDrawer.jsx` - `BillingDrawer`: display plan/credit usage and start Razorpay checkout.
- `components/AiBanner.jsx` - `AIBanner`: show an auto-closing notification.

### Frontend API features

- `features/getCurrentUser.js` - request the current authenticated user.
- `features/createConversation.js` - create a conversation.
- `features/getConversations.js` - load the conversation list.
- `features/updateConversation.js` - rename a conversation.
- `features/getMessages.js` - load messages for a conversation.
- `features/sendMessage.js` - submit prompt, selected agent, user ID, and optional file.
- `features/createOrder.js` - request a Razorpay order.
- `features/verifyPayment.js` - payment verification module; currently empty/unused.
- `features/logout.js` - request logout and clear client state.
- `utils/axios.js` - shared Axios client configured for the backend.
- `utils/detectLanguage.js` - map file extensions to Monaco language IDs.
- `utils/firebase.js` - initialize the Firebase web client.

### Redux state

- `redux/store.js` - configure the store from conversation, message, and user reducers.
- `redux/conversationSlice.js` - conversations, selected conversation, and titles.
- `redux/messageSlice.js` - messages, loading state, and artifacts.
- `redux/userSlice.js` - authenticated user and credit/plan data.

### Static and build files

- `index.html` - Vite HTML entry point.
- `vite.config.js` - Vite and React configuration.
- `eslint.config.js` - ESLint configuration.
- `src/index.css` - global application styles.
- `public/favicon.svg` - browser favicon.
- `public/icons.svg` - shared SVG icon definitions.
- `Frontend/README.md` - Vite starter documentation; this root README is the project-level source of truth.

## Persistence and integrations

### PostgreSQL and Prisma

The canonical schema is `Backend/shared/prisma/schema.prisma`:

- `User`: Firebase identity, profile, plan, credits, and relationships.
- `Conversation`: user-owned chat thread.
- `Message`: user/assistant content, images, and artifacts.
- `Artifact`: generated artifact metadata and type.
- `ArtifactFile`: file name/content belonging to an artifact.
- `Payment`: Razorpay order/payment metadata and status.

Enums:

- `Role`: `user` or `assistant`.
- `PaymentStatus`: `created`, `paid`, or `failed`.

`Backend/services/agent/prisma/schema.prisma` is a separate, incomplete Agent schema and is not the canonical application model. Database migrations and seed scripts are not included in the repository.

### Redis

`Backend/shared/redis/redis.js` configures the Redis client. The application uses these key patterns:

- `session-{sessionId}`: serialized authenticated session.
- `user-session-{userId}`: user-to-session lookup.
- `messages-{conversationId}`: recent agent memory, capped at 20 messages.
- `rate:{agent}:{userId}`: agent rate-limit counters.

### External providers

- Firebase Admin/Web SDK: identity verification and Google login.
- Groq, OpenRouter, and Gemini: model providers selected by Agent configuration.
- Tavily: web search.
- Qdrant: PDF embeddings and retrieval.
- AWS S3: generated file storage and signed downloads.
- Razorpay: payment orders and signature verification.
- Pollinations: image generation/retrieval used by the vision agent.

## API reference

All URLs below are shown relative to the gateway. Protected endpoints require the gateway session cookie. Protected service identity is passed internally as `x-user-id`.

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/` | Gateway response |
| `GET` | `/api/me` | Current session user |
| `POST` | `/api/auth/login` | Firebase login |
| `POST` | `/api/auth/logout` | End session |
| `POST` | `/api/auth/update-plan` | Apply purchased plan/credits |
| `POST` | `/api/auth/deduct-credits` | Deduct agent credits |
| `POST` | `/api/chat/create-conversation` | Create conversation |
| `GET` | `/api/chat/get-conversations` | List conversations |
| `POST` | `/api/chat/update-conversation` | Rename conversation |
| `POST` | `/api/chat/save-message` | Persist message/artifacts |
| `GET` | `/api/chat/get-message/:conversationId` | Read conversation messages |
| `POST` | `/api/agent/chat` | Run an AI agent; multipart field `file` is optional |
| `POST` | `/api/billing/create-payment` | Create Razorpay order |
| `POST` | `/api/billing/verify-payment` | Verify and complete payment |

## Configuration

Do not copy real secrets into documentation. Create untracked `.env` files beside the service that consumes them.

### Gateway: `Backend/gateway/.env`

```env
PORT=8000
AUTH_SERVICE=http://localhost:<auth-port>
CHAT_SERVICE=http://localhost:<chat-port>
AGENT_SERVICE=http://localhost:<agent-port>
BILLING_SERVICE=http://localhost:<billing-port>
FRONTEND_URL=http://localhost:5173
REDIS_URL=redis://localhost:6379
```

### Auth: `Backend/services/auth/.env`

```env
PORT=<auth-port>
DATABASE_URL=postgresql://<user>:<password>@<host>:5432/<database>
REDIS_URL=redis://localhost:6379
```

Firebase Admin also requires credentials. Prefer `GOOGLE_APPLICATION_CREDENTIALS` pointing to a local secret file or a deployment secret rather than committing `serviceAccountKey.json`.

### Chat: `Backend/services/chat/.env`

```env
PORT=<chat-port>
DATABASE_URL=postgresql://<user>:<password>@<host>:5432/<database>
```

### Billing: `Backend/services/billing/.env`

```env
PORT=<billing-port>
DATABASE_URL=postgresql://<user>:<password>@<host>:5432/<database>
RAZORPAY_API_ID=<public-key>
RAZORPAY_SECRET_KEY=<secret-key>
AUTH_SERVICE=http://localhost:<auth-port>
```

### Agent: `Backend/services/agent/.env`

```env
PORT=<agent-port>
DATABASE_URL=postgresql://<user>:<password>@<host>:5432/<database>
REDIS_URL=redis://localhost:6379
GROQ_API_KEY=<key>
GOOGLE_API_KEY=<key>
OPENROUTER_API_KEY=<key>
TAVILY_API_KEY=<key>
CHAT_SERVICE=http://localhost:<chat-port>
AUTH_SERVICE=http://localhost:<auth-port>
AWS_ACCESS_KEY_ID=<key>
AWS_SECRET_ACCESS_KEY=<secret>
AWS_REGION=<region>
AWS_BUCKET_NAME=<bucket>
QDRANT_URL=<url>
QDRANT_API_KEY=<key>
```

### Frontend: `Frontend/.env`

```env
VITE_FIREBASE_API_KEY=<firebase-web-api-key>
VITE_SERVER_URL=http://localhost:8000
VITE_RAZORPAY_API_ID=<razorpay-public-key>
```

Other Firebase web configuration values may be required by `utils/firebase.js`, depending on the local Firebase project.

## Local development

### Prerequisites

- Node.js and npm.
- PostgreSQL database reachable through `DATABASE_URL`.
- Redis. The included Compose file provides Redis only.
- Firebase project and Admin credentials.
- Provider credentials for the agents you intend to use.
- Razorpay credentials for billing tests.
- Qdrant and S3 configuration for PDF/PPT/RAG flows.

### Install

Install dependencies independently because each service is a separate npm package:

```powershell
cd Backend\gateway; npm install
cd ..\shared; npm install
cd ..\services\auth; npm install
cd ..\billing; npm install
cd ..\chat; npm install
cd ..\agent; npm install
cd ..\..\..\Frontend; npm install
```

### Start infrastructure

From `Backend`:

```powershell
docker compose up
```

This starts Redis on `localhost:6379`; it does not start PostgreSQL, the gateway, or any application service.

### Start services

Open separate terminals and run `npm run dev` in each service directory. Start Auth, Chat, Agent, Billing, and Gateway, then start the frontend from `Frontend` with:

```powershell
npm run dev
```

Use the service ports and URLs configured in the environment files. Vite's default development URL is normally `http://localhost:5173`.

### Frontend commands

```powershell
npm run dev       # start Vite development server
npm run build     # create production build
npm run lint      # run ESLint
npm run preview   # preview the production build
```

### Backend commands

The service packages use `npm run dev` with `nodemon index.js`. The root `Backend` package has no application start command and its placeholder `npm test` intentionally exits with an error.

## Known limitations

The following observations describe the current implementation and should be addressed before production deployment:

- The checked-in Firebase service-account private key and `.env` files are security risks; rotate and remove them from source control.
- Auth credit/plan endpoints trust a request-body `userId`; service-to-service authentication is not implemented.
- Chat endpoints need explicit conversation ownership checks when reading or updating by ID.
- Payment verification should reject already-paid orders to prevent replayed credit grants.
- Frontend logout currently calls `GET /api/auth/logout`, while Auth exposes `POST /logout`.
- `MessageList` contains an undefined `setArtifacts` reference and treats a messages array as though it has an `artifacts` property.
- The frontend lint command currently reports errors and warnings, although the production build succeeds.
- Some imports use filename casing that can fail on Linux (`generateppt.js` vs `generatePpt.js`, and `S3.js` vs `s3.js`).
- Generated PDF/PPT files are returned by the Agent but are not fully represented by the Chat message persistence path.
- Signed URL durations and their user-facing text are inconsistent.
- Uploaded filenames need sanitization and temporary files need stronger cleanup guarantees.
- The Agent's model selector falls back to Groq for agent names without explicit model cases.
- Docker Compose starts Redis only. No PostgreSQL, Qdrant, or application health checks are provided.
- There are no migrations, seed scripts, automated tests, request validation layer, structured logs, retries, timeouts, or graceful shutdown handlers.
- The frontend bundle is large and the default document title remains `frontend`.
- Some UI controls are placeholders: microphone, empty-state suggestions, and the Sidebar Login button have no complete handler.

## File-by-file reference

The following is the complete reviewable source/configuration inventory and the responsibility of each file. Lockfiles pin dependency resolution and are not repeated individually as they contain generated package metadata.

### Backend root and shared

- `Backend/package.json`: root backend metadata, dependencies, and placeholder test script.
- `Backend/package-lock.json`: locked root backend dependency tree.
- `Backend/docker-compose.yml`: Redis container definition and port mapping.
- `Backend/shared/package.json`: shared package metadata/dependencies.
- `Backend/shared/package-lock.json`: locked shared dependency tree.
- `Backend/shared/.env`: shared database configuration.
- `Backend/shared/config/db.js`: shared Prisma/database configuration.
- `Backend/shared/redis/redis.js`: shared Redis client configuration.
- `Backend/shared/prisma/schema.prisma`: canonical PostgreSQL schema and Prisma models.

### Gateway

- `Backend/gateway/package.json`: gateway scripts and dependencies.
- `Backend/gateway/package-lock.json`: locked gateway dependencies.
- `Backend/gateway/.env`: gateway port, service URLs, CORS origin, and Redis URL.
- `Backend/gateway/index.js`: gateway server and proxy route registration.
- `Backend/gateway/controller/user.controller.js`: current-user controller.
- `Backend/gateway/middleware/auth.middleware.js`: Redis session protection middleware.
- `Backend/gateway/utils/proxyWithHeader.js`: authenticated user header proxy helper.

### Agent service

- `Backend/services/agent/package.json`: Agent scripts and AI/storage dependencies.
- `Backend/services/agent/package-lock.json`: locked Agent dependencies.
- `Backend/services/agent/.env`: Agent database, model, service, storage, search, and vector configuration.
- `Backend/services/agent/.gitignore`: ignored Agent runtime/local files.
- `Backend/services/agent/index.js`: Agent service bootstrap and route registration.
- `Backend/services/agent/controller/agent.controller.js`: multipart chat controller and graph invocation.
- `Backend/services/agent/routes/agent.routes.js`: Agent HTTP route definition.
- `Backend/services/agent/graph/state.js`: LangGraph state definition.
- `Backend/services/agent/graph/router.js`: agent selection/classification logic.
- `Backend/services/agent/graph/graph.js`: graph nodes, edges, and compilation.
- `Backend/services/agent/lib/db.js`: Agent Prisma client.
- `Backend/services/agent/lib/model.js`: provider/model factory.
- `Backend/services/agent/config/agentRateLimit.js`: rate-limit policy and Redis counters.
- `Backend/services/agent/config/embeddings.js`: embedding model setup.
- `Backend/services/agent/config/memory.js`: Redis conversation memory helpers.
- `Backend/services/agent/config/multer.js`: upload parser and restrictions.
- `Backend/services/agent/config/s3.js`: S3 client setup.
- `Backend/services/agent/config/tavily.js`: Tavily client setup.
- `Backend/services/agent/config/vectorDB.js`: Qdrant collection and retrieval setup.
- `Backend/services/agent/agents/chat.agent.js`: memory-aware chat agent.
- `Backend/services/agent/agents/coding.agent.js`: coding classification and artifact/analysis agent.
- `Backend/services/agent/agents/imageAnalyser.agent.js`: uploaded-image analysis agent.
- `Backend/services/agent/agents/pdf.agent.js`: PDF generation agent.
- `Backend/services/agent/agents/pdfRag.agent.js`: PDF RAG ingestion/retrieval agent.
- `Backend/services/agent/agents/ppt.agent.js`: PowerPoint generation agent.
- `Backend/services/agent/agents/search.agent.js`: web search agent.
- `Backend/services/agent/agents/vision.agent.js`: image generation agent.
- `Backend/services/agent/utils/deductCredits.js`: Auth credit deduction client.
- `Backend/services/agent/utils/generatePdf.js`: PDFKit renderer.
- `Backend/services/agent/utils/generatePpt.js`: PPTX renderer.
- `Backend/services/agent/utils/getFromS3.js`: signed S3 URL helper.
- `Backend/services/agent/utils/getMessages.js`: Chat history client.
- `Backend/services/agent/utils/uploadToS3.js`: S3 upload helper.
- `Backend/services/agent/prisma/schema.prisma`: incomplete Agent-local Prisma schema.
- `Backend/services/agent/temp/`: uploaded/generated temporary files, including the sample PDF.

### Auth, Billing, and Chat services

- `Backend/services/auth/package.json`: Auth scripts/dependencies.
- `Backend/services/auth/package-lock.json`: locked Auth dependencies.
- `Backend/services/auth/.env`: Auth port, database, and Redis configuration.
- `Backend/services/auth/index.js`: Auth service bootstrap.
- `Backend/services/auth/serviceAccountKey.json`: Firebase Admin credential file; sensitive and should not be committed.
- `Backend/services/auth/config/firebase.js`: Firebase Admin initialization.
- `Backend/services/auth/controllers/auth.controller.js`: login, logout, payment update, credit deduction, and DB connection functions.
- `Backend/services/auth/routes/auth.routes.js`: Auth route definitions.
- `Backend/services/auth/lib/db.js`: Auth Prisma client.
- `Backend/services/billing/package.json`: Billing scripts/dependencies.
- `Backend/services/billing/package-lock.json`: locked Billing dependencies.
- `Backend/services/billing/.env`: Billing port, database, Razorpay, and Auth service configuration.
- `Backend/services/billing/index.js`: Billing service bootstrap.
- `Backend/services/billing/controllers/billing.controller.js`: order creation and payment verification.
- `Backend/services/billing/routes/billing.routes.js`: Billing route definitions.
- `Backend/services/billing/lib/db.js`: Billing Prisma client.
- `Backend/services/billing/lib/plan.js`: plan and credit definitions.
- `Backend/services/billing/lib/razorpay.js`: Razorpay SDK initialization.
- `Backend/services/chat/package.json`: Chat scripts/dependencies.
- `Backend/services/chat/package-lock.json`: locked Chat dependencies.
- `Backend/services/chat/.env`: Chat port and database configuration.
- `Backend/services/chat/index.js`: Chat service bootstrap.
- `Backend/services/chat/controllers/chat.controller.js`: conversation and message operations.
- `Backend/services/chat/routes/chat.routes.js`: Chat route definitions.
- `Backend/services/chat/lib/db.js`: Chat Prisma client.

### Frontend

- `Frontend/package.json`: Vite scripts and React/UI dependencies.
- `Frontend/package-lock.json`: locked frontend dependency tree.
- `Frontend/.env`: Firebase web, gateway, and Razorpay public configuration.
- `Frontend/.gitignore`: ignored frontend local/build files.
- `Frontend/index.html`: Vite document entry point.
- `Frontend/vite.config.js`: Vite configuration.
- `Frontend/eslint.config.js`: ESLint configuration.
- `Frontend/README.md`: generated Vite starter notes.
- `Frontend/public/favicon.svg`: favicon asset.
- `Frontend/public/icons.svg`: icon sprite asset.
- `Frontend/src/main.jsx`: React root and Redux provider.
- `Frontend/src/App.jsx`: session bootstrap and top-level rendering.
- `Frontend/src/index.css`: global styles.
- `Frontend/src/pages/Home.jsx`: main authenticated/unauthenticated page.
- `Frontend/src/components/AiBanner.jsx`: transient AI notification.
- `Frontend/src/components/Artifact.jsx`: Monaco artifact editor and iframe preview.
- `Frontend/src/components/BillingDrawer.jsx`: plans, credit usage, and Razorpay checkout.
- `Frontend/src/components/ChatArea.jsx`: chat layout composition.
- `Frontend/src/components/ChatInput.jsx`: agent selection, upload, and prompt submission.
- `Frontend/src/components/MessageBubble.jsx`: rich assistant/user message rendering.
- `Frontend/src/components/MessageList.jsx`: message loading and scrolling.
- `Frontend/src/components/Nav.jsx`: conversation navigation header.
- `Frontend/src/components/Sidebar.jsx`: conversation navigation and account actions.
- `Frontend/src/features/createConversation.js`: create-conversation API wrapper.
- `Frontend/src/features/createOrder.js`: create-payment API wrapper.
- `Frontend/src/features/getConversations.js`: conversation-list API wrapper.
- `Frontend/src/features/getCurrentUser.js`: current-user API wrapper.
- `Frontend/src/features/getMessages.js`: message-list API wrapper.
- `Frontend/src/features/logout.js`: logout API wrapper.
- `Frontend/src/features/sendMessage.js`: multipart agent-chat API wrapper.
- `Frontend/src/features/updateConversation.js`: conversation-title API wrapper.
- `Frontend/src/features/verifyPayment.js`: unused empty payment verification wrapper.
- `Frontend/src/redux/conversationSlice.js`: conversation Redux state.
- `Frontend/src/redux/messageSlice.js`: message/artifact Redux state.
- `Frontend/src/redux/store.js`: Redux store setup.
- `Frontend/src/redux/userSlice.js`: user Redux state.
- `Frontend/utils/axios.js`: shared Axios instance.
- `Frontend/utils/detectLanguage.js`: Monaco language detection.
- `Frontend/utils/firebase.js`: Firebase web SDK setup.

### Documentation artifacts

- `Project-Workflow-Documentation-Part1.docx`: existing workflow document.
- `~$oject-Workflow-Documentation-Part1.docx`: Office temporary lock file; not application source.
