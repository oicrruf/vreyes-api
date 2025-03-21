import { Express } from "express";
import { setCurrentMonthEmailRoutes } from "./currentMonthEmailRoutes";
import { setEmailAttachmentsRoutes } from "./emailAttachmentsRoutes";

export function setDteRoutes(app: Express) {
  // Set up routes from separated files
  setCurrentMonthEmailRoutes(app);
  setEmailAttachmentsRoutes(app);
}
