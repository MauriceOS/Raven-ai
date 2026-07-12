# Deploy backend (Windows)

Region: **us-east-1**

## Prerequisites

1. [AWS CLI](https://aws.amazon.com/cli/) — `aws configure` with access keys
2. [SAM CLI](https://docs.aws.amazon.com/serverless-application-model/latest/developerguide/install-sam-cli.html)
3. Node.js 18+ (frontend)

Verify:

```powershell
aws sts get-caller-identity
sam --version
```

## Build and deploy

```powershell
cd infrastructure
sam build
sam deploy --guided
```

Suggested stack name: `raven-lite`. Save settings when prompted (`samconfig.toml`).

Copy the **ApiUrl** output → `frontend/.env`:

```
VITE_API_URL=https://xxxxxxxx.lambda-url.us-east-1.on.aws
```

## Test

```powershell
Invoke-RestMethod -Uri "https://YOUR_URL/health"
```

## Redeploy after backend changes

```powershell
cd infrastructure
sam build
sam deploy
```

## Frontend locally

```powershell
cd frontend
copy .env.example .env
npm install
npm run dev
```

Open http://localhost:5173

## GitHub Pages

Host the frontend for free from this public repo — no S3 bucket needed.

### One-time setup

1. Deploy the backend and copy your **ApiUrl** ([steps above](#build-and-deploy)).
2. In GitHub: **Settings → Secrets and variables → Actions → New repository secret**
   - Name: `VITE_API_URL`
   - Value: your Lambda Function URL (no trailing slash)
3. **Settings → Pages → Build and deployment → Source:** choose **GitHub Actions**.

### Deploy

Push to `main` (or run the **Deploy frontend to GitHub Pages** workflow manually).

Live URL (this repo):

```
https://mauriceos.github.io/Raven-ai/
```

The workflow sets `VITE_BASE_PATH` to `/Raven-ai/` automatically. If assets 404, confirm the repo name is exactly `Raven-ai`.

### Redeploy frontend only

Any push under `frontend/` on `main` triggers a new Pages deploy. To update the API URL, change the `VITE_API_URL` secret and re-run the workflow.
