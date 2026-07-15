from __future__ import annotations

from dataclasses import dataclass
from typing import Any

import pytest
from fastapi.testclient import TestClient

import main as catalog_main


@dataclass
class _InsertOneResult:
    inserted_id: str


class _FakeCursor:
    def __init__(self, docs: list[dict[str, Any]]) -> None:
        self._docs = docs

    async def to_list(self, _limit: int) -> list[dict[str, Any]]:
        return [dict(d) for d in self._docs]


class _FakeCollection:
    def __init__(self, seed_docs: list[dict[str, Any]] | None = None) -> None:
        self._docs = [dict(d) for d in (seed_docs or [])]

    async def count_documents(self, _query: dict[str, Any]) -> int:
        return len(self._docs)

    async def insert_many(self, docs: list[dict[str, Any]]) -> None:
        self._docs.extend(dict(d) for d in docs)

    def find(self, _query: dict[str, Any] | None = None) -> _FakeCursor:
        return _FakeCursor(self._docs)

    async def find_one(self, query: dict[str, Any]) -> dict[str, Any] | None:
        product_id = query.get("product_id")
        for doc in self._docs:
            if doc.get("product_id") == product_id:
                return dict(doc)
        return None

    async def insert_one(self, doc: dict[str, Any]) -> _InsertOneResult:
        self._docs.append(dict(doc))
        return _InsertOneResult(inserted_id=str(doc.get("product_id", "")))


class _DummyGrpcServer:
    async def stop(self, grace: int = 2) -> None:
        _ = grace


@pytest.fixture()
def client_and_collection(monkeypatch: pytest.MonkeyPatch) -> tuple[TestClient, _FakeCollection]:
    fake_collection = _FakeCollection(
        [
            {
                "product_id": "p1001",
                "name": "Laptop",
                "description": "Demo",
                "price": 1000.0,
                "stock": 5,
                "category": "computers",
            }
        ]
    )

    async def _fake_seed_products() -> None:
        return None

    async def _fake_serve_grpc() -> _DummyGrpcServer:
        return _DummyGrpcServer()

    monkeypatch.setattr(catalog_main, "products_collection", fake_collection)
    monkeypatch.setattr(catalog_main, "seed_products", _fake_seed_products)
    monkeypatch.setattr(catalog_main, "serve_grpc", _fake_serve_grpc)

    with TestClient(catalog_main.app) as client:
        yield client, fake_collection


def test_health(client_and_collection: tuple[TestClient, _FakeCollection]) -> None:
    client, _ = client_and_collection
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json()["status"] == "ok"


def test_list_products_v1(client_and_collection: tuple[TestClient, _FakeCollection]) -> None:
    client, _ = client_and_collection
    response = client.get("/api/v1/products")
    assert response.status_code == 200
    body = response.json()
    assert len(body) == 1
    assert body[0]["product_id"] == "p1001"
    assert body[0]["available"] is True


def test_get_product_not_found(client_and_collection: tuple[TestClient, _FakeCollection]) -> None:
    client, _ = client_and_collection
    response = client.get("/api/v1/products/unknown")
    assert response.status_code == 404
    assert response.json()["detail"] == "Product not found"


def test_create_product_v1(client_and_collection: tuple[TestClient, _FakeCollection]) -> None:
    client, _ = client_and_collection
    payload = {
        "name": "Mouse",
        "description": "Wireless",
        "price": 20.0,
        "stock": 10,
        "category": "accessories",
    }
    response = client.post("/api/v1/products", json=payload)
    assert response.status_code == 201
    body = response.json()
    assert body["product_id"].startswith("p-")
    assert body["name"] == "Mouse"
    assert body["available"] is True


def test_list_products_v2_includes_additive_fields(
    client_and_collection: tuple[TestClient, _FakeCollection],
) -> None:
    client, _ = client_and_collection
    response = client.get("/api/v2/products")
    assert response.status_code == 200
    body = response.json()
    assert len(body) == 1
    assert body[0]["currency"] == "USD"
    assert body[0]["price_display"].startswith("$")
