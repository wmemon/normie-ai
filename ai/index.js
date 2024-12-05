const axios = require('axios');

class CryptoTwitterBot {
    constructor() {
        this.prevOutputs = {
            count: 0,
            mentions: [],
            previousTweets: []  // Array to store previous tweets
        };
    }

    async updateMentions() {
        try {
            // Get mentions from Twitter API
            const mentionsResponse = await axios.get('http://127.0.0.1:5000/api/mentions');
            this.prevOutputs.mentions = mentionsResponse.data.mentions;
            this.prevOutputs.count = mentionsResponse.data.count;
        } catch (error) {
            console.error("Error updating mentions:", error);
        }
    }

    async generateTweet() {
        try {
            const response = await axios.post('http://localhost:11434/api/generate', {
                model: "normie-uncensored",
                prompt: '',
                stream: false
            });

            const output = response.data.response;
            
            // Parse and handle the tweet
            if (output.includes("[TWEET:")) {
                console.log("includesssss")
                const tweetMatch = output.match(/\[TWEET: "(.+?)"\]/);

                if (tweetMatch) {
                    const tweetText = tweetMatch[1];
                    console.log(tweetText)
                    await this.postTweet(tweetText);
                    
                    // Add to previous tweets
                    this.prevOutputs.previousTweets.push({
                        text: tweetText,
                        timestamp: new Date().toISOString()
                    });

                    // Keep only last 10 tweets for context
                    if (this.prevOutputs.previousTweets.length > 10) {
                        this.prevOutputs.previousTweets.shift();
                    }
                }
            }

            console.log("Generated Output:", output);
            console.log("Current Context:", JSON.stringify(this.prevOutputs, null, 2));
            console.log("----------------------------------------");
            return output;

        } catch (error) {
            console.error("Error generating tweet:", error);
            return null;
        }
    }

    async postTweet(tweetText) {
        try {
            await axios.post('http://127.0.0.1:5000/api/tweet', {
                text: tweetText
            });
            console.log("Tweet posted successfully:", tweetText);
        } catch (error) {
            console.error("Error posting tweet:", error);
        }
    }

    // async start() {
        
    //     // Initial run
    //     this.run();
        
    //     // Run every 10 minutes
    //     setInterval(() => this.run(), 60000);
    // }

    async start() {
      const execute = async () => {
          console.log("rinning")
          await this.run();
          setTimeout(execute, 60000); // Wait 1 minute before next execution
      };
  
      execute(); // Initial run
  }

    async run() {
        await this.updateMentions();
        await this.generateTweet();
    }
}

// Initialize and start the bot
const bot = new CryptoTwitterBot();
bot.start();