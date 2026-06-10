```
 ____   ____   ___   _____  _    ____  _____  _____
|  _ \ |  _ \ / _ \ |  ___|/ \  / ___|| ____|| ____|
| |_) || |_) | | | || |_  / _ \ \___ \|  _|  |  _|
|  __/ |  _ <| |_| ||  _|/ ___ \ ___) || |___ | |___
|_|    |_| \_\\___/ |_| /_/   \_\____/ |_____||_____|

           A I   E N G I N E E R I N G   A S S E S S M E N T
                 P R O J E C T :   C A M P A I G N   G U A R D I A N
```

+--------------------------------------------------------------+
| |
| CSV Upload |
| | |
| v |
| [Parse & Validate] --> 7 validation rules |
| | |
| v |
| [Data Quality] |
| | |
| v |
| [Normalisation] |
| | |
| v |
| [Regime Detection] |
| | |
| v |
| [Anomaly Detection] --> 4 detectors |
| | |
| v |
| [LLM Validation] --> Anthropic Haiku 4.5 (batches of 5) |
| | |
| v |
| [Persist] --> reports / anomalies / audit_logs |
| | |
| v |
| /anomalies + /insights |
| |
+--------------------------------------------------------------+
.------. .------. .------.
CSV ----> |Parse | ----> |Quality| ----> |Norm |
'------' '------' '------'
|
v
.------. .------. .------.
|Persist| <--- | LLM | <---- |Anomaly|
'------' '------' '------'
| ^
v |
Postgres Anthropic
(anomalies (batches
reports of 5)
audit_logs)

- Pipeline that ingest a csv and perform calculation. Detecting anomalies based on PPC metrics and each campaing baseline.

- on the `src\backend` repository pattern. Services are each stage of the pipeline. middleware to handles erros. SQL is cheaper because if we query an object with a large amount of anomalies it's going to be an overload. But we can decouple audit table an move that onto a nosql for analitycs.

- on the `src\frontend` folder page is an orchestrator. Each component lives on components folders. hooks is for global hooks and we are using modules.css thanks to vite.

- This is a working prototype for local machine.

run

```bash
docker-compose up --build -d
```

Then open **http://localhost:5173** in your browser.

Set `ANTHROPIC_API_KEY` in `.env` to enable LLM insights.

### Service ports

| Service  | URL                   |
| -------- | --------------------- |
| Frontend | http://localhost:5173 |
| Backend  | http://localhost:3001 |
| Postgres | `localhost:5432`      |

The Vite dev server proxies `/api/*` to the backend, so the frontend uses relative paths like `/api/v1/anomaly`.

The dev stack is hot-reloading out of the box: the backend runs under `tsx watch` and the frontend runs Vite HMR; both have source bind-mounted into the containers, so edits on the host are picked up automatically.

