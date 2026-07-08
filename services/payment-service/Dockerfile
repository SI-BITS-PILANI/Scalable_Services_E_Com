# Use a small official Node.js image for predictable builds and smaller attack surface.
FROM node:20-alpine

# Keep all service files inside /usr/src/app in the container.
WORKDIR /usr/src/app

# Copy dependency manifests first so Docker can cache npm install layers.
COPY package.json package-lock.json* ./

# Install only production dependencies for runtime image efficiency.
RUN npm ci --omit=dev

# Copy service source code after dependencies are installed.
COPY . .

# Service runtime defaults.
ENV NODE_ENV=production
ENV PORT=8003

# Document the listening port for local/container runtime.
EXPOSE 8003

# Start the payment service.
CMD ["node", "app/main.js"]
