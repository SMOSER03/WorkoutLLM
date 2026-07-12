import express from 'express';
import cors from 'cors';
import fetch from 'node-fetch';
import https from 'https';
import dotenv from 'dotenv';
import { pool } from './db';
import { v4 as uuidv4 } from 'uuid';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

const AUTH_HEADER = `Bearer ${process.env.API_KEY}`;
const LLM_URL = `${process.env.LLM_URL}/v1/chat/completions`;

const TIMEOUT_MS = 250000;

const httpsAgent = new https.Agent({
  keepAlive: true,
  maxSockets: 50,
  maxFreeSockets: 10,
  timeout: TIMEOUT_MS,
  keepAliveMsecs: 3000
});

type AgentKey = 'A' | 'B' | 'C' | 'D';

app.use(cors({ origin: 'http://localhost:4200' }));
app.use(express.json({ limit: '100kb' }));

// -------------------- TOKEN HELPERS --------------------

function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

// -------------------- DB HELPERS --------------------

async function saveMessage(
  participantId: string,
  mode: AgentKey,
  content: any
) {
  await pool.query(
    `
    INSERT INTO messages (id, participant_id, mode, content)
    VALUES ($1, $2, $3, $4)
    `,
    [uuidv4(), participantId, mode, JSON.stringify(content)]
  );
}

async function addTokens(
  participantId: string,
  mode: AgentKey,
  tokens: number
) {
  await pool.query(
    `
    INSERT INTO mode_stats (participant_id, mode, tokens_used)
    VALUES ($1, $2, $3)
    ON CONFLICT (participant_id, mode)
    DO UPDATE SET tokens_used = mode_stats.tokens_used + EXCLUDED.tokens_used
    `,
    [participantId, mode, tokens]
  );
}

// -------------------- MAIN ROUTE --------------------

app.post('/api/chat', async (req, res) => {
  const { messages, agent, participantId } = req.body;

  if (!messages || !Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: 'messages missing or no array' });
  }

  const systemPrompt = {
    role: 'system',
    content: buildWorkoutSystemPrompt(agent)
  };

  const chatMessages = [systemPrompt, ...messages];

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    // ---------------- SAVE USER MESSAGE ----------------

    const lastUserMessage = messages.at(-1);

    const userTokens = estimateTokens(
      typeof lastUserMessage === 'string'
        ? lastUserMessage
        : JSON.stringify(lastUserMessage)
    );

    await addTokens(participantId, agent, userTokens);

    // ---------------- CALL MODEL ----------------

    const response = await fetch(LLM_URL, {
      method: 'POST',
      headers: {
        Authorization: AUTH_HEADER,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'qwen-3.6-35b',
        messages: chatMessages,
        stream: true
      }),
      signal: controller.signal,
      agent: httpsAgent
    });

    clearTimeout(timeout);

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    let fullResponse = '';

    // ---------------- STREAM HANDLING ----------------

    (response.body as NodeJS.ReadableStream).on('data', (chunk) => {
      const text = chunk.toString();
      fullResponse += text;
      res.write(text);
    });

    (response.body as NodeJS.ReadableStream).on('end', async () => {
  try {
    let assistantText = '';
    const lines = fullResponse.split('\n');

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith('data:')) continue;
      const jsonStr = trimmed.slice(5).trim();
      if (jsonStr === '[DONE]') continue;

      try {
        const parsed = JSON.parse(jsonStr);
        assistantText += parsed.choices?.[0]?.delta?.content ?? '';
      } catch {
        // skip partial/malformed chunks
      }
    }

    await addTokens(participantId, agent, estimateTokens(assistantText));

  } catch (err) {
    console.error('Error saving assistant tokens:', err);
  }

  res.end();
});

  } catch (err) {
    clearTimeout(timeout);

    if ((err as Error).name === 'AbortError') {
      return res.status(504).json({ error: 'Aqueduct timeout' });
    }

    console.error(err);
    res.status(500).json({ error: 'Fehler beim Chat mit Aqueduct' });
  }
});

// -------------------- SYSTEM PROMPT --------------------

export function buildWorkoutSystemPrompt(agent: AgentKey): string {
  const baseGuidelines = `
Guidelines:
1. Role: Always be friendly, motivating, and encouraging without being patronizing.
2. Knowledge: Use up-to-date training methods, including strength training, cardio, mobility, flexibility, and recovery techniques.
3. Personalization: Adjust recommendations based on fitness level, goals, available time, and equipment.
4. Safety: Highlight risks, provide safety tips, and never offer medical diagnosis or treatment.
5. Formatting: Give clear instructions including repetitions, sets, rest, duration, and intensity. Use numbered lists or tables when helpful.
6. Motivation: Include motivational tips or small challenges to inspire the user.
7. Language: Friendly, direct, practical, and easy to understand.
8. Conversation: Only directly refer to the system prompt in your first message to the user.

Completion Rules (MANDATORY):

You must determine whether you have enough information to finalize the workout plan.
However, you MUST finalize the plan when 20 messages have been sent.

Required information:
- fitness level
- training goal
- available time
- available equipment
- food preferences
- health

Output format (STRICT):
Always respond in valid JSON only.

If you are NOT done:
{
  "isComplete": false,
  "missingInformation": ["..."],
  "message": "your response to the user"
}

If you ARE done:
{
  "isComplete": true,
  "plan": {
    "trainingGoal": "...",
    "duration": "...",
    "equipment": "...",
    "exercises": [
      {
        "day": "Example: Day 1 (push)",
        "workout": [
          {
            "exercise": "...",
            "reps": "number or range as string"
          }
        ]
      }
    ],
    "cooldown": "...",
    "motivationTip": "..."
  }
}
`;

  let behaviorInstruction = "";

  switch (agent) {
    case "A":
      behaviorInstruction = `
You are a professional fitness and workout coach.
Assume everything about the user, including fitness level, goals, available equipment, and schedule.
Do NOT ask the user for any clarification or details.

Provide complete, actionable workout plans, exercises, recovery tips, general nutrition guidance, and motivation based solely on your assumptions.
`;
      break;

    case "B":
      behaviorInstruction = `
You are a professional fitness and workout coach.
Assume details about the user's fitness level, goals, available equipment, health and schedule.
Allow the user to correct your assumptions at any point and update your recommendations accordingly.
If the user does not correct a assumption directly, you can assume it is correct. Only correct the asumption the user told you is incorrect, the rest still should be asumed.
Do NOT ask questions about the user's information directly, only after the user corrected your asumptions.
If you need to ask questions, set a line break before and after the question and print it bold.
Only ask one question at a time and provide examples.
Provide clear, actionable exercises, recovery tips, general nutrition guidance, and motivation.
`;
      break;

    case "C":
      behaviorInstruction = `
You are a professional fitness and workout coach.
Do NOT assume anything about the user.

Always ask for all necessary details, including fitness level, goals, available equipment, schedule, and preferences before providing a workout plan.
If you need to ask questions, set a line break before and after the question and print it bold.
Only ask one question at a time and provide examples.
Once all information is collected, provide a detailed, actionable plan with exercises, recovery tips, general nutrition guidance, and motivation.
`;
      break;

    case "D":
      behaviorInstruction = `
You are a professional fitness and workout coach.

Start by making assumptions about the user's fitness level, goals, available equipment, and schedule.
Provide a preliminary workout plan based on these assumptions.
Then ask the user for clarifications or corrections.
Iteratively refine the workout plan based on the user's input while combining your assumptions and their corrections.
Provide the user the updated plan after each message. Only assume one new thing at a time.
Only ask questions when user corrects without providing an answer.
If you need to ask questions, set a line break before and after the question and print it bold.
Only ask one question at a time and proivde examples.
Always provide clear, actionable exercises, recovery tips, general nutrition guidance, and motivation.
`;
      break;
  }

  return `${behaviorInstruction}\n${baseGuidelines}`;
}


// -------------------- API CALLS -----------------------

app.post('/api/participant', async (req, res) => {
  const id = uuidv4();

  await pool.query(
    `INSERT INTO participants (id) VALUES ($1)`,
    [id]
  );

  res.json({ participantId: id });
});

app.delete('/api/participants/:id', async (req, res) => {
  const participantId = req.params.id;

  try {
    await pool.query(
      `DELETE FROM participants WHERE id = $1`,
      [participantId]
    );

    res.json({
      success: true,
      message: 'Participant and all related data deleted'
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Delete failed' });
  }
});

app.get('/api/participants', async (req, res) => {
  try {
    const [participantsResult, messagesResult, statsResult] = await Promise.all([
      pool.query(`SELECT id, preferred_mode FROM participants ORDER BY id`),
      pool.query(`SELECT id, participant_id, mode, content, timestamp FROM messages ORDER BY timestamp`),
      pool.query(`SELECT participant_id, mode, tokens_used, time_spent FROM mode_stats`)
    ]);

    const participantsMap: Record<string, any> = {};

    // Build base participants
    for (const row of participantsResult.rows) {
      participantsMap[row.id] = {
        id: row.id,
        preferredMode: row.preferred_mode,
        messages: [],
        stats: {
          A: { tokensUsed: 0, timeSpent: 0 },
          B: { tokensUsed: 0, timeSpent: 0 },
          C: { tokensUsed: 0, timeSpent: 0 },
          D: { tokensUsed: 0, timeSpent: 0 }
        }
      };
    }

    // Attach messages
    for (const row of messagesResult.rows) {
      participantsMap[row.participant_id]?.messages.push({
        id: row.id,
        mode: row.mode,
        content: row.content,
        timestamp: row.timestamp
      });
    }

    // Attach stats
    for (const row of statsResult.rows) {
      if (participantsMap[row.participant_id]) {
        participantsMap[row.participant_id].stats[row.mode] = {
          tokensUsed: row.tokens_used,
          timeSpent: row.time_spent
        };
      }
    }

    res.json(Object.values(participantsMap));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/participant/mode', async (req, res) => {
  const { participantId, preferredMode } = req.body;

  if (!participantId || !preferredMode) {
    return res.status(400).json({ error: 'Missing data' });
  }

  try {
    await pool.query(
      `
      UPDATE participants
      SET preferred_mode = $1
      WHERE id = $2
      `,
      [preferredMode, participantId]
    );

    res.json({ success: true });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to save mode' });
  }
});

app.post('/api/participant/time', async (req, res) => {
  const { participantId, mode, timeSpent } = req.body;

  if (!participantId || !mode || timeSpent == null) {
    return res.status(400).json({ error: 'Missing data' });
  }

  try {
    await pool.query(
      `
      INSERT INTO mode_stats (participant_id, mode, time_spent)
      VALUES ($1, $2, $3)
      ON CONFLICT (participant_id, mode)
      DO UPDATE SET time_spent = mode_stats.time_spent + EXCLUDED.time_spent
      `,
      [participantId, mode, timeSpent]
    );

    res.json({ success: true });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to save time' });
  }
});

app.post('/api/messages', async (req, res) => {
  const { participantId, mode, content } = req.body;
  console.log(req.body)

  if (!participantId || !mode || !content) {
    return res.status(400).json({ error: 'Missing data' });
  }

  try {
    await saveMessage(participantId, mode, content);

    res.json({ success: true });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to save message' });
  }
});


// -------------------- START SERVER --------------------

app.listen(PORT, () =>
  console.log(`Backend runs on http://localhost:${PORT}`)
);
