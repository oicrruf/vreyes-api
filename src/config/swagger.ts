import swaggerJsdoc from "swagger-jsdoc";

const options: swaggerJsdoc.Options = {
    definition: {
        openapi: "3.0.0",
        info: {
            title: "Auto Task API Documentation",
            version: "1.0.0",
            description: "Documentación de la API de DTE (Documento Tributario Electrónico) y automatización de tareas.",
        },
        servers: [
            {
                url: "http://localhost:3001",
                description: "Servidor local",
            },
            {
                url: "http://192.168.1.160:3001",
                description: "Servidor NAS",
            },
        ],
    },
    apis: ["./src/app.ts", "./src/modules/*/routes/*.ts"], // Busca comentarios Swagger en estos archivos
};

const swaggerSpec = swaggerJsdoc(options);

export default swaggerSpec;
