const axios = require('axios');
const fs = require('fs/promises');
const path = require('path');

class ReplyManager {
    constructor() {
        this.repliedTweetsFile = path.join(__dirname, 'replied_tweets.json');
        this.repliedTweets = new Set();
        
        this.lastReplyTime = 0;
        this.minReplyInterval = 30000; // 30 seconds between replies
    }

    async loadRepliedTweets() {
        try {
            const data = await fs.readFile(this.repliedTweetsFile, 'utf8');
            const tweets = JSON.parse(data);
            const yesterday = Date.now() - (24 * 60 * 60 * 1000);
            const filteredTweets = tweets.filter(t => new Date(t.timestamp) > yesterday);
            
            if (filteredTweets.length !== tweets.length) {
                console.log(`Cleaned up ${tweets.length - filteredTweets.length} old tweets`);
            }
            
            this.repliedTweets = new Set(filteredTweets.map(t => t.id));
            await this.saveRepliedTweets();
        } catch (error) {
            if (error.code === 'ENOENT') {
                console.log('Creating new replied tweets file');
                await this.saveRepliedTweets();
            } else {
                console.error("Error loading replied tweets:", error);
                // Create backup of corrupted file if it exists
                try {
                    const backupPath = `${this.repliedTweetsFile}.backup`;
                    await fs.copyFile(this.repliedTweetsFile, backupPath);
                    console.log(`Backup created at ${backupPath}`);
                } catch (backupError) {
                    console.error("Failed to create backup:", backupError);
                }
            }
        }
    }

    async saveRepliedTweets() {
        const tweetsArray = Array.from(this.repliedTweets).map(id => ({
            id,
            timestamp: new Date().toISOString()
        }));
        await fs.writeFile(this.repliedTweetsFile, JSON.stringify(tweetsArray, null, 2));
    }

    async generateReply(mention) {
        // Load previous replies from replies.md
        const previousReplies = await this.loadPreviousReplies();
        try {
            const response = await axios.post('http://localhost:11434/api/generate', {
                model: "normie-uncensored",
                prompt: '',
                stream: false
            });

            const output = response.data.response;
            console.log("Generated output:", output);
            
            if (output.includes("[REPLY:")) {
                const replyMatch = output.match(/\[REPLY: "(.+?)"\]/);
                if (replyMatch) {
                    return replyMatch[1];
                }
            }
            return null;
        } catch (error) {
            console.error("Error generating reply:", error);
            return null;
        }
    }

    // New method to load previous replies from replies.md
    async loadPreviousReplies() {
        try {
            const data = await fs.readFile('replies.md', 'utf8');
            const replies = data.split('\n').filter(line => line.trim() !== '');
            return replies.join('\n'); // Return as a single string
        } catch (error) {
            if (error.code === 'ENOENT') {
                return ''; // No previous replies
            }
            console.error("Error reading replies file:", error);
            return '';
        }
    }

    async handleMentions() {
        try {
            const response = await axios.get('http://127.0.0.1:5000/api/mentions');
            const mentions = response.data.mentions;

            console.log(`Processing ${mentions.length} mentions`);

            // Process only the first mention that hasn't been replied to
            for (const mention of mentions) {
                console.log("Mention is: ", mention);
                // Check if a reply has already been made
                if (this.repliedTweets.has(mention.id)) {
                    console.log(`Already replied to mention ID: ${mention.id}`);
                    continue; // Skip to the next mention
                }

                // Log the text of the mention we are replying to
                console.log(`Replying to mention: ${mention.text}`);

                // Check rate limiting
                const now = Date.now();
                if (now - this.lastReplyTime < this.minReplyInterval) {
                    const waitTime = this.minReplyInterval - (now - this.lastReplyTime);
                    console.log(`Rate limiting - waiting ${waitTime}ms`);
                    await new Promise(resolve => setTimeout(resolve, waitTime));
                }

                const reply = await this.generateReply(mention);
                if (reply) {
                    await this.postReply(reply, mention.id);
                    await this.appendReplyToFile(mention.id, mention.text, reply);
                    this.repliedTweets.add(mention.id);
                    await this.saveRepliedTweets();
                    this.lastReplyTime = Date.now();
                    console.log(`Reply posted successfully for mention ID: ${mention.id}`);
                    break; // Exit after one reply
                }
            }
        } catch (error) {
            console.error("Error handling mentions:", error);
            if (error.response) {
                console.error("API Response:", error.response.data);
            }
        }
    }

    async postReply(replyText, tweetId) {
        try {
            console.log("Posting reply: ", replyText);
            console.log("Tweet ID type:", typeof tweetId);
            await axios.post('http://127.0.0.1:5000/api/reply', {
                text: replyText,
                tweet_id: tweetId
            });
            console.log("Reply posted successfully:", replyText);
        } catch (error) {
            if (error.response && error.response.status === 500) {
                console.error("Error posting reply: Tweet was not successful (500 Internal Server Error)");
            } else {
                console.error("Error posting reply:", error);
            }
        }
    }

    async start() {
        console.log('Starting Reply Manager...');
        await this.loadRepliedTweets();
        console.log(`Loaded ${this.repliedTweets.size} replied tweets`);
        
        const execute = async () => {
            console.log('\n--- Processing Mentions ---');
            await this.handleMentions();
            console.log('Waiting 3 minutes before next check...');
            setTimeout(execute, 60000);
        };

        execute();
    }

    // New method to check if a reply has already been made
    async hasReplied(mentionId) {
        try {
            const data = await fs.readFile('replies.md', 'utf8');
            const replies = data.split('\n').filter(line => line.trim() !== '');
            
            // Check if the replies array is empty
            if (replies.length === 0) {
                console.log("No replies have been made yet");
                return false; // No replies have been made yet
            }

            return replies.some(line => line.includes(`id: "${mentionId}"`));
        } catch (error) {
            if (error.code === 'ENOENT') {
                // File doesn't exist, no replies have been made yet
                return false;
            }
            console.error("Error reading replies file:", error);
            return false;
        }
    }

    // New method to append a reply to replies.md
    async appendReplyToFile(id, text, reply) {
        const entry = {
            id: id,
            text: text,
            reply: reply,
        };
        try {
            await fs.appendFile('replies.md', JSON.stringify(entry, null, 2) + ',\n');
            console.log(`Reply stored for mention ID: ${id}`);
        } catch (error) {
            console.error("Error writing to replies file:", error);
        }
    }
}

process.on('uncaughtException', (error) => {
    console.error('Uncaught Exception:', error);
});

process.on('unhandledRejection', (error) => {
    console.error('Unhandled Rejection:', error);
});

const replyManager = new ReplyManager();
replyManager.start(); 