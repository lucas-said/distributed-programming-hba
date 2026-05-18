# Cab Booking Platform

A distributed cab booking platform for **ITSFT-606-2101 Distributed Programming**, built with seven Node.js microservices, RabbitMQ event-driven workflows, and a React frontend.

## Architecture

| Service   | Port | Purpose                                                    |
|-----------|------|------------------------------------------------------------|
| gateway   | 4000 | Single entry point. Routes `/customer/*`, `/booking/*`, etc. |
| customer  | 4001 | Account registration, login, notifications inbox          |
| booking   | 4002 | Create / list cab bookings; publishes `booking.created`   |
| payment   | 4003 | Fare formula, payment processing                          |
| fare      | 4004 | Taxi fare estimate (RapidAPI wrapper)                     |
| location  | 4005 | Favourite locations + weather (RapidAPI wrapper)          |
| events    | 4006 | Discount handler + cab-ready delay handler (TTL+DLX)      |
| frontend  | 5173 | React + Vite single-page app                              |

All services share one MongoDB Atlas cluster (with separate logical databases) and one CloudAMQP RabbitMQ broker.

## Building the environment

You need free accounts on **MongoDB Atlas**, **CloudAMQP**, **RapidAPI**, **Render**, and **Vercel**, plus **Node.js 20+** locally.

### 1. MongoDB Atlas

1. Sign up at https://cloud.mongodb.com
2. Create a free M0 cluster (any region)
3. Database Access: create a user with a password, role **Read and write to any database**
4. Network Access: add IP `0.0.0.0/0` (allow from anywhere — required because Render's IPs are dynamic)
5. Copy the connection string from the "Connect" → "Drivers" panel. It looks like:
   `mongodb+srv://user:pass@cluster.mongodb.net/?retryWrites=true&w=majority`

### 2. CloudAMQP

1. Sign up at https://cloudamqp.com
2. Create a new instance using the free **Little Lemur** plan (any region)
3. Open the instance, copy the **AMQP URL** (starts with `amqps://`)

### 3. RapidAPI

1. Sign up at https://rapidapi.com
2. Subscribe to the **free tier** of both:
   - [Taxi Fare Calculator](https://rapidapi.com/3b-data-3b-data-default/api/taxi-fare-calculator)
   - [WeatherAPI.com](https://rapidapi.com/weatherapi/api/weatherapi-com)
3. Copy your **RapidAPI key** from any of the endpoint pages (same key works for both)

### 4. Generate a JWT secret

The customer service signs tokens that every other service must verify. They must share the same secret.

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

Save the output. You'll paste it into five `.env` files (customer, booking, payment, fare, location).

### 5. Install dependencies

```bash
npm install
npm --prefix frontend install
```

### 6. Verify the `.env` files

Each service ships with a populated `.env` file under `services/<name>/.env` (and `frontend/.env`). The four secrets you need to set/replace:

| Variable | Where it goes | Value |
|---|---|---|
| `MONGODB_URI` | customer, booking, payment, location, events | Your Atlas connection string |
| `RABBITMQ_URL` | customer, booking, payment, events | Your CloudAMQP URL |
| `JWT_SECRET` | customer, booking, payment, fare, location | The 48-byte hex string from step 4 |
| `RAPIDAPI_KEY` | fare, location | Your RapidAPI key |

The gateway and frontend `.env` files don't need editing for local dev — their defaults point at `localhost`.

### 7. Run everything

Each service runs in its own terminal. Open eight terminals (or use `tmux`):

```bash
npm run dev:customer    # :4001
npm run dev:booking     # :4002
npm run dev:payment     # :4003
npm run dev:fare        # :4004
npm run dev:location    # :4005
npm run dev:events      # :4006
npm run dev:gateway     # :4000
npm run dev:frontend    # :5173
```

Open http://localhost:5173 — you're running the platform.

## Production deployment

`render.yaml` provisions all seven services on Render: from the Render dashboard, **New +** → **Blueprint** → connect this repo. Render reads the YAML and creates the services. After they're created, fill in each service's environment variables in the Render dashboard (use `0.0.0.0/0` in Atlas Network Access since Render's free tier doesn't have static IPs).

`frontend/vercel.json` configures the React app for Vercel: from the Vercel dashboard, **Add New** → **Project** → set Root Directory to `frontend`, then add `VITE_API_BASE_URL` pointing at your deployed gateway URL.

## Repository layout

```
.
├── shared/              # DB, RabbitMQ, JWT, async-handler, logger helpers
├── services/
│   ├── customer/        # Auth, notifications inbox
│   ├── booking/         # Booking CRUD, publishes booking.created
│   ├── payment/         # Fare formula, pay endpoint
│   ├── fare/            # Taxi fare API wrapper
│   ├── location/        # Favourite locations + weather wrapper
│   ├── events/          # Discount handler, cab-ready TTL+DLX handler
│   └── gateway/         # Prefix-routing reverse proxy
├── frontend/            # React + Vite
├── render.yaml          # Render blueprint
└── package.json         # npm workspaces (shared + services/*)
```
