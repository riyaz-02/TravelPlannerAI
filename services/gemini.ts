export interface ItineraryDay {
  day: number;
  date: string;
  theme: string;
  morning: { activity: string; description: string; estimatedCost: number; duration: string };
  afternoon: { activity: string; description: string; estimatedCost: number; duration: string };
  evening: { activity: string; description: string; estimatedCost: number; duration: string };
  food: { meal: string; suggestion: string; cost: number }[];
  accommodation: { name: string; type: string; cost: number };
  tips: string[];
}

export interface BudgetBreakdown {
  transport: number;
  accommodation: number;
  food: number;
  activities: number;
  shopping: number;
  miscellaneous: number;
  total: number;
}

export interface Itinerary {
  summary: string;
  days: ItineraryDay[];
  budgetBreakdown: BudgetBreakdown;
  packingList: string[];
  localTips: string[];
  bestTimeToVisit: string;
}

export async function generateItinerary(tripData: Record<string, unknown>): Promise<Itinerary> {
  const response = await fetch('/api/gemini', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(tripData),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    if (response.status === 429) {
      throw new Error(err.error ?? 'Gemini rate limit reached. Please wait 60 s and retry.');
    }
    throw new Error(err.error || 'Failed to generate itinerary');
  }

  const data = await response.json();
  return data.itinerary;
}
