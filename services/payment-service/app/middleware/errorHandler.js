export function globalErrorHandler(error, request, response, next) {
  try {
    response.status(500).json({
      error: {
        code: "INTERNAL_SERVER_ERROR",
        message: error?.message || "Unexpected server error"
      }
    });
  } catch (handlerError) {
    response.status(500).end();
  }
}
