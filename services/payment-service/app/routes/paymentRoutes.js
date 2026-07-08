import express from "express";
import {
  createPayment,
  getPaymentById,
  getPaymentsByOrderId,
  listPayments,
  refundPayment
} from "../controllers/paymentController.js";

const router = express.Router();

router.get("/api/v1/payments", listPayments);
router.post("/api/v1/payments", createPayment);
router.get("/api/v1/payments/:paymentId", getPaymentById);
router.get("/api/v1/payments/order/:orderId", getPaymentsByOrderId);
router.post("/api/v1/payments/:paymentId/refund", refundPayment);

export default router;
