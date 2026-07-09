"""RabbitMQ event consumer for the Notification Service.

Listens on the 'ecom.events' topic exchange.
Routing key format:  '<domain>.<EventName>'
  e.g.  'order.OrderCreated', 'payment.PaymentCaptured'

If RabbitMQ is unavailable the consumer retries with exponential backoff and
logs a warning — it does NOT crash the service.  This lets the service start
cleanly in dev environments where the broker isn't running yet.
"""
from __future__ import annotations

import asyncio
import json
import logging
from datetime import datetime, timezone
from typing import Any
from uuid import uuid4

import aio_pika
from motor.motor_asyncio import AsyncIOMotorCollection

logger = logging.getLogger(__name__)

EXCHANGE_NAME = "ecom.events"
QUEUE_NAME = "notification-service.queue"
# Binds to all order and payment events published by other services.
BINDING_KEYS = ["order.*", "payment.*"]

# Human-readable message templates keyed on event type.
# {order_id} is substituted at runtime.
_EVENT_MESSAGES: dict[str, str] = {
    "OrderCreated": "Your order {order_id} has been placed successfully.",
    "OrderCancelled": "Your order {order_id} has been cancelled.",
    "OrderPaid": "Payment for your order {order_id} has been confirmed.",
    "PaymentAuthorized": "Payment for your order {order_id} has been authorized.",
    "PaymentCaptured": (
        "Payment for your order {order_id} has been captured. "
        "Your order is confirmed!"
    ),
    "PaymentFailed": (
        "Payment for your order {order_id} has failed. Please try again."
    ),
    "PaymentRefunded": "A refund for your order {order_id} has been processed.",
}


def _build_notification(event_type: str, payload: dict[str, Any]) -> dict[str, Any]:
    """Build a notification document from an incoming event payload."""
    order_id: str | None = payload.get("order_id")
    customer_id: str = payload.get("customer_id", "unknown")
    template = _EVENT_MESSAGES.get(
        event_type,
        "You have a new update for order {order_id}.",
    )
    message = template.format(order_id=order_id or "N/A")
    return {
        "notification_id": str(uuid4()),
        "customer_id": customer_id,
        "event_type": event_type,
        "order_id": order_id,
        "message": message,
        "read": False,
        "created_at": datetime.now(timezone.utc),
    }


async def _process_message(
    message: aio_pika.IncomingMessage,
    collection: AsyncIOMotorCollection,
) -> None:
    """Decode one RabbitMQ message, create a notification, and persist it."""
    async with message.process():
        try:
            routing_key = message.routing_key or ""
            # routing key: 'order.OrderCreated' → event_type = 'OrderCreated'
            event_type = (
                routing_key.split(".", 1)[1] if "." in routing_key else routing_key
            )
            payload: dict[str, Any] = json.loads(message.body)
            notification = _build_notification(event_type, payload)
            await collection.insert_one(notification)
            logger.info(
                "Stored notification '%s' for customer '%s'",
                event_type,
                notification["customer_id"],
            )
        except Exception:
            logger.exception(
                "Failed to process message with routing key '%s'",
                message.routing_key,
            )


async def start_consumer(
    rabbitmq_url: str,
    collection: AsyncIOMotorCollection,
) -> None:
    """Connect to RabbitMQ and consume events indefinitely.

    Retries with exponential backoff (up to 60 s) when the broker is
    unavailable so that the rest of the service remains healthy.
    """
    retry_delay = 5
    while True:
        try:
            connection = await aio_pika.connect_robust(rabbitmq_url)
            async with connection:
                channel = await connection.channel()
                await channel.set_qos(prefetch_count=10)

                exchange = await channel.declare_exchange(
                    EXCHANGE_NAME,
                    aio_pika.ExchangeType.TOPIC,
                    durable=True,
                )
                queue = await channel.declare_queue(QUEUE_NAME, durable=True)

                for key in BINDING_KEYS:
                    await queue.bind(exchange, routing_key=key)

                logger.info(
                    "Notification consumer connected to RabbitMQ, "
                    "listening on routing keys: %s",
                    BINDING_KEYS,
                )
                retry_delay = 5  # reset backoff on successful connection

                async with queue.iterator() as queue_iter:
                    async for message in queue_iter:
                        await _process_message(message, collection)

        except asyncio.CancelledError:
            logger.info("Notification consumer shutting down.")
            return
        except Exception:
            logger.warning(
                "RabbitMQ unavailable — retrying in %d seconds...",
                retry_delay,
            )
            await asyncio.sleep(retry_delay)
            retry_delay = min(retry_delay * 2, 60)
