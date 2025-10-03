import os
import random
import pickle
import cv2
import numpy as np
import math
import base64
import json 

# Removed unused imports related to MediaPipe and PyTorch/Model inference

from flask import Flask, jsonify, send_from_directory, request
# Removed unused import: from flask_socketio import SocketIO, emit 

# --- Global Configuration ---
VIDEO_FOLDER = 'Video Data'
WORDS_FILE = 'words.txt' 
WORDS_PER_LEVEL = 15 # New constant for level size

# Load the list of all available words and their video paths
def load_word_data():
    """
    Loads all available sign words and their video paths.
    Returns a dictionary: {word: {'videos': [video_paths]}}
    """
    word_data = {}
    if not os.path.exists(VIDEO_FOLDER):
        print(f"Warning: Video folder '{VIDEO_FOLDER}' not found.")
        return word_data

    for word in os.listdir(VIDEO_FOLDER):
        word_lower = word.lower()
        word_dir = os.path.join(VIDEO_FOLDER, word)
        
        if os.path.isdir(word_dir):
            videos = [
                os.path.join(word_lower, f) 
                for f in os.listdir(word_dir) 
                if f.lower().endswith(('.mp4', '.mov', '.webm'))
            ]
            
            if videos:
                # Store the word exactly as it appears in the folder name for case-sensitive lookups if needed, 
                # but key by lower case for easy comparison with client data
                word_data[word_lower] = {'videos': videos}
    
    print(f"Loaded {len(word_data)} unique words.")
    return word_data

WORD_DATA = load_word_data()
ALL_WORDS = list(WORD_DATA.keys())

# --- Level Assignment for Gated Progression ---

def assign_gated_levels(words, words_per_level):
    """
    Assigns words to Levels 1, 2, 3, etc., with a fixed number of words per level.
    """
    if not words:
        return {}

    shuffled_words = words[:]
    random.shuffle(shuffled_words)

    WORD_LEVELS = {}
    total_words = len(shuffled_words)
    num_levels = (total_words + words_per_level - 1) // words_per_level # Ceiling division

    for i in range(num_levels):
        start_index = i * words_per_level
        end_index = min((i + 1) * words_per_level, total_words)
        level_key = f'Level {i + 1}'
        WORD_LEVELS[level_key] = shuffled_words[start_index:end_index]
    
    print(f"Assigned {total_words} words across {num_levels} levels of ~{words_per_level} words each.")
    return WORD_LEVELS

GATED_WORD_LEVELS = assign_gated_levels(ALL_WORDS, WORDS_PER_LEVEL)

# --- Helper Functions for Quiz Data ---

def get_word_videos(word):
    """Returns a list of video files for a given word from the loaded data."""
    return WORD_DATA.get(word, {}).get('videos', [])

# --- Flask Setup ---
app = Flask(__name__)

# --- Web Routes ---

@app.route('/')
def serve_home():
    return send_from_directory('.', 'index.html')

@app.route('/<path:filename>')
def serve_static(filename):
    """Serves static files like CSS and JS."""
    return send_from_directory('.', filename)

@app.route('/Video Data/<path:filename>')
def serve_video(filename):
    """Serves video files from the Video Data directory."""
    try:
        directory = os.path.dirname(filename)
        base_filename = os.path.basename(filename)
        return send_from_directory(os.path.join(VIDEO_FOLDER, directory), base_filename)
    except FileNotFoundError:
        return jsonify({'error': 'Video not found'}), 404

@app.route('/level-data')
def get_level_data():
    """Returns the list of words for the current level and the total number of levels."""
    
    return jsonify({
        'allLevels': GATED_WORD_LEVELS,
        'totalLevels': len(GATED_WORD_LEVELS)
    })


@app.route('/quiz-data')
def get_quiz_data():
    """
    Returns all necessary data for a word, filtered by the user's current level
    and determines the quiz mode (MCQ, Video Select, or Type-In).
    """
    requested_level = request.args.get('current_level', 'Level 1') # Default to Level 1
    target_word = request.args.get('target_word', None)
    
    # The client sends the list of "unlocked" words (seen correctly in both MCQ and Video Select)
    unlocked_words_json = request.args.get('unlocked_words', '[]') 
    
    try:
        unlocked_words = set(json.loads(unlocked_words_json))
    except json.JSONDecodeError:
        unlocked_words = set()

    # 1. Filter words based on the requested Gated level
    available_words_by_level = GATED_WORD_LEVELS.get(requested_level, [])

    if not available_words_by_level:
         return jsonify({'error': f'No words available for the level: {requested_level}'}), 500

    
    # 2. Determine the actual quiz mode
    
    # Check for words in the current level that are fully unlocked (MCQ + Video Select complete)
    current_level_unlocked_words = [
        word for word in available_words_by_level 
        if word in unlocked_words
    ]
    
    # If the Type-In pool is empty (no words mastered yet), we cannot serve Type-In
    if not current_level_unlocked_words:
        actual_quiz_mode = random.choice(['mcq', 'video_select'])
        current_pool = available_words_by_level
    else:
        # If Type-In words are available, give it a 1/3 chance.
        actual_quiz_mode = random.choice(['mcq', 'video_select', 'typein'])
        
        if actual_quiz_mode == 'typein':
            current_pool = current_level_unlocked_words
        else:
            # For MCQ/Video Select, we draw from the entire level pool
            current_pool = available_words_by_level

    if not current_pool:
        return jsonify({'error': 'No words available for quiz in the selected mode/level.'}), 500
    
    # 3. Select the correct word based on the determined mode
    
    # If a specific word is requested (for review), ensure it's in the current pool
    if target_word and target_word.lower() in current_pool and target_word.lower() in WORD_DATA:
        correct_word = target_word.lower()
    else:
        # Select a random word from the filtered list
        correct_word = random.choice(current_pool)
    
    correct_word_data = WORD_DATA.get(correct_word)
    if not correct_word_data or not correct_word_data['videos']:
        return jsonify({'error': f'No videos found for {correct_word}'}), 500

    correct_word_videos = correct_word_data['videos']

    # 4. Prepare data based on the determined mode
    data = {
        'correctWord': correct_word,
        'actualQuizMode': actual_quiz_mode, 
        'levelWordCount': len(available_words_by_level) # Send the total word count for progression check
    }

    # Distractors (needed for all three modes)
    distractors = set()
    # Ensure distractors are not the correct word and are actual loaded words
    while len(distractors) < 3:
        random_word = random.choice(ALL_WORDS)
        if random_word != correct_word and random_word not in distractors:
            distractors.add(random_word)
    distractor_words = list(distractors)

    if actual_quiz_mode == 'mcq' or actual_quiz_mode == 'typein':
        # Select the main video for the correct word (used by Video-to-Word modes)
        random_correct_video = random.choice(correct_word_videos)
        data['videoUrl'] = random_correct_video  
        
        if actual_quiz_mode == 'mcq':
            # Prepare Word Options (MCQ)
            word_options = [correct_word] + distractor_words
            random.shuffle(word_options)
            data['options'] = word_options       
        
    elif actual_quiz_mode == 'video_select':
        # Prepare Video Options (for Word-to-Video mode)
        
        # We need 4 total video options (1 correct, 3 distractors)
        video_options = []
        
        # Add the correct video
        video_options.append({'word': correct_word, 'videoUrl': random.choice(correct_word_videos)})
        
        # Add distractor videos
        for d_word in distractor_words:
            d_videos = get_word_videos(d_word)
            if d_videos:
                # Add a random video for the distractor word
                video_options.append({'word': d_word, 'videoUrl': random.choice(d_videos)})
        
        # If we didn't manage to get 4 videos, we just shuffle what we have.
        random.shuffle(video_options)
        data['videoOptions'] = video_options 

    return jsonify(data)

if __name__ == '__main__':
    app.run(debug=True)
