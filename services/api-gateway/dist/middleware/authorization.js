export function requireRole(...allowedRoles) {
    return (request, response, next) => {
        if (!request.user) {
            response.status(401).json({
                error: {
                    code: "AUTH_REQUIRED",
                    message: "Authentication is required"
                }
            });
            return;
        }
        const hasRole = request.user.roles.some((role) => allowedRoles.includes(role));
        if (!hasRole) {
            response.status(403).json({
                error: {
                    code: "INSUFFICIENT_PERMISSIONS",
                    message: `This action requires one of the following roles: ${allowedRoles.join(", ")}`
                },
                requiredRoles: allowedRoles,
                userRoles: request.user.roles
            });
            return;
        }
        next();
    };
}
