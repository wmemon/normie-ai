from flask import Flask, request, jsonify
import tweepy
from datetime import date

# API_KEY = "qgVjb9bIPIFUMy4oqmKJ0KEvv"
# API_SECRET = "z0j1lmK9NrGlkPksNzWScFLzjX1DVJxY9kRc2jOcSekC5qJeB4"
# ACCESS_KEY = "1749425181704196097-Y0m9D3LssPE3lE4CDk7IqRUKErdx8u"
# ACCESS_SECRET = "zMmMaXmdSDHtnW6Jy34P6idUfpPFwvukz0Klm45F3uIOz"
# BEARER_TOKEN = "AAAAAAAAAAAAAAAAAAAAAK96wgEAAAAAvwivoiEJ7wF%2F1fwWYcBlwNrB2Kk%3DuAkEi1JBMXgeTfZZMcHLUzR4M1yhIpJwPuqUWWelAQWLnk6KND"

API_KEY = "xv8sKoHOJhuXG1NVUww9UTjGJ"
API_SECRET = "aNBH6OovtNEcnHmD2Mn2RKcN0t4sFKrBtGLjztm2MvKci8XmIz"
ACCESS_KEY = "1858958077497638912-ELaxW5EVhC8gYJMsIU0lOm1BzDy1OL"
ACCESS_SECRET = "XW3w4M6bLdtxa76heyIUyRFfbFb4HRJcgl7PW5NgpgbUn"
BEARER_TOKEN = "AAAAAAAAAAAAAAAAAAAAAHDdxAEAAAAAPr5ny0%2FJN%2BQCdOgcPbOXBJYTYRQ%3Dupp6Gv23p1P7LwOpNwYfAP8r9U6aVxYSh5C3uL8q3lQr9vJtkF"

# Create a Twitter API client
newapi = tweepy.Client(
    bearer_token=BEARER_TOKEN,
    access_token=ACCESS_KEY,
    access_token_secret=ACCESS_SECRET,
    consumer_key=API_KEY,
    consumer_secret=API_SECRET,
)

# Initialize Flask app
app = Flask(__name__)

# Route to post a tweet
@app.route('/api/tweet', methods=['POST'])
def post_tweet():
    # Get the JSON data from the request
    data = request.get_json()

    # Extract the tweet text and validate it
    tweet_text = data.get('text')
    if not tweet_text:
        return jsonify({'error': 'Tweet text is required'}), 400

    try:
        # Post the tweet
        post_result = newapi.create_tweet(text=tweet_text)
        priint(post_result)
        return jsonify({'message': 'Tweet posted successfully'}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# Route to get latest mentions
@app.route('/api/mentions', methods=['GET'])
def get_mentions():
    try:
        # Get the latest 5 mentions
        mentions = newapi.get_users_mentions(
            id=newapi.get_me()[0].id,  # Get authenticated user's ID
            max_results=5,
            tweet_fields=['created_at', 'text']
        )
        
        # Format the mentions data
        mentions_data = []
        if mentions.data:
            for mention in mentions.data:
                mentions_data.append({
                    'id': str(mention.id),
                    'text': mention.text,
                    'created_at': mention.created_at.isoformat()
                })
        
        return jsonify({
            'mentions': mentions_data,
            'count': len(mentions_data)
        }), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# Route to reply to a specific tweet
@app.route('/api/reply', methods=['POST'])
def reply_to_tweet():
    data = request.get_json()
    
    # Extract and validate required fields
    reply_text = data.get('text')
    tweet_id = data.get('tweet_id')
    
    if not reply_text or not tweet_id:
        return jsonify({
            'error': 'Both tweet_id and reply text are required'
        }), 400
    
    try:
        # Create the reply tweet
        response = newapi.create_tweet(
            text=reply_text,
            in_reply_to_tweet_id=tweet_id
        )
        
        return jsonify({
            'message': 'Reply posted successfully',
            'reply_id': response.data['id']
        }), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# Start the Flask server
if __name__ == '__main__':
    app.run(port=5000)  # You can change the port if needed