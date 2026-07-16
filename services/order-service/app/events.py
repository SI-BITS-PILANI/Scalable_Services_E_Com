import json
import logging
import time
from typing import Optional
from sqlalchemy.orm import sessionmaker
from sqlalchemy import select

from app.models import OrderRecord, OrderStatus


logger = logging.getLogger(__name__)


def parse_payment_outcome_message(message_body: bytes) -> Optional[dict]:
    """Parse and validate payment outcome event payload."""
    try:
        payload = json.loads(message_body.decode("utf-8"))
    except (json.JSONDecodeError, UnicodeDecodeError) as e:
        logger.warning(f"[order-service] invalid JSON payload: {e}")
        return None

    order_id = payload.get("order_id")
    customer_id = payload.get("customer_id")
    status = payload.get("status")

    if not order_id or not customer_id or not status:
        logger.warning(
            "[order-service] payment outcome missing required fields: "
            f"order_id={order_id}, customer_id={customer_id}, status={status}"
        )
        return None

    return {
        "order_id": str(order_id),
        "customer_id": str(customer_id),
        "status": str(status),
        "reason": payload.get("reason"),
        "payment_id": payload.get("payment_id"),
    }


def update_order_from_payment_outcome(
    session_factory: sessionmaker, payload: dict
) -> Optional[str]:
    """Update order status based on payment outcome. Returns updated order_id or None."""
    session = session_factory()
    try:
        order_id = payload["order_id"]
        payment_status = payload["status"]

        query = select(OrderRecord).where(OrderRecord.order_id == order_id)
        order = session.execute(query).scalar_one_or_none()

        if not order:
            logger.warning(f"[order-service] order not found: order_id={order_id}")
            return None

        if payment_status == "SUCCEEDED":
            if order.status == OrderStatus.PENDING.value:
                order.status = OrderStatus.PAID.value
                session.add(order)
                session.commit()
                logger.info(
                    f"[order-service] order status updated to PAID: order_id={order_id}, "
                    f"payment_id={payload.get('payment_id')}"
                )
                return order_id
            else:
                logger.info(
                    f"[order-service] order status not updated (not PENDING): "
                    f"order_id={order_id}, current_status={order.status}"
                )
                return order_id
        elif payment_status == "FAILED":
            if order.status == OrderStatus.PENDING.value:
                order.status = OrderStatus.CANCELLED.value
                session.add(order)
                session.commit()
                logger.info(
                    f"[order-service] order status updated to CANCELLED (payment failed): "
                    f"order_id={order_id}, reason={payload.get('reason')}"
                )
                return order_id
            else:
                logger.info(
                    f"[order-service] order status not updated (not PENDING): "
                    f"order_id={order_id}, current_status={order.status}"
                )
                return order_id
        else:
            logger.warning(
                f"[order-service] unknown payment status: "
                f"order_id={order_id}, status={payment_status}"
            )
            return None

    except Exception as e:
        logger.error(f"[order-service] failed to update order from payment outcome: {e}")
        session.rollback()
        return None
    finally:
        session.close()


def start_payment_outcome_consumer(rabbitmq_url: str, session_factory: sessionmaker):
    """Start consumer for payment outcome events (PaymentCaptured, PaymentFailed)."""
    import pika

    retry_delay = 5
    while True:
        connection = None
        try:
            connection = pika.BlockingConnection(pika.URLParameters(rabbitmq_url))
            channel = connection.channel()

            exchange = "ecom.events"
            queue = "order.payment-outcomes.queue"

            channel.exchange_declare(exchange=exchange, exchange_type="topic", durable=True)
            channel.queue_declare(queue=queue, durable=True)

            channel.queue_bind(exchange=exchange, queue=queue, routing_key="payment.PaymentCaptured")
            channel.queue_bind(exchange=exchange, queue=queue, routing_key="payment.PaymentFailed")

            logger.info(
                f"[order-service] payment outcome consumer started; listening on {queue}"
            )
            retry_delay = 5

            def callback(ch, method, properties, body):
                try:
                    payload = parse_payment_outcome_message(body)
                    if not payload:
                        logger.warning("[order-service] skipped invalid payment outcome message")
                        ch.basic_ack(delivery_tag=method.delivery_tag)
                        return

                    event_type = method.routing_key
                    logger.info(
                        f"[order-service] consumed {event_type} for order_id={payload['order_id']}"
                    )

                    update_order_from_payment_outcome(session_factory, payload)
                    ch.basic_ack(delivery_tag=method.delivery_tag)

                except Exception as e:
                    logger.error(
                        f"[order-service] payment outcome processing failed: {e}"
                    )
                    ch.basic_nack(delivery_tag=method.delivery_tag, requeue=False)

            channel.basic_consume(queue=queue, on_message_callback=callback)
            channel.start_consuming()

        except Exception as e:
            logger.warning(
                "[order-service] payment outcome consumer error, retrying in %ss: %s",
                retry_delay,
                e,
            )
            time.sleep(retry_delay)
            retry_delay = min(retry_delay * 2, 60)
        finally:
            if connection and connection.is_open:
                connection.close()


def create_payment_outcome_consumer(rabbitmq_url: str, session_factory: sessionmaker):
    """Factory function to create and return a payment outcome consumer runner."""
    import threading

    def run():
        start_payment_outcome_consumer(rabbitmq_url, session_factory)

    thread = threading.Thread(target=run, daemon=True)
    return thread
