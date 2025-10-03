# **🤟 Visible Voice: A Progressive Sign Language Quiz App**

Visible Voice is an interactive, level-based quiz application designed to help users learn and master sign language vocabulary through varied practice modes. It enforces a strict mastery requirement across multiple quiz formats before allowing progression, ensuring deep retention and understanding.

## **✨ Features**

### **1\. Progressive, Mastery-Gated Levels**

The application features a structured, self-paced learning path:

* **Level Progression:** Users must correctly answer **all** words in the current level across **all three** quiz modes (MCQ, Video Select, and Type-In) to automatically unlock the next level.  
* **Focused Learning:** Each level contains approximately 15 words, providing manageable learning blocks.

### **2\. Integrated Quiz Modes for Deep Mastery**

The app randomly selects questions from three modes to test different aspects of sign recognition and recall:

| Mode | Description | Mastery Focus | Prerequisite |
| :---- | :---- | :---- | :---- |
| **MCQ** (Video-to-Word) | Watch a video sign, select the correct word from 4 options. | Sign recognition | None |
| **Video Select** (Word-to-Video) | Read a word, select the correct signing video from 4 options. | Word recall/Visual association | None |
| **Type-In** (Video-to-Word) | Watch a video sign, type the correct word. | Active recall/Spelling | **Must be answered correctly in both MCQ and Video Select mode first.** |

### **3\. Review Queue**

Any word answered incorrectly is automatically added to a dedicated **Review Mode** queue, allowing the user to focus on their weak points.

### **4\. Aesthetic Design**

The user interface utilizes a modern **Material You Expressive** theme, featuring bold colors, rounded corners, and elevated elements for an engaging visual experience.

## **🛠️ Technology Stack**

* **Frontend:** HTML5, CSS3 (Custom Styles with Material You principles), JavaScript.  
* **Backend:** Python with Flask (for serving quiz data and videos).

## **🚀 Installation & Setup**

### **Prerequisites**

* Python (3.7+)  
* The Flask framework (pip install flask)  
* Sign Language video assets organized by word (e.g., Video Data/hello/video1.mp4).

### **Steps**

1. **Clone the Repository (or setup files):** Ensure you have the following files: server.py, index.html, app.js, and style.css.  
2. **Create Video Data:** Create a folder named Video Data in the same directory as server.py. Inside it, create subdirectories for each word (e.g., Video Data/apple, Video Data/banana) and place the corresponding video files within them.  
3. **Run the Server:** Open your terminal in the project directory and run:  
   python server.py

4. **Access the App:** The server will typically run on http://127.0.0.1:5000/. Open this address in your web browser.

## **🎮 How to Play**

1. **Start Quiz:** The app automatically loads a random question in Level 1 (either **MCQ** or **Video Select**).  
2. **Answer:** Select the correct option or type in the word (in Type-In mode).  
3. **Progress:** Upon continuous correct answers, you will be served the same word across different modes. Once a word is mastered in all three modes, it is counted toward your level completion.  
4. **Advance Level:** When all words in the current level are fully mastered, the app automatically progresses you to the next level.  
5. **Review:** If you miss a sign, use the **Review Mode** button to cycle through your missed words.
