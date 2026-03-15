# FastAPI backend for AQMS
FROM python:3.9-slim

ENV PORT=8000
ENV PYTHONUNBUFFERED=1

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

EXPOSE 8000

ENTRYPOINT ["python"]
CMD ["main.py"]