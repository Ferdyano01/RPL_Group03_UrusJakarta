FROM python:3.11-slim

WORKDIR /app

COPY backend/requirements.txt .
RUN apt-get update && apt-get install -y --no-install-recommends \
    libgl1 \
    libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*

# Install CPU-only PyTorch first to avoid pulling large CUDA wheels.
RUN pip install --no-cache-dir --upgrade pip setuptools wheel && \
    pip install --no-cache-dir --default-timeout=180 --retries=10 \
    --index-url https://download.pytorch.org/whl/cpu torch torchvision && \
    pip install --no-cache-dir --default-timeout=180 --retries=10 -r requirements.txt

COPY backend ./backend

EXPOSE 8000

CMD ["uvicorn", "backend.main:app", "--host", "0.0.0.0", "--port", "8000"]
