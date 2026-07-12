import { Component, ElementRef, ViewChild, OnInit } from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';

interface Message {
  role: 'user' | 'assistant';
  rawContent: string;
  displayContent?: SafeHtml;
  loading?: boolean;
}

@Component({
  selector: 'app-chat',
  templateUrl: './chat.component.html',
  styleUrls: ['./chat.component.scss'],
})
export class ChatComponent implements OnInit {
  constructor(private sanitizer: DomSanitizer) {}

  @ViewChild('chatContainer') private chatContainer!: ElementRef;

  private modes = ['A', 'B', 'C', 'D'];
  currMode: string | undefined = undefined;
  private previousModes: string[] = [];
  lastModeSelected: boolean = false;
  experimentOver: boolean = false;
  lastMessageSent: boolean = false;
  private API_URL = 'http://localhost:3000/api';
  showPreferencePopup: boolean = false;
  selectedModeForPreference: string | null = null;
  participantId: string = '';
  showStartModal: boolean = true;

  messages: Message[] = [];
  userInput: string = '';
  firstMessage: boolean = true;
  messageCount: number = 0;
  showMessageBox: boolean = true;
  showFinishedPopup: boolean = false;
  firstTextareaHeight: string = '2.5rem';
  showSurveyPopup: boolean = false;
surveyLink: string = '';
copiedId: boolean = false;
  lastMessageHtmlPerMode: Map<string, string> = new Map();
linksPerMode: Map<string, string> = new Map([
  ['A', 'https://docs.google.com/forms/d/e/1FAIpQLSeP6qHtyTtmJPlbInEBQ68yAB93E7yDuFdRd1qFkgXX3HEg7Q/viewform?usp=dialog'],
  ['B', 'https://docs.google.com/forms/d/e/1FAIpQLSd6oZMG3Ybc7A8aOPq__LGSyN1hz5jaf29KNKiqdXGAjNsdcw/viewform?usp=dialog'],
  ['C', 'https://docs.google.com/forms/d/e/1FAIpQLSft1S7ySpCeoXUaPBbj1m1mwU54Y4BZVibf3lj7ZWMj2pMK3A/viewform?usp=dialog'],
  ['D', 'https://docs.google.com/forms/d/e/1FAIpQLSe7LBCF0Y4e5vrQdEKgX705ztrHzOukRBx4unyIlQ_tF7iKXQ/viewform?usp=dialog'],
  ['FINAL', 'https://docs.google.com/forms/d/e/1FAIpQLSfV5IG7k3f4EXTCxJX9gR_LDTJmXr2GzKfffM0Z9WF5vX8fnw/viewform?usp=publish-editor'],
])
;  sessionStartTime: number = Date.now();

  private rawAssistantResponse: string = '';

  async ngOnInit(): Promise<void> {
    this.participantId = await this.getParticipantId();
  }

  startExperiment() {
    this.showStartModal = false;
    this.selectRandomMode();
    this.sessionStartTime = Date.now();
  }

  async sendMessage() {
    if (!this.userInput.trim()) return;

    this.showMessageBox = false;

    const userText = this.userInput;

    // USER MESSAGE (fixed displayContent)
    this.messages.push({
      role: 'user',
      rawContent: userText,
      displayContent: this.sanitizer.bypassSecurityTrustHtml(
        this.formatMessageForHtml(userText)
      ),
    });

    const payload = {
      messages: this.messages.map(m => ({
        role: m.role,
        content: m.rawContent,
      })),
      agent: this.currMode,
      participantId: this.participantId,
      messageCount: this.messageCount,
    };

    this.messageCount++;

    if (this.firstMessage) this.firstMessage = false;

    // assistant placeholder
    this.messages.push({
      role: 'assistant',
      rawContent: '',
      loading: true,
    });

    const assistantIndex = this.messages.length - 1;

    this.userInput = '';
    this.rawAssistantResponse = '';

    try {
      const response = await fetch(`${this.API_URL}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      }
    );

    if (response.status === 504) {
    this.messages[assistantIndex] = {
      role: 'assistant',
      rawContent: 'SERVER ERROR: Please send last prompt again',
      displayContent: this.sanitizer.bypassSecurityTrustHtml(
        'SERVER ERROR: Please send last prompt again'
      ),
    };

    this.showMessageBox = true;
    this.scrollToBottom();
    return;
  }


     

      if (!response.body) throw new Error('No response body');

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed.startsWith('data:')) continue;

          const jsonStr = trimmed.slice(5).trim();
          if (jsonStr === '[DONE]') break;

          try {
            const parsed = JSON.parse(jsonStr);
            const token = parsed.choices?.[0]?.delta?.content ?? '';
            if (!token) continue;

            this.messages[assistantIndex].loading = false;

           this.rawAssistantResponse += token;

const raw = this.rawAssistantResponse;

// STREAM MESSAGE
const messageMatch = raw.match(/"message"\s*:\s*"([\s\S]*?)$/);

if (messageMatch) {
  let partialMessage = messageMatch[1];

  partialMessage = partialMessage
    .replace(/\\"/g, '"')
    .replace(/\\n/g, '\n');

  const html = this.formatMessageForHtml(partialMessage);

  this.messages[assistantIndex].displayContent =
    this.sanitizer.bypassSecurityTrustHtml(html);

  this.scrollToBottom();

// PLAN STATE
} else if (raw.includes('"plan"') || raw.includes('"isComplete": true')) {

  this.messages[assistantIndex].displayContent =
    this.sanitizer.bypassSecurityTrustHtml(
      '<span class="opacity-70">Generating your plan...</span>'
    );

// THINKING DOTS
} else {
  this.messages[assistantIndex].displayContent =
    this.sanitizer.bypassSecurityTrustHtml(`
      <div class="flex items-center gap-1 h-5">
        <span class="w-2 h-2 rounded-full bg-gray-500 animate-bounce [animation-delay:0ms]"></span>
        <span class="w-2 h-2 rounded-full bg-gray-500 animate-bounce [animation-delay:150ms]"></span>
        <span class="w-2 h-2 rounded-full bg-gray-500 animate-bounce [animation-delay:300ms]"></span>
      </div>
    `);
}


          } catch {
            // ignore partial chunks
          }
        }
      }

      this.handleFinalResponse(assistantIndex);

    } catch (err) {
      console.error(err);

      this.messages[assistantIndex] = {
        role: 'assistant',
        rawContent: 'Error: could not get response.',
        displayContent: this.sanitizer.bypassSecurityTrustHtml(
          'Error: could not get response.'
        ),
      };
    }

    this.showMessageBox = true;
    this.scrollToBottom();
  }

  // FINAL RESPONSE (unchanged logic, only safe parsing kept)
  private handleFinalResponse(index: number) {
    try {
      let raw = this.rawAssistantResponse.trim();

      raw = raw.replace(/```json/gi, '').replace(/```/g, '');

      const firstBrace = raw.indexOf('{');
      const lastBrace = raw.lastIndexOf('}');

      if (firstBrace === -1 || lastBrace === -1) {
        this.setPlainMessage(index, raw);
        return;
      }

      const jsonString = raw.substring(firstBrace, lastBrace + 1);
      const parsed = JSON.parse(jsonString);

      if (parsed.isComplete) {
        this.lastMessageSent = true;

        const plan = parsed.plan;

        const html = this.formatPlan(plan);

        this.messages[index].rawContent = JSON.stringify(plan);

        this.messages[index].displayContent =
          this.sanitizer.bypassSecurityTrustHtml(html);

        if (this.currMode) {
          this.lastMessageHtmlPerMode.set(this.currMode, html);
        }

      } else {
        let msg = parsed.message ?? raw;

        this.messages[index].rawContent = msg;

        this.messages[index].displayContent =
          this.sanitizer.bypassSecurityTrustHtml(
            this.formatMessageForHtml(msg)
          );
      }

    } catch (e) {
      console.error('JSON parse failed:', e);

      this.setPlainMessage(index, this.rawAssistantResponse);
    }
  }

  private setPlainMessage(index: number, msg: string) {
    this.messages[index].rawContent = msg;

    this.messages[index].displayContent =
      this.sanitizer.bypassSecurityTrustHtml(
        this.formatMessageForHtml(msg)
      );
  }

  private formatMessageForHtml(msg: string): string {
    let html = msg;

    html = html.replace(/^### (.*$)/gm, '<h3>$1</h3>');
    html = html.replace(/^## (.*$)/gm, '<h2>$1</h2>');
    html = html.replace(/^# (.*$)/gm, '<h1>$1</h1>');
    html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    html = html.replace(/\*(.*?)\*/g, '<em>$1</em>');
    html = html.replace(/\n/g, '<br>');

    return html;
  }

 private formatPlan(plan: any): string {
  if (!plan) return 'No plan generated.';

  let html = '';

  html += `<strong>Training Goal:</strong> ${plan.trainingGoal}<br>`;
  html += `<strong>Duration:</strong> ${plan.duration}<br>`;
  html += `<strong>Equipment:</strong> ${plan.equipment}<br><br>`;

  for (const day of plan.exercises ?? []) {
    html += `<strong>${day.day}</strong><ol>`;
    for (const ex of day.workout ?? []) {
      html += `<li>${ex.exercise} — ${ex.reps}</li>`;
    }
    html += `</ol>`;
  }

  if (plan.cooldown) {
    html += `<br><strong>Cooldown:</strong> ${plan.cooldown}`;
  }

  if (plan.motivationTip) {
    html += `<br><strong>Motivation Tip:</strong> ${plan.motivationTip}`;
  }

  return html;
}


  private scrollToBottom(): void {
    setTimeout(() => {
      if (!this.chatContainer) return;
      this.chatContainer.nativeElement.scrollTop =
        this.chatContainer.nativeElement.scrollHeight;
    }, 50);
  }

  autoResize(event: Event): void {
    const textarea = event.target as HTMLTextAreaElement;
    textarea.style.height = '2.5rem';
    textarea.style.height = Math.min(textarea.scrollHeight, 80) + 'px';
    this.firstTextareaHeight = textarea.style.height;
  }

  private selectRandomMode(): void {
  const availableModes = this.modes.filter(m => !this.previousModes.includes(m));

  if (availableModes.length === 0) {
    this.lastModeSelected = true;
    this.currMode = undefined;
    return;
  }

  const i = Math.floor(Math.random() * availableModes.length);
  this.currMode = availableModes[i];
  this.previousModes.push(this.currMode);

  if (this.previousModes.length >= this.modes.length) {
    this.lastModeSelected = true;
  }
}

  cleanMessages(): void {
    this.sendMessagesToBackend();
    this.sendTimeSpent();

    this.sessionStartTime = Date.now();
    this.messageCount = 0;
    this.messages = [];
    this.firstMessage = true;
    this.lastMessageSent = false;
    this.userInput = '';
    this.firstTextareaHeight = '2.5rem';

    if (!this.lastModeSelected) {
    this.selectRandomMode();
    }
  }

  async getParticipantId(): Promise<string> {
    const res = await fetch(`${this.API_URL}/participant`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });

    const data = await res.json();
    return data.participantId;
  }

  async sendMessagesToBackend() {
    await fetch(`${this.API_URL}/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        participantId: this.participantId,
        mode: this.currMode,
        content: this.messages.map(m => ({
          role: m.role,
          content: m.rawContent,
        })),
      }),
    });
  }

  async sendTimeSpent(): Promise<void> {
    const timeSpentSeconds = Math.floor(
      (Date.now() - this.sessionStartTime) / 1000
    );

    await fetch(`${this.API_URL}/participant/time`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        participantId: this.participantId,
        mode: this.currMode,
        timeSpent: timeSpentSeconds,
      })
    });
  }

  openPreferencePopup(): void {
    this.showPreferencePopup = true;
  }

  selectModeForPreference(mode: string): void {
    this.selectedModeForPreference = mode;
  }

  async confirmPreferredMode(): Promise<void> {
    if (!this.selectedModeForPreference) return;

    await this.sendPreferredMode(this.selectedModeForPreference);


    this.showPreferencePopup = false;
    this.selectedModeForPreference = null;
    this.experimentOver = true;
    this.surveyLink = this.linksPerMode.get('FINAL') ?? '';
    this.showSurveyPopup = true;
  }

  openSurvey(): void {
    this.surveyLink = this.linksPerMode.get(this.getCurrMode()) ?? '';
    this.showSurveyPopup = true;
  }

  proceedFromSurvey(): void {
  this.showSurveyPopup = false;
  if (this.experimentOver) {
    this.showFinishedPopup = true;
  } else if (this.lastModeSelected) {
    this.sendMessagesToBackend();
    this.openPreferencePopup();
    this.sendTimeSpent();
  } else {
    this.cleanMessages();
  }
}

  async sendPreferredMode(mode: string): Promise<void> {
    await fetch(`${this.API_URL}/participant/mode`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        participantId: this.participantId,
        preferredMode: mode,
      }),
    });
  }

  public isLastModeSelected(): boolean {
    return this.lastModeSelected;
  }

  public isLastMessageSent(): boolean {
    return this.lastMessageSent;
  }

  public getCurrMode(): string {
    return this.currMode ?? '';
  }

  copyParticipantId(): void {
  navigator.clipboard.writeText(this.participantId);
  this.copiedId = true;
  setTimeout(() => this.copiedId = false, 2000);
}
}
