const minimumSessions = 12;


export function modelReadiness(sessions, answers) {
  const cold = sessions < minimumSessions;
  return {
    phase: cold ? 'Cold Start' : 'Collecting Data',
    mastery: !cold && answers >= 30,
    irt: !cold && answers >= 60,
    entropy: !cold && answers >= 40,
    pacing: !cold && answers >= 30,
    reminder: sessions >= 20,
  };
}

export function validAttempt(event) {
  return event && typeof event.id === 'string' && Number.isFinite(event.at) &&
    event.at >= 0 && event.at <= 8640000000000000 && typeof event.item === 'string' &&
    typeof event.skill === 'string' && typeof event.correct === 'boolean' &&
    Number.isFinite(event.difficulty) && Math.abs(event.difficulty) <= 4 &&
    event.guess >= 0 && event.guess < 1 && event.slip >= 0 && event.slip < 1 &&
    (event.rating === 1 || event.rating === 3) && Number.isFinite(event.seconds) &&
    event.seconds > 0;
}
