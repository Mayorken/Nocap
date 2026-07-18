export type ChallengeStatus = 'open' | 'active' | 'verifying' | 'settled';

export type Challenge = {
  id: string;
  title: string;
  description: string;
  emoji: string;
  stake: string;
  durationDays: number;
  participantCount: number;
  maxParticipants: number;
  currentDay: number;
  status: ChallengeStatus;
  creator: string;
  category: string;
};
