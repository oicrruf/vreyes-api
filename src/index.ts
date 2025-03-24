import express from "express";
import { setCurrentMonthEmailRoutes } from "./modules/dte/routes/currentMonthEmailRoutes";
import { initializeClienteModule } from "./modules/cliente";

const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(express.json());

// Initialize modules
setCurrentMonthEmailRoutes(app);
initializeClienteModule(app);

// Start server
app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
