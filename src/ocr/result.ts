export type OdometerResult =
  | {
      reading: number | null;
      unit: 'miles' | 'km';
      confidence: 'high' | 'med' | 'low';
    }
  | { error: 'UNREADABLE_IMAGE'; message: string };

export function unreadable(): OdometerResult {
  return {
    error: 'UNREADABLE_IMAGE',
    message: 'Could not extract a mileage reading from the provided image',
  };
}

