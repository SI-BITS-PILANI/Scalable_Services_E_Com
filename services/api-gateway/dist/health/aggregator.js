import axios from "axios";
import { config } from "../config.js";
/**
 * Check health of a single downstream service with timeout
 */
async function checkServiceHealth(serviceName, baseUrl, timeoutMs = 5000) {
    const startTime = Date.now();
    try {
        const response = await axios.get(`${baseUrl}/health`, {
            timeout: timeoutMs,
            validateStatus: () => true // Accept any status code
        });
        const latencyMs = Date.now() - startTime;
        if (response.status === 200) {
            return {
                status: "ok",
                latencyMs
            };
        }
        else {
            return {
                status: "down",
                latencyMs,
                error: `HTTP ${response.status}`
            };
        }
    }
    catch (error) {
        const latencyMs = Date.now() - startTime;
        return {
            status: "down",
            latencyMs,
            error: error.message || "Unknown error"
        };
    }
}
/**
 * Aggregate health status from all downstream services
 */
export async function getAggregatedHealth() {
    // Fan-out calls to all three services in parallel
    const [catalogHealth, orderHealth, paymentHealth] = await Promise.all([
        checkServiceHealth("catalog", config.CATALOG_BASE_URL),
        checkServiceHealth("order", config.ORDER_BASE_URL),
        checkServiceHealth("payment", config.PAYMENT_BASE_URL)
    ]);
    // Determine overall status
    const allHealthy = catalogHealth.status === "ok" &&
        orderHealth.status === "ok" &&
        paymentHealth.status === "ok";
    const anyDown = catalogHealth.status === "down" ||
        orderHealth.status === "down" ||
        paymentHealth.status === "down";
    const overallStatus = allHealthy
        ? "ok"
        : anyDown
            ? "degraded"
            : "ok";
    return {
        overall: overallStatus,
        timestamp: new Date().toISOString(),
        services: {
            catalog: catalogHealth,
            order: orderHealth,
            payment: paymentHealth
        }
    };
}
