import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';

interface MessageContent {
  role: 'user' | 'assistant';
  content: string;
}

interface Message {
  id: string;
  mode: string;
  content: MessageContent[];
  timestamp: string;
}

interface ModeStats {
  tokensUsed: number;
  timeSpent: number;
}

interface Participant {
  id: string;
  preferredMode: string | null;
  messages: Message[];
  stats: {
    A: ModeStats;
    B: ModeStats;
    C: ModeStats;
    D: ModeStats;
  };
}

@Component({
  selector: 'app-participants',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './participants.component.html',
})
export class ParticipantsComponent implements OnInit {
  participants: Participant[] = [];
  loading = true;
  error: string | null = null;
  deletingId: string | null = null;
  expandedId: string | null = null;

  readonly MODES = ['A', 'B', 'C', 'D'] as const;

  constructor(private http: HttpClient) {}

  ngOnInit(): void {
    this.loadParticipants();
  }

  loadParticipants(): void {
    this.loading = true;
    this.error = null;
    this.http.get<Participant[]>('http://localhost:3000/api/participants').subscribe({
      next: (data) => {
        this.participants = data;
        this.loading = false;
      },
      error: (err) => {
        this.error = 'Failed to load participants. Please try again.';
        this.loading = false;
        console.error(err);
      },
    });
  }

  deleteParticipant(id: string): void {
    this.deletingId = id;
    this.http.delete(`http://localhost:3000/api/participants/${id}`).subscribe({
      next: () => {
        this.participants = this.participants.filter((p) => p.id !== id);
        this.deletingId = null;
        if (this.expandedId === id) this.expandedId = null;
      },
      error: (err) => {
        console.error('Delete failed', err);
        this.deletingId = null;
      },
    });
  }

  toggleExpand(id: string): void {
    this.expandedId = this.expandedId === id ? null : id;
  }

  getTotalTokens(participant: Participant): number {
    return this.MODES.reduce((sum, m) => sum + participant.stats[m].tokensUsed, 0);
  }

  getTotalTime(participant: Participant): number {
    return this.MODES.reduce((sum, m) => sum + participant.stats[m].timeSpent, 0);
  }

  getActiveModesCount(participant: Participant): number {
    return this.MODES.filter((m) => participant.stats[m].tokensUsed > 0).length;
  }

  formatTokens(n: number): string {
    if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
    if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K';
    return n.toString();
  }

  shortId(id: string): string {
    return id.slice(0, 8);
  }

  formatTimestamp(ts: string): string {
    return new Date(ts).toLocaleString();
  }
}