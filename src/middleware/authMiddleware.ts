import { Request, Response, NextFunction } from "express";

export const authMiddleware = (req: Request, res: Response, next: NextFunction) => {
  const apiKey = req.headers["x-api-key"];

  if (!apiKey) {
    return res.status(401).json({
      success: false,
      error: "Authentication required. Missing x-api-key header.",
    });
  }

  const validApiKey = process.env.API_KEY;

  // Si no se configuró API_KEY en el entorno, bloquear todas las peticiones por seguridad,
  // a menos que se quiera otro comportamiento (como permitir libre acceso).
  if (!validApiKey) {
    console.error("CRITICAL: API_KEY environment variable is not configured.");
    return res.status(500).json({
      success: false,
      error: "Server configuration error. API Key not configured.",
    });
  }

  if (apiKey !== validApiKey) {
    return res.status(403).json({
      success: false,
      error: "Invalid API key.",
    });
  }

  next();
};
