import { createEmptyCard, fsrs, Rating } from 'ts-fsrs';

const scheduler = fsrs({ enable_fuzz: false });

export function reviewCard(previous, reviewedAt, rating) {
  const date = new Date(reviewedAt);
  if (!Number.isFinite(date.getTime()) || ![Rating.Again, Rating.Hard, Rating.Good, Rating.Easy].includes(rating)) {
    throw new RangeError('Invalid review timestamp or rating');
  }
  if (previous && date < new Date(previous.last_review)) throw new RangeError('Reviews must be in chronological order');
  return scheduler.next(previous ?? createEmptyCard(date), date, rating).card;
}

export function retentionAt(card, at) {
  return card ? scheduler.retrievability(card, new Date(at), false) : null;
}

export { Rating };
