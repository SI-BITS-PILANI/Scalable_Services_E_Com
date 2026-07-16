import { randomUUID } from "node:crypto";
import { runQuery } from "../database.js";
import { mapPaymentRow, mapPaymentRowV2 } from "../utils/paymentMapper.js";
import { validateCreatePaymentPayload } from "../utils/paymentValidators.js";

export async function listPayments(request, response) {
  try {
    const queryResult = await runQuery(
      `
        SELECT payment_id, order_id, customer_id, amount, currency, method, status, transaction_ref, created_at, updated_at
        FROM payments
        ORDER BY created_at DESC
      `
    );

    response.status(200).json({
      count: queryResult.rows.length,
      payments: queryResult.rows.map(mapPaymentRow)
    });
  } catch (error) {
    response.status(500).json({
      error: {
        code: "PAYMENT_ROUTE_FAILED",
        message: "Failed to fetch payments"
      }
    });
  }
}

export async function createPayment(request, response) {
  try {
    const validationError = validateCreatePaymentPayload(request.body);

    if (validationError) {
      response.status(400).json({
        error: {
          code: "PAYMENT_VALIDATION_FAILED",
          message: validationError
        }
      });
      return;
    }

    const paymentId = `pay_${randomUUID().replace(/-/g, "").slice(0, 12)}`;
    const transactionRef = `txn_${randomUUID().replace(/-/g, "").slice(0, 12)}`;

    const queryResult = await runQuery(
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
        RETURNING payment_id, order_id, customer_id, amount, currency, method, status, transaction_ref, created_at, updated_at
      `,
      [
        paymentId,
        request.body.orderId,
        request.body.customerId,
        Number(request.body.amount),
        String(request.body.currency).toUpperCase(),
        String(request.body.method).toUpperCase(),
        "SUCCEEDED",
        transactionRef
      ]
    );

    response.status(201).json(mapPaymentRow(queryResult.rows[0]));
  } catch (error) {
    response.status(500).json({
      error: {
        code: "PAYMENT_CREATE_FAILED",
        message: "Failed to create payment"
      }
    });
  }
}

export async function getPaymentById(request, response) {
  try {
    const queryResult = await runQuery(
      `
        SELECT payment_id, order_id, customer_id, amount, currency, method, status, transaction_ref, created_at, updated_at
        FROM payments
        WHERE payment_id = $1
      `,
      [request.params.paymentId]
    );

    if (queryResult.rows.length === 0) {
      response.status(404).json({
        error: {
          code: "PAYMENT_NOT_FOUND",
          message: "Payment was not found"
        }
      });
      return;
    }

    response.status(200).json(mapPaymentRow(queryResult.rows[0]));
  } catch (error) {
    response.status(500).json({
      error: {
        code: "PAYMENT_FETCH_FAILED",
        message: "Failed to fetch payment by id"
      }
    });
  }
}

export async function getPaymentsByOrderId(request, response) {
  try {
    const queryResult = await runQuery(
      `
        SELECT payment_id, order_id, customer_id, amount, currency, method, status, transaction_ref, created_at, updated_at
        FROM payments
        WHERE order_id = $1
        ORDER BY updated_at DESC
      `,
      [request.params.orderId]
    );

    if (queryResult.rows.length === 0) {
      response.status(404).json({
        error: {
          code: "PAYMENT_NOT_FOUND",
          message: "Payment for order was not found"
        }
      });
      return;
    }

    response.status(200).json({
      count: queryResult.rows.length,
      payments: queryResult.rows.map(mapPaymentRow)
    });
  } catch (error) {
    response.status(500).json({
      error: {
        code: "PAYMENT_FETCH_FAILED",
        message: "Failed to fetch payment by order id"
      }
    });
  }
}

export async function refundPayment(request, response) {
  try {
    const existingPaymentResult = await runQuery(
      `
        SELECT payment_id, order_id, customer_id, amount, currency, method, status, transaction_ref, created_at, updated_at
        FROM payments
        WHERE payment_id = $1
      `,
      [request.params.paymentId]
    );

    if (existingPaymentResult.rows.length === 0) {
      response.status(404).json({
        error: {
          code: "PAYMENT_NOT_FOUND",
          message: "Payment was not found"
        }
      });
      return;
    }

    const currentPayment = existingPaymentResult.rows[0];

    if (currentPayment.status !== "SUCCEEDED") {
      response.status(409).json({
        error: {
          code: "REFUND_NOT_ALLOWED",
          message: "Refund is allowed only for SUCCEEDED payments"
        },
        currentStatus: currentPayment.status
      });
      return;
    }

    const updatedPaymentResult = await runQuery(
      `
        UPDATE payments
        SET status = $2,
            updated_at = NOW()
        WHERE payment_id = $1
        RETURNING payment_id, order_id, customer_id, amount, currency, method, status, transaction_ref, created_at, updated_at
      `,
      [request.params.paymentId, "REFUNDED"]
    );

    response.status(200).json(mapPaymentRow(updatedPaymentResult.rows[0]));
  } catch (error) {
    response.status(500).json({
      error: {
        code: "PAYMENT_REFUND_FAILED",
        message: "Failed to refund payment"
      }
    });
  }
}

// ============= v2 API endpoints (non-breaking, includes fee calculations) =============

export async function listPaymentsV2(request, response) {
  try {
    const queryResult = await runQuery(
      `
        SELECT payment_id, order_id, customer_id, amount, currency, method, status, transaction_ref, created_at, updated_at
        FROM payments
        ORDER BY created_at DESC
      `
    );

    response.status(200).json({
      count: queryResult.rows.length,
      apiVersion: "2.0",
      payments: queryResult.rows.map(mapPaymentRowV2)
    });
  } catch (error) {
    response.status(500).json({
      error: {
        code: "PAYMENT_ROUTE_FAILED",
        message: "Failed to fetch payments"
      }
    });
  }
}

export async function createPaymentV2(request, response) {
  try {
    const validationError = validateCreatePaymentPayload(request.body);

    if (validationError) {
      response.status(400).json({
        error: {
          code: "PAYMENT_VALIDATION_FAILED",
          message: validationError
        }
      });
      return;
    }

    const paymentId = `pay_${randomUUID().replace(/-/g, "").slice(0, 12)}`;
    const transactionRef = `txn_${randomUUID().replace(/-/g, "").slice(0, 12)}`;

    const queryResult = await runQuery(
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
        RETURNING payment_id, order_id, customer_id, amount, currency, method, status, transaction_ref, created_at, updated_at
      `,
      [
        paymentId,
        request.body.orderId,
        request.body.customerId,
        Number(request.body.amount),
        String(request.body.currency).toUpperCase(),
        String(request.body.method).toUpperCase(),
        "SUCCEEDED",
        transactionRef
      ]
    );

    response.status(201).json(mapPaymentRowV2(queryResult.rows[0]));
  } catch (error) {
    response.status(500).json({
      error: {
        code: "PAYMENT_CREATE_FAILED",
        message: "Failed to create payment"
      }
    });
  }
}

export async function getPaymentByIdV2(request, response) {
  try {
    const queryResult = await runQuery(
      `
        SELECT payment_id, order_id, customer_id, amount, currency, method, status, transaction_ref, created_at, updated_at
        FROM payments
        WHERE payment_id = $1
      `,
      [request.params.paymentId]
    );

    if (queryResult.rows.length === 0) {
      response.status(404).json({
        error: {
          code: "PAYMENT_NOT_FOUND",
          message: "Payment was not found"
        }
      });
      return;
    }

    response.status(200).json(mapPaymentRowV2(queryResult.rows[0]));
  } catch (error) {
    response.status(500).json({
      error: {
        code: "PAYMENT_FETCH_FAILED",
        message: "Failed to fetch payment by id"
      }
    });
  }
}

export async function getPaymentsByOrderIdV2(request, response) {
  try {
    const queryResult = await runQuery(
      `
        SELECT payment_id, order_id, customer_id, amount, currency, method, status, transaction_ref, created_at, updated_at
        FROM payments
        WHERE order_id = $1
        ORDER BY updated_at DESC
      `,
      [request.params.orderId]
    );

    if (queryResult.rows.length === 0) {
      response.status(404).json({
        error: {
          code: "PAYMENT_NOT_FOUND",
          message: "Payment for order was not found"
        }
      });
      return;
    }

    response.status(200).json({
      count: queryResult.rows.length,
      apiVersion: "2.0",
      payments: queryResult.rows.map(mapPaymentRowV2)
    });
  } catch (error) {
    response.status(500).json({
      error: {
        code: "PAYMENT_FETCH_FAILED",
        message: "Failed to fetch payment by order id"
      }
    });
  }
}
