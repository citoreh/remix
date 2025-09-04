
// server.js
const express = require('express');
const cors = require('cors');
const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 3001;
const DATA_DIR = './user_data';

// Middleware
app.use(cors());
app.use(express.json());

// Ensure data directory exists
async function ensureDataDir() {
    try {
        await fs.access(DATA_DIR);
    } catch {
        await fs.mkdir(DATA_DIR, { recursive: true });
    }
}

// Generate user ID based on fingerprint or create new one
function generateUserId(fingerprint) {
    return crypto.createHash('sha256').update(fingerprint || Date.now().toString()).digest('hex').substring(0, 16);
}

// Get user file path
function getUserFilePath(userId) {
    return path.join(DATA_DIR, `${userId}.json`);
}

// Load user data
async function loadUserData(userId) {
    try {
        const filePath = getUserFilePath(userId);
        const data = await fs.readFile(filePath, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        // Return default data if file doesn't exist
        return {
            userId,
            stats: { played: 0, liked: 0, disliked: 0 },
            userPreferences: {
                plays: {},
                likes: [],
                dislikes: [],
                genreScores: {}
            },
            history: {
                played: [],
                liked: [],
                skipped: []
            },
            lastUpdated: new Date().toISOString()
        };
    }
}

// Save user data
async function saveUserData(userId, data) {
    const filePath = getUserFilePath(userId);
    const dataWithTimestamp = {
        ...data,
        userId,
        lastUpdated: new Date().toISOString()
    };
    await fs.writeFile(filePath, JSON.stringify(dataWithTimestamp, null, 2));
}

// Routes

// Health check endpoint
app.get('/api/health', (req, res) => {
    res.json({ 
        status: 'ok', 
        message: 'IranMix server is running',
        timestamp: new Date().toISOString() 
    });
});

// Get user data
app.get('/api/user/:userId', async (req, res) => {
    try {
        const userId = req.params.userId;
        const userData = await loadUserData(userId);
        res.json(userData);
    } catch (error) {
        console.error('Error loading user data:', error);
        res.status(500).json({ error: 'Failed to load user data' });
    }
});

// Save user data
app.post('/api/user/:userId', async (req, res) => {
    try {
        const userId = req.params.userId;
        const userData = req.body;
        await saveUserData(userId, userData);
        res.json({ success: true, message: 'Data saved successfully' });
    } catch (error) {
        console.error('Error saving user data:', error);
        res.status(500).json({ error: 'Failed to save user data' });
    }
});

// Log a specific action (play, like, skip)
app.post('/api/user/:userId/action', async (req, res) => {
    try {
        const userId = req.params.userId;
        const { action, track } = req.body; // action: 'play', 'like', 'skip'
        
        const userData = await loadUserData(userId);
        
        // Create track entry with timestamp
        const trackEntry = {
            ...track,
            timestamp: new Date().toISOString(),
            trackId: track.title + '_' + track.singer
        };
        
        // Update history
        if (!userData.history) userData.history = { played: [], liked: [], skipped: [] };
        
        switch (action) {
            case 'play':
                userData.history.played.push(trackEntry);
                userData.stats.played = (userData.stats.played || 0) + 1;
                break;
            case 'like':
                userData.history.liked.push(trackEntry);
                userData.stats.liked = (userData.stats.liked || 0) + 1;
                break;
            case 'skip':
                userData.history.skipped.push(trackEntry);
                userData.stats.disliked = (userData.stats.disliked || 0) + 1;
                break;
        }
        
        // Keep only last 1000 entries per category to prevent unlimited growth
        Object.keys(userData.history).forEach(key => {
            if (userData.history[key].length > 1000) {
                userData.history[key] = userData.history[key].slice(-1000);
            }
        });
        
        await saveUserData(userId, userData);
        res.json({ success: true, message: `${action} logged successfully` });
    } catch (error) {
        console.error('Error logging action:', error);
        res.status(500).json({ error: 'Failed to log action' });
    }
});

// Get user statistics
app.get('/api/user/:userId/stats', async (req, res) => {
    try {
        const userId = req.params.userId;
        const userData = await loadUserData(userId);
        
        const stats = {
            totalPlayed: userData.history?.played?.length || 0,
            totalLiked: userData.history?.liked?.length || 0,
            totalSkipped: userData.history?.skipped?.length || 0,
            topGenres: getTopGenres(userData.userPreferences?.genreScores || {}),
            recentActivity: getRecentActivity(userData.history || {})
        };
        
        res.json(stats);
    } catch (error) {
        console.error('Error getting stats:', error);
        res.status(500).json({ error: 'Failed to get stats' });
    }
});

// Get user's song lists
app.get('/api/user/:userId/lists', async (req, res) => {
    try {
        const userId = req.params.userId;
        const userData = await loadUserData(userId);
        
        const lists = {
            played: userData.history?.played || [],
            liked: userData.history?.liked || [],
            skipped: userData.history?.skipped || []
        };
        
        res.json(lists);
    } catch (error) {
        console.error('Error getting lists:', error);
        res.status(500).json({ error: 'Failed to get lists' });
    }
});

// Helper functions
function getTopGenres(genreScores) {
    return Object.entries(genreScores)
        .sort(([,a], [,b]) => b - a)
        .slice(0, 5)
        .map(([genre, score]) => ({ genre, score }));
}

function getRecentActivity(history) {
    const allActivities = [];
    
    if (history.played) {
        allActivities.push(...history.played.map(item => ({ ...item, action: 'played' })));
    }
    if (history.liked) {
        allActivities.push(...history.liked.map(item => ({ ...item, action: 'liked' })));
    }
    if (history.skipped) {
        allActivities.push(...history.skipped.map(item => ({ ...item, action: 'skipped' })));
    }
    
    return allActivities
        .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
        .slice(0, 20);
}

// Initialize server
async function startServer() {
    await ensureDataDir();
app.listen(PORT, '0.0.0.0', () => {
    console.log(`IranMix server running on port ${PORT}`);
});
}

startServer().catch(console.error);

// Export for testing
module.exports = app;
