// api/chat.js
// Chatbot avec compteur de questions gratuites - Version Vercel

const FREE_LIMIT = 2;
const users = {};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Méthode non autorisée' });
  }

  try {
    const { email, message, system } = req.body;

    if (!email || !message) {
      return res.status(400).json({ error: 'Email et message requis' });
    }

    const userKey = email.toLowerCase().trim();

    if (!users[userKey]) {
      users[userKey] = { email: userKey, questionsUsed: 0, plan: 'free' };
    }

    if (users[userKey].questionsUsed >= FREE_LIMIT && users[userKey].plan === 'free') {
      return res.status(200).json({
        blocked: true,
        reply: "Tu as utilisé tes 2 diagnostics gratuits. Passe à l'offre Essentiel (9,90€/mois) pour un accès illimité.",
        questionsUsed: users[userKey].questionsUsed,
        questionsRemaining: 0,
        plan: 'free'
      });
    }

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return res.status(200).json({
        reply: "[DEBUG] Erreur: ANTHROPIC_API_KEY manquante sur le serveur",
        error: true
      });
    }

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-5',
        max_tokens: 1000,
        system: system,
        messages: [{ role: 'user', content: message }]
      })
    });

    if (!response.ok) {
      const errorBody = await response.text();
      console.error('Claude API error:', response.status, errorBody);
      return res.status(200).json({
        reply: `[DEBUG] Erreur API Claude: ${response.status} - ${errorBody}`,
        error: true
      });
    }

    const data = await response.json();
    const reply = data.content?.[0]?.text || "Désolé, une erreur est survenue.";

    if (users[userKey].plan === 'free') {
      users[userKey].questionsUsed += 1;
    }

    const remaining = Math.max(0, FREE_LIMIT - users[userKey].questionsUsed);

    return res.status(200).json({
      reply: reply,
      questionsUsed: users[userKey].questionsUsed,
      questionsRemaining: users[userKey].plan === 'free' ? remaining : null,
      plan: users[userKey].plan,
      blocked: false
    });

  } catch (error) {
    console.error('Erreur chat:', error);
    return res.status(200).json({
      reply: `[DEBUG] Erreur serveur: ${error.message}`,
      error: true
    });
  }
}
