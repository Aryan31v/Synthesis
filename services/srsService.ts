import { Task } from '../types';

/**
 * SuperMemo-2 Algorithm
 * @param quality 0-5 rating (5=easy, 3=mid, 0=hard/fail)
 * @param previousInterval days
 * @param previousEaseFactor multiplier
 * @param previousRepetitions count
 */
export const calculateSRS = (
  quality: number,
  previousInterval: number,
  previousEaseFactor: number,
  previousRepetitions: number
) => {
  let interval = 0;
  let repetitions = previousRepetitions + 1;
  let easeFactor = previousEaseFactor;

  if (quality >= 3) {
    if (repetitions === 1) {
      interval = 1;
    } else if (repetitions === 2) {
      interval = 6;
    } else {
      interval = Math.round(previousInterval * easeFactor);
    }

    easeFactor =
      easeFactor +
      (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02));
  } else {
    // Forgot/Hard
    repetitions = 0;
    interval = 1;
    // Ease factor doesn't decrease below 1.3 usually, but SM-2 spec says keep it if failed? 
    // Standard impl:
    easeFactor = previousEaseFactor; 
  }

  if (easeFactor < 1.3) easeFactor = 1.3;

  return { interval, repetitions, easeFactor };
};

export const getNextReviewDate = (intervalDays: number): number => {
  const now = new Date();
  now.setHours(0, 0, 0, 0); // Normalize to start of day
  const nextDate = new Date(now.getTime() + intervalDays * 24 * 60 * 60 * 1000);
  return nextDate.getTime();
};

export const isDue = (task: Task): boolean => {
  if (!task.completed || !task.reviewDate) return false;
  return task.reviewDate <= Date.now();
};
