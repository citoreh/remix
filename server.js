// Minimal working server.js for Railway deployment
const express = require('express');
const cors = require('cors');
const fs = require('fs').promises;
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3001;

console.log('Starting IranMix server...');
console.log('Port:', PORT);
console.log('Node version:', process.version);

// Middleware
app.use(cors({
    origin: ['*'], // Allow all origins for testing
    credentials: false
}));
app.use(express.json({ limit: '10mb' }));

// Error handling middleware
app.use((err, req, res, next) => {
    console.error('Server error:', err);
    res.status(500).json({ error: 'Internal server error' });
});

// Basic health check (most important)
app.get('/api/health', (req, res) => {
    console.log('Health check requested');
    res.json({ 
        status: 'ok', 
        message: 'IranMix server is running',
        timestamp: new Date().toISOString(),
        port: PORT
    });
});

// Root endpoint
app.get('/', (req, res) => {
    res.json({ 
        message: 'IranMix Server API',
        version: '1.0.0',
        status: 'running'
    });
});

// Simple user data storage (in-memory for now to avoid file system issues)
const userData = new Map();

// Get user data
app.get('/api/user/:userId', (req, res) => {
    try {
        const userId = req.params.userId;
        console.log('Getting user data for:', userId);
        
        const user = userData.get(userId) || {
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
        
        res.json(user);
    } catch (error) {
        console.error('Error getting user:', error);
        res.status(500).json({ error: 'Failed to get user data' });
    }
});

// Save user data
app.post('/api/user/:userId', (req, res) => {
    try {
        const userId = req.params.userId;
        const userDataToSave = req.body;
        
        console.log('Saving user data for:', userId);
        
        userData.set(userId, {
            ...userDataToSave,
            userId,
            lastUpdated: new Date().toISOString()
        });
        
        res.json({ success: true, message: 'Data saved successfully' });
    } catch (error) {
        console.error('Error saving user:', error);
        res.status(500).json({ error: 'Failed to save user data' });
    }
});

// Log specific action
app.post('/api/user/:userId/action', (req, res) => {
    try {
        const userId = req.params.userId;
        const { action, track } = req.body;
        
        console.log(`Action: ${action} for user: ${userId}`);
        console.log('Track:', track?.title);
        
        // Get existing user data
        const user = userData.get(userId) || {
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
            }
        };
        
        // Create track entry
        const trackEntry = {
            ...track,
            timestamp: new Date().toISOString(),
            trackId: track.title + '_' + track.singer
        };
        
        // Update history
        switch (action) {
            case 'play':
                user.history.played.push(trackEntry);
                user.stats.played = (user.stats.played || 0) + 1;
                break;
            case 'like':
                user.history.liked.push(trackEntry);
                user.stats.liked = (user.stats.liked || 0) + 1;
                break;
            case 'skip':
                user.history.skipped.push(trackEntry);
                user.stats.disliked = (user.stats.disliked || 0) + 1;
                break;
        }
        
        // Keep only last 500 entries per category
        Object.keys(user.history).forEach(key => {
            if (user.history[key].length > 500) {
                user.history[key] = user.history[key].slice(-500);
            }
        });
        
        user.lastUpdated = new Date().toISOString();
        userData.set(userId, user);
        
        res.json({ success: true, message: `${action} logged successfully` });
    } catch (error) {
        console.error('Error logging action:', error);
        res.status(500).json({ error: 'Failed to log action' });
    }
});

// Get user's song lists (for admin dashboard)
app.get('/api/user/:userId/lists', (req, res) => {
    try {
        const userId = req.params.userId;
        const user = userData.get(userId);
        
        if (!user) {
            return res.json({
                played: [],
                liked: [],
                skipped: []
            });
        }
        
        res.json({
            played: user.history?.played || [],
            liked: user.history?.liked || [],
            skipped: user.history?.skipped || []
        });
    } catch (error) {
        console.error('Error getting lists:', error);
        res.status(500).json({ error: 'Failed to get lists' });
    }
});

// Catch all unhandled routes
app.use((req, res) => {
    res.status(404).json({ error: 'Endpoint not found' });
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
    console.log(`✅ IranMix server successfully started on port ${PORT}`);
    console.log(`🌍 Health check: http://localhost:${PORT}/api/health`);
}).on('error', (err) => {
    console.error('❌ Failed to start server:', err);
    process.exit(1);
});

// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('SIGTERM received, shutting down gracefully');
    process.exit(0);
});

process.on('SIGINT', () => {
    console.log('SIGINT received, shutting down gracefully');
    process.exit(0);
});

console.log('Server setup complete, waiting for requests...');
