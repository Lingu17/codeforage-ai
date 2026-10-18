FROM python:3.14-slim
RUN apt-get update && apt-get install -y --no-install-recommends git && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY *.py ./
RUN useradd --create-home codeforge
USER codeforge
ENV APP_ENV=production
EXPOSE 8000
ENV PORT=8000
HEALTHCHECK CMD python -c "import os, urllib.request; urllib.request.urlopen(f'http://127.0.0.1:{os.environ[\"PORT\"]}/health', timeout=5)"
# Hosts such as Render inject PORT; fall back to 8000 locally.
CMD ["sh", "-c", "exec python -m uvicorn main:app --host 0.0.0.0 --port ${PORT:-8000} --workers 1 --limit-concurrency 32 --backlog 64 --proxy-headers --forwarded-allow-ips='*'"]
