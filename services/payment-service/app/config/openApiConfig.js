import yaml from "yamljs";

export function loadOpenApiDocument() {
  // Keep spec loading isolated so app bootstrap stays minimal.
  return yaml.load("./app/docs/openapi.yaml");
}
