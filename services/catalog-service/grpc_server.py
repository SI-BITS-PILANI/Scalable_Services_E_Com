"""gRPC server for the Catalog Service.

Exposes a high-performance, strongly-typed contract used by the Order Service
to validate/price a basket synchronously before creating an order.

The *_pb2 modules are generated from proto/catalog.proto at Docker build time.
"""
import grpc

import catalog_pb2
import catalog_pb2_grpc
from config import settings
from database import products_collection


class CatalogServicer(catalog_pb2_grpc.CatalogServiceServicer):
    async def GetProduct(self, request, context):
        doc = await products_collection.find_one({"product_id": request.product_id})
        if not doc:
            return catalog_pb2.ProductResponse(product_id=request.product_id, available=False)
        return catalog_pb2.ProductResponse(
            product_id=doc["product_id"],
            name=doc["name"],
            price=doc["price"],
            stock=doc["stock"],
            available=doc["stock"] > 0,
        )

    async def ValidateProducts(self, request, context):
        items = []
        total = 0.0
        all_available = True

        for it in request.items:
            doc = await products_collection.find_one({"product_id": it.product_id})
            if not doc:
                all_available = False
                items.append(catalog_pb2.ValidatedItem(
                    product_id=it.product_id, quantity=it.quantity, available=False))
                continue

            available = it.quantity > 0 and doc["stock"] >= it.quantity
            if not available:
                all_available = False
            subtotal = doc["price"] * it.quantity
            if available:
                total += subtotal
            items.append(catalog_pb2.ValidatedItem(
                product_id=doc["product_id"],
                name=doc["name"],
                price=doc["price"],
                quantity=it.quantity,
                subtotal=subtotal,
                available=available,
            ))

        return catalog_pb2.ValidateProductsResponse(
            all_available=all_available, items=items, total=round(total, 2))


async def serve_grpc():
    """Start the async gRPC server on the shared event loop and return it."""
    server = grpc.aio.server()
    catalog_pb2_grpc.add_CatalogServiceServicer_to_server(CatalogServicer(), server)
    server.add_insecure_port(f"[::]:{settings.grpc_port}")
    await server.start()
    print(f"[catalog] gRPC server listening on :{settings.grpc_port}")
    return server
