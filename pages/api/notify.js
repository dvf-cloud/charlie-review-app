export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    const response = await fetch(
      'https://domvf.app.n8n.cloud/webhook/0f7f3c51-b24c-48c6-b634-c9e0c93a36dd',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      }
    );
    const text = await response.text();
    console.log('n8n response status:', response.status, 'body:', text);
    res.status(200).json({ ok: true, n8n_status: response.status, n8n_body: text });
  } catch (e) {
    console.error('notify error:', e.message);
    res.status(500).json({ ok: false, error: e.message });
  }
}
