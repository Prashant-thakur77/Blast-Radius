# Blast Radius Backend

## Setup

```bash
cd backend
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
```

Add your `OPENAI_API_KEY` to `.env`.

## Run

```bash
uvicorn app.main:app --reload
```
