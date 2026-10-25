// ─────────────────────────────────────────────────────────────
// QUOTES
// A line to get going, keep going, or close the day, picked by how
// far through today's plan you are. Same quote all day unless you
// tap for another.
// ─────────────────────────────────────────────────────────────

const START = [
  ['Start where you are. Use what you have. Do what you can.', 'Arthur Ashe'],
  ['Either you run the day or the day runs you.', 'Jim Rohn'],
  ['Amateurs sit and wait for inspiration. The rest of us just get up and go to work.', 'Stephen King'],
  ['A year from now you may wish you had started today.', 'Karen Lamb'],
  ['The best time to plant a tree was 20 years ago. The second best time is now.', 'Proverb'],
  ['You don’t have to be great to start, but you have to start to be great.', 'Zig Ziglar'],
  ['Lost time is never found again.', 'Benjamin Franklin'],
  ['Do the hard jobs first. The easy jobs will take care of themselves.', 'Dale Carnegie'],
];

const KEEP = [
  ['We are what we repeatedly do.', 'Will Durant'],
  ['Don’t watch the clock; do what it does. Keep going.', 'Sam Levenson'],
  ['It always seems impossible until it’s done.', 'Nelson Mandela'],
  ['Focus on being productive instead of busy.', 'Tim Ferriss'],
  ['Small deeds done are better than great deeds planned.', 'Peter Marshall'],
  ['Energy and persistence conquer all things.', 'Benjamin Franklin'],
  ['Until we can manage time, we can manage nothing else.', 'Peter Drucker'],
];

const DONE = [
  ['Well done is better than well said.', 'Benjamin Franklin'],
  ['Success is the sum of small efforts, repeated day in and day out.', 'Robert Collier'],
  ['The reward for work well done is the opportunity to do more.', 'Jonas Salk'],
  ['Discipline is the bridge between goals and accomplishment.', 'Jim Rohn'],
];

// progress: 0–1 share of today's tasks done, or null with nothing planned.
export function quoteFor(progress, offset = 0, now = new Date()) {
  const list = progress >= 1 ? DONE : progress > 0 ? KEEP : START;
  const day = Math.floor((now - now.getTimezoneOffset() * 60000) / 86400000);
  const [text, author] = list[(day + offset) % list.length];
  return { text, author };
}
