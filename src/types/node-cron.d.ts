declare module "node-cron" {
  /**
   * Schedules the execution of a task
   * @param expression The crontab expression
   * @param func The function to be executed
   * @param options Options for scheduling the task
   */
  export function schedule(
    expression: string,
    func: Function,
    options?: {
      scheduled?: boolean;
      timezone?: string;
      name?: string;
    }
  ): ScheduledTask;

  export interface ScheduledTask {
    start: () => void;
    stop: () => void;
    getStatus: () => string;
  }

  export function validate(expression: string): boolean;
}
