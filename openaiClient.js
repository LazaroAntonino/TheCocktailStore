// openaiClient.js
const OpenAI = require('openai');
require('dotenv').config();

console.log('OPENAI_API_KEY cargada:', process.env.OPENAI_API_KEY ? 'Sí' : 'NO, revisa .env');

const openai = new OpenAI({
apiKey: process.env.OPENAI_API_KEY,
});

module.exports = { openai };