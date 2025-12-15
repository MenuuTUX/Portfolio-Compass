
export interface FearAndGreedData {
  score: number;
  rating: string;
  updatedAt: string;
}

export async function fetchFearAndGreedIndex(): Promise<FearAndGreedData> {
  const url = 'https://production.dataviz.cnn.io/index/fearandgreed/graphdata';

  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      },
      next: { revalidate: 3600 } // Cache for 1 hour
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch Fear & Greed Index: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();

    // The API returns structure like:
    // {
    //   fear_and_greed: {
    //     score: 45.123,
    //     rating: "Fear",
    //     timestamp: "2023-10-27T..."
    //   }
    // }

    const fg = data.fear_and_greed;

    if (!fg || typeof fg.score === 'undefined' || !fg.rating) {
      throw new Error('Invalid data structure received from CNN API');
    }

    return {
      score: Math.round(fg.score),
      rating: fg.rating,
      updatedAt: fg.timestamp || new Date().toISOString()
    };

  } catch (error) {
    console.error('Error fetching Fear & Greed Index:', error);
    // Return a neutral fallback or rethrow.
    // Since the UI needs to handle errors, we might want to throw or return null.
    // However, the prompt says "Handle API failures gracefully".
    // We'll throw here and handle in the API route.
    throw error;
  }
}
