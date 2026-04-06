# Airtype

> Speak and it types. Hands-free voice transcription for macOS.

```
     █████╗ ██╗██████╗ ████████╗██╗   ██╗██████╗ ███████╗
    ██╔══██╗██║██╔══██╗╚══██╔══╝╚██╗ ██╔╝██╔══██╗██╔════╝
    ███████║██║██████╔╝   ██║    ╚████╔╝ ██████╔╝█████╗
    ██╔══██║██║██╔══██╗   ██║     ╚██╔╝  ██╔═══╝ ██╔══╝
    ██║  ██║██║██║  ██║   ██║      ██║   ██║     ███████╗
    ╚═╝  ╚═╝╚═╝╚═╝  ╚═╝   ╚═╝      ╚═╝   ╚═╝     ╚══════╝
```

Press a shortcut. Speak. It transcribes, polishes, and pastes — into any app.

## Features

- **Toggle recording** — press shortcut to start, press again to stop
- **Smart formatting** — hesitation clearing, auto numbered lists, email format
- **Global shortcut** — works from any app (Terminal, VS Code, Chrome, etc.)
- **Live speech bar** — see your mic level in real-time
- **Auto paste** — result goes straight to your cursor
- **Fast** — under 2 seconds total
- **No API keys needed** — runs through a secure server proxy

## Install

```bash
# Prerequisites
brew install sox switchaudio-osx
curl -fsSL https://bun.sh/install | bash

# Install airtype
bun add -g @superdots/airtype
```

## Usage

```bash
airtype          # run (first time → onboarding)
airtype --setup  # redo settings
```

1. Press your shortcut → recording starts (sound plays)
2. Speak naturally
3. Press again → processes and pastes into active app

## Smart Formatting

| You say | Airtype types |
|---------|--------------|
| "Um so I think... no wait... we need to fix the bug" | We need to fix the bug. |
| "First update docs second fix bug third deploy" | 1. Update docs. 2. Fix bug. 3. Deploy. |
| "Dear Michael new line follow up period Regards Chris" | Dear Michael,\nFollow up.\nRegards, Chris |

## Daemon Mode Keys

- `S` — settings menu (shortcut, mic, auto-enter)
- `E` — toggle auto-enter ON/OFF

## Requirements

macOS · Bun · sox · SwitchAudioSource · Accessibility permission

## License

Proprietary. See [LICENSE](LICENSE) for details.
