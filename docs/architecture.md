# Architecture

```mermaid
flowchart LR
    user([Browser]) -->|":8080"| proxy

    subgraph web-net
        proxy["proxy<br/>nginx:1.27-alpine<br/>:80"]
        frontend["frontend<br/>nginx static UI<br/>:80"]
        api["api<br/>Node 20 / Express<br/>:3000"]
    end

    subgraph db-net["db-net (internal, no outside access)"]
        db[("db<br/>MySQL 8.4<br/>:3306")]
    end

    proxy -->|"/"| frontend
    proxy -->|"/api/* (prefix stripped)"| api
    api --> db
    db --- vol[(db-data volume)]
```

```mermaid
flowchart LR
    dev([Developer]) -->|git push| gh[(GitHub: ticket-system)]
    gh -->|"webhook (or poll every ~2 min)"| jenkins["Jenkins (Docker)<br/>:9090"]
    jenkins --> t["1. Unit tests<br/>docker build --target test"]
    t --> b["2. docker compose build<br/>tag = build #"]
    b --> d["3. docker compose up -d"]
    d --> s["4. Smoke test via proxy"]
    jenkins -. "/var/run/docker.sock" .-> host["Host Docker daemon<br/>runs the app stack"]
```

## Services

| Service  | Image / build            | Port (host) | Networks        | Healthcheck                      |
|----------|--------------------------|-------------|-----------------|----------------------------------|
| proxy    | `./proxy` (nginx 1.27)   | **8080**    | web-net         | `GET /nginx-health`              |
| frontend | `./frontend` (nginx 1.27)| none        | web-net         | `GET /`                          |
| api      | `./api` (target `production`) | none   | web-net, db-net | `GET /health`                    |
| db       | `./db` (mysql 8.4 + init.sql) | none   | db-net          | `mysqladmin ping` over TCP       |

## Design decisions

- **One public port.** Only the proxy publishes `8080`; frontend, api and db are unreachable from the host.
- **DB isolation.** `db-net` is `internal: true`; the proxy and frontend can't talk to MySQL at all.
- **Startup order is health-based.** `db` healthy -> `api` healthy -> `proxy` starts. The DB check uses TCP (`-h 127.0.0.1`) so the API can't start against MySQL's socket-only temporary init server.
- **No host bind mounts.** `init.sql` is baked into `ticket-app/db`, so the stack deploys identically from a laptop or from Jenkins-in-Docker (where host paths don't match container paths).
- **Multi-stage API image.** `test` stage runs `npm test` (used by CI); `production` stage has prod deps only and runs as the non-root `node` user.
- **Image tags.** `TAG` = Jenkins build number (`ticket-app/api:42`), `latest` locally.

- **CI trigger test.** This line was added to confirm Jenkins builds on new commits.
