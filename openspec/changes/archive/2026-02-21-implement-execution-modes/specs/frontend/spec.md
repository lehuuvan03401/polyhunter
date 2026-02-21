# Spec: Frontend Execution Modes UI

## ADDED Requirements

### Requirement: Mode Selection Interface
- **REQ-UI-001**: The Copy Trading setup UI MUST allow users to choose between modes.
    - **Switch/Toggle**: "🛡️ Security Mode (Proxy)" vs "⚡ Speed Mode (Direct)".
    - **Visual Cues**: Speed mode should highlight "Highest Speed" but warn about "Custodial Risk".

#### Scenario: Switching to Speed Mode
- **Given** the user is on the Copy Trading setup page.
- **When** they select "Speed Mode".
- **Then** the UI MUST reveal a secured Private Key input field and hide the "Deploy Proxy" logic/button if applicable (or just strictly require the key).

### Requirement: Private Key Input
- **REQ-UI-002**: The UI MUST accept validated input for Ethereum Private Keys.
    - **Validation**: MUST be 64 hex characters (with or without `0x`).
    - **Security**: Input type `password`. Never displayed in plain text after entry.

#### Scenario: Submitting Speed Mode Config
- **Given** the user enters a valid private key.
- **When** they click "Save".
- **Then** the key is sent securely (HTTPS) to the backend API, where it MUST be encrypted and stored.
