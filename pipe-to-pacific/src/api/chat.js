import express from 'express';
import { chat } from '../services/claude.js';

const MAX_QUESTION_LENGTH = 1000;

function createChatRoutes(appData) {
  const router = express.Router();

  router.post('/', async (req, res) => {
    const { question } = req.body;
    if (!question || typeof question !== 'string' || question.trim().length === 0) {
      res.status(400).json({ data: null, error: 'Question is required' });
      return;
    }
    if (question.length > MAX_QUESTION_LENGTH) {
      res.status(400).json({ data: null, error: `Question must be under ${MAX_QUESTION_LENGTH} characters` });
      return;
    }

    try {
      const answer = await chat(appData, question.trim());
      res.json({ question, answer });
    } catch (err) {
      console.error('Chat error:', err.message); // eslint-disable-line no-console
      res.status(500).json({ data: null, error: 'Failed to generate response' });
    }
  });

  return router;
}

export { createChatRoutes };
