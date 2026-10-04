# 🏡 StayNest

[![CI](https://github.com/vikas0799/staynest/actions/workflows/ci.yml/badge.svg)](https://github.com/vikas0799/staynest/actions/workflows/ci.yml)

**StayNest** is a full-stack stay-booking platform (think a mini Airbnb for India) built with the **MERN stack** — MongoDB, Express, React and Node.js. Guests can discover homestays, havelis, villas and hostels, book them for specific dates and leave reviews; hosts list their properties and manage booking requests.

It is built as a **beginner-friendly open-source project**: real features, clear code, and lots of open issues to contribute to.

## ✨ Features

- 🔐 JWT auth with two roles: **guest** and **host**
- 🔎 Search stays by city, type, number of guests and max price
- 🏠 Listing detail page with amenities, host info and reviews
- 📅 Date-range booking with automatic night and price calculation
- 🧳 "My Trips" page for guests (with cancellation)
- 🧑‍💼 Host dashboard: create / edit / delete listings, accept or decline bookings
- ⭐ Reviews (only after a completed stay) with automatic average rating

## 🧱 Tech stack

| Layer    | Tech                                 |
| -------- | ------------------------------------ |
| Frontend | React 18, Vite, React Router, Axios  |
| Backend  | Node.js, Express, JWT, bcrypt        |
| Database | MongoDB with Mongoose                |

## 📁 Folder structure

```
staynest/
├── client/                    # React frontend (Vite)
│   └── src/
│       ├── api/               # Axios instance
│       ├── components/        # ListingCard, BookingBox, Reviews, StarRating...
│       ├── context/           # AuthContext
│       ├── pages/             # Home, ListingDetail, Trips, host/*
│       └── utils/
└── server/                    # Express API
    └── src/
        ├── config/
        ├── controllers/       # auth, listing, booking
        ├── middleware/        # protect, hostOnly, errors
        ├── models/            # User, Listing, Booking, Review
        ├── routes/
        └── seed/
```

## 🚀 Getting started

**Prerequisites:** Node.js 18+, MongoDB (local or free [MongoDB Atlas](https://www.mongodb.com/atlas)).

```bash
# 1. Fork, then clone your fork
git clone https://github.com/<your-username>/staynest.git
cd staynest

# 2. Backend
cd server
cp .env.example .env          # set MONGO_URI and JWT_SECRET
npm install
npm run seed                  # 8 sample stays + 2 users
npm run dev                   # API on http://localhost:5001

# 3. Frontend (new terminal)
cd client
npm install
npm run dev                   # app on http://localhost:5174
```

**Demo accounts (after seeding):**

| Role  | Email               | Password |
| ----- | ------------------- | -------- |
| Host  | host@staynest.dev   | host123  |
| Guest | guest@staynest.dev  | guest123 |

**Booking flow to try:** login as guest → book a stay → login as host → accept → mark completed → login as guest → write a review.

## 🔌 API reference

| Method | Endpoint                        | Access      | Description                    |
| ------ | ------------------------------- | ----------- | ------------------------------ |
| POST   | `/api/auth/register`            | Public      | Sign up (guest or host)        |
| POST   | `/api/auth/login`               | Public      | Login, returns JWT             |
| GET    | `/api/auth/me`                  | User        | Current user                   |
| GET    | `/api/listings`                 | Public      | Search listings                |
| GET    | `/api/listings/mine`            | Host        | Host's own listings            |
| GET    | `/api/listings/:id`             | Public      | Listing detail                 |
| POST   | `/api/listings`                 | Host        | Create listing                 |
| PUT    | `/api/listings/:id`             | Owner host  | Update listing                 |
| DELETE | `/api/listings/:id`             | Owner host  | Delete listing                 |
| GET    | `/api/listings/:id/reviews`     | Public      | Reviews for a listing          |
| POST   | `/api/listings/:id/reviews`     | User        | Add review (after stay)        |
| POST   | `/api/bookings`                 | User        | Create booking                 |
| GET    | `/api/bookings/mine`            | User        | Guest's trips                  |
| GET    | `/api/bookings/host`            | Host        | Bookings on host's listings    |
| PATCH  | `/api/bookings/:id/cancel`      | Guest       | Cancel own booking             |
| PATCH  | `/api/bookings/:id/status`      | Owner host  | Confirm / decline / complete   |

## 🤝 Contributing

Contributions are welcome! Please read **[CONTRIBUTING.md](./CONTRIBUTING.md)** and start with an issue labelled
[`good first issue`](../../issues?q=is%3Aissue+is%3Aopen+label%3A%22good+first+issue%22).

## 📄 License

[MIT](./LICENSE)
