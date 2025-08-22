# v0.dev Screenshot to HTML Generator

Generate HTML webpages from screenshots using the v0.dev Platform API.

## Quick Setup

### 1. Install Dependencies
\`\`\`bash
npm install
\`\`\`

### 2. Get Your API Key
1. Go to [v0.dev/chat/settings/keys](https://v0.dev/chat/settings/keys)
2. Create a new API key
3. Copy the key

### 3. Configure Environment Variables
1. Copy the example file:
   \`\`\`bash
   cp .env.example .env.local
   \`\`\`

2. Edit `.env.local` and add your actual API key:
   \`\`\`env
   V0_API_KEY=your_actual_api_key_here
   \`\`\`

### 4. Start the Server
\`\`\`bash
npm start
\`\`\`

For development with auto-restart:
\`\`\`bash
npm run dev
\`\`\`

### 5. Open Your Browser
Navigate to `http://localhost:3000`

## File Structure
\`\`\`
project-root/
├── index.html          # Main web interface
├── server-v0.js        # Node.js backend server
├── package.json        # Dependencies and scripts
├── .env.local          # Your API keys (DO NOT commit)
├── .env.example        # Template for environment variables
├── .gitignore          # Excludes .env files from git
├── uploads/            # Temporary file storage (auto-created)
└── README.md           # This file
\`\`\`

## Security Notes

⚠️ **IMPORTANT**: Never commit your `.env.local` file to version control!

- ✅ `.env.local` is in `.gitignore` 
- ✅ Use `.env.example` as a template
- ✅ Share `.env.example` publicly, never `.env.local`

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `V0_API_KEY` | Yes | Your v0.dev API key |
| `PORT` | No | Server port (defaults to 3000) |

## Troubleshooting

**"V0_API_KEY environment variable is not set"**
- Make sure `.env.local` exists in your project root
- Check that `V0_API_KEY=your_key` is in the file
- Restart your server after adding the key

**"Invalid V0_API_KEY"**
- Verify your API key is correct in `.env.local`
- Check that your v0.dev account has API access

## How It Works

1. Upload a screenshot through the web interface
2. Server processes the image and sends it to v0.dev API
3. v0.dev generates HTML code based on the screenshot
4. Returns links to the generated chat and live preview
