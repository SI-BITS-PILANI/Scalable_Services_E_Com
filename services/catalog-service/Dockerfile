FROM python:3.11-slim

WORKDIR /app

# Install dependencies first (better layer caching)
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy source
COPY . .

# Generate gRPC stubs from the proto contract at build time
RUN python -m grpc_tools.protoc -I./proto \
    --python_out=. --grpc_python_out=. ./proto/catalog.proto

EXPOSE 8001 50051

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8001"]
