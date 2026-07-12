# Weekend Productivity Challenge: Raven — AI Focus Coach

**Tag:** #productivity

---

## The problem

Productivity tools scatter goals, energy, and schedule across different apps. I wanted one place that answers a single question: **what should I focus on today?**

## The solution

Raven is a personal AI focus coach. It tracks:

- **Goals & milestones** — direction with completable steps
- **Daily energy** — Low / OK / High check-in that shapes recommendations
- **Manual schedule** — meetings, study blocks, deadlines in Plan
- **Focus sessions** — mark today's recommendation done; history in Progress
- **Follow-up questions** — ask Raven when you need context

## Architecture

```
Browser (React)
    ↓ HTTPS
Lambda Function URL
    ├── DynamoDB (goals, energy, schedule, recommendations)
    └── Amazon Bedrock (Nova Micro)
```

| Service | Role |
|---------|------|
| Lambda + Function URL | API, no servers |
| DynamoDB | Single-table storage |
| Bedrock Nova Micro | Daily recommendations and chat |
| **GitHub Pages** | Static frontend (free, from this repo) |

## What I learned

1. **One primary action beats a chat UI** — recommendation-first Today view outperformed a generic sidebar chat for daily use.

2. **Short prompts save cost** — structured Bedrock output (one focus line + optional extras + why) keeps Nova Micro usage to pennies.

3. **Single-table DynamoDB** — `USER#id` + typed sort keys (`GOAL#`, `REC#`, `EVENT#`, `FOCUS#`) replaced a multi-file local setup with minimal code.

4. **Scope for a weekend** — goals, energy, plan, progress, and one-click study blocks were enough for a complete demo without calendar OAuth or auth.

## Demo

- **Live app:** https://mauriceos.github.io/Raven-ai/
- **GitHub:** https://github.com/MauriceOS/Raven-ai
- **API health:** [YOUR LAMBDA URL]/health

---

*Built for the AWS Builder Center July Weekend Productivity Challenge.*
