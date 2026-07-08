"""Seed the catalog with demo products on first start (idempotent)."""
from database import products_collection

SEED_PRODUCTS = [
    {"product_id": "p1001", "name": "14\" Ultrabook Laptop", "description": "16GB RAM, 512GB SSD",
     "price": 1099.00, "stock": 25, "category": "computers"},
    {"product_id": "p1002", "name": "Wireless Mouse", "description": "Ergonomic, 2.4GHz",
     "price": 24.99, "stock": 200, "category": "accessories"},
    {"product_id": "p1003", "name": "Mechanical Keyboard", "description": "RGB, blue switches",
     "price": 79.50, "stock": 120, "category": "accessories"},
    {"product_id": "p1004", "name": "27\" 4K Monitor", "description": "IPS, USB-C",
     "price": 329.00, "stock": 40, "category": "computers"},
    {"product_id": "p1005", "name": "Noise-Cancelling Headphones", "description": "Over-ear, BT 5.3",
     "price": 199.99, "stock": 60, "category": "audio"},
    {"product_id": "p1006", "name": "USB-C Hub", "description": "7-in-1 docking",
     "price": 45.00, "stock": 150, "category": "accessories"},
]


async def seed_products() -> None:
    count = await products_collection.count_documents({})
    if count == 0:
        await products_collection.insert_many([dict(p) for p in SEED_PRODUCTS])
        print(f"[catalog] seeded {len(SEED_PRODUCTS)} products")
    else:
        print(f"[catalog] {count} products already present, skipping seed")
