import type { VercelRequest, VercelResponse } from '@vercel/node';
import express from 'express';
import { readDB, writeDB, updateFeatureUsage, logTraffic } from '../server/db';
import { generateBlackbell2Response } from '../server/blackbell2';
import { getSearchQueryAndDecision, performWebSearch } from '../server/search';
import { handleWebsiteBuild, handleWebsiteRebuild } from '../server/websiteBuilder';
import { handleNoteGeneration } from '../server/noteGenerator';
import { GoogleGenAI } from '@google/genai';

const app = express();
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Helper to get Gemini client
function getGeminiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY || process.env.GEMINI_API_KEYS?.split(',')[0] || '';
  return new GoogleGenAI({
    apiKey,
    httpOptions: { headers: { 'User-Agent': 'aistudio-build' } }
  });
}

// Serverless API Health Check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', runtime: 'serverless', timestamp: new Date().toISOString() });
});

// Serverless Chat API endpoint
app.post('/api/chat', async (req, res) => {
  try {
    const { messages, personality = 'black', userName, isAdmin } = req.body;
    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: 'Messages array is required' });
    }

    const lastMsg = messages[messages.length - 1];
    const userPrompt = lastMsg?.content || '';

    // Direct Gemini generate call
    const ai = getGeminiClient();
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: userPrompt,
      config: {
        systemInstruction: personality === 'black' 
          ? `You are Black, the commanding, fiercely intelligent master detective and warrior persona of Blackbell AGI. User: ${userName || 'Janab'}.`
          : `You are Bell, the spirited, witty, confident companion of Blackbell AGI. User: ${userName || 'Dost'}.`
      }
    });

    const text = response.text || '';
    updateFeatureUsage('textChat');
    return res.json({ response: text, questions: [] });
  } catch (err: any) {
    console.error('[Serverless API Chat Error]:', err);
    return res.status(500).json({ error: err?.message || 'Serverless chat error' });
  }
});

// Serverless Build & Rebuild API endpoint
app.post('/api/build-website', async (req, res) => {
  try {
    const { prompt, user, isRebuild, existingCode } = req.body;
    if (isRebuild && existingCode) {
      const result = await handleWebsiteRebuild(prompt, existingCode, user?.username || 'User');
      return res.json(result);
    }
    const result = await handleWebsiteBuild(prompt, user?.username || 'User');
    return res.json(result);
  } catch (err: any) {
    return res.status(500).json({ error: err?.message || 'Build generation failed' });
  }
});

// Serverless Note Generation API endpoint
app.post('/api/generate-note', async (req, res) => {
  try {
    const { topic, user } = req.body;
    const result = await handleNoteGeneration(topic, user?.username || 'User');
    return res.json(result);
  } catch (err: any) {
    return res.status(500).json({ error: err?.message || 'Note generation failed' });
  }
});

export default function handler(req: VercelRequest, res: VercelResponse) {
  return app(req as any, res as any);
}
