import { Express, RequestHandler } from "express";
import fs from "fs";
import path from "path";
import { logToFile } from "../utils/logUtils";

export function setDteFilesRoutes(app: Express) {
    /**
     * @swagger
     * /api/dte/{year}/{month}/{type}:
     *   get:
     *     summary: Lista los archivos DTE por año, mes y tipo (compras/ventas).
     *     tags: [DTE Files]
     *     parameters:
     *       - in: path
     *         name: year
     *         required: true
     *         schema:
     *           type: string
     *         description: Año de consulta (ej. 2026).
     *       - in: path
     *         name: month
     *         required: true
     *         schema:
     *           type: string
     *         description: Mes de consulta (ej. 01 o 1).
     *       - in: path
     *         name: type
     *         required: true
     *         schema:
     *           type: string
     *           enum: [compras, ventas]
     *         description: Tipo de registro (compras o ventas).
     *     responses:
     *       200:
     *         description: Lista de archivos recuperada con éxito.
     *       400:
     *         description: Parámetros inválidos.
     *       404:
     *         description: El directorio solicitado no existe.
     *       500:
     *         description: Error interno del servidor.
     */
    app.get("/api/dte/:year/:month/:type", (async (req, res) => {
        try {
            const year = req.params.year as string;
            const month = req.params.month as string;
            const type = req.params.type as string;

            // Validación básica del tipo
            if (type !== 'compras' && type !== 'ventas') {
                return res.status(400).json({
                    success: false,
                    error: "El parámetro 'type' debe ser 'compras' o 'ventas'."
                });
            }

            // Normalizar mes a dos dígitos
            const formattedMonth = month.padStart(2, "0");

            // Construir ruta base
            const basePath = process.env.ATTACHMENTS_PATH || "./attachments";
            const dirPath = path.join(basePath, year, formattedMonth, type);

            // Verificar si el directorio existe
            if (!fs.existsSync(dirPath)) {
                logToFile(`Directorio no encontrado: ${dirPath}`, "error");
                return res.status(404).json({
                    success: false,
                    error: `No se encontraron archivos para ${year}/${formattedMonth} en ${type}.`,
                    path: dirPath
                });
            }

            // Leer archivos y metadata básica
            const files = fs.readdirSync(dirPath).map(file => {
                const stats = fs.statSync(path.join(dirPath, file));
                return {
                    filename: file,
                    size: stats.size,
                    mtime: stats.mtime,
                    extension: path.extname(file).replace(".", "").toLowerCase()
                };
            });

            res.status(200).json({
                success: true,
                period: `${year}-${formattedMonth}`,
                type,
                count: files.length,
                files
            });

        } catch (error: any) {
            logToFile(`Error en GET /api/dte: ${error.message}`, "error");
            res.status(500).json({
                success: false,
                error: "Error interno al listar archivos."
            });
        }
    }) as RequestHandler);
}
