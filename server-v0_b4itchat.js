require("dotenv").config({ path: ".env.local" })

const express = require("express")
const multer = require("multer")
const path = require("path")
const fs = require("fs")
const cors = require("cors")
const { generateText } = require("ai")
const { vercel } = require("@ai-sdk/vercel")

const app = express()
const PORT = Number.parseInt(process.env.PORT) || 3000

const VERCEL_API_KEY = process.env.VERCEL_API_KEY

if (!VERCEL_API_KEY) {
  console.error("❌ VERCEL_API_KEY environment variable is not set in .env.local file")
  console.error("Please create a .env.local file and add your API key:")
  console.error("VERCEL_API_KEY=your_actual_api_key_here")
  process.exit(1)
}

const upload = multer({ dest: "uploads/" })

app.use(cors())
app.use(express.json())
app.use(express.static(".")) // Serve static files including index.html

app.use("/uploads", express.static("uploads"))

app.get("/health", (req, res) => {
  res.json({ status: "OK", timestamp: new Date().toISOString() })
})

app.post("/generate", upload.single("screenshot"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded" })
    }

    if (!VERCEL_API_KEY) {
      return res.status(500).json({
        error: "VERCEL_API_KEY not configured. Please add it to your .env.local file.",
      })
    }

    console.log("[v0] Processing screenshot:", req.file.filename)

    const userPrompt = req.body.prompt
    const includeJS = req.body.include_javascript === "true"
    const makeInteractive = req.body.make_interactive === "true"

    console.log("Frontend prompt:", userPrompt)
    console.log("Include JavaScript:", includeJS)
    console.log("Make Interactive:", makeInteractive)

    let prompt =
      userPrompt ||
      `Create a complete, standalone HTML file that recreates the UI shown in the screenshot as accurately as possible. Make it fully interactive and functional - all buttons, forms, dropdowns, and interactive elements should work with JavaScript. Include all necessary CSS and JavaScript inline within the HTML file. Make sure it's a pixel-perfect recreation with proper hover effects, animations, and user interactions.`

    if (includeJS || makeInteractive) {
      prompt += `

IMPORTANT: This must include JavaScript functionality:
- All buttons and interactive elements must be functional
- Include event handlers for clicks, hovers, form submissions
- Add animations and transitions where appropriate
- Make dropdowns, modals, tabs, and other UI components fully working
- Use vanilla JavaScript (no external libraries required)
- Include all JavaScript code within <script> tags in the HTML file
- Make sure every interactive element visible in the screenshot actually works`
    }

    console.log("Final prompt being sent:", prompt)

    const imageBuffer = fs.readFileSync(req.file.path)
    const imageBase64 = imageBuffer.toString("base64")
    const mimeType = `image/${path.extname(req.file.originalname).slice(1)}`

    const response = await generateText({
      model: vercel("v0-1.0-md"),
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: prompt,
            },
            {
              type: "image",
              image: `data:${mimeType};base64,${imageBase64}`,
            },
          ],
        },
      ],
      temperature: 0.7,
      maxTokens: 8000, // Increase for longer responses with JS
    })

    console.log("Response length:", response.text.length)
    console.log("Contains <script>:", response.text.includes("<script>"))
    console.log(
      "Contains JavaScript keywords:",
      /function|addEventListener|querySelector|getElementById/.test(response.text),
    )

    fs.unlink(req.file.path, (err) => {
      if (err) console.error("Error deleting file:", err)
    })

    console.log("[v0] Generation complete!")

    res.json({
      success: true,
      text: response.text,
      message: "HTML generated successfully!",
      debug: {
        promptUsed: prompt,
        responseLength: response.text.length,
        hasScript: response.text.includes("<script>"),
        hasJSKeywords: /function|addEventListener|querySelector|getElementById/.test(response.text),
      },
    })
  } catch (error) {
    console.error("Generation error:", error)

    if (req.file) {
      fs.unlink(req.file.path, (err) => {
        if (err) console.error("Error deleting file:", err)
      })
    }

    if (error.message.includes("Invalid API key")) {
      return res.status(401).json({
        error: "Invalid VERCEL_API_KEY. Please check your API key in .env.local file.",
      })
    }

    res.status(500).json({
      error: "Failed to generate HTML. Please try again.",
    })
  }
})

app.post("/chat", async (req, res) => {
  try {
    const { message, conversationHistory, currentHtml } = req.body

    if (!message) {
      return res.status(400).json({ error: "No message provided" })
    }

    if (!VERCEL_API_KEY) {
      return res.status(500).json({
        error: "VERCEL_API_KEY not configured. Please add it to your .env.local file.",
      })
    }

    console.log("[v0] Processing chat message:", message)

    // Build conversation context
    const messages = []

    // Add conversation history (excluding images for follow-up messages)
    conversationHistory.forEach((msg, index) => {
      if (msg.role === "user" && msg.hasImage && index === 0) {
        // Skip the first message with image as we'll reference the current HTML instead
        return
      }
      messages.push({
        role: msg.role,
        content: msg.content,
      })
    })

    // Add current context and user request
    const contextPrompt = `Here is the current HTML code I'm working with:

\`\`\`html
${currentHtml}
\`\`\`

User request: ${message}

Please provide an updated version of the complete HTML file with the requested changes. Make sure to:
- Keep all existing functionality that wasn't mentioned for changes
- Maintain the same structure and styling unless specifically asked to change it
- Include all CSS and JavaScript inline within the HTML file
- Make sure all interactive elements continue to work properly
- Only modify what was specifically requested

Provide the complete updated HTML file.`

    messages.push({
      role: "user",
      content: contextPrompt,
    })

    console.log("Sending chat request with", messages.length, "messages")

    const response = await generateText({
      model: vercel("v0-1.0-md"),
      messages: messages,
      temperature: 0.7,
      maxTokens: 8000,
    })

    console.log("Chat response length:", response.text.length)
    console.log("Contains <script>:", response.text.includes("<script>"))

    console.log("[v0] Chat response complete!")

    res.json({
      success: true,
      text: response.text,
      message: "HTML updated successfully!",
      debug: {
        messageLength: message.length,
        responseLength: response.text.length,
        hasScript: response.text.includes("<script>"),
        conversationLength: conversationHistory.length,
      },
    })
  } catch (error) {
    console.error("Chat error:", error)

    if (error.message.includes("Invalid API key")) {
      return res.status(401).json({
        error: "Invalid VERCEL_API_KEY. Please check your API key in .env.local file.",
      })
    }

    res.status(500).json({
      error: "Failed to process chat message. Please try again.",
    })
  }
})

function findAvailablePort(startPort) {
  return new Promise((resolve, reject) => {
    const server = app.listen(startPort, () => {
      const port = server.address().port
      server.close(() => resolve(port))
    })

    server.on("error", (err) => {
      if (err.code === "EADDRINUSE") {
        resolve(findAvailablePort(Number.parseInt(startPort) + 1))
      } else {
        reject(err)
      }
    })
  })
}

async function startServer() {
  try {
    const availablePort = await findAvailablePort(PORT)

    app.listen(availablePort, () => {
      console.log(`🚀 Experimental Realism AI Server running on http://localhost:${availablePort}`)
      console.log(`📁 Upload interface available at http://localhost:${availablePort}`)
      console.log(`❤️  Health check: http://localhost:${availablePort}/health`)

      if (availablePort !== PORT) {
        console.log(`⚠️  Port ${PORT} was busy, using port ${availablePort} instead`)
      }
    })
  } catch (error) {
    console.error("❌ Failed to start server:", error)
    process.exit(1)
  }
}

startServer()
