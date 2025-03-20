# Auto Task Email Downloader

This project is an Express application that connects to a Gmail account using the POP protocol to fetch emails. It specifically looks for emails from the current month that have the subject containing "credito fiscal" (case insensitive) and downloads any attached PDF files to a specified directory structure.

## Project Structure

```
auto-task
├── src
│   ├── app.ts                # Entry point of the application
│   ├── controllers
│   │   └── emailController.ts # Handles email processing logic
│   ├── routes
│   │   └── emailRoutes.ts     # Defines application routes
│   └── utils
│       └── popClient.ts       # Manages POP client connection and email fetching
├── .env                       # Environment variables for Gmail authentication
├── package.json               # NPM package configuration
├── tsconfig.json              # TypeScript configuration
└── README.md                  # Project documentation
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

## License

This project is licensed under the MIT License.
