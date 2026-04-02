import { Schema, model, models } from 'mongoose';

/**
 * ChatSession model — persists multi-turn AI conversation history per trip.
 *
 * Each session is keyed by a unique sessionId (generated client-side via
 * crypto.randomUUID()), allowing both guest and authenticated sessions.
 *
 * The `messages` array stores the full Gemini-compatible conversation history
 * (alternating user/model roles), which is replayed on every API call to give
 * the model full context of prior refinements.
 *
 * `currentItinerary` tracks the latest itinerary state after AI modifications,
 * enabling incremental refinements without losing prior changes.
 */

const MessageSchema = new Schema(
  {
    role: { type: String, enum: ['user', 'model'], required: true },
    parts: [{ text: { type: String, required: true } }],
    timestamp: { type: Date, default: Date.now },
  },
  { _id: false },
);

const ChatSessionSchema = new Schema(
  {
    sessionId: {
      type: String,
      required: true,
      index: true,
      unique: true,
    },
    userId: {
      type: String,
      index: true,
      default: null,
    },
    messages: {
      type: [MessageSchema],
      default: [],
    },
    currentItinerary: {
      type: Schema.Types.Mixed,
      default: null,
    },
    tripContext: {
      type: Schema.Types.Mixed,
      default: null,
    },
  },
  { timestamps: true },
);

const ChatSession = models.ChatSession || model('ChatSession', ChatSessionSchema);
export default ChatSession;
