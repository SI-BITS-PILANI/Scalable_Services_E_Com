import amqplib from "amqplib";
import { randomUUID } from "node:crypto";
import { runQuery } from "../database.js";

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
  const existingPaymentResult = await runQuery(
    `
      SELECT payment_id, transaction_ref
      FROM payments
      WHERE order_id = $1
      ORDER BY created_at DESC
      LIMIT 1
    `,
    [payload.orderId]
  );

  if (existingPaymentResult.rows.length > 0) {
    return {
      paymentId: existingPaymentResult.rows[0].payment_id,
      transactionRef: existingPaymentResult.rows[0].transaction_ref,
      skipped: true
    };
  }

  const paymentId = `pay_${randomUUID().replace(/-/g, "").slice(0, 12)}`;
  const transactionRef = `txn_${randomUUID().replace(/-/g, "").slice(0, 12)}`;

  await runQuery(
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
    `,
    [
      paymentId,
      payload.orderId,
      payload.customerId,
      payload.amount,
      payload.currency,
      payload.method,
      "SUCCEEDED",
      transactionRef
    ]
  );

  return {
    paymentId,
    transactionRef,
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
        .then((result) => {
          if (result.skipped) {
            console.info(
              `[payment-service] duplicate ${rabbitMqConfig.orderCreatedRoutingKey} skipped for order_id=${payload.orderId}; existing payment_id=${result.paymentId}`
            );
          } else {
            console.info(
              `[payment-service] payment persisted from ${rabbitMqConfig.orderCreatedRoutingKey}: payment_id=${result.paymentId}, order_id=${payload.orderId}`
            );
          }
          channel.ack(message);
        })
        .catch((error) => {
          console.error("[payment-service] failed to persist payment from order event:", error);
          channel.ack(message);
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

export { parseAndValidateOrderCreatedMessage, persistPaymentFromOrderCreatedEvent };
