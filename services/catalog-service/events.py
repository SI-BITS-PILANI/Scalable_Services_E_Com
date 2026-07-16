"""RabbitMQ topology/bootstrap and event publishing for catalog-service."""
from __future__ import annotations

import json
import logging
from typing import Iterable

logger = logging.getLogger(__name__)


class CatalogEventBus:
    """Small RabbitMQ helper for declaring topology and publishing events.

    Uses short-lived connections so failures do not block service startup or
    product creation paths.
    """

    def __init__(
        self,
        amqp_url: str,
        exchange: str,
        queue_name: str,
        binding_keys: Iterable[str],
    ) -> None:
        self.amqp_url = amqp_url.strip()
        self.exchange = exchange
        self.queue_name = queue_name
        self.binding_keys = [k.strip() for k in binding_keys if k.strip()]

    @property
    def enabled(self) -> bool:
        return bool(self.amqp_url)

    def ensure_topology(self) -> None:
        if not self.enabled:
            logger.info("Catalog event bus disabled: no RABBITMQ_URL configured")
            return

        try:
            import pika

            connection = pika.BlockingConnection(pika.URLParameters(self.amqp_url))
            channel = connection.channel()
            channel.exchange_declare(
                exchange=self.exchange,
                exchange_type="topic",
                durable=True,
            )
            channel.queue_declare(queue=self.queue_name, durable=True)
            for key in self.binding_keys:
                channel.queue_bind(
                    exchange=self.exchange,
                    queue=self.queue_name,
                    routing_key=key,
                )
            connection.close()
            logger.info(
                "Catalog event topology ready: exchange=%s queue=%s keys=%s",
                self.exchange,
                self.queue_name,
                self.binding_keys,
            )
        except Exception as exc:
            logger.warning("Catalog RabbitMQ bootstrap skipped: %s", exc)

    def publish(self, event_name: str, payload: dict[str, object]) -> None:
        if not self.enabled:
            return

        try:
            import pika

            body_payload = dict(payload)
            body_payload.setdefault("event_type", event_name)
            body = json.dumps(body_payload)

            connection = pika.BlockingConnection(pika.URLParameters(self.amqp_url))
            channel = connection.channel()
            channel.exchange_declare(
                exchange=self.exchange,
                exchange_type="topic",
                durable=True,
            )
            channel.basic_publish(
                exchange=self.exchange,
                routing_key=event_name,
                body=body,
                properties=pika.BasicProperties(delivery_mode=2),
            )
            connection.close()
        except Exception as exc:
            logger.warning(
                "Catalog event publish skipped for %s: %s",
                event_name,
                exc,
            )
