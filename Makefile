# ============================================
# Profasee — convenience commands
# ============================================
# Prereq: copy .env.example to .env and fill values.

SHELL := /bin/bash
COMPOSE := docker compose

.PHONY: help up down restart logs ps build rebuild clean test test-backend test-frontend debug prod prod-down shell-backend shell-db

help:
	@echo "Profasee — make targets:"
	@echo "  make up            Build + start all services (detached)"
	@echo "  make down          Stop and remove containers (keeps DB volume)"
	@echo "  make restart       Restart all services"
	@echo "  make logs          Tail logs from all services"
	@echo "  make ps            List running containers"
	@echo "  make build         Build images (no cache pull)"
	@echo "  make rebuild       Rebuild images from scratch (no cache)"
	@echo "  make clean         Stop, remove containers, networks, AND the postgres volume"
	@echo "  make test          Run frontend + backend tests"
	@echo "  make test-backend  Run backend tests only"
	@echo "  make test-frontend Run frontend tests only"
	@echo "  make debug         Start with docker-compose.debug.yml (Node inspector :9229)"
	@echo "  make prod          Start in production mode (uses docker-compose.prod.yml)"
	@echo "  make prod-down     Stop production stack"
	@echo "  make shell-backend Open a shell in the backend container"
	@echo "  make shell-db      Open psql against the postgres container"

up:
	$(COMPOSE) up -d --build

down:
	$(COMPOSE) down

restart:
	$(COMPOSE) restart

logs:
	$(COMPOSE) logs -f --tail=100

ps:
	$(COMPOSE) ps

build:
	$(COMPOSE) build

rebuild:
	$(COMPOSE) build --no-cache

clean:
	$(COMPOSE) down -v --remove-orphans

test: test-backend test-frontend

test-backend:
	cd src/backend && npm test -- --run

test-frontend:
	cd src/frontend && npm test -- --run

debug:
	$(COMPOSE) -f docker-compose.yml -f docker-compose.debug.yml up --build

prod:
	$(COMPOSE) -f docker-compose.yml -f docker-compose.prod.yml up -d --build

prod-down:
	$(COMPOSE) -f docker-compose.yml -f docker-compose.prod.yml down

shell-backend:
	$(COMPOSE) exec backend sh

shell-db:
	$(COMPOSE) exec postgres psql -U $${DB_USER:-profasee_user} -d $${DB_NAME:-profasee}
