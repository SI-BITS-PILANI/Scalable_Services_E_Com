FROM python:3.12-slim

WORKDIR /app

COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

COPY app ./app

# Generate gRPC stubs from the shared catalog contract at build time.
# The generated files (catalog_pb2.py, catalog_pb2_grpc.py) are placed
# directly into app/proto/ so imports resolve as app.proto.catalog_pb2.
RUN python -m grpc_tools.protoc \
    -I./app/proto \
    --python_out=./app/proto \
    --grpc_python_out=./app/proto \
    ./app/proto/catalog.proto

EXPOSE 8002

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8002"]
