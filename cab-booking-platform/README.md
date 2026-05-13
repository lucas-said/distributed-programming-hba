# Cab Booking Platform

A distributed cab booking platform built for **ITSFT-606-2101 Distributed Programming**.

## Architecture

- **Microservices Architecture** — Each business capability is a separate Node.js service with its own MongoDB database. They communicate by HTTP for queries and via RabbitMQ for events.
- **Event-Driven Architecture** — Booking creation, payment completion, discount eligibility, and cab-ready notifications are all coordinated via RabbitMQ topic exchanges and a TTL+DLX delay-queue pattern.
- **API Gateway** — A single entry point that routes the React frontend's requests to the appropriate microservice.

## Services

| Service   | Port | Responsibility                                              |
|-----------|------|-------------------------------------------------------------|
| gateway   | 4000 | Single entry point — routes `/customer`, `/booking`, etc.   |
| customer  | 4001 | Account registration, login, notifications inbox           |
| booking   | 4002 | Create / list cab bookings; consumes `payment.completed`   |
| payment   | 4003 | Fare calculation, payment processing                       |
| fare      | 4004 | RapidAPI Taxi Fare Calculator wrapper                      |
| location  | 4005 | Saved pickup locations + WeatherAPI wrapper                |
| events    | 4006 | Discount + cab-ready event handlers (no public API)        |

Plus the **frontend** (React + Vite) on `:5173` in dev.

## Running locally

You'll need:
- Node.js 20+
- A MongoDB Atlas connection string (free M0 tier is enough)
- A CloudAMQP URL (free Little Lemur tier is enough)
- A RapidAPI key with subscriptions to:
  - [Taxi Fare Calculator](https://rapidapi.com/3b-data-3b-data-default/api/taxi-fare-calculator)
  - [WeatherAPI.com](https://rapidapi.com/weatherapi/api/weatherapi-com)

```bash
# 1. Install everything (npm workspaces hoists deps for shared + services/*)
npm install

# 2. Install the frontend separately (it's not in the workspace)
npm --prefix frontend install

# 3. Copy each service's .env.example to .env and fill in the secrets.
#    JWT_SECRET must be the SAME value across customer, booking, payment,
#    fare, and location services.

# 4. Boot one service per terminal:
npm run dev:customer    # :4001
npm run dev:booking     # :4002
npm run dev:payment     # :4003
npm run dev:fare        # :4004
npm run dev:location    # :4005
npm run dev:events      # :4006
npm run dev:gateway     # :4000
npm run dev:frontend    # :5173
```

The frontend talks ONLY to the gateway. Set `VITE_API_BASE_URL` in `frontend/.env` to point at the deployed gateway URL when you go to production.

## Repository layout

```
.
├── shared/              # Reusable helpers (DB, RabbitMQ, JWT, asyncHandler, logger)
├── services/
│   ├── customer/        # Auth + notifications inbox
│   ├── booking/         # Bookings CRUD + booking.created publisher
│   ├── payment/         # Fare formula + payment processing
│   ├── fare/            # RapidAPI taxi fare wrapper
│   ├── location/        # Favourite locations + RapidAPI weather wrapper
│   ├── events/          # Discount handler + cab-ready (TTL+DLX) handler
│   └── gateway/         # API gateway with prefix routing
└── frontend/            # React + Vite + React Router
```
