---
name: project-bootstrapper
description: Mevcut dizindeki proje tipini (Node.js, Python, Go, Docker vb.) otomatik algılar. Bağımlılıkları kontrol eder/yükler, .env dosyasını doğrular ve en uygun development sunucusunu veya build sürecini başlatır. 'Projeyi başlat', 'serverı aç', 'run' komutlarında devreye girer.
---

# Goal
To autonomously detect the project's tech stack, validate the environment, install missing dependencies, and execute the correct startup command without user hand-holding.

# Workflow

## 1. Stack Detection & Reconnaissance
- **Scan** root directory for indicator files:
  - `package.json` -> Node.js (Check `lock` files for `npm`, `yarn`, `pnpm`, or `bun`).
  - `requirements.txt` / `pyproject.toml` / `Pipfile` -> Python.
  - `go.mod` -> Go.
  - `Cargo.toml` -> Rust.
  - `docker-compose.yml` -> Docker.
  - `Makefile` -> Generic.

## 2. Environment Validation
- Check for `.env` or config files.
- **Safety Check:** If `.env` is missing but `.env.example` exists, ask the user if they want to copy it.
- Check required language versions (e.g., `node -v` vs `engines` in package.json).

## 3. Dependency Management
- **Check:** Are dependencies installed? (e.g., `node_modules` exists?).
- **Action:** If missing, run the install command *specifically* matching the lock file:
  - `yarn.lock` -> `yarn install`
  - `package-lock.json` -> `npm ci` (preferred over install for consistency)
  - `poetry.lock` -> `poetry install`

## 4. Execution Strategy
- Analyze `scripts` (in `package.json`) or `Makefile` targets.
- **Priority Order:**
  1. `dev` / `start:dev` (Development Mode)
  2. `start` (Production Mode)
  3. `docker-compose up`
  4. `go run .` / `cargo run`
- **Port Conflict Check:** Before running, check if the default port (3000, 8000, 8080) is in use using `lsof -i :<port>`. If busy, kill the process (with permission) or increment port.

## 5. Post-Launch
- Output the local URL (e.g., `http://localhost:3000`).
- Update `memory-bank.md` (if exists) with the status: "Project running on port X".

# Constraints
- **Do not** blindly run `npm install` if a `yarn.lock` exists. Respect the lockfile.
- **Do not** start the server in the background (daemon) unless requested. Keep the output visible in the terminal pane.
- If the startup fails, analyze the error log immediately and suggest a fix (don't just say "it failed").

# Examples

**Scenario: Node Project**
> User: "Projeyi kaldır."
> Agent: Detects `package.json` & `pnpm-lock.yaml`.
> Action: Runs `pnpm install` (if node_modules missing) -> Runs `pnpm dev`.

**Scenario: Python Project**
> User: "Başlat."
> Agent: Detects `requirements.txt`. Checks venv.
> Action: Activates venv -> Runs `pip install -r requirements.txt` -> Runs `python main.py` or `uvicorn app:app --reload`.