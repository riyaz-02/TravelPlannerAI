import { Schema, model, models } from 'mongoose';

const TripSchema = new Schema(
  {
    userId:    { type: String, required: true, index: true },
    title:     { type: String, default: '' },          // e.g. "Delhi → Goa"
    from:      { type: String, required: true },
    to:        { type: String, required: true },
    fromCoords: {
      lat: { type: Number, required: true },
      lon: { type: Number, required: true },
    },
    toCoords: {
      lat: { type: Number, required: true },
      lon: { type: Number, required: true },
    },
    transport:   { type: String, default: 'driving-car' },
    startDate:   { type: Date },
    endDate:     { type: Date },
    budget:      { type: Number },
    currency:    { type: String, default: 'INR' },
    travelers:   { type: Number, default: 1 },
    preferences: { type: [String], default: [] },
    // Cached API results — stored as flexible Mixed so any shape is accepted
    routeData:     { type: Schema.Types.Mixed },
    weatherData:   { type: Schema.Types.Mixed },
    itineraryData: { type: Schema.Types.Mixed },   // full Itinerary object from Gemini
    newsData:      { type: Schema.Types.Mixed },
  },
  { timestamps: true }
);

const Trip = models.Trip || model('Trip', TripSchema);
export default Trip;
