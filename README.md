# TravelAI – AI-Powered Trip Planner

A full-stack Next.js 15 application that generates AI-powered travel itineraries using Google Gemini, visualizes routes with MapLibre GL JS, shows real-time weather, and surfaces travel news.

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 15 (App Router) |
| Styling | Tailwind CSS |
| Auth | NextAuth.js v4 (Google OAuth) |
| Database | MongoDB Atlas (Mongoose) |
| AI | Google Gemini 2.0 Flash |
| Mapping | MapLibre GL JS + OpenFreeMap tiles |
| Routing | OpenRouteService API |
| Weather | Open-Meteo (free, no key needed) |
| News | GNews API |
| Geocoding | Nominatim (OpenStreetMap) |

## Quick Start

### 1. Install dependencies
```bash
npm install
```

### 2. Configure environment variables
```bash
cp .env.local.example .env.local
# Edit .env.local and fill in your API keys
```

Required keys:
- `GOOGLE_CLIENT_ID` + `GOOGLE_CLIENT_SECRET` → [Google Cloud Console](https://console.cloud.google.com)
- `NEXTAUTH_SECRET` → run `openssl rand -base64 32`
- `MONGODB_URI` → [MongoDB Atlas](https://cloud.mongodb.com)
- `GEMINI_API_KEY` → [Google AI Studio](https://aistudio.google.com)
- `OPENROUTE_API_KEY` → [openrouteservice.org](https://openrouteservice.org) (free)
- `GNEWS_API_KEY` → [gnews.io](https://gnews.io) (free tier)

### 3. Run development server
```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

## Features
- 🗺️ **Interactive Route Map** with source/destination markers and polyline
- 🤖 **AI Itinerary** (Gemini 2.0 Flash) – day-by-day activities, food, accommodation
- 🌤️ **7-day Weather Forecast** for your destination
- 💰 **Budget Breakdown** with category bars
- 📰 **Travel News Alerts** from GNews
- ☁️ **Save Trips** to MongoDB (requires Google sign-in)
- 📱 **Responsive** – works on mobile and desktop

## Project Structure
```
├── app/
│   ├── api/              # Route handlers
│   │   ├── auth/         # NextAuth
│   │   ├── route/        # OpenRouteService proxy
│   │   ├── weather/      # Open-Meteo proxy
│   │   ├── news/         # GNews proxy
│   │   ├── gemini/       # Gemini AI itinerary
│   │   └── trips/        # MongoDB CRUD
│   ├── dashboard/        # Results dashboard
│   ├── plan-trip/        # Trip planning form
│   └── page.tsx          # Landing page
├── components/           # React components
├── lib/                  # MongoDB & auth config
│   └── models/           # Mongoose models
└── services/             # API client functions
```

## Deployment (Vercel)

1. Push to GitHub
2. Import in [Vercel](https://vercel.com)
3. Add all environment variables in Vercel dashboard
4. Deploy
