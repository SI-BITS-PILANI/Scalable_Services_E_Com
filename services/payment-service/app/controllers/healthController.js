import { checkDatabaseHealth } from "../database.js";

export async function getHealth(request, response) {
  try {
    await checkDatabaseHealth();

    response.status(200).json({
      service: "payment-service",
      status: "ok",
      database: "ok",
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    response.status(500).json({
      error: {
        code: "HEALTH_CHECK_FAILED",
        message: "Database connectivity check failed"
      }
    });
  }
}
