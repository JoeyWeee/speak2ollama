const express = require("express");
const WebSocket = require("ws");
const bodyParser = require("body-parser");
const cors = require("cors");

const app = express();
const PORT = 8000;

// Middleware to allow cross-origin requests and parse JSON data
app.use(cors());
app.use(bodyParser.json());

// Dynamically import the 'node-fetch' module
let fetch;
(async () => {
  fetch = (await import("node-fetch")).default; // Dynamically load node-fetch

  // Warm up Ollama API by making an initial request
  await warmUpOllamaAPI();

  // WebSocket server to handle real-time communication
  const wss = new WebSocket.Server({ port: 8080 });

  // Handling WebSocket connections
  wss.on("connection", (ws) => {
    let language = "";

    // Listen for messages from clients
    ws.on("message", async (message) => {
      console.log("Received message:", message);

      try {
        const messageStr = message.toString(); // Convert Buffer to string
        const data = JSON.parse(messageStr); // Parse the string into a JSON object

        // If language data is provided, store it
        if (data.language) {
          language = data.language;
          console.log("Language set to:", language);
        } else {
          console.log("No language field, processing voice data...");

          const inputText = data.text; // Assume voice data is provided as text
          const translation = await translateToBothLanguages(inputText); // Translate the text to both languages

          // Send the translations back to the client
          ws.send(
            JSON.stringify({
              language: language,
              translation: {
                chinese: translation.chinese,
                english: translation.english,
              },
            })
          );
        }
      } catch (error) {
        console.error("Error parsing message:", error);
      }
    });
  });
})();

// Function to "warm up" Ollama API to ensure it's ready for use
async function warmUpOllamaAPI() {
  try {
    console.log("Preheating Ollama API...");
    const response = await fetch("http://localhost:11434/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "llama3.2",
        messages: [{ role: "user", content: "Now, I'm going to ask you a few questions. Please respond to the questions in the quotes based on the prompts." }], // Test query
        stream: false,
      }),
    });

    if (!response.ok) {
      throw new Error("Ollama API warm-up failed, response status:" + response.status);
    }

    const data = await response.json();
    console.log("Ollama API warmed up successfully:", data.message?.content || "No response content");
  } catch (error) {
    console.error("Error during Ollama API warm-up:", error);
  }
}

// Function to perform translations using Ollama API
async function translateToBothLanguages(inputText) {
  if (!inputText) return { chinese: "", english: "" }; // Return empty translations if input is empty

  try {
    // Parallel translation requests for both Chinese and English
    const [chineseResponse, englishResponse] = await Promise.all([
      fetch("http://localhost:11434/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "llama3.2",
          messages: [
            { role: "user", content: `请用中文回答这个问题: "${inputText}"` }, // 用中文提问
          ],
          stream: false,
        }),
      }),
      fetch("http://localhost:11434/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "llama3.2",
          messages: [
            { role: "user", content: `Please answer this question in English: "${inputText}"` }, // 用英文提问
          ],
          stream: false,
        }),
      }),
    ])
    ;

    // Check if both API responses are successful
    if (!chineseResponse.ok || !englishResponse.ok) {
      throw new Error("API request failed");
    }

    // Parse the responses to extract the translations
    const chineseData = await chineseResponse.json();
    const englishData = await englishResponse.json();

    const chineseTranslation = chineseData.message.content;
    const englishTranslation = englishData.message.content;

    return {
      chinese: chineseTranslation || "翻译失败 (中文)", // Fallback if translation fails
      english: englishTranslation || "Translation failed (English)", // Fallback if translation fails
    };
  } catch (error) {
    console.error("Translation error:", error);
    return {
      chinese: "翻译失败 (中文)",
      english: "Translation failed (English)",
    };
  }
}

// Start the Express server on the specified port
app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
