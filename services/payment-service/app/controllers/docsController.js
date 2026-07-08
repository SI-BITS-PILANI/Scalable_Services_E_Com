export function getDocsJson(openApiDocument) {
  return (request, response) => {
    try {
      response.status(200).json(openApiDocument);
    } catch (error) {
      response.status(500).json({
        error: {
          code: "SWAGGER_DOCS_FAILED",
          message: "Unable to load OpenAPI document"
        }
      });
    }
  };
}
