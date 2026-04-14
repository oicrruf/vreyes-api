import express from "express";
import { setCurrentMonthEmailRoutes } from "./modules/dte/routes/currentMonthEmailRoutes";

const app = express();
const port = process.env.PORT || 3001;

// Middleware
app.use(express.json());

// Initialize modules
setCurrentMonthEmailRoutes(app);

// Start server
app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
