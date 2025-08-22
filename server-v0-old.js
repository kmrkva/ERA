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

    const prompt = `Please recreate this design as a complete HTML webpage. 
    Analyze the screenshot and build a pixel-perfect recreation with:
    - Exact layout and positioning
    - Matching colors and typography  
    - Responsive design
    - Clean, semantic HTML
    - Modern CSS styling
    
    Make it a complete, standalone HTML file that matches the design shown in the image.`

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
    })

    // Clean up uploaded file
    fs.unlink(req.file.path, (err) => {
      if (err) console.error("Error deleting file:", err)
    })

    console.log("[v0] Generation complete!")

    res.json({
      success: true,
      text: response.text,
      message: "HTML generated successfully!",
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
