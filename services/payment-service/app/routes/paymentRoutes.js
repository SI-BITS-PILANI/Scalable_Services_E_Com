import express from "express";
import {
  createPayment,
  getPaymentById,
  getPaymentsByOrderId,
  listPayments,
  refundPayment,
  createPaymentV2,
  getPaymentByIdV2,
  getPaymentsByOrderIdV2,
  listPaymentsV2
} from "../controllers/paymentController.js";

const router = express.Router();

// v1 endpoints (baseline)
router.get("/api/v1/payments", listPayments);
router.post("/api/v1/payments", createPayment);
router.get("/api/v1/payments/:paymentId", getPaymentById);
router.get("/api/v1/payments/order/:orderId", getPaymentsByOrderId);
router.post("/api/v1/payments/:paymentId/refund", refundPayment);

// v2 endpoints (non-breaking, adds processingFee, totalAmount, feeDescription, serviceVersion)
router.get("/api/v2/payments", listPaymentsV2);
router.post("/api/v2/payments", createPaymentV2);
router.get("/api/v2/payments/:paymentId", getPaymentByIdV2);
router.get("/api/v2/payments/order/:orderId", getPaymentsByOrderIdV2);

export default router;
