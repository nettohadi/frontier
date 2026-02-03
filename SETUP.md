# Frontier - Setup Guide

A spiritual video generation and YouTube automation platform that creates AI-powered short videos with text-to-speech narration.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Installation](#installation)
3. [Environment Configuration](#environment-configuration)
4. [Asset Setup](#asset-setup)
5. [Database Setup](#database-setup)
6. [Running the Application](#running-the-application)
7. [Cloudflare Tunnel Setup](#cloudflare-tunnel-setup)
8. [Architecture Overview](#architecture-overview)
9. [Troubleshooting](#troubleshooting)

---

## Prerequisites

### Required Software

1. **Node.js** (v18 or higher)
   ```bash
   # Check version
   node --version

   # Install via Homebrew on Mac
   brew install node
   ```

2. **PostgreSQL** (v14 or higher)
   ```bash
   # Install via Homebrew
   brew install postgresql@15

   # Start PostgreSQL service
   brew services start postgresql@15

   # Create database
   createdb frontier
   ```

3. **Redis** (v7 or higher)
   ```bash
   # Install via Homebrew
   brew install redis

   # Start Redis service
   brew services start redis

   # Verify Redis is running
   redis-cli ping
   # Should return: PONG
   ```

4. **FFmpeg** (required for video rendering)
   ```bash
   # Install via Homebrew
   brew install ffmpeg

   # Verify installation
   ffmpeg -version
   ```

### Required API Keys

You'll need accounts and API keys from:

| Service | Purpose | Sign Up |
|---------|---------|---------|
| OpenRouter | LLM for script generation | https://openrouter.ai |
| ElevenLabs | Text-to-speech | https://elevenlabs.io |
| Fal.ai | AI image generation | https://fal.ai |
| Publer | YouTube scheduling | https://publer.io |

---

## Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/nettohadi/frontier.git
   cd frontier
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Copy environment template**
   ```bash
   cp .env.example .env
   # Or create .env manually (see next section)
   ```

---

## Environment Configuration

Create a `.env` file in the project root with the following variables:

```env
# ===================
# Database & Queue
# ===================
DATABASE_URL="postgresql://username:password@localhost:5432/frontier"
REDIS_HOST="localhost"
REDIS_PORT="6379"

# ===================
# External API Keys
# ===================
# OpenRouter - LLM for script generation
# Get from: https://openrouter.ai/keys
OPENROUTER_API_KEY="sk-or-v1-your-key-here"

# ElevenLabs - Text-to-speech
# Get from: https://elevenlabs.io/app/settings/api-keys
ELEVENLABS_API_KEY="sk_your-key-here"
ELEVENLABS_VOICE_ID="your-voice-id"

# Fal.ai - Image generation
# Get from: https://fal.ai/dashboard/keys
FAL_KEY="your-fal-key-here"

# Publer - YouTube scheduling (optional, for auto-upload)
# Get from: https://publer.io/app/settings/api
PUBLER_KEY="your-publer-key-here"
PUBLER_WORKSPACE_ID="your-workspace-id"
PUBLER_DRAFT_MODE="false"  # Set to "true" for testing (creates drafts instead of publishing)

# ===================
# File Paths
# ===================
ASSETS_PATH="assets/backgrounds"
MUSICS_PATH="assets/musics"
OUTPUT_PATH="output"
TEMP_PATH="temp"
```

### Finding Your ElevenLabs Voice ID

1. Go to https://elevenlabs.io/app/voice-library
2. Select or create a voice
3. Click the voice settings
4. Copy the Voice ID from the URL or settings panel

---

## Asset Setup

The following asset folders are required but **not included in the repository** (they contain large media files):

### Directory Structure

```
frontier/
├── assets/
│   ├── backgrounds/     # Background videos (MP4)
│   ├── musics/          # Background music (MP3)
│   ├── overlays/        # Overlay animations (MP4, transparent)
│   └── voices/          # Custom voice samples (optional)
├── output/              # Generated videos (auto-created)
└── temp/                # Temporary files (auto-created)
```

### 1. Background Videos (`assets/backgrounds/`)

Place vertical (9:16 aspect ratio) MP4 videos here. These are used as backgrounds for the BACKGROUND_VIDEO render mode.

**Required format:**
- Resolution: 1080x1920 (vertical/portrait)
- Format: MP4 (H.264)
- Duration: 60+ seconds recommended

**Example files:**
- `forest.mp4` - Forest scenery
- `mountain.mp4` - Mountain landscape
- `ocean.mp4` - Ocean waves
- `rain.mp4` - Rain visuals
- etc.

After adding videos, seed them to the database:
```bash
npm run db:seed
```

### 2. Background Music (`assets/musics/`)

Place ambient/background music MP3 files here. The system rotates through these for variety.

**Recommended:**
- Calm, meditative music
- No lyrics (instrumental only)
- 2-5 minutes duration
- MP3 format

### 3. Overlays (`assets/overlays/`)

Optional animated overlays (transparent MP4 with alpha channel) that are composited over the video.

**Examples:**
- Dust particles
- Light rays
- Bokeh effects
- Subtle animations

### 4. Create Required Directories

```bash
# Create asset directories if they don't exist
mkdir -p assets/backgrounds assets/musics assets/overlays assets/voices
mkdir -p output temp

# Add .gitkeep files to preserve empty directories
touch assets/backgrounds/.gitkeep
touch assets/musics/.gitkeep
touch assets/overlays/.gitkeep
touch assets/voices/.gitkeep
```

---

## Database Setup

1. **Generate Prisma client**
   ```bash
   npx prisma generate
   ```

2. **Run database migrations**
   ```bash
   npx prisma migrate deploy
   # Or for development:
   npx prisma db push
   ```

3. **Seed the database** (topics, background videos)
   ```bash
   npm run db:seed
   ```

4. **Verify setup** (optional)
   ```bash
   # Open Prisma Studio to view data
   npx prisma studio
   ```

---

## Running the Application

You need to run **two processes** simultaneously:

### Terminal 1: Next.js Web Server

```bash
npm run dev
```

This starts the web interface at `http://localhost:9999`

### Terminal 2: Worker Process

```bash
npm run worker:dev
```

This runs the job processor that handles video generation.

### Production Mode

```bash
# Build the application
npm run build

# Start the web server
npm run start

# Start the worker (in another terminal)
npm run worker
```

### Available Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Start dev server (port 9999) |
| `npm run worker:dev` | Run worker with hot-reload |
| `npm run build` | Build for production |
| `npm run start` | Start production server |
| `npm run worker` | Run worker (production) |
| `npm run db:push` | Sync schema to database |
| `npm run db:migrate` | Run migrations |
| `npm run db:studio` | Open Prisma Studio |
| `npm run db:seed` | Seed database |
| `npm run format` | Format code with Prettier |

---

## Cloudflare Tunnel Setup

Cloudflare Tunnel allows you to expose your local application to the internet securely without opening ports on your router.

### 1. Install cloudflared

```bash
# On Mac (Homebrew)
brew install cloudflared

# Verify installation
cloudflared --version
```

### 2. Authenticate with Cloudflare

```bash
cloudflared tunnel login
```

This opens a browser window. Log in with your Cloudflare account and authorize the connection.

### 3. Create a Tunnel

```bash
# Create a new tunnel (replace 'frontier' with your preferred name)
cloudflared tunnel create frontier

# This creates a credentials file at:
# ~/.cloudflared/<TUNNEL_ID>.json
```

Note the Tunnel ID shown in the output.

### 4. Configure the Tunnel

Create a config file at `~/.cloudflared/config.yml`:

```yaml
tunnel: <TUNNEL_ID>
credentials-file: /Users/<your-username>/.cloudflared/<TUNNEL_ID>.json

ingress:
  # Main web application
  - hostname: frontier.yourdomain.com
    service: http://localhost:9999

  # Catch-all rule (required)
  - service: http_status:404
```

Replace:
- `<TUNNEL_ID>` with your actual tunnel ID
- `<your-username>` with your macOS username
- `frontier.yourdomain.com` with your desired subdomain

### 5. Add DNS Record

```bash
# Route your subdomain to the tunnel
cloudflared tunnel route dns frontier frontier.yourdomain.com
```

This automatically creates a CNAME record in Cloudflare DNS.

### 6. Run the Tunnel

```bash
# Start the tunnel
cloudflared tunnel run frontier
```

Your application is now accessible at `https://frontier.yourdomain.com`

### 7. Run Tunnel as a Service (Recommended for Mac Mini)

To keep the tunnel running after logout:

```bash
# Install as a service
sudo cloudflared service install

# Start the service
sudo launchctl start com.cloudflare.cloudflared

# Check status
sudo launchctl list | grep cloudflare
```

**Alternative: Using launchd directly**

Create `~/Library/LaunchAgents/com.cloudflare.frontier.plist`:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.cloudflare.frontier</string>
    <key>ProgramArguments</key>
    <array>
        <string>/opt/homebrew/bin/cloudflared</string>
        <string>tunnel</string>
        <string>run</string>
        <string>frontier</string>
    </array>
    <key>RunAtLoad</key>
    <true/>
    <key>KeepAlive</key>
    <true/>
    <key>StandardOutPath</key>
    <string>/tmp/cloudflared.out.log</string>
    <key>StandardErrorPath</key>
    <string>/tmp/cloudflared.err.log</string>
</dict>
</plist>
```

Load the service:
```bash
launchctl load ~/Library/LaunchAgents/com.cloudflare.frontier.plist
```

### Complete Startup Script for Mac Mini

Create a startup script `~/start-frontier.sh`:

```bash
#!/bin/bash

# Navigate to project directory
cd /Users/<your-username>/Documents/projects/frontier

# Start Redis if not running
brew services start redis

# Start PostgreSQL if not running
brew services start postgresql@15

# Start the worker in the background
npm run worker:dev > /tmp/frontier-worker.log 2>&1 &

# Start the Next.js server
npm run dev
```

Make it executable:
```bash
chmod +x ~/start-frontier.sh
```

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                     USER INTERFACE                          │
│              Next.js Frontend (Port 9999)                   │
│   Dashboard | Videos | Schedule | Topics | Settings         │
└─────────────────────────┬───────────────────────────────────┘
                          │
┌─────────────────────────▼───────────────────────────────────┐
│                    API ROUTES                               │
│  /api/videos     - Video CRUD                              │
│  /api/topics     - Topic management                        │
│  /api/upload/*   - YouTube scheduling                      │
│  /api/settings/* - Service configuration                   │
└─────────────────────────┬───────────────────────────────────┘
                          │
┌─────────────────────────▼───────────────────────────────────┐
│                  BULLMQ JOB QUEUE                          │
│              (Redis-backed, Port 6379)                     │
│  Concurrency: 2 jobs | Rate: 10/min | Retries: 3          │
└─────────────────────────┬───────────────────────────────────┘
                          │
┌─────────────────────────▼───────────────────────────────────┐
│                   WORKER PROCESS                            │
│                                                             │
│  Pipeline for AI_IMAGES mode:                              │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌─────────┐        │
│  │ Script   │→│ Image    │→│ Generate │→│ TTS     │        │
│  │ (OpenAI) │ │ Prompts  │ │ Images   │ │(11Labs) │        │
│  └──────────┘ └──────────┘ │ (Fal.ai) │ └────┬────┘        │
│                            └──────────┘      │             │
│  ┌──────────┐ ┌──────────┐                   │             │
│  │ Auto     │←│ Render   │←──────────────────┘             │
│  │ Upload   │ │ (FFmpeg) │← SRT Generation                 │
│  │ (Publer) │ └──────────┘                                 │
│  └──────────┘                                              │
└─────────────────────────────────────────────────────────────┘
                          │
┌─────────────────────────▼───────────────────────────────────┐
│                    POSTGRESQL                               │
│  Videos | Topics | Schedules | Settings | Rotation         │
└─────────────────────────────────────────────────────────────┘
```

### Video Generation Pipeline

1. **Script Generation** - OpenRouter LLM creates spiritual script
2. **Image Prompts** - Extracts visual prompts with color schemes
3. **Image Generation** - Fal.ai generates 720x1280 images
4. **Text-to-Speech** - ElevenLabs converts script to audio
5. **SRT Generation** - Creates subtitle timing from TTS data
6. **Video Rendering** - FFmpeg composites everything
7. **Auto Upload** - Publer schedules to YouTube

---

## Troubleshooting

### Redis Connection Failed

```bash
# Check if Redis is running
redis-cli ping

# Restart Redis
brew services restart redis
```

### PostgreSQL Connection Failed

```bash
# Check if PostgreSQL is running
pg_isready

# Restart PostgreSQL
brew services restart postgresql@15

# Check if database exists
psql -l | grep frontier
```

### FFmpeg Not Found

```bash
# Reinstall FFmpeg
brew reinstall ffmpeg

# Check PATH
which ffmpeg
```

### Worker Not Processing Jobs

1. Check Redis connection
2. Ensure worker is running (`npm run worker:dev`)
3. Check worker logs for errors
4. Verify API keys are correct

### Video Generation Fails

1. Check if all API keys are set in `.env`
2. Verify asset folders have files
3. Check `output/` and `temp/` directories exist and are writable
4. Review worker logs for specific errors

### Cloudflare Tunnel Not Working

```bash
# Check tunnel status
cloudflared tunnel list

# Test tunnel locally
cloudflared tunnel run frontier --url http://localhost:9999

# Check logs
tail -f /tmp/cloudflared.err.log
```

---

## Quick Start Checklist

- [ ] Node.js v18+ installed
- [ ] PostgreSQL running
- [ ] Redis running
- [ ] FFmpeg installed
- [ ] `.env` file configured with all API keys
- [ ] Asset folders created and populated
- [ ] Database migrated (`npx prisma db push`)
- [ ] Database seeded (`npm run db:seed`)
- [ ] Web server running (`npm run dev`)
- [ ] Worker running (`npm run worker:dev`)
- [ ] (Optional) Cloudflare Tunnel configured

---

## Support

For issues or questions:
- Check the troubleshooting section above
- Review worker logs for detailed error messages
- Open an issue on GitHub
