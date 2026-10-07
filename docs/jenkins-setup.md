# Jenkins setup

Jenkins runs in Docker, **separate** from the app stack, and deploys the app by talking to the host Docker daemon through `/var/run/docker.sock`.

## 1. Start Jenkins

```bash
cd jenkins
cp .env.example .env        # then edit passwords
docker compose up -d --build
```

Open **http://localhost:9090** and log in with `JENKINS_ADMIN_ID` / `JENKINS_ADMIN_PASSWORD`.

Plugins, the admin user, the DB credentials and the `ticket-system` pipeline job are all created automatically from `jenkins/plugins.txt` and `jenkins/casc.yaml` (Configuration as Code), so there is no setup wizard.

| Credential ID             | Used for                          |
|---------------------------|-----------------------------------|
| `ticket-db-root-password` | `DB_ROOT_PASSWORD` in the Deploy stage |
| `ticket-db-password`      | `DB_PASSWORD` in the Deploy stage |

## 2. Run the pipeline

Click **ticket-system -> Build Now**. Stages: Checkout -> Unit Tests -> Build Images -> Deploy -> Smoke Test. The app comes up at **http://localhost:8080**.

## 3. Triggers

**Polling (works out of the box).** The `Jenkinsfile` has `pollSCM('H/2 * * * *')`: Jenkins checks GitHub about every 2 minutes and builds on new commits. Run the job once manually after first start so the trigger registers.

**Webhook (instant builds).** GitHub can't reach `localhost`, so expose Jenkins first:

```bash
ngrok http 9090          # copy the https URL, e.g. https://abcd.ngrok-free.app
```

Then set `JENKINS_URL` in `jenkins/.env` to that URL (`docker compose up -d` again), and in GitHub go to
**Settings -> Webhooks -> Add webhook**:

- Payload URL: `https://abcd.ngrok-free.app/github-webhook/`
- Content type: `application/json`
- Event: *Just the push event*

The `githubPush()` trigger in the `Jenkinsfile` picks it up. Keep polling as a fallback.

## Troubleshooting

- **`permission denied` on docker.sock**: the Jenkins container must run as root (set in `jenkins/docker-compose.yml`) or share the host's `docker` GID.
- **Port 8080 in use**: the app owns 8080 and Jenkins uses 9090. Change the app port with `APP_PORT`.
- **Changed DB password has no effect**: MySQL only reads the password on first init. Run `docker compose down -v` to reset the `db-data` volume (this deletes data).
- **Hardening for non-lab use**: mounting `docker.sock` gives Jenkins root-equivalent control of the host; use a dedicated build agent or rootless Docker in production.
