// Add this to your server (Express.js example)
app.post('/api/generate-playlist', async (req, res) => {
  try {
    // Use your hardcoded API key here instead of from headers
    const apiKey = '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'; // Replace with your actual key
    
    const { timeContext, userPreferences, availableTracks, requestedLength, type } = req.body;
    
    // Create the AI prompt
    const prompt = `You are a music curator AI. Create a personalized playlist based on this data:

TIME CONTEXT: ${timeContext.timeOfDay} (${timeContext.hour}:00) on ${timeContext.day}
MOOD: ${timeContext.mood}
ENERGY LEVEL: ${timeContext.energy}

USER PREFERENCES:
- Liked tracks: ${userPreferences.likes.length} songs
- Disliked tracks: ${userPreferences.dislikes.length} songs
- Top genres: ${Object.entries(userPreferences.genreScores || {})
  .sort(([,a], [,b]) => b - a)
  .slice(0, 3)
  .map(([genre]) => genre)
  .join(', ')}

AVAILABLE TRACKS: ${availableTracks.length} songs

PLAYLIST TYPE: ${type}

Select ${requestedLength} tracks that best match the current time/mood and user preferences.

Available tracks:
${availableTracks.slice(0, 50).map(track => 
  `ID: ${track.id} | "${track.title}" by ${track.singer} | Genres: ${track.genre1}, ${track.genre2} | Moods: ${track.mood1}, ${track.mood2}, ${track.mood3} | ${track.prompt}`
).join('\n')}

Return a JSON object with this exact format:
{
  "title": "Playlist Name Here",
  "description": "Brief explanation of why this playlist fits the current time and user preferences",
  "playlist": [
    {"id": "track_id_from_available_tracks", "reason": "why this track was selected"},
    {"id": "another_track_id", "reason": "selection reasoning"}
  ]
}

Focus on:
1. Time-appropriate energy levels
2. Mood matching for current time of day
3. User's genre preferences
4. Variety while maintaining cohesion`;

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-3-sonnet-20240229',
        max_tokens: 2000,
        messages: [{
          role: 'user',
          content: prompt
        }]
      })
    });

    if (!response.ok) {
      throw new Error(`Anthropic API error: ${response.status}`);
    }

    const result = await response.json();
    const content = result.content[0].text;
    
    // Extract JSON from the response
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('Could not parse AI response');
    }
    
    const playlist = JSON.parse(jsonMatch[0]);
    
    res.json(playlist);
  } catch (error) {
    console.error('Playlist generation error:', error);
    res.status(500).json({ error: error.message });
  }
});
