import { ReviewRequest, ReviewResult } from './types';

const DEFAULT_BASE_URL = 'http://localhost:3000';

export async function createReview(payload: ReviewRequest): Promise<ReviewResult> {
  const baseUrl = import.meta.env.VITE_API_BASE_URL || DEFAULT_BASE_URL; 
  const response = await fetch(`${baseUrl}/reviews`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    let message = `Request failed with status ${response.status}`;
    try {
      const data = await response.json();
      if (typeof data?.message === 'string') {
        message = data.message;
      }
    } catch {
      // ignore parse error
    }
    throw new Error(message);
  }

  return (await response.json()) as ReviewResult;
}
