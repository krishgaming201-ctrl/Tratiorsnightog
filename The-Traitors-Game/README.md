# 🏰 The Traitors — Realtime Social Deduction Companion App 2.0

An upgraded, feature-packed in-person event game manager inspired by the hit reality TV show **"The Traitors"**.

---

## 🌟 Naye & Powerful Features (Upgraded)

1. **🔒 Master Host PIN Protection**:
   - `/admin` aur `/secret-admin` par secure passcode wall (`PIN: 1337`). Players roles dekh kar cheat nahi kar sakte.

2. **👤 Player Profiles & Sigils**:
   - Player Name + Player Number + Custom Castle Sigil (🗡️, 🐺, 🏰, 🦅, 🐍, 👑, 🕯️, 🗝️).
   - LocalStorage me state securely persist rehti hai.

3. **🗳️ Real-Time Round Table Banishment (In-App Voting)**:
   - Host phone ya laptop se "Start Council Vote" trigger karta hai.
   - Har player ke phone par voting chamber khul jata hai jisme alive suspects ke cards aate hain.
   - Secret vote cast hone ke baad host "Reveal Votes" click karke live animated vote tally bar dekh sakta hai!
   - Banished player ka identity reveal aur elimination.

4. **🗡️ Night Murder Phase (Secret Traitors' Turret)**:
   - Host "Initiate Night Phase" trigger karta hai.
   - **Innocents/Faithfuls**: Screen par candle flicker karta hai aur "Go to sleep, Faithful. Pray that you awaken at breakfast..." message aata hai.
   - **Traitors**: Secret cloaked turret screen open hoti hai jisme:
     - **Encrypted Traitor Chat**: Traitors aapas me privately whisper kar sakte hain.
     - **Murder Target Selector**: Traitors vote karke ek innocent ko target karte hain.

5. **🛡️ The Armory & Shield Protection**:
   - Players ko Host shield award kar sakta hai.
   - Shielded player par Traitors ka night murder attack beasar ho jata hai!

6. **⏱️ Synced Castle Countdown Timer**:
   - Host 1m, 3m, 5m, 10m ya custom timer set kar sakta hai.
   - Sabhi players ke phone par realtime me timer sync hota hai aur 30 seconds bachne par heartbeat pulse aur crimson glow karta hai.

7. **🤝 Round 3 Dilemma (Trust or Betray)**:
   - Pairs bante hain aur dono players ke screen par interactive 🤝 **TRUST** aur 🗡️ **BETRAY** buttons aate hain.
   - Host ke reveal karte hi Prisoner's Dilemma logic se winner/eliminated decide hota hai.

8. **🔊 Built-In Gothic Web Audio Engine**:
   - Zero external audio files/downloads required! Pure procedural synthesis:
     - Deep Gothic Cathedral Bell Toll
     - Council Bronze Gong
     - Heartbeat countdown ticks
     - Elimination death toll
     - Victory royal fanfare
     - Mute/Unmute sound switch

9. **📱 Easy Join & QR / Local Network Play**:
   - Local Wi-Fi network par sabhi dost apne phones se connect kar sakte hain:
     - Player Portal: `http://<YOUR_IP>:3000/`
     - Host Dashboard: `http://<YOUR_IP>:3000/secret-admin` (PIN: `1337`)

---

## 🚀 How to Run (Kaise Chalayein)

### Option 1: 1-Click Launch (Windows)
Project folder me `start.bat` par double click karein!

### Option 2: Command Line
```powershell
# Open terminal inside the traitors-game folder
node server.js
```
*(Antigravity Node runtime se chalane ke liye `start.bat` use karein)*

Server start hote hi browser me open karein:
- **Players**: `http://localhost:3000/`
- **Host**: `http://localhost:3000/secret-admin` (PIN: `1337`)
