FROM python:3.12-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
    libpq-dev gcc libffi-dev postgresql-client curl \
    && rm -rf /var/lib/apt/lists/*

RUN curl -fsSL https://deb.nodesource.com/setup_20.x | bash - \
    && apt-get install -y nodejs \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY bot.py db.py gdrive_backup.py discord_backup.py ./
COPY VibeCodingBdd/package.json VibeCodingBdd/package-lock.json ./VibeCodingBdd/
RUN cd VibeCodingBdd && npm install
COPY VibeCodingBdd/ ./VibeCodingBdd/

CMD ["python", "bot.py"]
