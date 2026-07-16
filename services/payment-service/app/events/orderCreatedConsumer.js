import amqplib from "amqplib";
import { randomUUID } from "node:crypto";
import { runQuery } from "../database.js";
import { publishPaymentOutcomeEvent } from "./paymentEventPublisher.js";

function determinePaymentOutcome(payload) {
  const forcedFailureMethods = new Set(["FAIL", "DECLINED"]);
  const isFailure = forcedFailureMethods.has(payload.method);

  if (isFailure) {
    return {
      status: "FAILED",
      eventType: "PaymentFailed",
      reason: "PAYMENT_DECLINED"
    };
  }

  return {
    status: "SUCCEEDED",
    eventType: "PaymentCaptured",
    reason: null
  };
}

function eventTypeFromPaymentStatus(status) {
  if (status === "SUCCEEDED") {
    return "PaymentCaptured";
  }
  if (status === "FAILED") {
    return "PaymentFailed";
  }
  return null;
}

function parseAndValidateOrderCreatedMessage(messageBuffer) {
  let payload;

  try {
    payload = JSON.parse(messageBuffer.toString("utf-8"));
  } catch (error) {
    return { error: "invalid JSON payload", payload: null };
  }

  const orderId = payload?.order_id;
  const customerId = payload?.customer_id;
  const amount = Number(payload?.amount);
  const currency = String(payload?.currency || "").toUpperCase();
  const method = String(payload?.method || "CARD").toUpperCase();

  if (!orderId || !customerId) {
    return {
      error: "order_id and customer_id are required",
      payload: null
    };
  }

  if (Number.isNaN(amount) || amount <= 0) {
    return {
      error: "amount must be present and greater than 0",
      payload: null
    };
  }

  if (!currency) {
    return {
      error: "currency is required",
      payload: null
    };
  }

  return {
    error: null,
    payload: {
      orderId: String(orderId),
      customerId: String(customerId),
      amount,
      currency,
      method
    }
  };
}

async function persistPaymentFromOrderCreatedEvent(payload) {
  const outcome = determinePaymentOutcome(payload);
  const paymentId = `pay_${randomUUID().replace(/-/g, "").slice(0, 12)}`;
  const transactionRef = `txn_${randomUUID().replace(/-/g, "").slice(0, 12)}`;

  const insertResult = await runQuery(
    `
      INSERT INTO payments (
        payment_id,
        order_id,
        customer_id,
        amount,
        currency,
        method,
        status,
        transaction_ref
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      ON CONFLICT (order_id) DO NOTHING
      RETURNING payment_id, transaction_ref
    `,
    [
      paymentId,
      payload.orderId,
      payload.customerId,
      payload.amount,
      payload.currency,
      payload.method,
      outcome.status,
      transactionRef
    ]
  );

  if (insertResult.rows.length === 0) {
    const existingPaymentResult = await runQuery(
      `
        SELECT payment_id, transaction_ref, status
        FROM payments
        WHERE order_id = $1
        LIMIT 1
      `,
      [payload.orderId]
    );

    return {
      paymentId: existingPaymentResult.rows[0]?.payment_id,
      transactionRef: existingPaymentResult.rows[0]?.transaction_ref,
      status: existingPaymentResult.rows[0]?.status || "UNKNOWN",
      eventType: eventTypeFromPaymentStatus(existingPaymentResult.rows[0]?.status),
      reason: null,
      skipped: true
    };
  }

  return {
    paymentId: insertResult.rows[0].payment_id,
    transactionRef: insertResult.rows[0].transaction_ref,
    status: outcome.status,
    eventType: outcome.eventType,
    reason: outcome.reason,
    skipped: false
  };
}

export async function startOrderCreatedConsumer(rabbitMqConfig) {
  const connection = await amqplib.connect(rabbitMqConfig.url);
  const channel = await connection.createChannel();

  await channel.assertExchange(rabbitMqConfig.exchange, "topic", { durable: true });
  await channel.assertQueue(rabbitMqConfig.orderCreatedQueue, { durable: true });
  await channel.bindQueue(
    rabbitMqConfig.orderCreatedQueue,
    rabbitMqConfig.exchange,
    rabbitMqConfig.orderCreatedRoutingKey
  );

  await channel.consume(rabbitMqConfig.orderCreatedQueue, (message) => {
    if (!message) {
      return;
    }

    try {
      const { error, payload } = parseAndValidateOrderCreatedMessage(message.content);

      if (error) {
        console.warn(
          `[payment-service] skipped ${rabbitMqConfig.orderCreatedRoutingKey}: ${error}`
        );
        channel.ack(message);
        return;
      }

      console.info(
        `[payment-service] consumed ${rabbitMqConfig.orderCreatedRoutingKey} for order_id=${payload.orderId}, customer_id=${payload.customerId}`
      );

      persistPaymentFromOrderCreatedEvent(payload)
        .then(async (result) => {
          if (result.skipped) {
            console.info(
              `[payment-service] duplicate ${rabbitMqConfig.orderCreatedRoutingKey} skipped for order_id=${payload.orderId}; existing payment_id=${result.paymentId}`
            );
          } else {
            console.info(
              `[payment-service] payment persisted from ${rabbitMqConfig.orderCreatedRoutingKey}: payment_id=${result.paymentId}, order_id=${payload.orderId}`
            );

            const eventPayload = {
              order_id: payload.orderId,
              customer_id: payload.customerId,
              payment_id: result.paymentId,
              transaction_ref: result.transactionRef,
              status: result.status
            };

            if (result.reason) {
              eventPayload.reason = result.reason;
            }

            if (result.eventType) {
              await publishPaymentOutcomeEvent(
                rabbitMqConfig,
                result.eventType,
                eventPayload
              );
            }
          }

          if (result.skipped && result.eventType) {
            const duplicateEventPayload = {
              order_id: payload.orderId,
              customer_id: payload.customerId,
              payment_id: result.paymentId,
              transaction_ref: result.transactionRef,
              status: result.status
            };
            await publishPaymentOutcomeEvent(
              rabbitMqConfig,
              result.eventType,
              duplicateEventPayload
            );
          }

          channel.ack(message);
        })
        .catch((error) => {
          console.error("[payment-service] failed to persist payment from order event:", error);

          // Technical persistence failures should be retried by RabbitMQ.
          channel.nack(message, false, true);
        });

      return;
    } catch (error) {
      console.error("[payment-service] order event processing failed:", error);
      channel.ack(message);
    }
  });

  return {
    async stop() {
      await channel.close();
      await connection.close();
    }
  };
}

export {
  determinePaymentOutcome,
  parseAndValidateOrderCreatedMessage,
  persistPaymentFromOrderCreatedEvent
};
