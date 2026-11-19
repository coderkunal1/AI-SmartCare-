const jwt = require('jsonwebtoken');
const fetch = require('node-fetch');
(async () => {
  const token = jwt.sign({ userId: '000000000000000000000001' }, 'your_secret_key_here', { expiresIn: '7d' });
  try {
    const res = await fetch('http://localhost:3001/api/ai/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
      body: JSON.stringify({ message: "I can't breathe and chest pain" }),
    });
    const data = await res.json();
    console.log(JSON.stringify(data, null, 2));
  } catch (err) {
    console.error('Request failed', err);
  }
})();
