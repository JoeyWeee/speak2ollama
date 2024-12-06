// DOM elements for buttons and output divs
const startChineseButton = document.getElementById("startChinese");
const startEnglishButton = document.getElementById("startEnglish");
const chineseOutput = document.getElementById("chineseOutput");
const englishOutput = document.getElementById("englishOutput");
const inputOutput = document.getElementById("inputOutput");

// Flags to track if speech recognition is active for Chinese and English
let isChineseListening = false;
let isEnglishListening = false;

// Speech recognition objects for Chinese and English
let chineseRecognition, englishRecognition;
let socket;
let isSocketOpen = false; // Tracks if the WebSocket connection is open
let language = ""; // Tracks the current language setting

// Initialize WebSocket connection
function setupWebSocket() {
  socket = new WebSocket("ws://localhost:8080");

  socket.onopen = () => {
    isSocketOpen = true;
    console.log("WebSocket connection established");
  };

  socket.onmessage = (event) => {
    const data = JSON.parse(event.data);
    console.log("Received translation results:", data);

    // Update outputs with the translation results
    if (data.translation) {
      updateOutput(chineseOutput, data.translation.chinese);
      updateOutput(englishOutput, data.translation.english);
    }
  };

  socket.onerror = (error) => {
    console.error("WebSocket error:", error);
  };

  socket.onclose = () => {
    isSocketOpen = false;
    console.warn("WebSocket connection closed, reconnecting...");
    setTimeout(setupWebSocket, 1000); // Auto reconnect if WebSocket closes
  };
}

// Start WebSocket connection
setupWebSocket();

// Web Speech API initialization check
if ("webkitSpeechRecognition" in window) {
  chineseRecognition = new webkitSpeechRecognition();
  chineseRecognition.continuous = true;
  chineseRecognition.interimResults = true;
  chineseRecognition.lang = "zh-CN";

  englishRecognition = new webkitSpeechRecognition();
  englishRecognition.continuous = true;
  englishRecognition.interimResults = true;
  englishRecognition.lang = "en-US";
} else {
  alert("Sorry, your browser does not support speech recognition!");
}

// Scroll to the bottom of the output element
function scrollToBottom(outputElement) {
  outputElement.scrollTop = outputElement.scrollHeight;
}

// Update the output element with new text and scroll to the bottom
function updateOutput(outputElement, newText) {
  const newDiv = document.createElement("div");
  newDiv.classList.add("transcript-item");
  newDiv.textContent = newText;
  outputElement.appendChild(newDiv);
  scrollToBottom(outputElement);
}

// Start speech recognition for a specific language
function startRecognition(recognition, lang, currentButton, otherButton) {
  // Check if recognition is already in progress to prevent duplicate starts
  if (
    (recognition === chineseRecognition && isChineseListening) ||
    (recognition === englishRecognition && isEnglishListening)
  ) {
    console.warn("Voice recognition is already in progress, cannot start again!");
    return;
  }

  if (!recognition || !isSocketOpen) {
    console.error("WebSocket or speech recognition not ready!");
    return;
  }

  // Disable the other language button and change text of the current button
  otherButton.disabled = true;
  currentButton.textContent = "Stop";
  recognition.lang = lang;
  recognition.start();

  if (recognition === chineseRecognition) {
    isChineseListening = true;
  } else {
    isEnglishListening = true;
  }

  // Handle the result of speech recognition
  recognition.onresult = (event) => {
    let finalTranscript = "";

    // Combine results into final transcript
    for (let i = 0; i < event.results.length; i++) {
      if (event.results[i].isFinal) {
        finalTranscript = event.results[i][0].transcript + finalTranscript;
      }
    }

    // If there is new speech input, update the UI and send data to WebSocket
    if (finalTranscript) {
      const inputDiv = document.querySelector("div#inputOutput");
      const newDiv = document.createElement("div");
      newDiv.classList.add("transcript-item");
      newDiv.textContent = finalTranscript;
      inputDiv.appendChild(newDiv);
      scrollToBottom(inputDiv);

      // Send the transcript to WebSocket for translation
      if (socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify({ text: finalTranscript }));
      } else {
        console.error("WebSocket is not ready to send data");
      }
    }
  };

  // Handle errors in speech recognition
  recognition.onerror = (event) => {
    console.error("Speech recognition error:", event.error);
    stopRecognition(recognition);
    alert("Voice recognition error, please try again!");
  };
}

// Stop speech recognition for a specific language
function stopRecognition(recognition) {
  if (recognition === chineseRecognition) {
    isChineseListening = false;
    startChineseButton.textContent = "开始中文输入"; // Reset button text
  } else {
    isEnglishListening = false;
    startEnglishButton.textContent = "Start English Input"; // Reset button text
  }

  // Enable buttons again after stopping recognition
  startChineseButton.disabled = false;
  startEnglishButton.disabled = false;
  recognition.stop();
}

// Event listeners for button clicks
startChineseButton.addEventListener("click", () => {
  if (!isChineseListening) {
    language = "zh-CN"; // Set language to Chinese
    if (isSocketOpen) {
      socket.send(JSON.stringify({ language })); // Send language setting to WebSocket
    }
    startRecognition(chineseRecognition, "zh-CN", startChineseButton, startEnglishButton);
  } else {
    stopRecognition(chineseRecognition); // Stop recognition if already running
  }
});

startEnglishButton.addEventListener("click", () => {
  if (!isEnglishListening) {
    language = "en-US"; // Set language to English
    if (isSocketOpen) {
      socket.send(JSON.stringify({ language })); // Send language setting to WebSocket
    }
    startRecognition(englishRecognition, "en-US", startEnglishButton, startChineseButton);
  } else {
    stopRecognition(englishRecognition); // Stop recognition if already running
  }
});
