import fs from "fs";
import path from "path";

/**
 * Get the module name from the call stack
 * @returns Module name derived from the file path
 */
function getModuleNameFromCallStack(): string {
  // Create an error to capture the stack trace
  const stack = new Error().stack;

  if (!stack) return "unknown";

  // Get the caller's file path from the stack trace
  const callerLine = stack.split("\n")[3]; // Index 3 is typically the caller (0=Error, 1=getModuleNameFromCallStack, 2=logToFile)

  if (!callerLine) return "unknown";

  // Extract the file path from the stack trace line
  const match =
    callerLine.match(/\(([^)]+)\)/) || callerLine.match(/at\s+(.+):\d+:\d+/);
  const filePath = match ? match[1] : "";

  if (!filePath) return "unknown";

  // Look for a pattern like /modules/[module-name]/ in the path
  const moduleMatch = filePath.match(/\/modules\/([^\/]+)\//);

  return moduleMatch ? moduleMatch[1] : "app";
}

/**
 * Log a message to a date-based log file
 * @param message The message to log
 * @param type The type of log (info, error, etc.)
 */
export const logToFile = (
  message: any,
  type: "info" | "error" | "debug" = "info"
): void => {
  try {
    // Automatically determine the module name from the call stack
    const module = getModuleNameFromCallStack();

    const now = new Date();
    const year = now.getFullYear();
    const month = (now.getMonth() + 1).toString().padStart(2, "0");
    const day = now.getDate().toString().padStart(2, "0");

    // Create the log directory path: logs/module/year/month
    const logDir = path.join("logs", module, year.toString(), month);

    // Ensure the directory exists
    fs.mkdirSync(logDir, { recursive: true });

    // Create the log file path: logs/module/year/month/year-month-day.log
    const logFile = path.join(logDir, `${year}-${month}-${day}.log`);

    // Format the message
    const timestamp = now.toISOString();
    let logMessage = "";

    if (typeof message === "string") {
      logMessage = `[${timestamp}] [${type.toUpperCase()}] [${module}] ${message}\n`;
    } else {
      logMessage = `[${timestamp}] [${type.toUpperCase()}] [${module}] ${JSON.stringify(
        message,
        null,
        2
      )}\n`;
    }

    // Append to the log file
    fs.appendFileSync(logFile, logMessage);
  } catch (err) {
    // Fall back to console if there's an error with file logging
    console.error("Error writing to log file:", err);
    console.log(message);
  }
};
