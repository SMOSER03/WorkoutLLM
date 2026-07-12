# WorkoutLLM Backend

Backend server for the WorkoutLLM application. It provides the REST API, communicates with the LLM, and stores participant data in a PostgreSQL database.

## Requirements

- Node.js (v18 or newer recommended)
- npm
- PostgreSQL

## Installation

Clone the repository and install the dependencies:

```bash
npm install
```

## Environment Variables

A `.env.example` file is included.

Create a `.env` file in the project root by copying the placeholder:

```bash
cp .env.example .env
```

Fill in all required values, for example:

```env
PORT=3000

API_KEY=your_api_key
LLM_URL=https://your-llm-endpoint

DB_HOST=localhost
DB_PORT=5432
DB_NAME=workoutllm
DB_USER=postgres
DB_PASSWORD=your_password
```

## Database Setup

Create a PostgreSQL database:

```bash
createdb workoutllm
psql -U postgres -d workoutllm -f schema.sql
```

Update the database credentials in your `.env` file accordingly.

## Running the Server

Start the backend with:

```bash
npx ts-node src/server.ts
```

The server will start on:

```
http://localhost:3000
```

(or the port specified in your `.env` file).

## Project Overview

The backend provides endpoints for:

- Chat communication with the LLM
- Participant management
- Message storage
- Token usage tracking
- Time tracking for different experiment modes

Data is stored in PostgreSQL while LLM requests are forwarded to the configured API endpoint.

## Notes

- Ensure PostgreSQL is running before starting the server.
- Make sure all environment variables are configured correctly.
- The frontend is configured to connect to `http://localhost:3000` by default.