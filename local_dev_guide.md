# Local development guide

The canonical cross-platform setup is:

- [Windows and Linux local setup](docs/LOCAL_SETUP_WINDOWS_LINUX.md)
- [Reported errors and implemented fixes](docs/ERRORS_AND_FIXES.md)
- [Backend authority and propagation audit](docs/BACKEND_AUTHORITY_AUDIT.md)

Quick start after installing Docker, Node.js 22, Ollama, and the Clerk CLI:

```bash
npm ci
cp .env.example .env.local
docker compose -f docker-compose.dev.yml up -d --build postgres redis minio ingestion solver retrieval
ollama pull gemma4:e2b
ollama pull nomic-embed-text:latest
clerk auth login
clerk init --app app_3H8hkjTJXpa5w987cCoDFNSCmcU
npm run db:migrate
npm run db:seed
npm run dev:clerk
```

Run `npm run worker` in a second terminal. The application is available at
[http://localhost:3000](http://localhost:3000).

Do not use `docker-compose.yml` for this laptop workflow. It is the
production-oriented, fail-closed topology and requires deployment secrets plus
an HTTPS public URL.
