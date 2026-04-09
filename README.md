# NovaClaw

Personal AI Agent for Telegram powered by Claude.

## Features

- 5 core skills: browser, shell, files, code execution, HTTP API
- SQLite database for memory and sessions
- Whitelist authentication
- Rate limiting and security protections

## Requirements

- Node.js 18+
- Git
- Python (for code execution skill)

## Installation

### Quick Install (Windows)

```powershell
git clone https://github.com/YOUR_USERNAME/novaclaw.git
cd novaclaw
powershell -ExecutionPolicy Bypass -File install.ps1
```

### Manual Install

```bash
git clone https://github.com/YOUR_USERNAME/novaclaw.git
cd novaclaw
npm install          # Installs deps + builds + installs Playwright
npm link             # Makes 'novaclaw' command available globally
```

## Usage

```bash
# Configure (interactive wizard)
novaclaw setup

# Start the agent
novaclaw start

# Check status
novaclaw status
```

## Telegram Commands

- `/start` - Welcome message
- `/status` - Agent status
- `/skills` - List available skills
- `/model` - Change Claude model
- `/reset` - Reset conversation
- `/admin` - Admin commands (owner only)

## Configuration

The `novaclaw setup` command creates a `.env` file with:

- `TELEGRAM_BOT_TOKEN` - From @BotFather
- `TELEGRAM_OWNER_ID` - Your Telegram user ID
- `TELEGRAM_ALLOWED_IDS` - Comma-separated allowed user IDs
- `CLAUDE_MODEL` - Default model (e.g., claude-sonnet-4-6)
- `DEFAULT_LANGUAGE` - fr or en

## Security

- Whitelist-only access
- Rate limiting (30 msg/min)
- Shell command allowlist
- Code execution restrictions
- SSRF protection on HTTP requests
- Audit logging

## License

MIT
