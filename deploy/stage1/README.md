# Stage 1 Minimal Production Topology

This folder provides a runnable Stage-1 deployment baseline for copy trading:

- Local integration: `docker-compose` (frontend + copy worker + postgres + redis + kafka-compatible broker)
- Kubernetes baseline: multi-replica app/worker and in-cluster data services for initial load testing

The setup is intentionally minimal and should be used as a starting point for gray/prod rollout.

## 1) Local bring-up with Docker Compose

```bash
cd deploy/stage1
cp .env.example .env
# edit .env with your secrets

docker compose up -d --build
```

Services:

- Frontend API/UI: `http://localhost:3000`
- PostgreSQL: `localhost:5432`
- Redis: `localhost:6379`
- Redpanda (Kafka API): `localhost:9092`

Stop:

```bash
docker compose down
```

## 2) Kubernetes deploy (Stage-1 baseline)

1. Create secret from template:

```bash
cp k8s/02-secrets.example.yaml /tmp/polyhunter-secrets.yaml
# fill values in /tmp/polyhunter-secrets.yaml
```

2. Apply manifests:

```bash
kubectl apply -f k8s/00-namespace.yaml
kubectl apply -f /tmp/polyhunter-secrets.yaml
kubectl apply -f k8s/01-configmap.yaml
kubectl apply -f k8s/03-postgres.yaml
kubectl apply -f k8s/04-redis.yaml
kubectl apply -f k8s/05-redpanda.yaml
kubectl apply -f k8s/06-frontend.yaml
kubectl apply -f k8s/07-copy-worker.yaml
kubectl apply -f k8s/08-frontend-hpa.yaml
```

3. Check rollout:

```bash
kubectl -n polyhunter-stage1 get pods
kubectl -n polyhunter-stage1 get svc
kubectl -n polyhunter-stage1 get hpa
```

## 3) Notes for Stage-1

- `COPY_TRADING_DRY_RUN=true` by default in configmap.
- Worker is deployed as a `StatefulSet` so each replica can derive stable `COPY_TRADING_WORKER_INDEX` from pod ordinal.
- For production, move PostgreSQL/Redis/Kafka to managed services and keep only app/worker deployments in cluster.
