import { Express } from "express";
import { setCurrentMonthEmailRoutes } from "./currentMonthEmailRoutes";
import { setEmailAttachmentsRoutes } from "./emailAttachmentsRoutes";
import { setDteFilesRoutes } from "./dteFilesRoutes";

export function setDteRoutes(app: Express) {
  // Set up routes from separated files
  setCurrentMonthEmailRoutes(app);
  setEmailAttachmentsRoutes(app);
  setDteFilesRoutes(app);
}
