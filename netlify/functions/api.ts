import serverless from 'serverless-http';
import express from 'express';
import { GoogleGenAI } from '@google/genai';
import { handleWebsiteBuild, handleWebsiteRebuild } from '../../server/websiteBuilder';
import { handleNoteGeneration } from '../../server/noteGenerator';

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

// Netlify Function API endpoints
app.get('/.netlify/functions/api/health', (req, res) => {
  res.json({ status: 'ok', provider: 'netlify', timestamp: new Date().toISOString() });
});

app.post('/.netlify/functions/api/chat', async (req, res) => {
  try {
    const { messages, personality = 'black', userName } = req.body;
    const lastMsg = messages && Array.isArray(messages) ? messages[messages.length - 1] : null;
    const userPrompt = lastMsg?.content || '';

    const ai = getGeminiClient();
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: userPrompt,
      config: {
        systemInstruction: personality === 'black' 
          ? `You are Black, the commanding master detective and warrior persona of Blackbell AGI. User: ${userName || 'Janab'}.`
          : `You are Bell, the spirited, witty companion of Blackbell AGI. User: ${userName || 'Dost'}.`
      }
    });

    return res.json({ response: response.text || '', questions: [] });
  } catch (err: any) {
    return res.status(500).json({ error: err?.message || 'Netlify chat error' });
  }
});

app.post('/.netlify/functions/api/build-website', async (req, res) => {
  try {
    const { prompt, user, isRebuild, existingCode } = req.body;
    if (isRebuild && existingCode) {
      const result = await handleWebsiteRebuild(prompt, existingCode, user?.username || 'User');
      return res.json(result);
    }
    const result = await handleWebsiteBuild(prompt, user?.username || 'User');
    return res.json(result);
  } catch (err: any) {
    return res.status(500).json({ error: err?.message || 'Build failed' });
  }
});

app.post('/.netlify/functions/api/generate-note', async (req, res) => {
  try {
    const { topic, user } = req.body;
    const result = await handleNoteGeneration(topic, user?.username || 'User');
    return res.json(result);
  } catch (err: any) {
    return res.status(500).json({ error: err?.message || 'Note generation failed' });
  }
});

export const handler = serverless(app);
