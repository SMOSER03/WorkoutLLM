type Mode = 'A' | 'B' | 'C' | 'D';

type MessageDTO = {
  id: string;
  role: 'user' | 'assistant';
  mode: Mode;
  content: any;
  timestamp: string;
};

type ModeStatsDTO = {
  tokensUsed: number;
  timeSpent: number;
};

type ParticipantDTO = {
  id: string;
  preferredMode: Mode | null;
  stats: Record<Mode, ModeStatsDTO>;
  messages: MessageDTO[];
};
