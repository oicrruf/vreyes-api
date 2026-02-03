import cron from "node-cron";
import axios from "axios";
import dotenv from "dotenv";

dotenv.config();

const API_URL = process.env.API_URL || "http://localhost:3001";
// Array para mantener referencia a los jobs activos
const activeJobs: ReturnType<typeof cron.schedule>[] = [];
// Configura explícitamente la zona horaria
const TIMEZONE = process.env.TIMEZONE || "America/El_Salvador";

// Función de utilidad para registros con zona horaria correcta
const logWithTimestamp = (message: string): void => {
  // Usa Intl.DateTimeFormat para formatear la fecha según la zona horaria de El Salvador
  const timeInLocalZone = new Intl.DateTimeFormat("es-SV", {
    timeZone: TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(new Date());

  console.log(`[${timeInLocalZone}] ${message}`);
};

export const initializeCronJobs = (): void => {
  logWithTimestamp("Initializing cron jobs...");

  try {
    // Current month email fetcher - runs at 11:59 PM every day
    const dailyJob = cron.schedule(
      "59 23 * * *",
      async () => {
        try {
          logWithTimestamp("Making request to /api/emails/current-month...");
          const response = await axios.post(
            `${API_URL}/api/emails/current-month`
          );
          logWithTimestamp(`Request completed with status: ${response.status}`);
          logWithTimestamp(`Processed ${response.data.totalFiltered} emails.`);
        } catch (error: any) {
          logWithTimestamp(`Error fetching emails: ${error.message}`);
          if (error.response) {
            logWithTimestamp(`Response status: ${error.response.status}`);
            logWithTimestamp(
              `Response data: ${JSON.stringify(error.response.data)}`
            );
          }
        }
      },
      {
        scheduled: true,
        timezone: TIMEZONE,
      }
    );
    activeJobs.push(dailyJob);
    logWithTimestamp("Daily email fetcher job initialized");

    // DTE email sender - runs at 7:00 AM on the 1st day of every month
    const monthlyJob = cron.schedule(
      "0 7 1 * *",
      async () => {
        try {
          logWithTimestamp("Making request to /api/attachments/dte/email...");

          // Parse comma-separated email addresses
          const recipientEmails = process.env.RECIPIENT_EMAIL
            ? process.env.RECIPIENT_EMAIL.split(",").map((email) =>
              email.trim()
            )
            : ["default@example.com"];

          const body = {
            email: recipientEmails,
          };

          const response = await axios.post(
            `${API_URL}/api/attachments/dte/email`,
            body
          );
          logWithTimestamp(`Request completed with status: ${response.status}`);
          logWithTimestamp(
            `Sent ${response.data.sentFiles?.length || 0} files via email.`
          );
        } catch (error: any) {
          logWithTimestamp(`Error sending DTE email: ${error.message}`);

          if (error.response) {
            logWithTimestamp(`Response status: ${error.response.status}`);
            logWithTimestamp(
              `Response data: ${JSON.stringify(error.response.data)}`
            );
          }
        }
      },
      {
        scheduled: true,
        timezone: TIMEZONE,
      }
    );
    activeJobs.push(monthlyJob);
    logWithTimestamp("Monthly DTE email sender job initialized");

    // // Job de keepalive cada 6 horas, con énfasis en horas críticas
    // const keepaliveJob = cron.schedule(
    //   "0 */6 * * *",
    //   () => {
    //     logWithTimestamp("Keepalive check - cron jobs are running");

    //     // Verificar estado de los jobs y reiniciarlos para asegurar funcionamiento
    //     activeJobs.forEach((job, index) => {
    //       try {
    //         // Restart anyway to ensure it's running
    //         job.stop();
    //         job.start();
    //         logWithTimestamp(`Job #${index} restarted successfully`);
    //       } catch (error) {
    //         logWithTimestamp(`Error restarting job #${index}: ${error}`);
    //       }
    //     });
    //   },
    //   {
    //     scheduled: true,
    //     timezone: TIMEZONE,
    //   }
    // );
    // activeJobs.push(keepaliveJob);

    // // Keepalive adicional para periodo crítico nocturno (11pm-1am)
    // const nightCriticalKeepalive = cron.schedule(
    //   "0 23,0,1 * * *",
    //   () => {
    //     logWithTimestamp(
    //       "Critical night period keepalive check - ensuring jobs are running"
    //     );
    //     activeJobs.forEach((job, index) => {
    //       try {
    //         // Just restart to ensure it's running
    //         job.start();
    //         logWithTimestamp(`Critical time: Job #${index} ensured active`);
    //       } catch (error) {
    //         logWithTimestamp(
    //           `Critical time: Error ensuring job #${index}: ${error}`
    //         );
    //       }
    //     });
    //   },
    //   {
    //     scheduled: true,
    //     timezone: TIMEZONE,
    //   }
    // );
    // activeJobs.push(nightCriticalKeepalive);

    // // Keepalive adicional para periodo crítico del primer día del mes (7am-9am)
    // const monthlyKeepalive = cron.schedule(
    //   "0 7,8,9 1 * *",
    //   () => {
    //     logWithTimestamp(
    //       "Critical first-of-month morning period keepalive check"
    //     );
    //     activeJobs.forEach((job, index) => {
    //       try {
    //         // Just restart to ensure it's running
    //         job.start();
    //         logWithTimestamp(`Critical time: Job #${index} ensured active`);
    //       } catch (error) {
    //         logWithTimestamp(
    //           `Critical time: Error ensuring job #${index}: ${error}`
    //         );
    //       }
    //     });
    //   },
    //   {
    //     scheduled: true,
    //     timezone: TIMEZONE,
    //   }
    // );
    // activeJobs.push(monthlyKeepalive);

    // logWithTimestamp(
    //   "Keepalive jobs initialized with 6-hour intervals and critical time coverage"
    // );

    logWithTimestamp(
      `All cron jobs initialized successfully in timezone: ${TIMEZONE}`
    );
    logWithTimestamp(`Total active jobs: ${activeJobs.length}`);
  } catch (error: any) {
    logWithTimestamp(`Critical error initializing cron jobs: ${error.message}`);
    logWithTimestamp(`Stack trace: ${error.stack}`);
    // Intentar recuperarse
    setTimeout(() => {
      logWithTimestamp("Attempting to re-initialize cron jobs...");
      initializeCronJobs();
    }, 60000); // Reintentar después de 1 minuto
  }
};

// Función para detener todos los jobs (útil para pruebas o reinicio controlado)
export const stopAllJobs = (): void => {
  logWithTimestamp("Stopping all cron jobs...");
  activeJobs.forEach((job, index) => {
    job.stop();
    logWithTimestamp(`Job #${index} stopped`);
  });
  activeJobs.length = 0;
  logWithTimestamp("All cron jobs stopped");
};
