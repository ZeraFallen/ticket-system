# Docker and Jenkins

The app is a static Vite single-page app that talks to Firebase (Authentication + Firestore) straight from the browser. There is **no API or database container**, so the stack is one nginx container, and Jenkins builds and deploys it.

```
Browser --> web (nginx :80, static files)      Jenkins (:9090) --docker.sock--> host Docker
   |
   +--> Firebase Auth / Firestore (Google-hosted)
```

| File | Purpose |
|------|---------|
| `Dockerfile` | Stages: `deps` -> `lint` (quality gate) -> `build` (Vite) -> `production` (nginx) |
| `docker/nginx.conf` | SPA fallback, `/healthz`, long cache for `/assets/`, `index.html` never cached |
| `docker-compose.yml` | One service, `web`, published on `APP_PORT` (default 8080) |
| `Jenkinsfile` | Checkout -> Check Config -> Lint -> Build Image -> Deploy -> Smoke Test |
| `jenkins/` | Jenkins controller in Docker, fully configured by Configuration as Code |

## Run with Docker

```bash
cp .env.example .env        # fill in the Firebase web app values
docker compose up -d --build
```

Open **http://localhost:8080** and sign in with a staff account. `localhost` is already an authorized Firebase Auth domain; any other hostname must be added under **Authentication -> Settings -> Authorized domains**.

The `VITE_FIREBASE_*` values are compiled into the JavaScript at build time, so after editing `.env` run `docker compose up -d --build` again. If a required value is empty, the build stops with an error instead of producing a broken app.

## Run Jenkins

```bash
cd jenkins
cp .env.example .env        # set the admin password and the same Firebase values
docker compose up -d --build
```

Open **http://localhost:9090**. The admin user, plugins, Firebase values (as global environment variables) and the `ticket-system` pipeline job are created automatically from `jenkins/casc.yaml`. Click **ticket-system -> Build Now**; the app is deployed at http://localhost:8080.

**Triggers.** `pollSCM('H/2 * * * *')` checks GitHub about every 2 minutes (run the job once manually so it registers). For instant builds, expose Jenkins with `ngrok http 9090`, set `JENKINS_URL` in `jenkins/.env` to the ngrok URL, restart with `docker compose up -d`, and add a GitHub webhook to `https://<ngrok-url>/github-webhook/` (content type `application/json`, push events).

## Quality gate

There are no unit tests in this version, so the gate is `npm run lint`, which runs inside the Docker `lint` stage. To demo a failing gate, push a lint error (for example an unused variable in `src/data.js`): the **Lint** stage fails and nothing is deployed.

## Rollback

Every build is tagged `ticket-app/web:<build number>`. To go back to an earlier build without rebuilding:

```bash
TAG=12 docker compose up -d --no-build     # needs the same .env as a normal run
```

## Troubleshooting

- **`required variable ... is missing`**: copy `.env.example` to `.env` and fill it in (and `jenkins/.env` for Jenkins).
- **Sign-in shows `auth/unauthorized-domain`**: add the hostname you are using to Firebase Authorized domains.
- **Port 8080 in use**: set `APP_PORT=8081` in `.env`. Jenkins uses 9090.
- **Previously ran the older multi-container version (proxy/api/db) on this machine**: its `proxy` container still holds port 8080. Run `docker compose down --remove-orphans` from that branch, or `docker rm -f` the old containers, before deploying this version. The old MySQL volume is not deleted.
- **`permission denied` on docker.sock**: the Jenkins container runs as root (see `jenkins/docker-compose.yml`) or must share the host's `docker` group ID.
- **Hardening**: mounting `docker.sock` gives Jenkins root-equivalent control of the host. Fine for a local lab; use a dedicated build agent or rootless Docker for anything else.
