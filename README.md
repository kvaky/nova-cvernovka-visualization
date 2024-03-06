# Finance flow visualizer

![alt text](preview.png)

## Description
Web application built with Node.js that displays a sankey diagram from Google Sheets data. For each sheet in a spreadsheet, there is a separate diagram accessible through a dropdown.

## Data preparation

- Fill (potentially multiple) google sheets with data in the following format (leave first row for column names):
  - Column A: Source
  - Column B: Target
  - Column C: Value

![example data](data.png)

- Create a sheet called `allowed_google_users` with emails of users who should have access to the application.
![Example users with access](users.png)

## Installation
1. Install dependencies using `npm install`
1. Set the following environment variables:
   - `PORT=80`
   - `GOOGLE_CLIENT_ID=your_google_client_id`
   - `GOOGLE_CLIENT_SECRET=your_google_client_secret`
   - `GOOGLE_SHEETS_API_KEY=your_google_sheets_api_key`
   - `EXPRESS_SESSION_SECRET=your_session_secret` (anything)
   - `SPREADSHEET_ID=your_spreadsheet_id`
1. Run the application using `npm start`

## Usage
- Access the application at `localhost`
- Authenticate using your Google account
- Upon successful authentication, you will be able to view the sankey diagram from the Google Sheets data
