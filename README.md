# Auto Task Application

## Project Structure

```
auto-task/
├── logs/
│   └── dte/                          # Module-specific logs
│       └── YYYY/                     # Year folder (e.g., 2023)
│           └── MM/                   # Month folder (e.g., 01 for January)
│               └── YYYY-MM-DD.log    # Log file for specific date
├── scripts/
│   └── commit/
│       └── generate-commit.js        # Script for generating conventional commits
├── src/
│   └── modules/
│       └── dte/
│           ├── cronjobs/
│           │   ├── emailFetcher.ts   # Scheduled job for fetching emails
│           │   └── dteSender.ts      # Scheduled job for sending DTE files
│           ├── routes/
│           │   ├── emailRoutes.ts    # Main route handler
│           │   ├── currentMonthEmailRoutes.ts  # Endpoint for current month emails
│           │   └── emailAttachmentsRoutes.ts   # Endpoint for sending attachments
│           ├── services/
│           │   ├── gmailService.ts   # Service for interacting with Gmail
│           │   └── emailService.ts   # Service for email operations
│           └── utils/
│               ├── fileUtils.ts      # Utilities for file operations
│               └── logUtils.ts       # Utilities for logging
└── attachments/
    └── YYYY/                         # Year folder (e.g., 2023)
        └── MM/                       # Month folder (e.g., 01 for January)
            ├── *.json                # JSON attachments
            └── *.pdf                 # PDF attachments
```

## Setup Instructions

1. **Clone the repository:**

   ```
   git clone <repository-url>
   cd auto-task
   ```

2. **Install dependencies:**

   ```
   npm install
   ```

3. **Set up environment variables:**
   Create a `.env` file in the root directory and add your Gmail credentials:

   ```
   GMAIL_USER=your_email@gmail.com
   GMAIL_PASS=your_app_password
   ```

4. **Run the application:**
   ```
   npm start
   ```

## Usage

Once the application is running, it will connect to your Gmail account and check for emails with the subject "credito fiscal" for the current month. Any PDF attachments will be downloaded to the following directory structure:

```
(year)/(current month)
```

Make sure to replace `your_email@gmail.com` and `your_app_password` with your actual Gmail email and application password.

## Environment Variables

The application uses the following environment variables:

| Variable        | Description                              | Default |
| --------------- | ---------------------------------------- | ------- |
| RECIPIENT_EMAIL | Comma-separated list of email recipients | -       |
| RECEPTOR_NRC    | NRC code used to filter JSON documents   | -       |

Make sure to set these environment variables in your deployment environment or .env file.

```bash
# Example .env file
RECIPIENT_EMAIL=user1@example.com,user2@example.com
RECEPTOR_NRC=9999999
```

## Logging

The application logs important operations to date-based log files. Logs are organized by:

- Module (automatically detected from the source file path)
- Year
- Month
- Day

Log files are stored at: `/logs/[module-name]/YYYY/MM/YYYY-MM-DD.log`

For example:

- `/logs/dte/2023/05/2023-05-15.log` (logs from the DTE module)
- `/logs/auth/2023/05/2023-05-15.log` (logs from the Auth module)

Each log entry includes:

- Timestamp (ISO format)
- Log level (INFO, ERROR, DEBUG)
- Module name
- Message content

This structure makes it easy to track activity for specific components and dates.

## License

This project is licensed under the MIT License.
