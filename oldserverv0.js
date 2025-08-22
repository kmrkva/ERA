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

// Declare upload variable
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

    // Use the prompt from the frontend if provided, otherwise use enhanced default
    const userPrompt = req.body.prompt
    const includeJS = req.body.include_javascript === 'true'
    const makeInteractive = req.body.make_interactive === 'true'
    
    console.log("Frontend prompt:", userPrompt)
    console.log("Include JavaScript:", includeJS)
    console.log("Make Interactive:", makeInteractive)

    let prompt = userPrompt || `Create a complete, standalone HTML file that recreates the UI shown in the screenshot as accurately as possible. Make it fully interactive and functional - all buttons, forms, dropdowns, and interactive elements should work with JavaScript. Include all necessary CSS and JavaScript inline within the HTML file. Make sure it's a pixel-perfect recreation with proper hover effects, animations, and user interactions.`

    // Enhance prompt if JavaScript flags are set
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
      // Add generation parameters that might help with JavaScript generation
      temperature: 0.7,
      maxTokens: 8000, // Increase for longer responses with JS
    })

    // Log response details for debugging
    console.log("Response length:", response.text.length)
    console.log("Contains <script>:", response.text.includes('<script>'))
    console.log("Contains JavaScript keywords:", /function|addEventListener|querySelector|getElementById/.test(response.text))

    // Clean up uploaded file
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
        hasScript: response.text.includes('<script>'),
        hasJSKeywords: /function|addEventListener|querySelector|getElementById/.test(response.text)
      }
    })
  } catch (error) {
    console.error("Generation error:", error)

    // Clean up uploaded file on error
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
      console.log(`🚀 Server running on http://localhost:${availablePort}`)
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