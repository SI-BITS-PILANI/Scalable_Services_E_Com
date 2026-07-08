"""Pydantic models / schemas for the Catalog Service."""
from pydantic import BaseModel, Field


class ProductCreate(BaseModel):
    name: str = Field(..., examples=["Mechanical Keyboard"])
    description: str = ""
    price: float = Field(..., gt=0)
    stock: int = Field(..., ge=0)
    category: str = "general"


class Product(ProductCreate):
    product_id: str
    available: bool
