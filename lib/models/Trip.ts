import { Schema, model, models } from 'mongoose';

const CoordsSchema = new Schema(
  { lat: { type: Number }, lon: { type: Number } },
  { _id: false },
);

const TripSchema = new Schema(
  {
    userId:    { type: String, required: true, index: true },
    title:     { type: String, default: '' },

    from:      { type: String, required: true },
    to:        { type: String, required: true },
    fromCoords: { type: CoordsSchema },   // optional — not all transports have coords
    toCoords:   { type: CoordsSchema },

    transport:   { type: String, default: 'driving-car' },
    startDate:   { type: Date },
    endDate:     { type: Date },
    budget:      { type: Number },
    currency:    { type: String, default: 'INR' },
    travelers:   { type: Number, default: 1 },
    preferences: { type: [String], default: [] },

    // Full Gemini itinerary + cached API results
    itineraryData: { type: Schema.Types.Mixed },
    routeData:     { type: Schema.Types.Mixed },
    weatherData:   { type: Schema.Types.Mixed },
    newsData:      { type: Schema.Types.Mixed },
  },
  { timestamps: true },
);

// Index for fast user history queries
TripSchema.index({ userId: 1, createdAt: -1 });

const Trip = models.Trip || model('Trip', TripSchema);
export default Trip;
