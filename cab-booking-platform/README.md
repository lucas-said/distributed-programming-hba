# Cab Booking Platform

A distributed cab booking platform built for **ITSFT-606-2101 Distributed Programming**.

## Architecture

- **Microservices Architecture** — Each business capability is isolated as its own Node.js service with its own database collection.
- **Event-Driven Architecture** — Services communicate asynchronously via RabbitMQ for cross-cutting workflows (cab-ready notifications, discount eligibility).
- **API Gateway** — A single entry point that routes requests from the React frontend to the appropriate microservice.

## Services

| Service   | Port | Responsibility                                        |
|-----------|------|-------------------------------------------------------|
| customer  | 4001 | Account registration, login, notifications inbox     |
| booking   | 4002 | Create / list cab bookings                            |
| payment   | 4003 | Fare calculation, payment processing, payment history |
| fare      | 4004 | External taxi-fare API wrapper                        |
| location  | 4005 | Saved pickup locations + weather forecast wrapper     |
| gateway   | 4000 | Single entry point for the frontend (added later)     |

## Getting started

```bash
# 1. Install everything (npm workspaces hoists deps)
npm install

# 2. Create a .env file in each service folder (see services/<name>/.env.example)

# 3. Run a service in watch mode
npm run dev:customer
```

## Tech stack

- Node.js 20+, Express
- MongoDB (Mongoose) on MongoDB Atlas
- RabbitMQ on CloudAMQP (`amqplib`)
- React (Vite) on the frontend (added later)

## Repository layout

```
.
├── shared/              # Reusable helpers (DB, RabbitMQ, logger)
└── services/
    ├── customer/
    ├── booking/
    ├── payment/
    ├── fare/
    └── location/
```
