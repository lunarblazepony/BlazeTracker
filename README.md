# BlazeTracker 🔥

A SillyTavern extension that uses LLM analysis to track and maintain scene state across roleplay conversations. Helps AI models stay consistent with physical positions, outfits, time of day, mood, and narrative tension.

## Examples

### Compact View

![./img/screenshot.png]

### Detailed View

![./img/detailed_screenshot.png]

## Features

### Scene State Tracking
- **Time**: Hour, minute, day of week
- **Location**: Area, place, position, nearby props
- **Climate**: Weather and temperature
- **Characters**: Position, activity, mood, goals, physical state, outfit (head, jacket, torso, legs, underwear, socks, footwear), and dispositions toward other characters

### Scene Context
- **Topic**: What the scene is about (3-5 words)
- **Tone**: Emotional quality of the scene (2-3 words)
- **Tension**: 
  - Level: relaxed → aware → guarded → tense → charged → volatile → explosive
  - Direction: escalating, stable, or decreasing
  - Type: confrontation, intimate, vulnerable, celebratory, negotiation, suspense, conversation
- **Recent Events**: Up to 5 significant events affecting the narrative (secrets discovered, injuries, intimacy changes, etc.)

### Smart Extraction
- Extracts state changes from messages using your configured LLM
- Delta-based updates - only changes what actually changed
- Grounded in character cards and lorebook for accuracy
- Swipe-aware storage - each swipe maintains its own state

### Context Injection
- Automatically injects current scene state into the prompt
- Helps the AI maintain consistency without manual reminders

### Visual Display
- Inline state display below each message
- Tension visualized with icons (☕ relaxed, 👁 aware, 🛡 guarded, 😬 tense, ⚡ charged, 🔥 volatile, 💥 explosive)
- Direction indicators (📈 escalating, ➖ stable, 📉 decreasing)
- Expandable details for characters and props
- Loading indicator during extraction

### Manual Editing
- Full state editor UI
- Edit any field: time, location, characters, outfits, tension, events
- Add/remove characters and dispositions

## Installation

### Requirements
- SillyTavern 1.12.0 or later
- Git installed on your system

### Install via SillyTavern
1. Open SillyTavern
2. Go to **Extensions** → **Install Extension**
3. Paste the repository URL:
   ```
   https://github.com/yourusername/BlazeTracker
   ```
4. Click **Install**
5. Reload SillyTavern

### Manual Installation
1. Navigate to your SillyTavern installation
2. Go to `data/<user>/extensions/` (or `public/scripts/extensions/third-party/` for all users)
3. Clone the repository:
   ```bash
   git clone https://github.com/yourusername/BlazeTracker
   ```
4. Restart SillyTavern

## Configuration

Open the BlazeTracker settings panel in SillyTavern's Extensions menu.

### Connection Profile
- You will need to choose a connection profile to use BlazeTracker
- The easiest way to get a connection profile is to go to the connection menu, then at the top, press the 'Add' button, it will auto-populate the chat template etc from your current settings.
- **IMPORTANT**: Make sure to uncheck 'Start reply with' if you have it set up for your roleplays.
- You will need to refresh the page after creating a Connection Profile for it to show up in the Extensions settings.

### Auto-Extraction Mode
- **Off**: Manual extraction only (click 🔥 button)
- **Responses**: Auto-extract after AI messages
- **Inputs**: Auto-extract after your messages
- **Both**: Auto-extract after all messages

### Extraction Settings
- **Temperature**: Controls creativity of extraction (default 0.4, lower = more deterministic)
- **Model**: Override which model to use for extraction (optional)

## Usage

### Automatic Mode
With auto-extraction enabled, state is extracted after each message. A loading indicator shows while extraction is in progress.

#### Note: Manual Editing
I usually like to edit the state after the first assistant message, since it will make a bunch of assumptions that may or not be true for your roleplay. This isn't required, but setting the initial state manually will help to keep the roleplay coherent.

### Manual Mode
1. Click the 🔥 button in the '...' menu on any message to extract state
2. Click the ✏️ button in the '...' menu to manually edit state

### Swipes
Each swipe maintains its own state. When you swipe to a new response, BlazeTracker will:
1. Show the existing state if previously extracted
2. Auto-extract if enabled and no state exists
3. Update the injected context to match the current swipe

## How It Works

1. **Extraction**: When triggered, BlazeTracker sends recent messages plus the previous state to your LLM with a structured extraction prompt
2. **Delta Processing**: The LLM returns only what changed, which is merged with the previous state
3. **Storage**: State is stored in `message.extra.blazetracker` for each message/swipe
4. **Injection**: The most recent state is formatted and injected into the prompt context
5. **Display**: React components render the state inline with each message

## Building from Source

```bash
# Clone the repository
git clone https://github.com/yourusername/BlazeTracker
cd BlazeTracker

# Install dependencies
npm install

# Build
npm run build

# Output appears in dist/
```

## Troubleshooting

### State not extracting
- Check that your API is connected and working
- Check browser console for errors

### Old state showing after swipe
- This is usually a timing issue - state should update within a moment
- Try clicking the extract button manually

### Extension not appearing
- Ensure you have the latest SillyTavern version
- Check that the extension is enabled in Extensions → Manage Extensions

## License

Copyright (c) 2026 Lunar Blaze

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.

## Contributing

Contributions welcome! Please open an issue or PR on GitHub.

## Acknowledgements

- [SillyTavern](https://github.com/SillyTavern/SillyTavern) team for the extensible platform
- [WTracker](https://github.com/bmen25124/SillyTavern-WTracker) for exposing me to the idea of a tracker
- Font Awesome for icons
