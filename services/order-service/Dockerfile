FROM python:3.12-slim

WORKDIR /app

COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

COPY app ./app
COPY tests ./tests
COPY pytest.ini ./

# Generate gRPC stubs from the shared catalog contract at build time.
# Generate to /app so grpc-generated imports resolve without runtime path hacks.
RUN python -m grpc_tools.protoc \
    -I./app/proto \
    --python_out=. \
    --grpc_python_out=. \
    ./app/proto/catalog.proto

EXPOSE 8002

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8002"]
