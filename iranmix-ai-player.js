// Add to your server
app.post('/api/generate-playlist', async (req, res) => {
  try {
    const apiKey = req.headers.authorization?.replace('Bearer ', '');
    if (!apiKey) {
      return res.status(401).json({ error: 'API key required' });
    }

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-3-sonnet-20240229',
        max_tokens: 1000,
        messages: [{
          role: 'user',
          content: `Create a playlist based on this data: ${JSON.stringify(req.body)}
          
          Return JSON with:
          {
            "title": "Playlist name",
            "description": "Why this playlist fits the time/mood",
            "playlist": [{"id": "track_id", "reason": "why included"}]
          }`
        }]
      })
    });

    const result = await response.json();
    const content = result.content[0].text;
    const playlist = JSON.parse(content);
    
    res.json(playlist);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
